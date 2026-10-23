/**
 * Utilities for cleaning quoted email replies and headers on the client.
 */

export function stripQuotedReply(text: string): string {
  if (!text) return '';
  let clean = text;

  // 1. Cut off at "On <date> ... <email> wrote:"
  clean = clean.replace(/(?:\r?\n|^)\s*On\s+[\s\S]+?(?:wrote|wrote:)\s*[\s\S]*$/i, '');

  // 2. Cut off at Outlook original message marker
  clean = clean.replace(/(?:\r?\n|^)\s*-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i, '');

  // 3. Cut off at Outlook header block
  clean = clean.replace(/(?:\r?\n|^)\s*From:\s*.+?(?:\r?\n)(?:Sent|Date):\s*.+?(?:\r?\n)(?:To|Subject):[\s\S]*$/i, '');

  // 4. Filter out lines starting with '>'
  clean = clean
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('>'))
    .join('\n');

  return clean.trim();
}

export function stripQuotedReplyHtml(html: string): string {
  if (!html) return '';
  let clean = html;
  clean = clean.replace(/<div[^>]*class=["'][^"']*gmail_quote[^"']*["'][\s\S]*$/i, '');
  clean = clean.replace(/<div[^>]*class=["'][^"']*gmail_attr[^"']*["'][\s\S]*$/i, '');
  clean = clean.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');
  clean = clean.replace(/<div[^>]*id=["'](?:appendonsend|divRplyFwdMsg)["'][\s\S]*$/i, '');
  return clean.trim();
}
