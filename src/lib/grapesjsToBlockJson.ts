export type BlockType =
  | 'TEXT'
  | 'IMAGE'
  | 'BUTTON'
  | 'DIVIDER'
  | 'SPACER'
  | 'COLUMNS'
  | 'SOCIAL_LINKS'
  | 'HEADER_LOGO'
  | 'FOOTER_UNSUBSCRIBE';

export interface EmailBlock {
  id: string;
  type: BlockType;
  props: Record<string, any>;
}

export interface BlockJson {
  blocks: EmailBlock[];
}

/**
 * Converts a GrapesJS editor instance or an exported HTML string into
 * the canonical BlockJson format expected by mjml-compiler.service.ts.
 */
export function grapesjsToBlockJson(editorOrHtml: any): BlockJson {
  let html = '';
  if (typeof editorOrHtml === 'string') {
    html = editorOrHtml;
  } else if (editorOrHtml && typeof editorOrHtml.getHtml === 'function') {
    html = editorOrHtml.getHtml();
  } else if (editorOrHtml && editorOrHtml.html) {
    html = editorOrHtml.html;
  }

  if (!html || !html.trim()) {
    return { blocks: [] };
  }

  // Parse HTML elements into structured EmailBlocks
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
  if (!parser) {
    // Node environment fallback
    return {
      blocks: [
        {
          id: `block-${Date.now()}-1`,
          type: 'TEXT',
          props: { html },
        },
      ],
    };
  }

  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const elements = Array.from(doc.body.children);
  const blocks: EmailBlock[] = [];

  let idx = 0;
  for (const el of elements) {
    idx++;
    const tagName = el.tagName.toLowerCase();
    const gjsType = el.getAttribute('data-gjs-type') || '';

    if (gjsType === 'image' || tagName === 'img') {
      blocks.push({
        id: `block-${Date.now()}-${idx}`,
        type: 'IMAGE',
        props: {
          src: el.getAttribute('src') || el.querySelector('img')?.getAttribute('src') || '',
          alt: el.getAttribute('alt') || el.querySelector('img')?.getAttribute('alt') || '',
          width: el.getAttribute('width') || (el as HTMLElement).style.width || '100%',
          align: (el as HTMLElement).style.textAlign || 'center',
        },
      });
    } else if (gjsType === 'link' || tagName === 'a' || el.classList.contains('button') || el.querySelector('a.btn, a.button')) {
      const linkEl = tagName === 'a' ? el : el.querySelector('a') || el;
      blocks.push({
        id: `block-${Date.now()}-${idx}`,
        type: 'BUTTON',
        props: {
          label: linkEl.textContent?.trim() || 'Click Here',
          href: linkEl.getAttribute('href') || '#',
          buttonColor: (linkEl as HTMLElement).style.backgroundColor || '#6366f1',
          textColor: (linkEl as HTMLElement).style.color || '#ffffff',
          borderRadius: (linkEl as HTMLElement).style.borderRadius || '6px',
        },
      });
    } else if (tagName === 'hr' || el.classList.contains('divider')) {
      blocks.push({
        id: `block-${Date.now()}-${idx}`,
        type: 'DIVIDER',
        props: {
          color: (el as HTMLElement).style.borderColor || '#e5e7eb',
        },
      });
    } else if (el.classList.contains('spacer')) {
      blocks.push({
        id: `block-${Date.now()}-${idx}`,
        type: 'SPACER',
        props: {
          height: (el as HTMLElement).style.height || '30px',
        },
      });
    } else {
      // Default to TEXT block
      blocks.push({
        id: `block-${Date.now()}-${idx}`,
        type: 'TEXT',
        props: {
          html: el.outerHTML,
          text: el.textContent?.trim() || '',
        },
      });
    }
  }

  if (blocks.length === 0 && html.trim()) {
    blocks.push({
      id: `block-${Date.now()}-1`,
      type: 'TEXT',
      props: { html },
    });
  }

  return { blocks };
}
