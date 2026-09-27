/**
 * FAQ answers carry {email} and {phone} tokens, so the contact details live in
 * one place (common.email / common.phoneDisplay) and the page can render them
 * as links while the structured data gets plain text.
 */
import type { t } from '../i18n';

type Copy = ReturnType<typeof t>;

/** Splits an answer into text runs and the {email} / {phone} tokens. */
export function answerParts(answer: string): string[] {
  return answer.split(/(\{email\}|\{phone\})/).filter(Boolean);
}

/** The answer as plain text, exactly as a reader sees it on the page. */
export function answerText(answer: string, copy: Copy): string {
  return answer
    .replaceAll('{email}', copy.common.email)
    .replaceAll('{phone}', copy.common.phoneDisplay);
}
