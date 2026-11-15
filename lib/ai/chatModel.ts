/**
 * Phase B B6: Model & inference abstraction — ChatModel contract.
 *
 * ChatModel is an additive refinement of AIProvider: structured message input
 * → structured output with token/usage accounting. The existing draft pipeline
 * keeps AIProvider untouched; this contract is additive and flag-gated.
 *
 * Nothing here calls a model provider, WhatsApp, OAuth, the network, a
 * browser, the filesystem, or any calendar API. All content is bounded and
 * content-free hashes only where applicable.
 */

export type ChatMessageRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
  /** Optional bounded tool call identifier for assistant/tool messages. */
  toolCallId?: string | null;
}

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatCompletionUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  toolCalls: ChatToolCall[];
}

export interface ChatCompletionInput {
  messages: ChatMessage[];
  /** Optional bounded tool schemas for tool-calling models. */
  tools: ChatToolSchema[] | null;
  toolChoice: "none" | "auto" | "required" | null;
  temperature: number | null;
  maxOutputTokens: number | null;
}

export interface ChatToolSchema {
  name: string;
  description: string | null;
  parameters: string; // JSON schema string, bounded
}

export interface ChatCompletionOutput {
  id: string;
  model: string;
  createdAt: number; // epoch ms
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
  systemFingerprint: string | null;
}

export interface ChatModel {
  readonly name: string;
  readonly provider: string;
  complete(input: ChatCompletionInput): Promise<ChatCompletionOutput>;
}

export interface ModelProviderStatus {
  kind: "mock" | "openai" | "openai-compatible" | "unsupported";
  ready: boolean;
  provider: string | null;
}

export function isChatMessageRole(role: unknown): role is ChatMessageRole {
  return (
    role === "system" ||
    role === "user" ||
    role === "assistant" ||
    role === "tool"
  );
}

export function boundedString(
  value: unknown,
  maxLength: number,
): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return s.length > maxLength ? s.slice(0, maxLength) : s;
}

export function boundedToolSchema(
  schema: unknown,
): string {
  if (schema === null || schema === undefined) return "{}";
  const s = String(schema);
  return s.length > 4000 ? s.slice(0, 4000) : s;
}

export function clampTemperature(
  value: number | null,
): number | null {
  if (value === null) return null;
  if (value < 0) return 0;
  if (value > 2) return 2;
  return value;
}

export function clampMaxOutputTokens(
  value: number | null,
): number | null {
  if (value === null) return null;
  if (value < 1) return 1;
  if (value > 4096) return 4096;
  return value;
}

export function emptyChatCompletionOutput(
  model: string,
): ChatCompletionOutput {
  return {
    id: "",
    model,
    createdAt: Date.now(),
    choices: [],
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    systemFingerprint: null,
  };
}
