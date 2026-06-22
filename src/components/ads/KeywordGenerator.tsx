import { useState } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { useSuggestKeywords } from '../../hooks/useAdAI';
import type { KeywordSuggestion } from '../../hooks/useAdAI';

interface KeywordGeneratorProps {
  description: string;
  seedKeywords: string[];
  onAddKeywords: (keywords: string[]) => void;
}

export default function KeywordGenerator({ description, seedKeywords, onAddKeywords }: KeywordGeneratorProps) {
  const { mutate: suggest, isPending } = useSuggestKeywords();
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const handleGenerate = () => {
    if (!description) return;
    suggest(
      { description, seed: seedKeywords, numKeywords: 10 },
      { onSuccess: (data) => {
          setSuggestions(data);
          setSelected(new Set()); // Reset selections
        } 
      }
    );
  };

  const toggleSelect = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  };

  const handleAddSelected = () => {
    const toAdd = Array.from(selected).map(i => suggestions[i].text);
    onAddKeywords(toAdd);
    setSuggestions(suggestions.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
  };

  return (
    <div className="space-y-4 border border-border rounded-xl p-5 bg-surface">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-text-main flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Keyword AI
          </h4>
          <p className="text-sm text-text-muted">Generate high-intent keywords based on your ad description.</p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending || !description}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Generating...' : 'Generate Ideas'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, idx) => (
              <div
                key={idx}
                onClick={() => toggleSelect(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors ${
                  selected.has(idx) 
                    ? 'bg-primary/10 border-primary text-primary' 
                    : 'bg-background border-border text-text-muted hover:border-text-muted'
                }`}
              >
                <span>{s.text}</span>
                <span className="text-[10px] uppercase opacity-60 bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                  {s.matchType}
                </span>
              </div>
            ))}
          </div>

          {selected.size > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAddSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border rounded-lg text-sm font-medium text-text-main hover:bg-border/50"
              >
                <Plus className="w-4 h-4" /> Add {selected.size} Keywords
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
