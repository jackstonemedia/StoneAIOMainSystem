import { useState } from 'react'
import { Sparkles, X, Loader2 } from 'lucide-react'
import { generateJSON, SYSTEM_PROMPTS } from '../../../lib/gemini'

interface Props {
  onClose: () => void
  onGenerate: (blocks: any[]) => void
}

const EMAIL_SCHEMA = `
An array of block objects. Only return the JSON array. Allowed block types:
- title: { type: "title", content: string, level: 1|2|3|4, textAlign: "left"|"center"|"right", color: string }
- paragraph: { type: "paragraph", content: string } // Can contain basic HTML like <strong>, <br>, <a>
- image: { type: "image", src: string, alt: string, width: "full", align: "center" }
- button: { type: "button", text: string, url: string, backgroundColor: string, textColor: string, borderRadius: number, fontSize: number, buttonPadding: { top: 12, right: 24, bottom: 12, left: 24 } }
- divider: { type: "divider", lineStyle: "solid", color: "#e5e7eb", thickness: 1, width: "full" }
- spacer: { type: "spacer", height: number }
- social: { type: "social", iconStyle: "solid", iconSize: "medium", align: "center", icons: [{ id: "1", platform: "facebook", url: "#" }, { id: "2", platform: "instagram", url: "#" }] }

Include styles where required by the interface. Build a complete, beautiful email top to bottom.
`

export function AiDesignModal({ onClose, onGenerate }: Props) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!prompt.trim()) return
    
    setIsLoading(true)
    setError(null)
    try {
      const blocks = await generateJSON<any[]>(
        prompt,
        EMAIL_SCHEMA
      )
      
      const blocksWithIds = blocks.map(block => ({
        ...block,
        id: block.id || Math.random().toString(36).substring(2, 9),
        styles: {
          padding: { top: 16, right: 16, bottom: 16, left: 16 },
          ...(block.styles || {})
        }
      }))
      
      onGenerate(blocksWithIds)
      onClose()
    } catch (err: any) {
      console.error('AI Generation Error:', err)
      setError(err.message || 'Failed to generate design.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        className="rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--text-main)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            Generate Design with AI
          </div>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Describe the email campaign you want to build. Our AI will instantly generate the layout, copy, and styling for you to tweak.
          </p>

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={isLoading}
            placeholder="e.g., A sleek promotional email for a summer shoe sale. Include a catchy title, a product image, a paragraph about our 50% discount, and a bold 'Shop Now' button."
            className="w-full h-32 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 resize-none mb-2 transition-colors disabled:opacity-60"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
            }}
          />

          {error && (
            <div
              className="text-xs p-2 rounded-md mb-2 border"
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="px-5 py-4 border-t flex justify-end gap-2"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isLoading ? 'Generating...' : 'Generate Design'}
          </button>
        </div>
      </div>
    </div>
  )
}
