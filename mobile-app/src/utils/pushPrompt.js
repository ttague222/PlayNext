export const PUSH_PROMPT_SEEN_KEY = '@playnxt_push_prompt_seen';

/**
 * Whether to show the soft pre-prompt: only once, only after the first accept.
 */
export function shouldShowPushPrompt({ promptSeen, hasAccepted }) {
  return !promptSeen && !!hasAccepted;
}
