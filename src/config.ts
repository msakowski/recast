import { getPreferenceValues } from "@raycast/api";

export interface Preferences {
  credentialMethod: "default" | "profile" | "environment";
  awsProfile: string;
  awsRegion: string;
  modelId: string;
  inferenceProfile: string;
  maxTokens: string;
  temperature: string;
  defaultTone: string;
}

export const TONES: Record<string, string> = {
  professional:
    "Rewrite in a professional register: clear, direct, measured. Avoid slang, hedging, and filler. Prefer active voice and concrete language. Do not use words like 'crucial', 'delve', 'landscape', 'pivotal', 'foster', 'showcase', 'underscore', 'highlight', 'vibrant', 'enhance', or 'garner'. Do not inflate significance. State facts plainly.",
  friendly:
    "Rewrite in a warm, approachable tone: conversational but not sloppy. Use natural contractions and shorter sentences. Keep it genuine, not performative. Do not use chatbot artifacts like 'I hope this helps' or 'Let me know if you need anything'. Do not be sycophantic. Just say the thing.",
  concise:
    "Cut length by at least 30%. Remove filler, redundancy, and weak qualifiers. Every sentence must earn its place. Preserve all meaning. Kill filler phrases: 'in order to' becomes 'to', 'due to the fact that' becomes 'because', 'it is important to note that' gets deleted. Remove hedging stacks like 'could potentially possibly'.",
  polished:
    "Improve clarity, flow, and precision. Fix awkward phrasing, tighten transitions, and ensure parallel structure. The result should read as carefully edited prose. Use 'is', 'are', 'has' instead of 'serves as', 'stands as', 'represents a'. Do not force ideas into groups of three. Use the natural number of items needed.",
  neutral:
    "Fix grammar, spelling, and punctuation. Improve clarity where needed. Do not shift the tone. The output should feel like the same author wrote it, just more carefully. Do not add significance inflation, promotional language, or generic conclusions like 'the future looks bright'.",
};

export const SYSTEM_PROMPT = `You are a text rewriting tool. Your job is to improve text while preserving the author's intent and language.

Rules:
- Output ONLY the rewritten text. No preamble, no explanation, no quotation marks wrapping the result.
- Preserve the original language. If the input is German, output German. If Spanish, output Spanish. Never translate unless the user's instruction explicitly asks for it.
- Preserve formatting: if the input uses bullet points, paragraphs, or line breaks, maintain that structure.
- Preserve meaning: do not add information, opinions, or context that wasn't in the original.
- Match the length of the original unless the instruction says otherwise.

Anti-AI rules (apply to ALL rewrites, every tone):
- NEVER use em dashes or en dashes. Use periods, commas, colons, or parentheses instead.
- NEVER use these words: delve, crucial, pivotal, foster, showcase, underscore, highlight, vibrant, enhance, garner, tapestry, landscape (abstract), interplay, intricate, testament, enduring, valuable, additionally.
- Do not inflate significance. No "marking a pivotal moment", "a testament to", "setting the stage for", "key turning point", "evolving landscape", "indelible mark".
- Do not use copula avoidance. Write "is" not "serves as". Write "has" not "boasts" or "features" or "offers" (when "has" works).
- Do not force ideas into groups of three. Use the natural number.
- Do not use negative parallelisms: "It's not just X, it's Y" or "Not only...but also..."
- Do not use promotional language: "groundbreaking", "renowned", "breathtaking", "stunning", "nestled", "in the heart of".
- Do not use filler phrases: "in order to" (write "to"), "due to the fact that" (write "because"), "it is important to note that" (delete), "at this point in time" (write "now").
- Do not use generic conclusions: "the future looks bright", "exciting times lie ahead", "continues their journey toward excellence".
- Do not use chatbot artifacts: "I hope this helps", "Of course!", "Certainly!", "Would you like...", "Let me know".
- Do not use sycophantic language: "Great question!", "That's an excellent point!".
- Do not use signposting: "Let's dive in", "Let's explore", "Here's what you need to know", "Without further ado".
- Do not use persuasive authority tropes: "The real question is", "At its core", "What really matters", "Fundamentally".
- Do not use excessive hedging. "Could potentially possibly" becomes "may".
- Do not cycle synonyms to avoid repetition. Repeat the clearest term when appropriate.
- Do not use superficial -ing chains: "highlighting..., ensuring..., reflecting..., contributing to...".
- Vary sentence length naturally. Short sentences are fine. Not everything needs a subordinate clause.`;

export const USER_TEMPLATE = `<instruction>
{{tone_instruction}}
{{custom_instruction}}
</instruction>

<input>
{{input_text}}
</input>`;

export function getConfig(): Preferences {
  return getPreferenceValues<Preferences>();
}

const PROFILE_PREFIX = /^(global|us|eu|apac|au|jp|us-gov)\./;

/** Model ID to send to Bedrock: the base model ID with the configured inference profile prefix. */
export function resolveModelId(preferences: Preferences): string {
  const base = preferences.modelId.trim().replace(PROFILE_PREFIX, "");
  const profile = preferences.inferenceProfile?.trim() || "global";
  return profile === "none" ? base : `${profile}.${base}`;
}

export function formatModelName(preferences: Preferences): string {
  const profile = preferences.inferenceProfile?.trim() || "global";
  const base = preferences.modelId
    .trim()
    .replace(PROFILE_PREFIX, "")
    .replace(/^anthropic\./, "")
    .replace(/-v\d+:\d+$/, "");
  return profile === "none" ? base : `${base} (${profile})`;
}
