export interface AIReplyContext {
  businessName: string;
  employeeName: string;
  greetingMessage: string;
  knowledgeNotes: string;
  customerMessage: string;
  /**
   * Optional recent conversation turns (oldest first) so a provider can take
   * prior context into account without persisting anything. Callers that have
   * no history simply omit it, which keeps every existing path unchanged.
   */
  recentMessages?: string[];
}

export interface AIProvider {
  readonly name: string;
  generateReply(context: AIReplyContext): Promise<string>;
}
