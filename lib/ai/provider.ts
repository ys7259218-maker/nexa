export interface AIReplyContext {
  businessName: string;
  employeeName: string;
  greetingMessage: string;
  knowledgeNotes: string;
  customerMessage: string;
}

export interface AIProvider {
  readonly name: string;
  generateReply(context: AIReplyContext): Promise<string>;
}

import { MockAIProvider } from "./mockProvider";

export function getAIProvider(): AIProvider {
  const configured = (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase();

  if (configured !== "mock") {
    console.warn(
      `AI_PROVIDER "${configured}" has no implementation yet; falling back to the safe mock provider.`,
    );
  }

  return new MockAIProvider();
}
