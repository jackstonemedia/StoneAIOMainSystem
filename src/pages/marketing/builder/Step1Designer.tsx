import { useEffect, useRef, useState } from 'react'
import { init } from '@templatical/editor'
import type { TemplaticalEditor, TemplateContent } from '@templatical/editor'
import { Sparkles } from 'lucide-react'
import { AiDesignModal } from './AiDesignModal'
import '@templatical/editor/style.css'

interface Props {
  initialContent: any
  onChange: (content: any, mjml: string) => void
}

export function Step1Designer({ initialContent, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<TemplaticalEditor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [showAiModal, setShowAiModal] = useState(false)

  const handleAiGenerate = (blocks: any[]) => {
    if (!editorRef.current) return
    
    // Construct a full TemplateContent
    const newContent: TemplateContent = {
      blocks,
      settings: {
        width: 600,
        backgroundColor: '#ffffff',
        fontFamily: 'Inter',
        locale: 'en'
      }
    }
    
    editorRef.current.setContent(newContent)
    
    // Also trigger onChange manually to ensure it saves to parent state
    editorRef.current.toMjml().then(mjml => {
      onChange(newContent, mjml)
    }).catch(() => {
      onChange(newContent, '')
    })
  }

  useEffect(() => {
    if (!containerRef.current) return

    init({
      container: containerRef.current,
      content: initialContent || undefined,
      uiTheme: 'dark',
      shadowDom: false,
      theme: {
        // Dark mode overrides — Stone AIO Enterprise Navy palette
        dark: {
          bg:            '#0F1A2B', // --surface: navy panels/sidebars
          bgElevated:    '#1C2E4A', // slightly lighter surface for dropdowns/modals
          bgHover:       '#132136', // --surface-hover
          bgActive:      '#1C2E4A',
          border:        '#2E4568', // --border
          borderLight:   'rgba(82, 103, 125, 0.25)', // --border-subtle
          text:          '#E8E3D8', // --text-main
          textMuted:     '#C8CEDC', // --text-muted
          textDim:       'rgba(200, 206, 220, 0.4)',
          primary:       '#52677D', // --primary
          primaryHover:  '#6B84A0', // --primary-hover
          primaryLight:  'rgba(82, 103, 125, 0.18)', // --primary-light
          canvasBg:      '#1e293b', // --bg: the canvas behind the email
          success:       '#10B981', // --accent-green
          successLight:  'rgba(16, 185, 129, 0.15)',
          warning:       '#F59E0B', // --accent-amber
          warningLight:  'rgba(245, 158, 11, 0.15)',
          danger:        '#EF4444', // --accent-red
          dangerLight:   'rgba(239, 68, 68, 0.15)',
        },
      },
      fonts: {
        customFonts: [
          { name: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap' },
          { name: 'Open Sans', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap' },
          { name: 'Lato', url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap' },
          { name: 'Montserrat', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap' },
          { name: 'Oswald', url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap' },
          { name: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap' },
          { name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap' }
        ]
      },
      onChange: async (content) => {
        if (editorRef.current) {
          try {
            const mjml = await editorRef.current.toMjml()
            onChangeRef.current(content, mjml)
          } catch {
            onChangeRef.current(content, '')
          }
        }
      },
    }).then((editor) => {
      editorRef.current = editor
    })

    return () => {
      if (editorRef.current) {
        editorRef.current.unmount()
        editorRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Outer wrapper — CSS variable tokens cross into the Templatical shadow DOM */}
      <div
      className="relative w-full h-full"
      style={{
        /* Dark namespace — mirrors our theme.dark config so both paths fire */
        '--tpl-user-dark-bg':             '#0F1A2B',
        '--tpl-user-dark-bg-elevated':    '#1C2E4A',
        '--tpl-user-dark-bg-hover':       '#132136',
        '--tpl-user-dark-bg-active':      '#1C2E4A',
        '--tpl-user-dark-border':         '#2E4568',
        '--tpl-user-dark-border-light':   'rgba(82,103,125,0.25)',
        '--tpl-user-dark-text':           '#E8E3D8',
        '--tpl-user-dark-text-muted':     '#C8CEDC',
        '--tpl-user-dark-text-dim':       'rgba(200,206,220,0.4)',
        '--tpl-user-dark-primary':        '#52677D',
        '--tpl-user-dark-primary-hover':  '#6B84A0',
        '--tpl-user-dark-primary-light':  'rgba(82,103,125,0.18)',
        '--tpl-user-dark-canvas-bg':      '#1e293b',
        '--tpl-user-dark-success':        '#10B981',
        '--tpl-user-dark-success-light':  'rgba(16,185,129,0.15)',
        '--tpl-user-dark-warning':        '#F59E0B',
        '--tpl-user-dark-warning-light':  'rgba(245,158,11,0.15)',
        '--tpl-user-dark-danger':         '#EF4444',
        '--tpl-user-dark-danger-light':   'rgba(239,68,68,0.15)',
        '--tpl-user-dark-overlay':        'rgba(0,0,0,0.72)',
        '--tpl-user-dark-font-family':    '"Inter", ui-sans-serif, system-ui, sans-serif',
        '--tpl-user-dark-radius':         '8px',
        '--tpl-user-dark-radius-sm':      '6px',
        '--tpl-user-dark-radius-lg':      '12px',
      } as React.CSSProperties}
    >
      <style>{`
        /* Target ONLY the main empty canvas container for the background and dashed border */
        #tpl-builder-root .tpl-canvas-empty {
          --tpl-bg: #ffffff !important;
          --tpl-user-dark-bg: #ffffff !important;
          background-color: #ffffff !important;
          border: 2px dashed #cbd5e1 !important;
        }
        
        /* Force all text inside it to slate, and completely REMOVE any borders/backgrounds 
           from internal elements like the random grey '+' icon square. */
        #tpl-builder-root .tpl-canvas-empty * {
          color: #475569 !important;
          stroke: #475569 !important;
          fill: #475569 !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        /* Also keep the dropzone white if it appears during drag */
        #tpl-builder-root .tpl-design-dropzone, #tpl-builder-root .tpl-ghost {
          background-color: #ffffff !important;
        }
      `}</style>

      {/* AI generation button */}
      <div className="absolute bottom-6 right-6 z-50">
        <button
          onClick={() => setShowAiModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-full transition-all hover:-translate-y-0.5"
          style={{
            background: 'var(--primary)',
            color: 'var(--text-main)',
            boxShadow: '0 4px 12px rgba(82,103,125,0.35)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate with AI
        </button>
      </div>

      {/* Templatical mount point */}
      <div
        id="tpl-builder-root"
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />

      {showAiModal && (
        <AiDesignModal
          onClose={() => setShowAiModal(false)}
          onGenerate={handleAiGenerate}
        />
      )}
    </div>
    </>
  )
}
