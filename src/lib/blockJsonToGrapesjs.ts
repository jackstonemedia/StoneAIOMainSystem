import type { BlockJson, EmailBlock } from './grapesjsToBlockJson';

/**
 * Converts stored BlockJson or legacy HTML back into HTML compatible with GrapesJS canvas.
 */
export function blockJsonToGrapesjs(blockJson: BlockJson | Record<string, any> | string): { html: string } {
  if (typeof blockJson === 'string') {
    return { html: blockJson };
  }

  if (!blockJson) {
    return { html: '' };
  }

  const directHtml = (blockJson as any)?.html || (blockJson as any)?.body;
  if (directHtml) {
    return { html: directHtml };
  }

  const blocks: EmailBlock[] = Array.isArray((blockJson as any)?.blocks) ? (blockJson as any).blocks : [];
  if (blocks.length === 0) {
    return { html: '' };
  }

  const htmlParts = blocks.map(block => {
    const p = block.props || {};
    switch (block.type) {
      case 'HEADER_LOGO':
        return `<div data-gjs-type="image" style="text-align: ${p.align || 'center'}; padding: 16px 0;">
  <img src="${p.logoUrl || ''}" alt="${p.altText || 'Logo'}" style="width: ${p.width || '150px'}; max-width: 100%; display: inline-block;" />
</div>`;

      case 'TEXT':
        return `<div data-gjs-type="text" style="font-family: ${p.fontFamily || 'Arial, sans-serif'}; font-size: ${p.fontSize || '16px'}; color: ${p.color || '#333333'}; line-height: ${p.lineHeight || '1.6'}; padding: 10px 0;">
  ${p.html || p.text || ''}
</div>`;

      case 'IMAGE':
        return `<div data-gjs-type="image" style="text-align: ${p.align || 'center'}; padding: 10px 0;">
  <img src="${p.src || ''}" alt="${p.alt || ''}" style="width: ${p.width || '100%'}; max-width: 100%; border-radius: ${p.borderRadius || '0px'};" />
</div>`;

      case 'BUTTON':
        return `<div style="text-align: ${p.align || 'center'}; padding: 16px 0;">
  <a data-gjs-type="link" href="${p.href || '#'}" class="button" style="background-color: ${p.buttonColor || '#6366f1'}; color: ${p.textColor || '#ffffff'}; padding: ${p.buttonPadding || '12px 24px'}; text-decoration: none; border-radius: ${p.borderRadius || '6px'}; font-size: ${p.fontSize || '16px'}; font-weight: ${p.fontWeight || 'bold'}; display: inline-block;">
    ${p.label || 'Click Here'}
  </a>
</div>`;

      case 'DIVIDER':
        return `<hr style="border: none; border-top: ${p.thickness || '1px'} solid ${p.color || '#e5e7eb'}; margin: 16px 0;" />`;

      case 'SPACER':
        return `<div class="spacer" style="height: ${p.height || '30px'};"></div>`;

      case 'FOOTER_UNSUBSCRIBE':
        return `<div style="text-align: center; font-size: 12px; color: #9ca3af; padding: 24px 0; border-top: 1px solid #e5e7eb; margin-top: 24px;">
  ${p.footerText ? `<p style="margin: 4px 0;">${p.footerText}</p>` : ''}
  ${p.mailingAddress ? `<p style="margin: 4px 0;">${p.mailingAddress}</p>` : ''}
  <p style="margin: 4px 0;"><a href="${p.unsubscribeUrl || '{{unsubscribe_url}}'}" style="color: #6b7280; text-decoration: underline;">${p.unsubscribeText || 'Unsubscribe'}</a></p>
</div>`;

      default:
        return p.html || p.text || '';
    }
  });

  return { html: htmlParts.join('\n') };
}
