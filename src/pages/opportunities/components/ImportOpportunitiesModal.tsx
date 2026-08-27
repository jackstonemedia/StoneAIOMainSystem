import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Upload, X, Check, FileText, AlertCircle, ArrowRight } from 'lucide-react';
import { opportunitiesApi } from '../../../lib/api/opportunities';
import { useToast } from '../../../components/ui/Toast';
import type { Pipeline } from '../../../types/opportunities';

interface ImportOpportunitiesModalProps {
  isOpen: boolean;
  pipelines: Pipeline[];
  activePipelineId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportOpportunitiesModal({
  isOpen,
  pipelines,
  activePipelineId,
  onClose,
  onSuccess,
}: ImportOpportunitiesModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'summary'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [pipelineId, setPipelineId] = useState<string>(activePipelineId || (pipelines[0]?.id || ''));
  const [stageId, setStageId] = useState<string>('');
  const [columnMap, setColumnMap] = useState<Record<string, string>>({
    title: '',
    amount: '',
    contactName: '',
    contactEmail: '',
    source: '',
    tags: '',
  });
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedPipeline = pipelines.find(p => p.id === pipelineId) || pipelines[0];
  const stages = selectedPipeline?.stages || [];

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return;

      const headerRow = parseCsvLine(lines[0]);
      setHeaders(headerRow);

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const rowObj: Record<string, string> = {};
        for (let j = 0; j < headerRow.length; j++) {
          rowObj[headerRow[j]] = values[j] || '';
        }
        rows.push(rowObj);
      }
      setParsedRows(rows);

      // Auto-map matching headers
      const map: Record<string, string> = {};
      for (const h of headerRow) {
        const lower = h.toLowerCase().trim();
        if (lower.includes('name') || lower.includes('deal') || lower.includes('title') || lower.includes('opportunity')) {
          if (!map.title) map.title = h;
        } else if (lower.includes('amount') || lower.includes('value') || lower.includes('price')) {
          if (!map.amount) map.amount = h;
        } else if (lower.includes('contact') || lower.includes('person') || lower.includes('lead')) {
          if (!map.contactName) map.contactName = h;
        } else if (lower.includes('email')) {
          if (!map.contactEmail) map.contactEmail = h;
        } else if (lower.includes('source')) {
          if (!map.source) map.source = h;
        } else if (lower.includes('tag')) {
          if (!map.tags) map.tags = h;
        }
      }
      setColumnMap(prev => ({ ...prev, ...map }));
      setStep('mapping');
    };
    reader.readAsText(f);
  };

  const handleExecuteImport = async () => {
    setIsProcessing(true);
    try {
      const res = await opportunitiesApi.import({
        rows: parsedRows,
        columnMap,
        pipelineId,
        stageId: stageId || (stages[0]?.id),
      });
      setImportResult(res);
      setStep('summary');
      toast('success', `Imported ${res.imported} opportunities`);
      onSuccess();
    } catch (e: any) {
      toast('error', 'Import failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-text-main">Import Opportunities</h2>
              <p className="text-[12px] text-text-muted">Import deals from CSV file into your pipeline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Steps */}
        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/60 rounded-2xl p-8 text-center cursor-pointer bg-surface-hover/20 hover:bg-surface-hover/40 transition-all flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[14px] font-bold text-text-main">Click to select CSV file</span>
                  <p className="text-[12px] text-text-muted mt-1">Supports standard CSV exports with headers</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="p-3 bg-surface-hover/40 rounded-xl border border-border flex items-center justify-between text-xs text-text-muted">
                <span>File: <strong className="text-text-main">{file?.name}</strong></span>
                <span>{parsedRows.length} rows detected</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-text-muted uppercase">Target Pipeline</label>
                  <select
                    value={pipelineId}
                    onChange={e => setPipelineId(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-main"
                  >
                    {pipelines.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-text-muted uppercase">Default Stage</label>
                  <select
                    value={stageId}
                    onChange={e => setStageId(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-main"
                  >
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-[12px] font-bold text-text-main">Map CSV Columns</h4>

                {[
                  { key: 'title', label: 'Opportunity Name *', required: true },
                  { key: 'amount', label: 'Value ($)' },
                  { key: 'contactName', label: 'Contact Name' },
                  { key: 'contactEmail', label: 'Contact Email' },
                  { key: 'source', label: 'Lead Source' },
                  { key: 'tags', label: 'Tags' },
                ].map(field => (
                  <div key={field.key} className="flex items-center justify-between gap-4 py-1.5 border-b border-border/40">
                    <span className="text-[12px] text-text-main font-medium min-w-[140px]">{field.label}</span>
                    <select
                      value={columnMap[field.key] || ''}
                      onChange={e => setColumnMap(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="flex-1 px-3 py-1.5 bg-surface-hover/60 border border-border rounded-lg text-xs text-text-main"
                    >
                      <option value="">-- Do not map --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'summary' && importResult && (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-text-main">Import Completed</h3>
                <p className="text-[13px] text-text-muted mt-1">
                  Successfully imported <strong className="text-emerald-400">{importResult.imported}</strong> opportunities.
                </p>
                {importResult.skipped > 0 && (
                  <p className="text-[12px] text-amber-400 mt-1">Skipped {importResult.skipped} rows.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-hover/30 flex items-center justify-end gap-3">
          {step === 'upload' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'mapping' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text-main"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isProcessing || !columnMap.title}
                className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isProcessing ? 'Importing...' : 'Start Import'}
              </button>
            </>
          )}

          {step === 'summary' && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-primary text-white"
            >
              Done
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function parseCsvLine(text: string): string[] {
  const p: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      p.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  p.push(cur.trim());
  return p;
}
