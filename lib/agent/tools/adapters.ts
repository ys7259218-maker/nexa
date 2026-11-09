import { ToolError } from "./errors.ts";
import { sha256Hex } from "./hash.ts";
import {
  toolAdapterKey,
  type ToolAdapter,
  type ToolAdapters,
} from "./types.ts";

/**
 * Deterministic B2 adapters. Every adapter is injectable and mock-only:
 * - no `node:fs`, `fetch`, HTTP client, provider SDK, OAuth, or calendar API;
 * - no real file, URL, or event is read;
 * - outputs are content-free or use reserved `.invalid` hosts.
 */

export type CalendarReadGate = {
  canRead(): boolean;
};

const DEFAULT_MAX_BYTES = 65_536;
const MAX_BYTES_LIMIT = 1_048_576;
const MAX_WEB_RESULTS = 10;
const MAX_CALENDAR_RESULTS = 50;
const CALENDAR_ID_PATTERN = /^[A-Za-z0-9._+@-]{3,255}$/;

function requireText(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ToolError("VALIDATION", code);
  }
  return value;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  code: string,
): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new ToolError("VALIDATION", code);
  }
  return value;
}

export function createMockFileReadAdapter(): ToolAdapter {
  return async (input) => {
    const path = requireText(input.path, "invalid_path");
    const maxBytes = boundedInteger(
      input.maxBytes,
      DEFAULT_MAX_BYTES,
      1,
      MAX_BYTES_LIMIT,
      "invalid_max_bytes",
    );

    return {
      path,
      contentHash: sha256Hex(`mock-file:${path}`),
      byteLength: Math.min(maxBytes, Math.max(1, path.length * 17)),
      mediaType: "text/plain",
    };
  };
}

export function createMockWebResearchAdapter(): ToolAdapter {
  return async (input) => {
    const query = requireText(input.query, "invalid_query");
    const maxResults = boundedInteger(
      input.maxResults,
      3,
      1,
      MAX_WEB_RESULTS,
      "invalid_max_results",
    );

    return {
      queryHash: sha256Hex(query),
      results: Array.from({ length: maxResults }, (_, index) => ({
        title: `Mock research result ${index + 1}`,
        url: `https://example.invalid/research/${index + 1}`,
        snippetHash: sha256Hex(`${query}:${index + 1}`),
      })),
    };
  };
}

/**
 * Calendar reads are denied unless the caller injects an open gate. The
 * production wiring will pass the existing calendar gate; B2 passes a closed
 * gate by default so an accidental call cannot look like a live read.
 */
export function createMockCalendarReadAdapter(
  options: {
    gate?: CalendarReadGate;
    calendarId?: string;
  } = {},
): ToolAdapter {
  const gate = options.gate ?? { canRead: () => false };
  const calendarId = options.calendarId ?? "mock-calendar";

  return async (input) => {
    if (!gate.canRead()) {
      throw new ToolError("PERMISSION", "calendar_gate_closed");
    }

    if (!CALENDAR_ID_PATTERN.test(calendarId)) {
      throw new ToolError("INTERNAL", "invalid_calendar_id");
    }

    const timeMin = requireText(input.timeMin, "invalid_time_min");
    const timeMax = requireText(input.timeMax, "invalid_time_max");
    const minMs = Date.parse(timeMin);
    const maxMs = Date.parse(timeMax);
    if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) {
      throw new ToolError("VALIDATION", "invalid_time_window");
    }

    const maxResults = boundedInteger(
      input.maxResults,
      3,
      1,
      MAX_CALENDAR_RESULTS,
      "invalid_max_results",
    );

    return {
      calendarId,
      events: Array.from({ length: maxResults }, (_, index) => ({
        eventId: `mock-event-${index + 1}`,
        startsAt: new Date(minMs).toISOString(),
        endsAt: new Date(maxMs).toISOString(),
        summaryHash: sha256Hex(`${calendarId}:${index + 1}`),
      })),
    };
  };
}

export function createMockToolAdapters(
  options: {
    calendarGate?: CalendarReadGate;
  } = {},
): ToolAdapters {
  return {
    [toolAdapterKey("workspace.file.read", "1.0.0")]:
      createMockFileReadAdapter(),
    [toolAdapterKey("web.research.search", "1.0.0")]:
      createMockWebResearchAdapter(),
    [toolAdapterKey("calendar.events.read", "1.0.0")]:
      createMockCalendarReadAdapter({
        gate: options.calendarGate ?? { canRead: () => false },
      }),
  };
}
