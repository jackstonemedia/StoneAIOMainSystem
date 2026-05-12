import { useState } from 'react';
import { Search, Loader2, Zap, Code, GitBranch, Repeat, ChevronDown, ChevronRight, Box } from 'lucide-react';
import { usePieces, usePieceDetail as usePiece } from '../../../hooks/usePieces';
import type { APStep, APPiece } from '../../../types/automation';

const PIECE_CATEGORIES = [
  'All', 'ARTIFICIAL_INTELLIGENCE', 'COMMUNICATION', 'CRM', 'MARKETING',
  'ACCOUNTING', 'DEVELOPER_TOOLS', 'PRODUCTIVITY', 'PAYMENT_PROCESSING',
  'CUSTOMER_SUPPORT', 'ANALYTICS', 'CONTENT_AND_FILES',
];

const CATEGORY_LABELS: Record<string, string> = {
  'ARTIFICIAL_INTELLIGENCE': 'AI',
  'COMMUNICATION': 'Communication',
  'CRM': 'CRM',
  'MARKETING': 'Marketing',
  'ACCOUNTING': 'Accounting',
  'DEVELOPER_TOOLS': 'Dev Tools',
  'PRODUCTIVITY': 'Productivity',
  'PAYMENT_PROCESSING': 'Payments',
  'CUSTOMER_SUPPORT': 'Support',
  'ANALYTICS': 'Analytics',
  'CONTENT_AND_FILES': 'Files',
};

// Built-in utility nodes (not from AP pieces catalog)
const UTILITY_STEPS = [
  {
    id: 'code',
    label: 'Code',
    description: 'Run custom JavaScript',
    icon: Code,
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-500/10 border-orange-500/30',
    step: (): APStep => ({
      name: `code_${Date.now()}`,
      type: 'CODE',
      valid: false,
      displayName: 'Code',
      settings: {
        sourceCode: { code: 'export const code = async (inputs) => {\n  return inputs;\n}', packageJson: '{"dependencies":{}}' },
        input: {},
      },
    }),
  },
  {
    id: 'branch',
    label: 'Branch',
    description: 'Conditional IF/ELSE logic',
    icon: GitBranch,
    colorClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10 border-yellow-500/30',
    step: (): APStep => ({
      name: `branch_${Date.now()}`,
      type: 'BRANCH',
      valid: false,
      displayName: 'Branch',
      settings: {
        conditions: [[{ firstValue: '', operator: 'TEXT_EXACTLY_MATCHES', secondValue: '' }]],
        input: {},
      },
    }),
  },
  {
    id: 'loop',
    label: 'Loop',
    description: 'Iterate over a list',
    icon: Repeat,
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10 border-cyan-500/30',
    step: (): APStep => ({
      name: `loop_${Date.now()}`,
      type: 'LOOP_ON_ITEMS',
      valid: false,
      displayName: 'Loop',
      settings: {
        items: '',
        input: {},
      },
    }),
  },
];

interface Props {
  onAddStep: (step: APStep) => void;
}

