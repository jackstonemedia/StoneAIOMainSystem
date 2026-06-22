export const TAG_COLORS = ['#FDDFDF', '#FCF7DE', '#DEFDE0', '#DEF3FD', '#F0DEFD'];

export function getTagColor(tagName: string): string {
  if (!tagName) return TAG_COLORS[0];
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  return TAG_COLORS[hash % TAG_COLORS.length];
}
