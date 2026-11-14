// Maps the OLD agent's tool names (used by the 142 eval cases'
// expectations) to the NEW assistant's tool names, for the scored eval
// of the shipping assistant (Blueprint 3 Phase 4).
//
// Most names survived the rewrite unchanged. Only the renames live here;
// anything not listed maps to itself.
export const TOOL_NAME_MAP: Record<string, string> = {
  create_appointment: 'book_appointment',
};

/**
 * Old tool names with NO equivalent in the new registry. Cases expecting
 * these fail the queuedTools check honestly — they are capability gaps
 * in the shipping product, not harness bugs, and the run report must
 * name them as such.
 *
 * (Eval-gap pass 2026-11-14: update_deal and send_campaign were built, so
 * this map is now empty. It stays as the extension point for future gaps.)
 */
export const UNMAPPABLE_TOOLS: Record<string, string> = {};

export function mapToolName(oldName: string): string {
  return TOOL_NAME_MAP[oldName] ?? oldName;
}
