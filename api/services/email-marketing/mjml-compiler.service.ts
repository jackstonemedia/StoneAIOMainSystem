/**
 * MJML Compiler Service — Email Marketing Module
 *
 * Converts structured block JSON → MJML → email-safe HTML.
 * Called at send time (per-contact personalization) and preview time.
 *
 * Merge tag syntax: {{contact.first_name | fallback:"there"}}
 * If a tag resolves to null/undefined and no fallback is given, renders empty string.
 * Never renders the literal tag text, "undefined", or "null".
 */

import mjml2html from 'mjml';

// ── Block type definitions ────────────────────────────────────────────────────

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

export interface MergeTagContext {
  contact: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    custom?: Record<string, string | number | boolean | null | undefined>;
  };
  unsubscribeUrl?: string;
  mailingAddress?: string;
}

// ── Merge tag resolution ──────────────────────────────────────────────────────

/**
 * Resolves all merge tags in a string against the given context.
 * Syntax: {{contact.first_name}} or {{contact.first_name | fallback:"there"}}
 */
export function resolveMergeTags(text: string, ctx: MergeTagContext): string {
  if (!text) return text;

  return text.replace(/\{\{([^}]+)\}\}/g, (_match, raw) => {
    const parts = raw.split('|');
    const tagPath = parts[0].trim(); // e.g. "contact.first_name"
    const fallbackStr = parts[1]?.trim(); // e.g. 'fallback:"there"'

    // Resolve tag value (supports contact.first_name, first_name, etc.)
    let value: string | number | boolean | null | undefined;
    const cleanTag = tagPath.replace(/^contact\./, '');
    if (cleanTag === 'first_name' || cleanTag === 'firstName') {
      value = ctx.contact.first_name;
    } else if (cleanTag === 'last_name' || cleanTag === 'lastName') {
      value = ctx.contact.last_name;
    } else if (cleanTag === 'email') {
      value = ctx.contact.email;
    } else if (tagPath.startsWith('contact.custom.')) {
      const key = tagPath.slice('contact.custom.'.length);
      value = ctx.contact.custom?.[key];
    } else {
      value = undefined;
    }

    // Resolve fallback
    if (value == null || value === '') {
      if (fallbackStr) {
        // Extract quoted fallback value: fallback:"there" → "there"
        const fallbackMatch = fallbackStr.match(/^fallback:\s*"([^"]*)"/) ||
                              fallbackStr.match(/^fallback:\s*'([^']*)'/) ||
                              fallbackStr.match(/^fallback:\s*(\S+)/);
        return fallbackMatch ? fallbackMatch[1] : '';
      }
      return '';
    }

    return String(value);
  });
}

// ── Block → MJML converters ───────────────────────────────────────────────────

