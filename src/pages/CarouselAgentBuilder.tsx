import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Sparkles, LayoutTemplate, Palette,
  CheckCircle2, Loader2, Settings, Globe, Zap, Send, FileText, DownloadCloud, Download, Image, ChevronDown
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';

// ─── Palettes ─────────────────────────────────────────────────────────────────
const GALLERY_BACKGROUNDS = [
  { id: 'dark-lime',    name: 'Dark & Lime',     bg: '#142d2c', text: '#ffffff', accent: '#e2f163' },
  { id: 'cream',        name: 'Editorial Cream', bg: '#f4efe8', text: '#1a1a1a', accent: '#1a1a1a' },
  { id: 'royal-purple', name: 'Royal Purple',    bg: '#2d1b69', text: '#ffffff', accent: '#f5c67a' },
  { id: 'burgundy',     name: 'Burgundy Gold',   bg: '#6b1e3a', text: '#ffffff', accent: '#f5c767' },
  { id: 'soft-purple',  name: 'Soft Purple',     bg: '#9580e2', text: '#ffffff', accent: '#ffffff' },
  { id: 'yellow',       name: 'Electric Yellow', bg: '#dfeb60', text: '#0d0d0d', accent: '#0d0d0d' },
  { id: 'navy',         name: 'Navy & Sky',      bg: '#0f1f40', text: '#ffffff', accent: '#7dd3fc' },
  { id: 'warm-black',   name: 'Warm Black',      bg: '#111111', text: '#ffffff', accent: '#ff4e50' },
  { id: 'blush',        name: 'Blush Rose',      bg: '#f7e8ec', text: '#2d1b2e', accent: '#8b2252' },
  { id: 'forest',       name: 'Forest Sage',     bg: '#2d4a3e', text: '#ffffff', accent: '#a8d5b5' },
];

const AUTO_PALETTES = GALLERY_BACKGROUNDS;

