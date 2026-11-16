import { createHash } from "node:crypto";
import { hashJson } from "../tools/hash.ts";

/**
 * Evidence capture (draft scope C3, matrix EV-01 … EV-05).
 *
 * Only descriptors are written to the database. Bytes go to workspace-scoped
 * sandbox storage, which this module reaches only through an injected store.
 * A descriptor never contains page content, only a pointer and content hashes.
 * If the write fails the action is a failure; nothing reports success without
 * evidence.
 */

export const EVIDENCE_PHASES = ["before", "after"] as const;

export type EvidencePhase = (typeof EVIDENCE_PHASES)[number];

export type EvidencePayload = Readonly<{
  screenshot: Uint8Array;
  dom: Uint8Array;
}>;

export type EvidenceDescriptor = Readonly<{
  id: string;
  workspaceId: string;
  taskId: string;
  sessionId: string;
  phase: EvidencePhase;
  url: string;
  capturedAt: string;
  screenshotHash: string;
  domHash: string;
  pointer: string;
}>;

export type EvidenceWriteResult =
  | { ok: true; pointer: string }
  | { ok: false; reason: string };

export type EvidenceDeleteResult =
  | { ok: true; deleted: number }
  | { ok: false; reason: string };

export interface EvidenceStore {
  put(descriptor: EvidenceDescriptor, payload: EvidencePayload): Promise<EvidenceWriteResult>;
  listByTask(taskId: string): Promise<readonly EvidenceDescriptor[] | null>;
  deleteByTask(taskId: string): Promise<EvidenceDeleteResult>;
}

export type InMemoryEvidenceStore = EvidenceStore & {
  payloadFor(pointer: string): EvidencePayload | null;
  objectCount(): number;
  descriptorBytes(): number;
};

export class BrowserEvidenceError extends Error {
  readonly code = "evidence_write_failed" as const;

  constructor(message = "evidence write failed") {
    super(message);
    this.name = "BrowserEvidenceError";
  }
}

export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createInMemoryEvidenceStore(): InMemoryEvidenceStore {
  const objects = new Map<string, EvidencePayload>();
  const byTask = new Map<string, EvidenceDescriptor[]>();

  return {
    async put(descriptor, payload) {
      if (objects.has(descriptor.pointer)) {
        return { ok: false, reason: "pointer_collision" };
      }
      objects.set(descriptor.pointer, payload);
      const list = byTask.get(descriptor.taskId) ?? [];
      list.push(descriptor);
      byTask.set(descriptor.taskId, list);
      return { ok: true, pointer: descriptor.pointer };
    },
    async listByTask(taskId) {
      return Object.freeze([...(byTask.get(taskId) ?? [])]);
    },
    async deleteByTask(taskId) {
      const list = byTask.get(taskId) ?? [];
      for (const descriptor of list) objects.delete(descriptor.pointer);
      byTask.delete(taskId);
      return { ok: true, deleted: list.length };
    },
    payloadFor(pointer) {
      return objects.get(pointer) ?? null;
    },
    objectCount() {
      return objects.size;
    },
    descriptorBytes() {
      let total = 0;
      for (const list of byTask.values()) {
        for (const descriptor of list) {
          total += Buffer.byteLength(JSON.stringify(descriptor), "utf8");
        }
      }
      return total;
    },
  };
}

export type CaptureEvidenceInput = Readonly<{
  workspaceId: string;
  taskId: string;
  sessionId: string;
  phase: EvidencePhase;
  url: string;
  capturedAt: string;
  payload: EvidencePayload;
}>;

function evidenceId(input: CaptureEvidenceInput): string {
  const digest = hashJson({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    sessionId: input.sessionId,
    phase: input.phase,
    url: input.url,
    capturedAt: input.capturedAt,
    screenshotHash: hashBytes(input.payload.screenshot),
    domHash: hashBytes(input.payload.dom),
  });
  return `ev_${input.phase}_${digest.slice(0, 24)}`;
}

export function buildEvidenceDescriptor(
  input: CaptureEvidenceInput,
): EvidenceDescriptor {
  const id = evidenceId(input);
  return Object.freeze({
    id,
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    sessionId: input.sessionId,
    phase: input.phase,
    url: input.url,
    capturedAt: input.capturedAt,
    screenshotHash: hashBytes(input.payload.screenshot),
    domHash: hashBytes(input.payload.dom),
    pointer: `sandbox://evidence/${input.workspaceId}/${input.taskId}/${id}`,
  });
}

/**
 * Fail closed: a failed sandbox write is an error, never a "success without
 * evidence". The caller turns this into a typed action failure.
 */
export async function captureEvidence(
  store: EvidenceStore,
  input: CaptureEvidenceInput,
): Promise<EvidenceDescriptor> {
  const descriptor = buildEvidenceDescriptor(input);
  const written = await store.put(descriptor, input.payload);
  if (!written.ok) {
    throw new BrowserEvidenceError(written.reason);
  }
  return descriptor;
}

export async function deleteTaskEvidence(
  store: EvidenceStore,
  taskId: string,
): Promise<number> {
  const result = await store.deleteByTask(taskId);
  if (!result.ok) {
    throw new BrowserEvidenceError(result.reason);
  }
  return result.deleted;
}
