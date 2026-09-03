import { MockAIProvider } from "./ai/mockProvider.ts";
import type { AIReplyContext } from "./ai/provider.ts";
import type { AIEmployee } from "./aiEmployees.ts";
import {
  findVerifiedFaqAnswer,
  formatVerifiedKnowledge,
  type KnowledgeEntry,
} from "./knowledgeEntries.ts";
import {
  SANDBOX_INPUT_MAX_LENGTH,
  SANDBOX_OUTPUT_MAX_LENGTH,
  SANDBOX_PROVIDER_LABEL,
  SANDBOX_VERIFIED_KNOWLEDGE_LABEL,
  SANDBOX_MEMORY_MAX_TURNS,
  SANDBOX_MEMORY_TURN_MAX_LENGTH,
} from "./employeeSandboxContract.ts";

export {
  SANDBOX_INPUT_MAX_LENGTH,
  SANDBOX_OUTPUT_MAX_LENGTH,
  SANDBOX_PROVIDER_LABEL,
  SANDBOX_VERIFIED_KNOWLEDGE_LABEL,
};

export type SandboxEmployee = Pick<
  AIEmployee,
  | "name"
  | "business_name"
  | "greeting_message"
  | "knowledge_notes"
>;

export type SandboxRunResult =
  | {
      ok: true;
      customerMessage: string;
      provider: typeof SANDBOX_PROVIDER_LABEL | typeof SANDBOX_VERIFIED_KNOWLEDGE_LABEL;
      reply: string;
      recalledTurns?: number;
    }
  | { ok: false; error: string };

function boundContextValue(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function parseSandboxRecentMessages(input: unknown): string[] {
  if (typeof input !== "string" || input.trim() === "") {
    return [];
  }

  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .slice(0, SANDBOX_MEMORY_MAX_TURNS)
    .map((line) => line.slice(0, SANDBOX_MEMORY_TURN_MAX_LENGTH));
}

export function isValidSandboxEmployeeId(input: unknown): input is string {
  return (
    typeof input === "string" &&
    input.length <= 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input,
    )
  );
}

export function validateSandboxCustomerMessage(
  input: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof input !== "string") {
    return { ok: false, error: "Enter a simulated customer message." };
  }

  if (input.length > SANDBOX_INPUT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Customer message must be at most ${SANDBOX_INPUT_MAX_LENGTH} characters.`,
    };
  }

  const value = input.trim();

  if (!value) {
    return { ok: false, error: "Enter a simulated customer message." };
  }

  return { ok: true, value };
}

export function buildEmployeeSandboxContext(
  employee: SandboxEmployee,
  customerMessage: string,
  knowledgeEntries: KnowledgeEntry[] = [],
  structuredKnowledgeOnly = false,
  recentMessages: string[] = [],
): AIReplyContext {
  const structured = formatVerifiedKnowledge(knowledgeEntries);
  const legacyNotes = structuredKnowledgeOnly
    ? ""
    : boundContextValue(employee.knowledge_notes, 500);
  const knowledgeNotes = [legacyNotes, structured]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4_000);

  return {
    employeeName: boundContextValue(employee.name, 100),
    businessName: boundContextValue(employee.business_name, 160),
    greetingMessage: boundContextValue(employee.greeting_message, 500),
    knowledgeNotes,
    customerMessage: customerMessage.slice(0, SANDBOX_INPUT_MAX_LENGTH),
    ...(recentMessages.length > 0 ? { recentMessages } : {}),
  };
}

/**
 * This sandbox deliberately constructs the deterministic mock directly.
 * It never reads provider configuration and never persists or sends output.
 */
export async function runEmployeeSandbox(
  employee: SandboxEmployee,
  input: unknown,
  knowledgeEntries: KnowledgeEntry[] = [],
  structuredKnowledgeOnly = false,
  recentMessages: string[] = [],
): Promise<SandboxRunResult> {
  const validation = validateSandboxCustomerMessage(input);

  if (!validation.ok) {
    return validation;
  }

  const verifiedAnswer = findVerifiedFaqAnswer(knowledgeEntries, validation.value);
  if (verifiedAnswer) {
    return {
      ok: true,
      customerMessage: validation.value,
      provider: SANDBOX_VERIFIED_KNOWLEDGE_LABEL,
      reply: verifiedAnswer.slice(0, SANDBOX_OUTPUT_MAX_LENGTH),
      recalledTurns: 0,
    };
  }

  const provider = new MockAIProvider();

  try {
    const generated = await provider.generateReply(
      buildEmployeeSandboxContext(
        employee,
        validation.value,
        knowledgeEntries,
        structuredKnowledgeOnly,
        recentMessages,
      ),
    );
    const reply = generated.trim().slice(0, SANDBOX_OUTPUT_MAX_LENGTH);

    if (!reply) {
      return {
        ok: false,
        error: "The safe simulation did not produce a draft. Try again.",
      };
    }

    return {
      ok: true,
      customerMessage: validation.value,
      provider: SANDBOX_PROVIDER_LABEL,
      reply,
      recalledTurns: recentMessages.length,
    };
  } catch {
    return {
      ok: false,
      error: "The safe simulation could not generate a draft. Try again.",
    };
  }
}
