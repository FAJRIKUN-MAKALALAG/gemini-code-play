/**
 * notebookContext.ts
 *
 * Builds a hidden context block injected into every AI Chat message so that
 * the AI is always aware of what is written (and executed) in the notebook.
 *
 * The context is appended to the user's message ONLY for the AI API call.
 * The chat UI still shows the user's original clean message.
 */

export interface CellSnapshot {
  /** 1-based displayed index */
  index: number;
  code: string;
  outputs: Array<{ type: "stdout" | "stderr"; text: string }>;
  executionCount: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatOutput(outputs: CellSnapshot["outputs"], maxChars = 400): string {
  const text = outputs.map(o => o.text).join("").trim();
  if (!text) return "(belum dijalankan / tidak ada output)";
  const hasError = outputs.some(o => o.type === "stderr");
  const truncated = text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
  return hasError ? `[ERROR]\n${truncated}` : truncated;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Build notebook context to inject into the AI prompt.
 *
 * @param userMessage  The raw message typed by the user in AI Chat.
 * @param cells        Snapshot of all notebook cells.
 * @returns            A markdown-formatted context block, or empty string if
 *                     there are no filled cells.
 */
export function buildContext(
  userMessage: string,
  cells: CellSnapshot[]
): string {
  // Filter to cells that have code
  const filledCells = cells.filter(c => c.code.trim().length > 0);
  if (filledCells.length === 0) return "";

  // ── Check if user mentions a specific cell, e.g. "cell 2", "Cell 3"
  const match = userMessage.match(/\bcell\s*(\d+)\b/i);
  const cellNumber = match ? parseInt(match[1], 10) : null;

  let contextBody = "";

  if (cellNumber !== null) {
    // ── Specific cell requested ──────────────────────────────────────────────
    const cell = filledCells.find(c => c.index === cellNumber);
    if (!cell) {
      // Cell number not found — return gentle note
      return `\n\n---\n> **[Notebook Context]** User menyebut Cell ${cellNumber}, tapi cell tersebut kosong atau tidak ada.\n---`;
    }

    contextBody = [
      `**[Notebook — Cell ${cell.index}]**`,
      "```python",
      cell.code.trimEnd(),
      "```",
      `**Output:**`,
      "```",
      formatOutput(cell.outputs),
      "```",
    ].join("\n");

  } else {
    // ── All filled cells ─────────────────────────────────────────────────────
    const cellBlocks = filledCells.map(cell => {
      const exec = cell.executionCount !== null ? ` [${cell.executionCount}]` : "";
      return [
        `**Cell ${cell.index}${exec}:**`,
        "```python",
        cell.code.trimEnd(),
        "```",
        "**Output:** `" + formatOutput(cell.outputs, 300) + "`",
      ].join("\n");
    });

    contextBody = [
      `**[Notebook Context — ${filledCells.length} cell(s)]**`,
      "",
      cellBlocks.join("\n\n"),
    ].join("\n");
  }

  return `\n\n---\n${contextBody}\n---`;
}