function blockToMjml(block: EmailBlock, ctx: MergeTagContext): string {
  const p = block.props;

  switch (block.type) {
    case 'HEADER_LOGO': {
      const src = p.logoUrl || '';
      const alt = p.altText ? resolveMergeTags(p.altText, ctx) : 'Logo';
      const width = p.width || '150px';
      const align = p.align || 'center';
      return `
      <mj-section background-color="${p.backgroundColor || '#ffffff'}">
        <mj-column>
          <mj-image src="${src}" alt="${alt}" width="${width}" align="${align}" />
        </mj-column>
      </mj-section>`;
    }

    case 'TEXT': {
      const content = resolveMergeTags(p.html || p.text || '', ctx);
      return `
      <mj-section background-color="${p.backgroundColor || '#ffffff'}" padding="${p.padding || '10px 20px'}">
        <mj-column>
          <mj-text font-family="${p.fontFamily || 'Arial, sans-serif'}" font-size="${p.fontSize || '16px'}" color="${p.color || '#333333'}" line-height="${p.lineHeight || '1.6'}">
            ${content}
          </mj-text>
        </mj-column>
      </mj-section>`;
    }

    case 'IMAGE': {
      const src = resolveMergeTags(p.src || '', ctx);
      const alt = resolveMergeTags(p.alt || '', ctx);
      const href = p.href ? resolveMergeTags(p.href, ctx) : undefined;
      const linkAttr = href ? `href="${href}"` : '';
      return `
      <mj-section background-color="${p.backgroundColor || '#ffffff'}" padding="${p.padding || '10px 20px'}">
        <mj-column>
          <mj-image src="${src}" alt="${alt}" ${linkAttr} width="${p.width || '100%'}" align="${p.align || 'center'}" border-radius="${p.borderRadius || '0px'}" />
        </mj-column>
      </mj-section>`;
    }

    case 'BUTTON': {
      const label = resolveMergeTags(p.label || 'Click Here', ctx);
      const href = resolveMergeTags(p.href || '#', ctx);
      return `
      <mj-section background-color="${p.backgroundColor || '#ffffff'}" padding="${p.padding || '10px 20px'}">
        <mj-column>
          <mj-button background-color="${p.buttonColor || '#6366f1'}" color="${p.textColor || '#ffffff'}" href="${href}" border-radius="${p.borderRadius || '6px'}" font-size="${p.fontSize || '16px'}" font-weight="${p.fontWeight || 'bold'}" align="${p.align || 'center'}" padding="${p.buttonPadding || '12px 24px'}">
            ${label}
          </mj-button>
        </mj-column>
      </mj-section>`;
    }

    case 'DIVIDER': {
      return `
      <mj-section background-color="${p.backgroundColor || '#ffffff'}" padding="${p.padding || '10px 20px'}">
        <mj-column>
          <mj-divider border-color="${p.color || '#e5e7eb'}" border-width="${p.thickness || '1px'}" border-style="${p.style || 'solid'}" width="${p.width || '100%'}" />
        </mj-column>
      </mj-section>`;
    }

    case 'SPACER': {
      const height = p.height || '30px';
      return `
      <mj-section background-color="${p.backgroundColor || '#ffffff'}" padding="0">
        <mj-column>
          <mj-spacer height="${height}" />
        </mj-column>
      </mj-section>`;
    }

    case 'COLUMNS': {
      const colCount = p.columns || 2;
      const cols: string[] = (p.columnContents || []).slice(0, colCount);
      while (cols.length < colCount) cols.push('');

      const width = colCount === 3 ? '33.333%' : '50%';
      const columnMjml = cols.map((html: string) => {
        const resolved = resolveMergeTags(html || '', ctx);
        return `
          <mj-column width="${width}">
            <mj-text font-family="Arial, sans-serif" font-size="16px" color="#333333">${resolved}</mj-text>
          </mj-column>`;
      }).join('');

      return `
      <mj-section background-color="${p.backgroundColor || '#ffffff'}" padding="${p.padding || '10px 20px'}">
        ${columnMjml}
      </mj-section>`;
    }

    case 'SOCIAL_LINKS': {
      const links: Array<{ platform: string; url: string }> = p.links || [];
      const iconSize = p.iconSize || '32px';
      // Generate basic text links for social (MJML social component is optional)
      const socialItems = links.map(l =>
        `<mj-social-element name="${l.platform.toLowerCase()}" href="${l.url}" icon-size="${iconSize}">${l.platform}</mj-social-element>`
      ).join('');
      if (!socialItems) return '';
      return `
      <mj-section background-color="${p.backgroundColor || '#ffffff'}" padding="${p.padding || '10px 20px'}">
        <mj-column>
          <mj-social align="${p.align || 'center'}" font-size="12px" icon-size="${iconSize}" mode="horizontal">
            ${socialItems}
          </mj-social>
        </mj-column>
      </mj-section>`;
    }

    case 'FOOTER_UNSUBSCRIBE': {
      const address = resolveMergeTags(p.mailingAddress || ctx.mailingAddress || '', ctx);
      const unsubUrl = p.unsubscribeUrl || ctx.unsubscribeUrl || '#';
      const unsubText = resolveMergeTags(p.unsubscribeText || 'Unsubscribe', ctx);
      const footerText = resolveMergeTags(p.footerText || '', ctx);
      return `
      <mj-section background-color="${p.backgroundColor || '#f9fafb'}" padding="${p.padding || '20px'}">
        <mj-column>
          <mj-text align="center" font-size="12px" color="#9ca3af" font-family="Arial, sans-serif" line-height="1.5">
            ${footerText ? `<p>${footerText}</p>` : ''}
            ${address ? `<p>${address}</p>` : ''}
            <p><a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline;">${unsubText}</a></p>
          </mj-text>
        </mj-column>
      </mj-section>`;
    }

    default:
      return '';
  }
}

// ── Main compiler function ────────────────────────────────────────────────────

export interface CompileResult {
  html: string;
  errors: string[];
}

/**
 * Compiles structured block JSON + merge tag context → email-safe HTML.
 *
 * Called at:
 *   - Send time (per recipient, ctx has the real contact data)
 *   - Preview time (ctx uses sample/admin data)
 */
export function compileBlockJsonToHtml(
  blockJson: BlockJson | Record<string, any> | string,
  mergeTagContext: MergeTagContext
): CompileResult {
  // If blockJson is a direct HTML string or object with { html: string }
  let directHtml = typeof blockJson === 'string' ? blockJson : (blockJson as any)?.html || (blockJson as any)?.body;

  if (directHtml) {
    const resolvedBody = resolveMergeTags(directHtml, mergeTagContext);
    const unsubUrl = mergeTagContext.unsubscribeUrl || '#';

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 32px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af; }
    .footer a { color: #6b7280; text-decoration: underline; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="container">
    ${resolvedBody}
    <div class="footer">
      <p>Sent via Stone AIO</p>
      <p><a href="${unsubUrl}">Unsubscribe from future emails</a></p>
    </div>
  </div>
</body>
</html>`;

    return { html: fullHtml, errors: [] };
  }

  const json = blockJson as BlockJson;
  const blocks: EmailBlock[] = Array.isArray(json?.blocks) ? json.blocks : [];

  const sectionsMjml = blocks.map(b => blockToMjml(b, mergeTagContext)).join('\n');

  const fullMjml = `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, Helvetica, sans-serif" />
      <mj-text line-height="1.6" />
    </mj-attributes>
    <mj-style>
      a { color: inherit; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f3f4f6">
    ${sectionsMjml}
  </mj-body>
</mjml>`;

  const rawResult = mjml2html(fullMjml, { validationLevel: 'soft' }) as any;
  const result = rawResult as { html: string; errors: any[] };

  return {
    html: result.html,
    errors: result.errors?.map((e: any) => e.formattedMessage || String(e)) || [],
  };
}
