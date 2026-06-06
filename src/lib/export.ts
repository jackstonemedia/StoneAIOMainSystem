/**
 * src/lib/export.ts
 * PDF and JSON export utilities — pure browser APIs, zero external dependencies.
 */

// ── exportToPDF ───────────────────────────────────────────────────────────────
/**
 * Prints a specific DOM element as a "PDF" using the browser's native print dialog.
 * Applies scoped print styles to isolate the target element and hide everything else.
 *
 * @param elementId  - ID of the DOM element to print
 * @param _filename  - Filename hint displayed in the print dialog (browser support varies)
 */
export function exportToPDF(elementId: string, _filename = 'export'): void {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn(`[export] Element #${elementId} not found`);
    return;
  }

  // Clone the element's outer HTML into a print-only iframe
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1200px;height:800px;border:none;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) { document.body.removeChild(iframe); return; }

  // Inject the page styles + element content
  const styles = Array.from(document.styleSheets)
    .map((ss) => {
      try {
        return Array.from(ss.cssRules || []).map((r) => r.cssText).join('\n');
      } catch {
        // Cross-origin stylesheets — skip
        return '';
      }
    })
    .join('\n');

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${_filename}</title>
  <style>
    ${styles}
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; background: white !important; color: #000 !important; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>${el.outerHTML}</body>
</html>`);
  iframeDoc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  };
}

// ── exportToJSON ──────────────────────────────────────────────────────────────
/**
 * Serializes data to a formatted JSON file and triggers a browser download.
 *
 * @param data     - Any JSON-serializable value
 * @param filename - Downloaded filename (without .json extension)
 */
export function exportToJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, `${filename}.json`);
}

// ── exportToCSVFromData ───────────────────────────────────────────────────────
/**
 * Export a pre-formatted 2D table (header row + data rows) as a .csv download.
 * Use when you have data already shaped for CSV (e.g. from a report query).
 *
 * @param headers  - Column header strings
 * @param rows     - Array of row values (same order as headers)
 * @param filename - Downloaded filename (without .csv extension)
 */
export function exportTableToCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  filename: string
): void {
  const escape = (v: string | number | boolean | null | undefined): string => {
    const s = v == null ? '' : String(v);
    return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csvRows = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];

  const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

// ── Helper ────────────────────────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
