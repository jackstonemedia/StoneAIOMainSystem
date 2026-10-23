/**
 * Utilities for cleaning quoted reply headers and forwarded history from email bodies.
 */

/**
 * Strips quoted reply history and headers from plain-text email bodies.
 */
export function stripQuotedReply(text: string): string {
  if (!text) return '';
  let clean = text;

  // 1. Cut off at "On <date> ... <email> wrote:" (greedy to end of string)
  clean = clean.replace(/(?:\r?\n|^)\s*On\s+[\s\S]+?(?:wrote|wrote:)\s*[\s\S]*$/i, '');

  // 2. Cut off at Outlook original message marker
  clean = clean.replace(/(?:\r?\n|^)\s*-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i, '');

  // 3. Cut off at Outlook header block (From: ... Sent: ... To: ... Subject: ...)
  clean = clean.replace(/(?:\r?\n|^)\s*From:\s*.+?(?:\r?\n)(?:Sent|Date):\s*.+?(?:\r?\n)(?:To|Subject):[\s\S]*$/i, '');

  // 4. Filter out any remaining lines that start with '>' (quoted lines)
  clean = clean
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('>'))
    .join('\n');

  return clean.trim();
}

/**
 * Strips quoted reply containers from HTML email bodies.
 */
export function stripQuotedReplyHtml(html: string): string {
  if (!html) return '';
  let clean = html;

  // Gmail quote container and attribution
  clean = clean.replace(/<div[^>]*class=["'][^"']*gmail_quote[^"']*["'][\s\S]*$/i, '');
  clean = clean.replace(/<div[^>]*class=["'][^"']*gmail_attr[^"']*["'][\s\S]*$/i, '');

  // Any blockquotes
  clean = clean.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');

  // Outlook / other webmail quote containers
  clean = clean.replace(/<div[^>]*id=["'](?:appendonsend|divRplyFwdMsg)["'][\s\S]*$/i, '');

  return clean.trim();
}
