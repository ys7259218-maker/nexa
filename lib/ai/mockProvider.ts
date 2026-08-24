import type { AIProvider, AIReplyContext } from "./provider";

const MAX_REPLY_LENGTH = 600;

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generateReply(context: AIReplyContext): Promise<string> {
    const customerMessage = normalize(context.customerMessage);
    const employeeName = normalize(context.employeeName) || "our assistant";
    const businessName = normalize(context.businessName) || "our business";

    let reply: string;

    if (!customerMessage) {
      reply =
        normalize(context.greetingMessage) ||
        `Hi! This is ${employeeName} from ${businessName}. How can I help you today?`;
    } else if (customerMessage.length <= 30 && /^(hi|hello|hey|good\s?(morning|afternoon|evening))[!. ]*$/i.test(customerMessage)) {
      reply =
        normalize(context.greetingMessage) ||
        `Hi! Thanks for reaching out to ${businessName}. This is ${employeeName} — how can I help?`;
    } else {
      reply = `[Mock reply] ${employeeName} at ${businessName} received your message and will follow up with details shortly.`;
    }

    return reply.slice(0, MAX_REPLY_LENGTH);
  }
}
