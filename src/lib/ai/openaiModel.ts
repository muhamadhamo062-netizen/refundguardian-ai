/**
 * Default chat model for Refyndra “AI Lawyer” paths (disputes, advisory JSON, IMAP letters).
 * Override with OPENAI_MODEL for cost/testing (e.g. gpt-4o-mini).
 */
export function getOpenAiChatModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
