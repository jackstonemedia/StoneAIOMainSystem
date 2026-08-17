import React, { useState, useRef, useEffect } from 'react';
import {
  X, Upload, Download, Tag, Plus, Check, Loader2,
  Users, Building2, Phone, Mail, MapPin, AlertCircle, FileText
} from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';
import { useToast } from '../../../components/ui/Toast';
import { useQueryClient } from '@tanstack/react-query';

export interface ImportLeadItem {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  category?: string;
  location?: string;
  tags?: string[];
  notes?: string;
}

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLeads?: ImportLeadItem[];
  initialJobTitle?: string;
  defaultTags?: string[];
}

/**
 * Robust RFC-4180 CSV parser handling quoted strings, internal commas, and escaped quotes.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') i++; // CRLF
      currentRow.push(currentVal.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function ImportContactsModal({
  isOpen,
  onClose,
  initialLeads,
  initialJobTitle,
  defaultTags = []
}: ImportContactsModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tags, setTags] = useState<string[]>(defaultTags);
  const [tagInput, setTagInput] = useState('');
  const [parsedContacts, setParsedContacts] = useState<ImportLeadItem[]>(initialLeads || []);
  const [fileName, setFileName] = useState<string | null>(initialJobTitle ? `${initialJobTitle} (Lead Studio)` : null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial leads if provided
  useEffect(() => {
    if (initialLeads && initialLeads.length > 0) {
      setParsedContacts(initialLeads);
      if (initialJobTitle) setFileName(`${initialJobTitle} (Lead Studio)`);
    }
  }, [initialLeads, initialJobTitle]);

  // Sync default tags
  useEffect(() => {
    if (defaultTags && defaultTags.length > 0) {
      setTags(Array.from(new Set([...tags, ...defaultTags])));
    }
  }, [defaultTags]);

  if (!isOpen) return null;

  const handleAddTag = (newTag: string) => {
    const clean = newTag.trim().replace(/,/g, '');
    if (clean && !tags.includes(clean)) {
      setTags(prev => [...prev, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleFileProcess = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const rawRows = parseCsv(text);
      if (rawRows.length < 2) {
        toast('warning', 'Invalid File', 'No data rows detected in CSV.');
        return;
      }

      const headers = rawRows[0].map(h => h.toLowerCase().replace(/["_\s]+/g, ' ').trim());
      const normalized: ImportLeadItem[] = [];

      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        const contact: ImportLeadItem = {};

        headers.forEach((h, idx) => {
          const val = (row[idx] || '').trim();
          if (!val) return;

          if (h.includes('business') || h.includes('company') || h.includes('organization')) {
            contact.businessName = val;
          } else if (h === 'first name' || h === 'firstname' || h === 'fname') {
            contact.firstName = val;
          } else if (h === 'last name' || h === 'lastname' || h === 'lname') {
            contact.lastName = val;
          } else if (h === 'name' || h === 'full name' || h === 'contact name' || h === 'contact') {
            contact.name = val;
          } else if (h.includes('email') || h === 'mail') {
            contact.email = val;
          } else if (h.includes('phone') || h.includes('mobile') || h.includes('tel') || h.includes('cell')) {
            contact.phone = val;
          } else if (h.includes('website') || h === 'url' || h === 'web') {
            contact.website = val;
          } else if (h.includes('city')) {
            contact.city = val;
          } else if (h.includes('state')) {
            contact.state = val;
          } else if (h.includes('address') || h.includes('street')) {
            contact.address = val;
          } else if (h.includes('zip') || h.includes('postal')) {
            contact.postalCode = val;
          } else if (h.includes('category') || h.includes('industry') || h.includes('niche')) {
            contact.category = val;
          } else if (h.includes('tag')) {
            const rowTags = val.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
            contact.tags = Array.from(new Set([...(contact.tags || []), ...rowTags]));
          } else if (h.includes('note') || h.includes('about')) {
            contact.notes = val;
          }
        });

        // Ensure we have some identifying info
        if (contact.firstName || contact.name || contact.email || contact.phone || contact.businessName) {
          normalized.push(contact);
        }
      }

      setFileName(file.name);
      setParsedContacts(normalized);
      toast('success', 'File Parsed', `Found ${normalized.length} contacts in ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleImportSubmit = async () => {
    if (parsedContacts.length === 0) {
      toast('warning', 'No Contacts', 'Please select or upload contacts first.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await apiFetch('/api/crm/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: parsedContacts,
          tags: tags,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Import failed');
      }

      const data = await res.json();
      toast(
        'success',
        'Import Successful! 🎉',
        `Imported ${data.imported || parsedContacts.length} contacts with tags: ${tags.length > 0 ? tags.join(', ') : 'None'}`
      );
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['smart-lists'] });
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      toast('error', 'Import Failed', err.message || 'Failed to import contacts');
    } finally {
      setIsImporting(false);
    }
  };

  const quickTagSuggestions = ['Lead', 'Prospect', 'Cold Outreach', 'Lead Studio', 'VIP', 'Partner', 'Needs Follow-up'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-bg border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        style={{ background: 'var(--bg)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-text-main">Import Contacts & Leads</h2>
              <p className="text-[12px] text-text-muted">Import CSV files or scraped leads with custom tags applied to all</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* File Upload / Selected Box */}
          <div>
            <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider block mb-2">
              1. Source Data
            </label>

            {parsedContacts.length > 0 ? (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-text-main">{fileName || 'Contacts Data'}</p>
                    <p className="text-[12px] text-primary font-semibold">
                      ✓ {parsedContacts.length} contacts ready to import
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setParsedContacts([]);
                    setFileName(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-[12px] text-text-muted hover:text-red-400 font-medium px-3 py-1.5 rounded-lg hover:bg-surface transition-colors"
                >
                  Change File
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-border hover:border-primary/50 hover:bg-surface/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileProcess(file);
                  }}
                />
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center border border-border text-primary shadow-sm">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-text-main">
                    Click to upload or drag & drop CSV
                  </p>
                  <p className="text-[12px] text-text-muted mt-1">
                    Supports exports from Lead Studio, Google Sheets, HubSpot, or any custom CSV
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                2. Apply Tags to All Imported Contacts
              </label>
              <span className="text-[11px] text-text-muted">
                {tags.length} tag{tags.length === 1 ? '' : 's'} selected
              </span>
            </div>

            <p className="text-[12px] text-text-muted">
              These tags will be assigned to every contact in this import (in addition to any row-specific tags).
            </p>

            {/* Tag Badges List */}
            <div className="flex flex-wrap gap-2 min-h-[36px] p-2 bg-surface rounded-xl border border-border items-center">
              {tags.length === 0 ? (
                <span className="text-[12px] text-text-muted italic px-1">No tags added yet. Type below or pick a suggestion.</span>
              ) : (
                tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/25 rounded-lg text-primary text-[12px] font-semibold"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="ml-0.5 hover:text-red-400 text-primary/70 transition-colors"
                      title="Remove tag"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Tag Input Form */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type tag name and press Enter (e.g. Roofers, San Jose, Q3-Leads)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    if (tagInput.trim()) handleAddTag(tagInput);
                  }
                }}
                className="flex-1 px-3.5 py-2 bg-surface border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={() => {
                  if (tagInput.trim()) handleAddTag(tagInput);
                }}
                className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-xl text-[13px] font-semibold text-text-main transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Tag
              </button>
            </div>

            {/* Quick suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-text-muted mr-1">Quick tags:</span>
              {quickTagSuggestions.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleAddTag(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                    tags.includes(st)
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-surface border-border text-text-muted hover:text-text-main hover:border-primary/40'
                  }`}
                >
                  + {st}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Table */}
          {parsedContacts.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider block">
                  3. Preview (First {Math.min(5, parsedContacts.length)} of {parsedContacts.length})
                </label>
              </div>

              <div className="border border-border rounded-xl overflow-hidden bg-surface max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-surface-hover border-b border-border text-text-muted font-bold text-[11px] uppercase">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedContacts.slice(0, 5).map((c, i) => (
                      <tr key={i} className="hover:bg-surface-hover/50">
                        <td className="px-3 py-2 font-medium text-text-main">
                          {c.firstName || c.name || (c.lastName ? `Unknown ${c.lastName}` : 'Unknown')}
                        </td>
                        <td className="px-3 py-2 text-text-muted truncate max-w-[140px]">
                          {c.businessName || '—'}
                        </td>
                        <td className="px-3 py-2 text-text-muted font-mono">
                          {c.phone || '—'}
                        </td>
                        <td className="px-3 py-2 text-text-muted truncate max-w-[140px]">
                          {c.email || '—'}
                        </td>
                        <td className="px-3 py-2 text-text-muted">
                          {[c.city, c.state].filter(Boolean).join(', ') || c.location || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0 bg-surface">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text-main border border-border hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleImportSubmit}
            disabled={isImporting || parsedContacts.length === 0}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-[13px] font-bold shadow-lg shadow-primary/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing {parsedContacts.length} Contacts...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Import {parsedContacts.length} Contact{parsedContacts.length === 1 ? '' : 's'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
