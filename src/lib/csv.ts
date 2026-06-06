/**
 * src/lib/csv.ts
 * CSV import/export utilities using the browser FileReader API.
 * Zero dependencies — pure browser APIs only.
 */
import type { Contact } from '../types/crm';

// ── parseCSV ──────────────────────────────────────────────────────────────────
/**
 * Parses a CSV File into an array of row objects keyed by column headers.
 * Auto-detects delimiter (comma, semicolon, or tab).
 *
 * @param file - A File object from an <input type="file"> or drag-and-drop event.
 * @returns    - Array of {[header]: value} objects, one per data row.
 */
export function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { resolve([]); return; }

        // Auto-detect delimiter
        const firstLine = lines[0];
        const delimiter =
          (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length
            ? ';'
            : (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length
            ? '\t'
            : ',';

        const headers = parseCSVLine(lines[0], delimiter);
        const rows: Record<string, string>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i], delimiter);
          if (values.every((v) => !v.trim())) continue; // skip empty rows
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h.trim()] = (values[idx] ?? '').trim();
          });
          rows.push(row);
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'UTF-8');
  });
}

/** Parse a single CSV line respecting quoted fields. */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── exportCSV ─────────────────────────────────────────────────────────────────
/**
 * Converts an array of objects to a CSV string and triggers a browser download.
 *
 * @param data     - Array of flat objects (string/number/boolean values)
 * @param filename - Downloaded filename (without extension)
 */
export function exportCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      const str = val == null ? '' : String(val);
      // Escape quotes and wrap in quotes if contains comma, newline, or quote
      return /[,"\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

// ── mapCSVToContacts ──────────────────────────────────────────────────────────
/**
 * Transforms CSV rows into Contact-shaped objects using a user-defined column map.
 *
 * @param rows       - Output from parseCSV()
 * @param columnMap  - Map of CSV header → Contact field name
 *                     e.g. { 'First Name': 'firstName', 'Email Address': 'email' }
 */
export function mapCSVToContacts(
  rows: Record<string, string>[],
  columnMap: Record<string, string>
): Partial<Contact>[] {
  return rows.map((row) => {
    const contact: Partial<Contact> = {};
    Object.entries(columnMap).forEach(([csvCol, contactField]) => {
      if (!csvCol || !contactField) return;
      const value = row[csvCol];
      if (value == null || value === '') return;

      switch (contactField) {
        case 'leadScore':
        case 'healthScore':
          (contact as any)[contactField] = parseInt(value, 10) || 0;
          break;
        case 'dndEnabled':
          (contact as any)[contactField] = value.toLowerCase() === 'true' || value === '1';
          break;
        case 'tags':
          (contact as any)[contactField] = value.split(',').map((t) => t.trim()).filter(Boolean);
          break;
        default:
          (contact as any)[contactField] = value;
      }
    });
    return contact;
  });
}

// ── detectCSVHeaders ─────────────────────────────────────────────────────────
/**
 * Returns the headers from the first parsed row (for column mapping UI).
 * Call after parseCSV().
 */
export function getCSVHeaders(rows: Record<string, string>[]): string[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]);
}

// ── CONTACT FIELD OPTIONS ─────────────────────────────────────────────────────
/** All mappable Contact fields — used to populate column-mapping dropdowns. */
export const CONTACT_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'firstName',    label: 'First Name' },
  { value: 'lastName',     label: 'Last Name' },
  { value: 'email',        label: 'Email' },
  { value: 'phone',        label: 'Phone' },
  { value: 'title',        label: 'Job Title' },
  { value: 'location',     label: 'Location' },
  { value: 'source',       label: 'Lead Source' },
  { value: 'status',       label: 'Status' },
  { value: 'tags',         label: 'Tags (comma-separated)' },
  { value: 'about',        label: 'Notes / About' },
  { value: 'leadScore',    label: 'Lead Score' },
  { value: 'preferredChannel', label: 'Preferred Channel' },
];

// ── Helper ────────────────────────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