// ─── SVG Pattern Backgrounds ──────────────────────────────────────────────────
// Each returns an SVG string encoded for use as a background-image
const PATTERNS = {
  dots: (color: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='2' cy='2' r='1.5' fill='${color}' opacity='0.18'/></svg>`,
  grid: (color: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><path d='M32 0H0v32' fill='none' stroke='${color}' stroke-width='0.5' opacity='0.15'/></svg>`,
  diagonals: (color: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><path d='M0 20L20 0' fill='none' stroke='${color}' stroke-width='0.7' opacity='0.12'/></svg>`,
  circles: (color: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><circle cx='30' cy='30' r='28' fill='none' stroke='${color}' stroke-width='0.5' opacity='0.1'/></svg>`,
  hexagons: (color: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='46'><polygon points='20,2 38,11 38,35 20,44 2,35 2,11' fill='none' stroke='${color}' stroke-width='0.6' opacity='0.1'/></svg>`,
  waves: (color: string) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='20'><path d='M0 10 Q20 0 40 10 Q60 20 80 10' fill='none' stroke='${color}' stroke-width='0.8' opacity='0.12'/></svg>`,
};

const PATTERN_OPTIONS = [
  { id: 'dots',      label: 'Dots' },
  { id: 'grid',      label: 'Grid' },
  { id: 'diagonals', label: 'Lines' },
  { id: 'circles',   label: 'Circles' },
  { id: 'hexagons',  label: 'Hexagons' },
  { id: 'waves',     label: 'Waves' },
];

function svgToDataUri(svgStr: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svgStr)}")`;
}

// ─── SVG Decorators ────────────────────────────────────────────────────────────
const SvgArrow = ({ color }: { color: string }) => (
  <svg width="40" height="12" viewBox="0 0 60 20" fill="none">
    <path d="M0 10H52M52 10L43 2M52 10L43 18" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SvgDiamond = ({ color, op = 0.4 }: { color: string; op?: number }) => (
  <svg width="16" height="16" viewBox="0 0 30 30" fill="none" style={{ opacity: op }}>
    <path d="M15 3L27 15L15 27L3 15Z" stroke={color} strokeWidth="1.5"/>
  </svg>
);
const SvgCheck = ({ color, op = 0.35 }: { color: string; op?: number }) => (
  <svg width="22" height="22" viewBox="0 0 30 30" fill="none" style={{ opacity: op }}>
    <circle cx="15" cy="15" r="13" stroke={color} strokeWidth="1.5"/>
    <path d="M9 15L13 19L21 11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Slide Renderer ────────────────────────────────────────────────────────────
function SlideRenderer({ slide, palette, websiteUrl, brandName, patternId, bgImage, fontFamily, visualTheme, slideIndex, totalSlides }: {
  slide: any;
  palette: { bg: string; text: string; accent: string };
  websiteUrl: string;
  brandName: string;
  patternId: string | null;
  bgImage: string | null;
  fontFamily: string;
  visualTheme: string;
  slideIndex: number;
  totalSlides: number;
}) {
  const { bg, text, accent } = palette;
  const font = { fontFamily: `${fontFamily}, system-ui, sans-serif` };
  const base: React.CSSProperties = {
    ...font, color: text,
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    position: 'relative', overflow: 'hidden',
    ...(bgImage 
      ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)), url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : { backgroundColor: bg }
    )
  };
  const pad: React.CSSProperties = { padding: '28px 30px 20px' };
  const center: React.CSSProperties = { textAlign: 'center', alignItems: 'center' };

  // Pattern overlay
  const patternBg: React.CSSProperties = patternId && (PATTERNS as any)[patternId] ? {
    position: 'absolute', inset: 0, zIndex: 0,
    backgroundImage: svgToDataUri((PATTERNS as any)[patternId](text)),
    backgroundRepeat: 'repeat',
    pointerEvents: 'none',
  } : {};

  const inner: React.CSSProperties = { position: 'relative', zIndex: 1, ...pad, height: '100%', display: 'flex', flexDirection: 'column' };

  const Corners = () => (
    <>
      {websiteUrl && (
        <span style={{ position: 'absolute', bottom: 20, left: 24, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', opacity: 0.5, zIndex: 20 }}>
          {websiteUrl}
        </span>
      )}
      {brandName && (
        <span style={{ position: 'absolute', bottom: 20, right: 24, fontSize: 8.5, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '3px 8px', border: `1px solid ${text}`, borderRadius: 2, opacity: 0.5, zIndex: 20 }}>
          {brandName}
        </span>
      )}
    </>
  );

  const clampBody: React.CSSProperties = { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' as any };

  const ThemeDecorator = () => {
    if (visualTheme === 'minimal' || !visualTheme) return null;
    
    if (visualTheme === 'geometric') {
      return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -40, width: 140, height: 260, backgroundColor: accent, transform: 'rotate(25deg)' }} />
          <div style={{ position: 'absolute', bottom: -50, left: -40, width: 120, height: 200, backgroundColor: accent, transform: 'rotate(25deg)' }} />
          {slideIndex > 0 && slideIndex < totalSlides - 1 && <div style={{ position: 'absolute', top: '35%', left: 0, width: '100%', borderTop: `2px dashed ${text}`, opacity: 0.2 }} />}
        </div>
      );
    }
    
    if (visualTheme === 'diagonal') {
      const globalWidth = totalSlides * 100;
      return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
           <div style={{ position: 'absolute', top: 0, left: `-${slideIndex * 100}%`, width: `${globalWidth}%`, height: '100%' }}>
              <div style={{ position: 'absolute', top: '-50%', left: '15%', width: '35%', height: '200%', backgroundColor: accent, opacity: 0.8, transform: 'rotate(45deg)' }} />
              <div style={{ position: 'absolute', top: '-50%', left: '42%', width: '25%', height: '200%', backgroundColor: text, opacity: 0.05, transform: 'rotate(45deg)' }} />
           </div>
        </div>
      );
    }
    
    if (visualTheme === 'organic') {
      const globalWidth = totalSlides * 100;
      return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
           <div style={{ position: 'absolute', top: 0, left: `-${slideIndex * 100}%`, width: `${globalWidth}%`, height: '100%' }}>
             <svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
               <path d="M0,300 C200,400 300,100 500,200 C700,300 800,100 1000,200 L1000,0 L0,0 Z" fill={accent} opacity={0.15} />
               <path d="M0,1000 C300,800 400,900 600,700 C800,500 900,800 1000,600 L1000,1000 L0,1000 Z" fill={text} opacity={0.05} />
             </svg>
             <div style={{ position: 'absolute', top: '40%', left: '0', width: '100%', borderTop: `1px solid ${text}`, opacity: 0.2 }} />
           </div>
        </div>
      );
    }
    return null;
  };

  // ── COVER – centered ──────────────────────────────────────────────────────
  if (slide.type === 'cover') return (
    <div style={base}>
      {patternId && <div style={patternBg} />}
      <ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexShrink: 0 }}>
          <SvgDiamond color={text} op={0.3} />
          <SvgCheck color={text} op={0.3} />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <h1 style={{ color: accent, fontSize: 38, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 26, wordBreak: 'break-word', textAlign: 'center' }}>
            {slide.title}
          </h1>
          <div style={{ width: 36, height: 4, backgroundColor: accent, opacity: 0.5, borderRadius: 4, marginBottom: 26, flexShrink: 0 }} />
          <p style={{ fontSize: 13.5, opacity: 0.8, lineHeight: 1.6, fontWeight: 500, textAlign: 'center', ...clampBody }}>
            {slide.body}
          </p>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.35 }}>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Swipe to continue</span>
            <SvgArrow color={text} />
          </div>
        </div>
        <Corners />
      </div>
    </div>
  );

  // ── MASTER MID-SLIDE TYPOGRAPHY ──────────────────────────────────────────
  const midTitle: React.CSSProperties = { color: accent, fontSize: 32, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 28 };
  const midBody: React.CSSProperties = { fontSize: 13.5, opacity: 0.85, lineHeight: 1.6, fontWeight: 450, ...clampBody };
  const midLabel: React.CSSProperties = { color: text, opacity: 0.4, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 };

  const ThemeStepNum = ({ num, align = 'center' }: { num: string | number, align?: 'center' | 'left' }) => {
    if (visualTheme === 'geometric') {
      return <div style={{ backgroundColor: accent, color: bg, padding: '4px 10px', fontWeight: 900, fontSize: 18, marginBottom: 16, display: 'inline-block' }}>#{num}</div>;
    }
    if (visualTheme === 'diagonal') {
      return <div style={{ WebkitTextStroke: `2px ${text}`, color: 'transparent', fontSize: 64, fontWeight: 900, marginBottom: 8, lineHeight: 1, letterSpacing: '-0.02em' }}>{num}</div>;
    }
    return <span style={{ ...midLabel, textAlign: align, width: '100%', display: 'block' }}>Step {num}</span>;
  };

  const ThemeTitle = ({ title, align = 'center' }: { title: string, align?: 'center' | 'left' }) => {
    if (visualTheme === 'organic') {
       return (
         <div style={{ width: '100%', textAlign: align, marginBottom: 28 }}>
           <h2 style={{ ...midTitle, marginBottom: 0, textAlign: align, backgroundColor: text, color: bg, padding: '6px 14px', display: 'inline-block' }}>{title}</h2>
         </div>
       );
    }
    if (visualTheme === 'geometric') {
       return <h2 style={{ ...midTitle, textAlign: align, width: '100%', textTransform: 'uppercase' }}>{title}</h2>;
    }
    return <h2 style={{ ...midTitle, textAlign: align, width: '100%' }}>{title}</h2>;
  };

  const IconComponent = slide.lucideIcon && (LucideIcons as any)[slide.lucideIcon] ? (LucideIcons as any)[slide.lucideIcon] : null;
  const RenderIcon = ({ mb = 20, align = 'center' }: { mb?: number, align?: 'center' | 'left' }) => 
    IconComponent ? <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start', width: '100%', marginBottom: mb }}><IconComponent color={accent} size={44} strokeWidth={1.5} /></div> : null;

  // ── STEP – centered ────────────────────────────────────────────────────────
  if (slide.type === 'step') return (
    <div style={base}>
      {patternId && <div style={patternBg} />}
      <ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}>
           <SvgDiamond color={text} op={0.2} />
           <SvgCheck color={text} op={0.2} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <RenderIcon />
          {slide.stepNum && <ThemeStepNum num={slide.stepNum} />}
          <ThemeTitle title={slide.title} />
          <p style={{ ...midBody, textAlign: 'center' }}>{slide.body}</p>
        </div>
        <Corners />
      </div>
    </div>
  );

  // ── QUOTE – centered ───────────────────────────────────────────────────────
  if (slide.type === 'quote') return (
    <div style={base}>
      {patternId && <div style={patternBg} />}
      <ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}>
           <SvgDiamond color={text} op={0.2} />
           <SvgCheck color={text} op={0.2} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <RenderIcon />
          {slide.title && <span style={midLabel}>{slide.title}</span>}
          <h2 style={{ ...midTitle, textAlign: 'center', fontStyle: 'italic' }}>"{slide.body}"</h2>
        </div>
        <Corners />
      </div>
    </div>
  );

  // ── STATISTIC – centered ───────────────────────────────────────────────────
  if (slide.type === 'statistic') return (
    <div style={base}>
      {patternId && <div style={patternBg} />}
      <ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}>
           <SvgDiamond color={text} op={0.2} />
           <SvgCheck color={text} op={0.2} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <RenderIcon />
          <span style={{ ...midLabel, textAlign: 'center', width: '100%', display: 'block' }}>Key Data</span>
          <ThemeTitle title={slide.title} />
          <p style={{ ...midBody, textAlign: 'center' }}>{slide.body}</p>
        </div>
        <Corners />
      </div>
    </div>
  );

  // ── LISTICLE – vertically centered, left-aligned bullets ───────────────────
  if (slide.type === 'listicle') return (
    <div style={base}>
      {patternId && <div style={patternBg} />}
      <ThemeDecorator />
      <div style={inner}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}>
           <SvgDiamond color={text} op={0.2} />
           <SvgCheck color={text} op={0.2} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingLeft: 8, paddingRight: 8 }}>
          <RenderIcon align="left" mb={16} />
          <h2 style={{ ...midTitle, textAlign: 'left', marginBottom: 20 }}>{slide.title}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(slide.items || []).map((item: string, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: accent, fontSize: 13.5, fontWeight: 900, marginTop: 1 }}>•</span>
                <p style={{ ...midBody, textAlign: 'left' }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
        <Corners />
      </div>
    </div>
  );

  // ── COMPARISON – vertically centered, stacked ──────────────────────────────
  if (slide.type === 'comparison') return (
    <div style={base}>
      {patternId && <div style={patternBg} />}
      <ThemeDecorator />
      <div style={inner}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}>
           <SvgDiamond color={text} op={0.2} />
           <SvgCheck color={text} op={0.2} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingLeft: 12, paddingRight: 12 }}>
          <RenderIcon align="left" mb={20} />
          <div style={{ marginBottom: 24, paddingLeft: 10, borderLeft: `2px solid ${text}20` }}>
            <span style={{ ...midLabel, display: 'block', marginBottom: 6 }}>{slide.leftTitle || 'Before'}</span>
            <p style={{ ...midBody, textAlign: 'left', opacity: 0.6, fontStyle: 'italic' }}>{slide.leftBody}</p>
          </div>
          <div style={{ paddingLeft: 10, borderLeft: `2px solid ${accent}` }}>
            <span style={{ ...midLabel, color: accent, opacity: 1, display: 'block', marginBottom: 6 }}>{slide.rightTitle || 'After'}</span>
            <p style={{ ...midBody, textAlign: 'left', fontWeight: 600 }}>{slide.rightBody}</p>
          </div>
        </div>
        <Corners />
      </div>
    </div>
  );

  // ── FREEFORM – AI controlled layout & graphics ─────────────────────────────
  if (slide.type === 'freeform') {
    const align = slide.textAlign || 'center';
    const alignCss = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
    const IconComponent = slide.lucideIcon && (LucideIcons as any)[slide.lucideIcon] ? (LucideIcons as any)[slide.lucideIcon] : null;

    return (
      <div style={base}>
        {patternId && <div style={patternBg} />}
      <ThemeDecorator />
        <div style={inner}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}>
             <SvgDiamond color={text} op={0.2} />
             <SvgCheck color={text} op={0.2} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: alignCss, minHeight: 0, padding: '0 12px' }}>
          <RenderIcon align={align as any} mb={20} />
          {slide.label && <span style={{ ...midLabel, textAlign: align, width: '100%' }}>{slide.label}</span>}
          {slide.title && <ThemeTitle title={slide.title} align={align as any} />}
          {slide.body && <p style={{ ...midBody, textAlign: align, width: '100%' }}>{slide.body}</p>}
            
            {slide.bullets && slide.bullets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, width: '100%' }}>
                {slide.bullets.map((b: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ color: accent, fontSize: 13.5, fontWeight: 900, marginTop: 1 }}>•</span>
                    <p style={{ ...midBody, textAlign: 'left', margin: 0 }}>{b}</p>
                  </div>
                ))}
              </div>
            )}
            
            {slide.accentBox && (
              <div style={{ marginTop: 24, padding: 16, borderLeft: `3px solid ${accent}`, backgroundColor: `${text}10`, width: '100%' }}>
                <p style={{ ...midBody, textAlign: align, margin: 0, fontStyle: 'italic', opacity: 1 }}>{slide.accentBox}</p>
              </div>
            )}
          </div>
          <Corners />
        </div>
      </div>
    );
  }

  // ── CTA – centered ─────────────────────────────────────────────────────────
  if (slide.type === 'cta') return (
    <div style={base}>
      {patternId && <div style={patternBg} />}
      <ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexShrink: 0 }}>
          <SvgDiamond color={text} op={0.3} />
          <SvgCheck color={text} op={0.3} />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <RenderIcon mb={24} />
          <h2 style={{ color: accent, fontSize: 44, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 24, textAlign: 'center' }}>
            {slide.title}
          </h2>
          <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6, fontWeight: 450, textAlign: 'center', ...clampBody }}>{slide.body}</p>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Save this post ↓</span>
          </div>
        </div>
        <Corners />
      </div>
    </div>
  );

  return <div style={{ ...base, ...pad, alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>Unknown type</div>;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CarouselAgentBuilder() {
  const [activeTab, setActiveTab] = useState('content');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [agentName, setAgentName] = useState('Carousel Auto-Poster');

  // Content
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [designPrompt, setDesignPrompt] = useState('');
  const [autoResearch, setAutoResearch] = useState(false);
  const [platform, setPlatform] = useState<'instagram' | 'linkedin'>('instagram');
  const [contentStyle, setContentStyle] = useState('professional');
  const [contentLength, setContentLength] = useState('medium');
  const [slideCount, setSlideCount] = useState(5);

  // Design
  const [autoGenBackground, setAutoGenBackground] = useState(true);
  const [selectedBgId, setSelectedBgId] = useState('dark-lime');
  const [brandName, setBrandName] = useState('LOGO');
  const [websiteUrl, setWebsiteUrl] = useState('www.yourwebsite.com');
  const [useCustomColors, setUseCustomColors] = useState(false);
  const [customBg, setCustomBg] = useState('#0f172a');
  const [customText, setCustomText] = useState('#ffffff');
  const [customAccent, setCustomAccent] = useState('#38bdf8');

  // Pattern backgrounds & Fonts
  const [usePattern, setUsePattern] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState('dots');
  const [fontFamily, setFontFamily] = useState('Inter');

  // Image Gallery
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedBgImage, setSelectedBgImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeAccordion, setActiveAccordion] = useState<string>('layout');
  const [visualTheme, setVisualTheme] = useState<'minimal' | 'geometric' | 'diagonal' | 'organic'>('minimal');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setUploadedImages(prev => [url, ...prev]);
      setSelectedBgImage(url);
    }
  };

  // State
  const [generationStep, setGenerationStep] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [generatedSlides, setGeneratedSlides] = useState<any[]>([]);
  const [slidePalette, setSlidePalette] = useState<{ bg: string; text: string; accent: string } | null>(null);

  const getActivePalette = () => {
    if (useCustomColors) return { bg: customBg, text: customText, accent: customAccent };
    if (slidePalette && autoGenBackground) return slidePalette;
    return GALLERY_BACKGROUNDS.find(b => b.id === selectedBgId) || GALLERY_BACKGROUNDS[0];
  };
  const activePalette = getActivePalette();

  const handleGenerate = async () => {
    if (!topic && !autoResearch) { alert('Please provide a topic or enable Auto-Research.'); return; }
    setGenerationStep(1);
    setGeneratedSlides([]);
    if (!useCustomColors && autoGenBackground) {
      setSlidePalette(AUTO_PALETTES[Math.floor(Math.random() * AUTO_PALETTES.length)]);
    }
    try {
      setTimeout(() => setGenerationStep(s => s < 2 ? 2 : s), 1800);
      setTimeout(() => setGenerationStep(s => s < 3 ? 3 : s), 4000);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const res = await fetch('/api/agents/generate-carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, description, designPrompt, autoResearch, platform, contentStyle, contentLength, slideCount }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Unknown' })); throw new Error(e.error || `Error ${res.status}`); }
      const data = await res.json();
      if (!data.slides || !Array.isArray(data.slides)) throw new Error('Invalid AI response');
      setGeneratedSlides(data.slides);
      setCurrentSlideIndex(0);
      setGenerationStep(4);
    } catch (err: any) {
      alert('Generation error: ' + (err.name === 'AbortError' ? 'Timed out after 2 min.' : err.message));
      setGenerationStep(0);
    }
  };

  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < generatedSlides.length; i++) {
        const el = document.getElementById(`export-slide-${i}`);
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2.16, useCORS: true });
        const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
        zip.file(`slide_${i + 1}.png`, blob);
      }
      saveAs(await zip.generateAsync({ type: 'blob' }), `${(topic || 'carousel').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`);
    } finally { setIsExporting(false); }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const dim = platform === 'instagram' ? [1080, 1350] : [1080, 1080];
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: dim });
      for (let i = 0; i < generatedSlides.length; i++) {
        const el = document.getElementById(`export-slide-${i}`);
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2.16, useCORS: true });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, dim[0], dim[1]);
      }
      pdf.save(`${(topic || 'carousel').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } finally { setIsExporting(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: agentName, type: 'carousel', status: 'active', config: JSON.stringify({ topic, platform }) }) });
      if (res.ok) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 3000); }
    } finally { setIsSaving(false); }
  };

  const tabs = [
    { id: 'content',  label: 'Content Strategy', icon: FileText },
    { id: 'design',   label: 'Design & Gallery',  icon: Palette },
    { id: 'settings', label: 'Agent Settings',    icon: Settings },
  ];
  const aspectClass = platform === 'instagram' ? 'aspect-[4/5]' : 'aspect-square';
  const activePatternId = usePattern ? selectedPattern : null;

  return (
    <div className="h-screen w-full flex flex-col bg-transparent text-text-main font-sans overflow-hidden">

      {/* Hidden export stage */}
      {generationStep === 4 && generatedSlides.length > 0 && (
        <div className="fixed top-0 left-[-9999px] pointer-events-none opacity-0 flex flex-col gap-10 z-0">
          {generatedSlides.map((s, idx) => (
            <div key={`export-${idx}`} id={`export-slide-${idx}`} style={{ width: 500, aspectRatio: platform === 'instagram' ? '4/5' : '1/1', overflow: 'hidden', flexShrink: 0 }}>
              <SlideRenderer slide={s} palette={activePalette} websiteUrl={websiteUrl} brandName={brandName} patternId={activePatternId} bgImage={selectedBgImage} fontFamily={fontFamily} visualTheme={visualTheme} slideIndex={idx} totalSlides={generatedSlides.length} />
            </div>
          ))}
        </div>
      )}

      {/* Topbar */}
      <header className="h-14 border-b border-border/50 bg-surface/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/templates" className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-md transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)} className="font-semibold text-sm bg-transparent border-none focus:outline-none hover:bg-surface-hover px-2 py-1 rounded w-64" />
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-pink-500 bg-pink-500/10 border border-pink-500/20">Carousel Agent</span>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && <span className="text-xs text-green flex items-center gap-1"><Save className="w-3 h-3" /> Saved</span>}
          <button onClick={handleSave} disabled={isSaving} className="bg-surface border border-border text-text-main hover:bg-surface-hover px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>
          <button className="bg-gradient-to-r from-pink-600 to-primary text-white px-5 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg">Publish Agent</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[420px] border-r border-border/50 bg-surface/40 backdrop-blur-xl flex shrink-0 overflow-hidden shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10">
          <nav className="w-16 border-r border-border/50 bg-surface/60 flex flex-col items-center py-4 gap-2 shrink-0">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${activeTab === tab.id ? 'bg-primary/10 text-primary shadow-sm' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}>
                {activeTab === tab.id && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />}
                <tab.icon className="w-4 h-4" />
                <span className="absolute left-12 px-2 py-1 bg-surface border border-border rounded-md text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-lg">{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-border/50"><h2 className="text-sm font-bold">{tabs.find(t => t.id === activeTab)?.label}</h2></div>
            <div className="p-5">

              {/* CONTENT TAB */}
              {activeTab === 'content' && (
                <div className="space-y-6 animate-fade-up">
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
                    <Globe className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-semibold">Auto-Research Web</h4>
                        <button onClick={() => setAutoResearch(v => !v)} className={`relative w-8 h-4 rounded-full transition-colors ${autoResearch ? 'bg-primary' : 'bg-border'}`}>
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${autoResearch ? 'left-4' : 'left-0.5'}`} />
                        </button>
                      </div>
                      <p className="text-[10px] text-text-muted">Searches current web trends and data to enrich your post.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Topic / Keyword</label>
                    <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Personal Brand for Founders" className="w-full px-4 py-2.5 bg-bg border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Brief / Angle</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What unique angle or story do you want to tell?" rows={2} className="w-full px-4 py-3 bg-bg border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Content Style</label>
                    <select value={contentStyle} onChange={e => setContentStyle(e.target.value)} className="w-full px-4 py-2.5 bg-bg border border-border/60 rounded-xl text-sm focus:outline-none appearance-none font-medium cursor-pointer">
                      <option value="professional">Professional & Authoritative</option>
                      <option value="educational">Educational & Step-by-Step</option>
                      <option value="casual">Casual & Conversational</option>
                      <option value="bold">Bold & Contrarian</option>
                    </select>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Text Density</label>
                      <select value={contentLength} onChange={e => setContentLength(e.target.value)} className="w-full px-4 py-2.5 bg-bg border border-border/60 rounded-xl text-sm focus:outline-none appearance-none font-medium cursor-pointer">
                        <option value="short">Short & Punchy</option>
                        <option value="medium">Medium Form</option>
                        <option value="long">Long & Detailed</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Slides: <span className="text-primary">{slideCount}</span></label>
                      <div className="flex items-center h-10 px-2 bg-bg border border-border/60 rounded-xl">
                        <input type="range" min="4" max="10" value={slideCount} onChange={e => setSlideCount(Number(e.target.value))} className="w-full accent-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DESIGN TAB */}
              {activeTab === 'design' && (
                <div className="space-y-4 animate-fade-up pb-10">

                  {/* 1. Layout & Format */}
                  <div className="bg-surface/40 border border-border/50 rounded-2xl overflow-hidden transition-all shadow-sm">
                    <button onClick={() => setActiveAccordion(a => a === 'layout' ? '' : 'layout')} className="w-full flex items-center justify-between p-4 bg-surface/30 hover:bg-surface/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <LayoutTemplate className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider text-text-main">Layout & Format</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-300 ${activeAccordion === 'layout' ? 'rotate-180' : ''}`} />
                    </button>
                    {activeAccordion === 'layout' && (
                      <div className="p-5 border-t border-border/50 space-y-6 bg-surface/10">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Platform Format</label>
                            <div className="flex gap-2">
                              {(['instagram', 'linkedin'] as const).map(p => (
                                <button key={p} onClick={() => setPlatform(p)} className={`flex-1 p-2 rounded-lg border text-center transition-all ${platform === p ? (p === 'instagram' ? 'bg-primary/10 border-primary text-primary' : 'bg-[#0077B5]/10 border-[#0077B5] text-[#0077B5]') : 'bg-surface border-border text-text-muted hover:border-text-muted'}`}>
                                  <span className="text-[10px] font-bold block capitalize">{p}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Typography</label>
                            <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full h-[38px] px-3 bg-bg border border-border/60 rounded-lg text-xs focus:outline-none appearance-none font-medium cursor-pointer">
                              <option value="Inter">Inter (Clean & Modern)</option>
                              <option value="'Playfair Display', serif">Playfair (Elegant Serif)</option>
                              <option value="'Space Grotesk'">Space Grotesk (Tech)</option>
                              <option value="Outfit">Outfit (Geometric)</option>
                              <option value="Georgia, serif">Georgia (Classic Editorial)</option>
                              <option value="Helvetica, Arial, sans-serif">Helvetica (Standard)</option>
                            </select>
                          </div>
                        </div>
                        <div className="border-t border-border/40 pt-5">
                          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Visual Theme & Aesthetics</label>
                          <div className="grid grid-cols-4 gap-2 mb-5">
                            {(['minimal', 'geometric', 'diagonal', 'organic'] as const).map(t => (
                              <button key={t} onClick={() => setVisualTheme(t)} className={`p-2 rounded-lg border text-center transition-all ${visualTheme === t ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-surface border-border text-text-muted hover:border-text-muted'}`}>
                                <span className="text-[10px] font-bold block capitalize">{t}</span>
                              </button>
                            ))}
                          </div>
                          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Custom Design Prompting</label>
                          <textarea value={designPrompt} onChange={e => setDesignPrompt(e.target.value)} placeholder="e.g. Include icons on every slide, make the tone extremely aggressive..." rows={3} className="w-full px-4 py-3 bg-bg border border-border/60 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 font-medium resize-none shadow-sm" />
                          <p className="text-[10px] text-text-muted mt-2 leading-relaxed">The AI will actively inject <span className="text-primary font-bold">Lucide graphics</span> and adjust text alignments to fulfill your custom instructions.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Brand Identity */}
                  <div className="bg-surface/40 border border-border/50 rounded-2xl overflow-hidden transition-all shadow-sm">
                    <button onClick={() => setActiveAccordion(a => a === 'brand' ? '' : 'brand')} className="w-full flex items-center justify-between p-4 bg-surface/30 hover:bg-surface/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-text-main">Brand Identity</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-300 ${activeAccordion === 'brand' ? 'rotate-180' : ''}`} />
                    </button>
                    {activeAccordion === 'brand' && (
                      <div className="p-5 border-t border-border/50 bg-surface/10">
                        <div className="grid grid-cols-2 gap-4 mb-5">
                          <div>
                            <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1.5">Brand / Logo</label>
                            <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="STONE MEDIA" className="w-full px-3 py-2 bg-bg border border-border/60 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 font-medium" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1.5">Website URL</label>
                            <input type="text" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="www.stoneaio.com" className="w-full px-3 py-2 bg-bg border border-border/60 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 font-medium" />
                          </div>
                        </div>
                        <div className="p-4 bg-surface/50 border border-border rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div><h4 className="text-xs font-semibold">Custom Hex Colors</h4><p className="text-[10px] text-text-muted">Override palette with brand colors.</p></div>
                            <button onClick={() => setUseCustomColors(v => !v)} className={`relative w-8 h-4 rounded-full transition-colors ${useCustomColors ? 'bg-emerald-500' : 'bg-border'}`}>
                              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${useCustomColors ? 'left-4' : 'left-0.5'}`} />
                            </button>
                          </div>
                          {useCustomColors && (
                            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/30">
                              {[['Background', customBg, setCustomBg], ['Text', customText, setCustomText], ['Accent', customAccent, setCustomAccent]].map(([label, val, setter]: any) => (
                                <div key={label}><label className="block text-[9px] font-bold text-text-muted uppercase mb-1">{label}</label><input type="color" value={val} onChange={e => setter(e.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Colors & Backgrounds */}
                  <div className="bg-surface/40 border border-border/50 rounded-2xl overflow-hidden transition-all shadow-sm">
                    <button onClick={() => setActiveAccordion(a => a === 'theme' ? '' : 'theme')} className="w-full flex items-center justify-between p-4 bg-surface/30 hover:bg-surface/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <br />
                        <Palette className="w-4 h-4 text-pink-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-text-main">Colors & Backgrounds</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-300 ${activeAccordion === 'theme' ? 'rotate-180' : ''}`} />
                    </button>
                    {activeAccordion === 'theme' && (
                      <div className="p-5 border-t border-border/50 space-y-6 bg-surface/10">
                        {/* Subtle Pattern */}
                        <div className="p-4 bg-pink-500/5 border border-pink-500/20 rounded-xl flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-pink-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-xs font-semibold">Subtle Pattern Overlay</h4>
                              <button onClick={() => setUsePattern(v => !v)} className={`relative w-8 h-4 rounded-full transition-colors ${usePattern ? 'bg-pink-500' : 'bg-border'}`}>
                                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${usePattern ? 'left-4' : 'left-0.5'}`} />
                              </button>
                            </div>
                            <p className="text-[10px] text-text-muted">Adds a premium texture to slides — dots, grids, weaves and more.</p>
                            {usePattern && (
                              <div className="grid grid-cols-3 gap-2 mt-4">
                                {PATTERN_OPTIONS.map(p => (
                                  <button key={p.id} onClick={() => setSelectedPattern(p.id)}
                                    className={`py-2 px-1 rounded-lg text-[10px] font-bold border transition-all ${selectedPattern === p.id ? 'bg-pink-500/20 border-pink-400 text-pink-300' : 'bg-surface border-border text-text-muted hover:border-text-muted'}`}>
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Palettes */}
                        <div className={`pt-2 transition-all ${useCustomColors ? 'opacity-40 pointer-events-none' : ''}`}>
                          <div className="flex items-center justify-between mb-3 border-b border-border/30 pb-3">
                            <div>
                              <h4 className="text-xs font-semibold">AI Auto-Select Palette</h4>
                              <p className="text-[10px] text-text-muted">Randomly selects a fresh editorial palette every generation.</p>
                            </div>
                            <button onClick={() => setAutoGenBackground(v => !v)} className={`relative w-8 h-4 rounded-full transition-colors ${autoGenBackground ? 'bg-pink-500' : 'bg-border'}`}>
                              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${autoGenBackground ? 'left-4' : 'left-0.5'}`} />
                            </button>
                          </div>
                          <div className={`transition-all ${autoGenBackground ? 'opacity-40 pointer-events-none' : ''}`}>
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Choose Palette</label>
                            <div className="grid grid-cols-2 gap-2">
                              {GALLERY_BACKGROUNDS.map(bg => (
                                <button key={bg.id} onClick={() => setSelectedBgId(bg.id)}
                                  className={`relative rounded-xl overflow-hidden border-2 transition-all h-14 flex items-center justify-center ${selectedBgId === bg.id ? 'border-primary shadow-[0_0_12px_rgba(67,97,238,0.3)] scale-105 z-10' : 'border-transparent hover:border-border'}`}
                                  style={{ backgroundColor: bg.bg }}>
                                  <span style={{ color: bg.text, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em' }}>{bg.name}</span>
                                  {selectedBgId === bg.id && <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow"><CheckCircle2 className="w-2.5 h-2.5 text-white" /></div>}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Custom Images */}
                        <div className="pt-4 border-t border-border/40">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider">Image Gallery</h3>
                            <button onClick={() => setSelectedBgImage(null)} className="text-[10px] text-text-muted hover:text-white transition-colors">Clear Selection</button>
                          </div>
                          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                          <button onClick={() => fileInputRef.current?.click()} className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 rounded-xl transition-all cursor-pointer mb-4">
                            <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shadow-sm mb-3">
                              <Image className="w-4 h-4 text-text-muted" />
                            </div>
                            <span className="text-xs font-bold text-text-main mb-1">Upload Background</span>
                            <span className="text-[10px] text-text-muted text-center max-w-[200px]">JPG, PNG, WEBP. Adds a dark overlay for text readability.</span>
                          </button>

                          {uploadedImages.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {uploadedImages.map((img, i) => (
                                <button key={i} onClick={() => setSelectedBgImage(img)} className={`relative rounded-xl overflow-hidden aspect-[4/3] border-2 transition-all group ${selectedBgImage === img ? 'border-primary shadow-[0_0_12px_rgba(67,97,238,0.3)] scale-105 z-10' : 'border-border/40 hover:border-border'}`}>
                                  <img src={img} alt="Uploaded" className="w-full h-full object-cover" />
                                  {selectedBgImage === img && <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow"><CheckCircle2 className="w-2.5 h-2.5 text-white" /></div>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SETTINGS TAB */}
              {activeTab === 'settings' && (
                <div className="space-y-4 animate-fade-up opacity-60">
                  <div className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3">
                    <Zap className="w-4 h-4 text-amber mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold mb-1">AI Model</h4>
                      <p className="text-[10px] text-text-muted mb-2">Powered by Gemini 2.5 Flash with Google Search grounding and creativity seed randomization.</p>
                      <select disabled className="w-full px-3 py-2 bg-bg border border-border/60 rounded-lg text-xs opacity-80 cursor-not-allowed">
                        <option>Gemini 2.5 Flash (Default)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main canvas */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-bg/50">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="flex-1 overflow-auto p-8 relative z-10 flex flex-col items-center justify-center min-h-0">

            {/* IDLE */}
            {generationStep === 0 && (
              <div className="flex flex-col items-center text-center max-w-md animate-fade-up">
                <div className="w-20 h-20 bg-surface border border-border rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                  <LayoutTemplate className="w-8 h-8 text-text-muted" />
                </div>
                <h2 className="text-2xl font-black mb-2 tracking-tight">Generate Your Carousel</h2>
                <p className="text-sm text-text-muted mb-8 leading-relaxed">
                  AI has full creative freedom — every generation is completely unique. Configure your topic and hit generate.
                </p>
                <button onClick={handleGenerate} className="bg-gradient-to-r from-primary to-pink-600 text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-[0_10px_25px_rgba(67,97,238,0.3)] hover:shadow-[0_15px_35px_rgba(219,39,119,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group border border-white/20">
                  <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  Generate Multi-Page Content
                </button>
              </div>
            )}

            {/* LOADING */}
            {generationStep > 0 && generationStep < 4 && (
              <div className="flex flex-col items-center max-w-md w-full animate-fade-up bg-surface/80 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl">
                <div className="relative w-24 h-24 mb-8">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                  <div className="absolute inset-2 bg-gradient-to-br from-primary to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-6 text-center">AI Crafting Your Carousel</h3>
                <div className="w-full space-y-4">
                  {[
                    { step: 1, text: autoResearch ? 'Researching trending web content...' : 'Analyzing topic & creative strategy...' },
                    { step: 2, text: 'Writing unique editorial-quality copy...' },
                    { step: 3, text: 'Composing layouts & design...' },
                  ].map(s => (
                    <div key={s.step} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${generationStep > s.step ? 'bg-green border-green text-white' : generationStep === s.step ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-border text-text-muted'}`}>
                        {generationStep > s.step ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                      </div>
                      <span className={`text-sm font-medium ${generationStep >= s.step ? 'text-text-main' : 'text-text-muted'}`}>{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PREVIEW */}
            {generationStep === 4 && generatedSlides.length > 0 && (
              <div className="w-full h-full flex flex-col animate-fade-up">
                <div className="flex items-center justify-between w-full max-w-6xl mx-auto mb-6 shrink-0">
                  <div>
                    <h3 className="text-lg font-bold">{generatedSlides.length} Slides Ready</h3>
                    <p className="text-xs text-text-muted capitalize">Optimized for {platform}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setGenerationStep(0); setGeneratedSlides([]); }} className="text-xs font-semibold px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors">Regenerate</button>
                    <button onClick={handleExportZip} disabled={isExporting} className="text-xs font-bold px-4 py-2 bg-surface border border-border/60 hover:border-primary/50 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                      {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />} ZIP
                    </button>
                    <button onClick={handleExportPdf} disabled={isExporting} className="text-xs font-bold px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                      {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                    </button>
                    <button className="text-xs font-bold px-4 py-2 bg-[#0077B5] hover:bg-[#0077B5]/90 text-white rounded-lg flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Publish
                    </button>
                  </div>
                </div>

                <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col items-center justify-center min-h-0">
                  <div className="relative group">
                    <div className={`relative overflow-hidden shadow-2xl w-[440px] max-w-full ${aspectClass}`} style={{ borderRadius: 0 }}>
                      {currentSlideIndex > 0 && (
                        <button onClick={() => setCurrentSlideIndex(p => p - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center z-50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                      )}
                      {currentSlideIndex < generatedSlides.length - 1 && (
                        <button onClick={() => setCurrentSlideIndex(p => p + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center z-50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowLeft className="w-5 h-5 rotate-180" />
                        </button>
                      )}
                      <SlideRenderer slide={generatedSlides[currentSlideIndex]} palette={activePalette} websiteUrl={websiteUrl} brandName={brandName} patternId={activePatternId} bgImage={selectedBgImage} fontFamily={fontFamily} visualTheme={visualTheme} slideIndex={currentSlideIndex} totalSlides={generatedSlides.length} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    {generatedSlides.map((_, i) => (
                      <button key={i} onClick={() => setCurrentSlideIndex(i)} className={`transition-all rounded-full ${currentSlideIndex === i ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-text-muted/40 hover:bg-text-muted'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-text-muted mt-3 font-medium">
                    Slide {currentSlideIndex + 1} of {generatedSlides.length} · <span className="capitalize">{generatedSlides[currentSlideIndex]?.type}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
