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
