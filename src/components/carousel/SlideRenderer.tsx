import React from 'react';
import * as LucideIcons from 'lucide-react';

export const GALLERY_BACKGROUNDS = [
  { id: 'dark-lime',    name: 'Dark & Lime',     bg: '#52677D', text: '#ffffff', accent: '#52677D' },
  { id: 'cream',        name: 'Editorial Cream', bg: '#52677D', text: '#52677D', accent: '#52677D' },
  { id: 'royal-purple', name: 'Royal Purple',    bg: '#52677D', text: '#ffffff', accent: '#52677D' },
  { id: 'burgundy',     name: 'Burgundy Gold',   bg: '#52677D', text: '#ffffff', accent: '#52677D' },
  { id: 'soft-purple',  name: 'Soft Purple',     bg: '#52677D', text: '#ffffff', accent: '#ffffff' },
  { id: 'yellow',       name: 'Electric Yellow', bg: '#52677D', text: '#52677D', accent: '#52677D' },
  { id: 'navy',         name: 'Navy & Sky',      bg: '#52677D', text: '#ffffff', accent: '#52677D' },
  { id: 'warm-black',   name: 'Warm Black',      bg: '#52677D', text: '#ffffff', accent: '#52677D' },
  { id: 'blush',        name: 'Blush Rose',      bg: '#52677D', text: '#52677D', accent: '#52677D' },
  { id: 'forest',       name: 'Forest Sage',     bg: '#52677D', text: '#ffffff', accent: '#52677D' },
];

export const AUTO_PALETTES = GALLERY_BACKGROUNDS;

