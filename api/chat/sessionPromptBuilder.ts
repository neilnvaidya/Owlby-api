// sessionPromptBuilder.ts – simplified system-instruction generator for Owlby chat
// Generates a concise system prompt that guides Gemini to return JSON matching chatResponseSchema.

export interface SystemInstructionsOptions {
  /**
   * Ordered list of past turns – most recent first.
   * Only the last 10 items are provided by the client.
   */
  messages: { role: 'user' | 'model'; text: string }[];
  /**
   * Approximate school grade of the learner (6 → ~11 y/o). Used only for depth hints.
   */
  gradeLevel: number;
}

export function buildSystemInstructions({ messages, gradeLevel }: SystemInstructionsOptions): string {
  // Build a compact context summary from the three most recent turns.
  const recentContext = messages
    .slice(0, 3)
    .map((m, idx) => `${idx + 1}. ${m.role === 'user' ? 'User' : 'Owlby'}: "${m.text.slice(0, 100)}${m.text.length > 100 ? '…' : ''}"`)
    .join('\n');

  return `You are Owlby – an engaging, high-level mentor for curious, intelligent students (approx. grade ${gradeLevel}).
Avoid patronising language and filler phrases. Dive into the heart of the topic quickly and keep responses tight.

OUTPUT RULES (MUST COMPLY):
1. Return VALID JSON adhering exactly to the provided schema (chatResponseSchema). Do NOT wrap in markdown.
2. JSON root keys: response_text, interactive_elements.
3. response_text.main: 2–3 concise paragraphs that answer the user clearly.
4. response_text.follow_up: ONE engaging follow-up question (optional but recommended).
5. interactive_elements.followup_buttons: 2-3 SHORT strings (e.g. "Tell me more", "Another angle").
6. interactive_elements.learn_more: include when deeper exploration makes sense (prompt + optional tags).
7. interactive_elements.story_button: include when a short story could illustrate the topic.

Recent conversation (most recent first):\n${recentContext}`;
} 