export function APNodeLibrary({ onAddStep }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const { data: pieces = [], isLoading } = usePieces();

  const filtered = pieces.filter((p) => {
    const matchSearch = !search ||
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'All' ||
      p.categories?.some((c) => c.toUpperCase() === category.toUpperCase());
    return matchSearch && matchCategory;
  });

  const handleAddAction = (piece: APPiece, actionName: string) => {
    const stepName = `${piece.name.replace('@activepieces/piece-', '').replace(/[^a-z0-9_]/gi, '_')}_${Date.now()}`;
    const actionsArr = Array.isArray(piece.actions) ? piece.actions : Object.values(piece.actions || {});
    const action = actionsArr.find((a: any) => a.name === actionName) as any;
    const step: APStep = {
      name: stepName,
      type: 'PIECE',
      valid: false,
      displayName: action?.displayName ?? actionName,
      settings: {
        packageType: 'REGISTRY',
        pieceName: piece.name,
        pieceType: 'OFFICIAL',
        pieceVersion: piece.version,
        actionName,
        input: {},
      },
    };
    onAddStep(step);
  };

  const handleAddTrigger = (piece: APPiece, triggerName: string) => {
    const stepName = `trigger_${piece.name.replace('@activepieces/piece-', '').replace(/[^a-z0-9_]/gi, '_')}_${Date.now()}`;
    const triggersArr = Array.isArray(piece.triggers) ? piece.triggers : Object.values(piece.triggers || {});
    const trigger = triggersArr.find((t: any) => t.name === triggerName) as any;
    const step: APStep = {
      name: stepName,
      type: 'TRIGGER',
      valid: false,
      displayName: trigger?.displayName ?? triggerName,
      settings: {
        packageType: 'REGISTRY',
        pieceName: piece.name,
        pieceType: 'OFFICIAL',
        pieceVersion: piece.version,
        triggerName,
        input: {},
      },
    };
    onAddStep(step);
  };

  return (
    <div className="w-64 border-r border-border bg-surface flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 700+ pieces..."
            className="w-full pl-8 pr-3 py-1.5 bg-bg border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 p-2 overflow-x-auto scrollbar-none border-b border-border flex-wrap">
        {PIECE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors ${
              category === cat
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-main hover:bg-bg'
            }`}
          >
            {cat === 'All' ? 'All' : (CATEGORY_LABELS[cat] ?? cat)}
          </button>
        ))}
      </div>

      {/* Utility steps (Code, Branch, Loop) */}
      {(search === '' || search.toLowerCase().match(/code|branch|loop|util/)) && category === 'All' && (
        <div className="p-2 border-b border-border">
          <p className="text-[10px] text-text-muted uppercase tracking-wider px-1 mb-1">Utilities</p>
          <div className="space-y-1">
            {UTILITY_STEPS.map((util) => (
              <button
                key={util.id}
                onClick={() => onAddStep(util.step())}
                className={`w-full flex items-center gap-2 p-2 rounded-lg border ${util.bgClass} hover:opacity-80 transition-opacity text-left`}
              >
                <util.icon className={`w-4 h-4 shrink-0 ${util.colorClass}`} />
                <div>
                  <div className={`text-xs font-medium ${util.colorClass}`}>{util.label}</div>
                  <div className="text-[10px] text-text-muted">{util.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pieces list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
            <p className="text-xs text-text-muted">Loading 700+ pieces...</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-8">No pieces found</p>
        ) : (
          <>
            <p className="text-[10px] text-text-muted uppercase tracking-wider px-1 pt-1">
              {filtered.length} pieces
            </p>
            {filtered.map((piece) => (
              <PieceItem key={piece.name} piece={piece} onAddAction={handleAddAction} onAddTrigger={handleAddTrigger} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function PieceItem({
  piece: summaryPiece, onAddAction, onAddTrigger,
}: {
  piece: APPiece;
  onAddAction: (p: APPiece, a: string) => void;
  onAddTrigger: (p: APPiece, t: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  // If expanded and we only have counts (like from cloud API), fetch full piece
  const needsFetch = expanded && (typeof summaryPiece.actions === 'number' || typeof summaryPiece.triggers === 'number');
  const { data: fullPiece, isLoading } = usePiece(needsFetch ? summaryPiece.name : '');
  
  const piece = fullPiece || summaryPiece;
  const actionsArr = Array.isArray(piece.actions) ? piece.actions : (typeof piece.actions === 'object' && piece.actions ? Object.values(piece.actions) : []);
  const triggersArr = Array.isArray(piece.triggers) ? piece.triggers : (typeof piece.triggers === 'object' && piece.triggers ? Object.values(piece.triggers) : []);
  
  const actionCount = typeof summaryPiece.actions === 'number' ? summaryPiece.actions : actionsArr.length;
  const triggerCount = typeof summaryPiece.triggers === 'number' ? summaryPiece.triggers : triggersArr.length;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2 hover:bg-bg transition-colors text-left"
      >
        {piece.logoUrl ? (
          <img src={piece.logoUrl} alt="" className="w-5 h-5 rounded object-contain shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded bg-accent/20 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-bold text-accent">
              {piece.displayName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <span className="flex-1 text-xs font-medium text-text-main truncate">{piece.displayName}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] text-text-muted">{actionCount + triggerCount}</span>
          {expanded ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        </div>
      </button>

      {expanded && (
        <div className="bg-bg border-t border-border">
          {isLoading && (
            <div className="px-3 py-4 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />
            </div>
          )}
          {!isLoading && triggersArr.length > 0 && (
            <>
              <div className="px-3 py-1 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-purple-400" />
                <span className="text-[9px] text-purple-400 uppercase tracking-wider">Triggers</span>
              </div>
              {triggersArr.map((t: any) => (
                <button
                  key={t.name}
                  onClick={() => onAddTrigger(piece, t.name)}
                  className="w-full flex items-start flex-col gap-0.5 p-2 px-3 hover:bg-surface transition-colors text-left border-t border-border/50"
                >
                  <span className="text-xs text-text-main">{t.displayName}</span>
                </button>
              ))}
            </>
          )}
          {actionsArr.length > 0 && (
            <>
              <div className="px-3 py-1 flex items-center gap-1 border-t border-border/50">
                <Box className="w-2.5 h-2.5 text-blue-400" />
                <span className="text-[9px] text-blue-400 uppercase tracking-wider">Actions</span>
              </div>
              {actionsArr.map((a: any) => (
                <button
                  key={a.name}
                  onClick={() => onAddAction(piece, a.name)}
                  className="w-full flex items-start flex-col gap-0.5 p-2 px-3 hover:bg-surface transition-colors text-left border-t border-border/50"
                >
                  <span className="text-xs text-text-main">{a.displayName}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