export const PATTERNS = {
  dots: (color: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='2' cy='2' r='1.5' fill='${color}' opacity='0.18'/></svg>`,
  grid: (color: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><path d='M32 0H0v32' fill='none' stroke='${color}' stroke-width='0.5' opacity='0.15'/></svg>`,
  diagonals: (color: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><path d='M0 20L20 0' fill='none' stroke='${color}' stroke-width='0.7' opacity='0.12'/></svg>`,
  circles: (color: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><circle cx='30' cy='30' r='28' fill='none' stroke='${color}' stroke-width='0.5' opacity='0.1'/></svg>`,
  hexagons: (color: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='46'><polygon points='20,2 38,11 38,35 20,44 2,35 2,11' fill='none' stroke='${color}' stroke-width='0.6' opacity='0.1'/></svg>`,
  waves: (color: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='20'><path d='M0 10 Q20 0 40 10 Q60 20 80 10' fill='none' stroke='${color}' stroke-width='0.8' opacity='0.12'/></svg>`,
};

export const PATTERN_OPTIONS = [
  { id: 'dots',      label: 'Dots' },
  { id: 'grid',      label: 'Grid' },
  { id: 'diagonals', label: 'Lines' },
  { id: 'circles',   label: 'Circles' },
  { id: 'hexagons',  label: 'Hexagons' },
  { id: 'waves',     label: 'Waves' },
];

export function svgToDataUri(svgStr: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svgStr)}")`;
}

export const SvgArrow = ({ color }: { color: string }) => (
  <svg width="40" height="12" viewBox="0 0 60 20" fill="none"><path d="M0 10H52M52 10L43 2M52 10L43 18" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
export const SvgDiamond = ({ color, op = 0.4 }: { color: string; op?: number }) => (
  <svg width="16" height="16" viewBox="0 0 30 30" fill="none" style={{ opacity: op }}><path d="M15 3L27 15L15 27L3 15Z" stroke={color} strokeWidth="1.5"/></svg>
);
export const SvgCheck = ({ color, op = 0.35 }: { color: string; op?: number }) => (
  <svg width="22" height="22" viewBox="0 0 30 30" fill="none" style={{ opacity: op }}><circle cx="15" cy="15" r="13" stroke={color} strokeWidth="1.5"/><path d="M9 15L13 19L21 11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export function SlideRenderer({ slide, palette, websiteUrl, brandName, patternId, bgImage, fontFamily, visualTheme, slideIndex, totalSlides }: any) {
  const { bg, text, accent } = palette;
  const font = { fontFamily: `${fontFamily}, system-ui, sans-serif` };
  const base: React.CSSProperties = {
    ...font, color: text, width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
    ...(bgImage 
      ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)), url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { backgroundColor: bg }
    )
  };
  const pad: React.CSSProperties = { padding: '28px 30px 20px' };
  const center: React.CSSProperties = { textAlign: 'center', alignItems: 'center' };

  const patternBg: React.CSSProperties = patternId && (PATTERNS as any)[patternId] ? {
    position: 'absolute', inset: 0, zIndex: 0, backgroundImage: svgToDataUri((PATTERNS as any)[patternId](text)), backgroundRepeat: 'repeat', pointerEvents: 'none',
  } : {};

  const inner: React.CSSProperties = { position: 'relative', zIndex: 1, ...pad, height: '100%', display: 'flex', flexDirection: 'column' };

  const Corners = () => (
    <>
      {websiteUrl && <span style={{ position: 'absolute', bottom: 20, left: 24, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', opacity: 0.5, zIndex: 20 }}>{websiteUrl}</span>}
      {brandName && <span style={{ position: 'absolute', bottom: 20, right: 24, fontSize: 8.5, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '3px 8px', border: `1px solid ${text}`, borderRadius: 2, opacity: 0.5, zIndex: 20 }}>{brandName}</span>}
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

  if (slide.type === 'cover') return (
    <div style={base}>
      {patternId && <div style={patternBg} />}<ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexShrink: 0 }}><SvgDiamond color={text} op={0.3} /><SvgCheck color={text} op={0.3} /></div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <h1 style={{ color: accent, fontSize: 38, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 26, wordBreak: 'break-word', textAlign: 'center' }}>{slide.title}</h1>
          <div style={{ width: 36, height: 4, backgroundColor: accent, opacity: 0.5, borderRadius: 4, marginBottom: 26, flexShrink: 0 }} />
          <p style={{ fontSize: 13.5, opacity: 0.8, lineHeight: 1.6, fontWeight: 500, textAlign: 'center', ...clampBody }}>{slide.body}</p>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.35 }}><span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Swipe to continue</span><SvgArrow color={text} /></div></div>
        <Corners />
      </div>
    </div>
  );

  const midTitle: React.CSSProperties = { color: accent, fontSize: 32, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 28 };
  const midBody: React.CSSProperties = { fontSize: 13.5, opacity: 0.85, lineHeight: 1.6, fontWeight: 450, ...clampBody };
  const midLabel: React.CSSProperties = { color: text, opacity: 0.4, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 };

  const ThemeStepNum = ({ num, align = 'center' }: { num: string | number, align?: 'center' | 'left' }) => {
    if (visualTheme === 'geometric') return <div style={{ backgroundColor: accent, color: bg, padding: '4px 10px', fontWeight: 900, fontSize: 18, marginBottom: 16, display: 'inline-block' }}>#{num}</div>;
    if (visualTheme === 'diagonal') return <div style={{ WebkitTextStroke: `2px ${text}`, color: 'transparent', fontSize: 64, fontWeight: 900, marginBottom: 8, lineHeight: 1, letterSpacing: '-0.02em' }}>{num}</div>;
    return <span style={{ ...midLabel, textAlign: align, width: '100%', display: 'block' }}>Step {num}</span>;
  };

  const ThemeTitle = ({ title, align = 'center' }: { title: string, align?: 'center' | 'left' }) => {
    if (visualTheme === 'organic') return <div style={{ width: '100%', textAlign: align, marginBottom: 28 }}><h2 style={{ ...midTitle, marginBottom: 0, textAlign: align, backgroundColor: text, color: bg, padding: '6px 14px', display: 'inline-block' }}>{title}</h2></div>;
    if (visualTheme === 'geometric') return <h2 style={{ ...midTitle, textAlign: align, width: '100%', textTransform: 'uppercase' }}>{title}</h2>;
    return <h2 style={{ ...midTitle, textAlign: align, width: '100%' }}>{title}</h2>;
  };

  const IconComponent = slide.lucideIcon && (LucideIcons as any)[slide.lucideIcon] ? (LucideIcons as any)[slide.lucideIcon] : null;
  const RenderIcon = ({ mb = 20, align = 'center' }: { mb?: number, align?: 'center' | 'left' }) => 
    IconComponent ? <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start', width: '100%', marginBottom: mb }}><IconComponent color={accent} size={44} strokeWidth={1.5} /></div> : null;

  if (slide.type === 'step') return (
    <div style={base}>{patternId && <div style={patternBg} />}<ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}><SvgDiamond color={text} op={0.2} /><SvgCheck color={text} op={0.2} /></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <RenderIcon />{slide.stepNum && <ThemeStepNum num={slide.stepNum} />}<ThemeTitle title={slide.title} /><p style={{ ...midBody, textAlign: 'center' }}>{slide.body}</p>
        </div><Corners />
      </div>
    </div>
  );

  if (slide.type === 'quote') return (
    <div style={base}>{patternId && <div style={patternBg} />}<ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}><SvgDiamond color={text} op={0.2} /><SvgCheck color={text} op={0.2} /></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <RenderIcon />{slide.title && <span style={midLabel}>{slide.title}</span>}<h2 style={{ ...midTitle, textAlign: 'center', fontStyle: 'italic' }}>"{slide.body}"</h2>
        </div><Corners />
      </div>
    </div>
  );

  if (slide.type === 'statistic') return (
    <div style={base}>{patternId && <div style={patternBg} />}<ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}><SvgDiamond color={text} op={0.2} /><SvgCheck color={text} op={0.2} /></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <RenderIcon /><span style={{ ...midLabel, textAlign: 'center', width: '100%', display: 'block' }}>Key Data</span><ThemeTitle title={slide.title} /><p style={{ ...midBody, textAlign: 'center' }}>{slide.body}</p>
        </div><Corners />
      </div>
    </div>
  );

  if (slide.type === 'listicle') return (
    <div style={base}>{patternId && <div style={patternBg} />}<ThemeDecorator />
      <div style={inner}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}><SvgDiamond color={text} op={0.2} /><SvgCheck color={text} op={0.2} /></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingLeft: 8, paddingRight: 8 }}>
          <RenderIcon align="left" mb={16} /><h2 style={{ ...midTitle, textAlign: 'left', marginBottom: 20 }}>{slide.title}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(slide.items || []).map((item: string, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}><span style={{ color: accent, fontSize: 13.5, fontWeight: 900, marginTop: 1 }}>•</span><p style={{ ...midBody, textAlign: 'left' }}>{item}</p></div>
            ))}
          </div>
        </div><Corners />
      </div>
    </div>
  );

  if (slide.type === 'comparison') return (
    <div style={base}>{patternId && <div style={patternBg} />}<ThemeDecorator />
      <div style={inner}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}><SvgDiamond color={text} op={0.2} /><SvgCheck color={text} op={0.2} /></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingLeft: 12, paddingRight: 12 }}>
          <RenderIcon align="left" mb={20} />
          <div style={{ marginBottom: 24, paddingLeft: 10, borderLeft: `2px solid ${text}20` }}><span style={{ ...midLabel, display: 'block', marginBottom: 6 }}>{slide.leftTitle || 'Before'}</span><p style={{ ...midBody, textAlign: 'left', opacity: 0.6, fontStyle: 'italic' }}>{slide.leftBody}</p></div>
          <div style={{ paddingLeft: 10, borderLeft: `2px solid ${accent}` }}><span style={{ ...midLabel, color: accent, opacity: 1, display: 'block', marginBottom: 6 }}>{slide.rightTitle || 'After'}</span><p style={{ ...midBody, textAlign: 'left', fontWeight: 600 }}>{slide.rightBody}</p></div>
        </div><Corners />
      </div>
    </div>
  );

  if (slide.type === 'freeform') {
    const align = slide.textAlign || 'center';
    const alignCss = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
    return (
      <div style={base}>{patternId && <div style={patternBg} />}<ThemeDecorator />
        <div style={inner}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12, flexShrink: 0 }}><SvgDiamond color={text} op={0.2} /><SvgCheck color={text} op={0.2} /></div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: alignCss, minHeight: 0, padding: '0 12px' }}>
          <RenderIcon align={align as any} mb={20} />{slide.label && <span style={{ ...midLabel, textAlign: align, width: '100%' }}>{slide.label}</span>}{slide.title && <ThemeTitle title={slide.title} align={align as any} />}{slide.body && <p style={{ ...midBody, textAlign: align, width: '100%' }}>{slide.body}</p>}
            {slide.bullets && slide.bullets.length > 0 && (<div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, width: '100%' }}>{slide.bullets.map((b: string, i: number) => (<div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}><span style={{ color: accent, fontSize: 13.5, fontWeight: 900, marginTop: 1 }}>•</span><p style={{ ...midBody, textAlign: 'left', margin: 0 }}>{b}</p></div>))}</div>)}
            {slide.accentBox && (<div style={{ marginTop: 24, padding: 16, borderLeft: `3px solid ${accent}`, backgroundColor: `${text}10`, width: '100%' }}><p style={{ ...midBody, textAlign: align, margin: 0, fontStyle: 'italic', opacity: 1 }}>{slide.accentBox}</p></div>)}
          </div><Corners />
        </div>
      </div>
    );
  }

  if (slide.type === 'cta') return (
    <div style={base}>{patternId && <div style={patternBg} />}<ThemeDecorator />
      <div style={{ ...inner, ...center }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexShrink: 0 }}><SvgDiamond color={text} op={0.3} /><SvgCheck color={text} op={0.3} /></div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <RenderIcon mb={24} /><h2 style={{ color: accent, fontSize: 44, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 24, textAlign: 'center' }}>{slide.title}</h2><p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6, fontWeight: 450, textAlign: 'center', ...clampBody }}>{slide.body}</p>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}><span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Save this post ↓</span></div></div><Corners />
      </div>
    </div>
  );

  return <div style={{ ...base, ...pad, alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>Unknown type</div>;
}
