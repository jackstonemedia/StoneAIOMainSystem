/**
 * Personal Email Compiler — Native Outreach Engine
 *
 * Compiles authentic, high-deliverability plain-text and personal HTML emails:
 * 1. Zero bloated marketing table wrappers to ensure primary inbox placement.
 * 2. System typography matching native Gmail & Outlook web clients.
 * 3. Dynamic merge variable substitution (first name, company, email, phone, custom fields).
 * 4. RFC-compliant HMAC-signed unsubscribe token injection.
 * 5. Generates both matching plainText and emailHtml payloads.
 */

import { buildUnsubscribeUrl } from './email-send-worker.service.js';

export interface PersonalEmailContext {
  workspaceId: string;
  contactId: string;
  contact: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    customFields?: Record<string, unknown>;
  };
  senderName?: string;
  businessAddress?: string;
  unsubscribeUrl?: string;
}

export interface CompiledPersonalEmail {
  subject: string;
  html: string;
  plainText: string;
  unsubscribeUrl: string;
}

/**
 * Replaces dynamic merge tags in text with actual contact values.
 */
export function interpolateMergeTags(template: string, ctx: PersonalEmailContext): string {
  const { contact } = ctx;
  const firstName = (contact.firstName || '').trim();
  const lastName = (contact.lastName || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || firstName || 'there';
  const email = (contact.email || '').trim();
  const phone = (contact.phone || '').trim();
  const company = (contact.companyName || '').trim();
  const unsubUrl = ctx.unsubscribeUrl || buildUnsubscribeUrl(ctx.workspaceId, ctx.contactId);

  let result = template
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName || 'there')
    .replace(/\{\{\s*firstName\s*\}\}/gi, firstName || 'there')
    .replace(/\{\{\s*last_name\s*\}\}/gi, lastName)
    .replace(/\{\{\s*lastName\s*\}\}/gi, lastName)
    .replace(/\{\{\s*name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*full_name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*fullName\s*\}\}/gi, fullName)
    .replace(/\{\{\s*email\s*\}\}/gi, email)
    .replace(/\{\{\s*business_name\s*\}\}/gi, company)
    .replace(/\{\{\s*businessName\s*\}\}/gi, company)
    .replace(/\{\{\s*company\s*\}\}/gi, company)
    .replace(/\{\{\s*phone\s*\}\}/gi, phone)
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubUrl)
    .replace(/\{\{\s*unsubscribe\s*\}\}/gi, unsubUrl);

  // Custom fields interpolation: {{custom.fieldName}}
  if (contact.customFields && typeof contact.customFields === 'object') {
    for (const [key, val] of Object.entries(contact.customFields)) {
      const regex = new RegExp(`\\{\\{\\s*custom\\.${key}\\s*\\}\\}`, 'gi');
      result = result.replace(regex, String(val ?? ''));
    }
  }

  return result;
}

/**
 * Compiles a subject line and body into personalized high-deliverability email formats.
 */
export function compilePersonalEmail(
  rawSubject: string,
  rawBody: string,
  ctx: PersonalEmailContext
): CompiledPersonalEmail {
  const unsubUrl = ctx.unsubscribeUrl || buildUnsubscribeUrl(ctx.workspaceId, ctx.contactId);
  const contextWithUnsub = { ...ctx, unsubscribeUrl: unsubUrl };

  const subject = interpolateMergeTags(rawSubject, contextWithUnsub).trim();
  const interpolatedBody = interpolateMergeTags(rawBody, contextWithUnsub).trim();

  // 1. Generate Plain Text
  const plainText = interpolatedBody.includes(unsubUrl)
    ? interpolatedBody
    : `${interpolatedBody}\n\n---\nUnsubscribe: ${unsubUrl}`;

  // 2. Generate Personal HTML
  let htmlBody = interpolatedBody;

  // If raw body doesn't already contain HTML tags, wrap paragraphs cleanly
  if (!htmlBody.includes('<p>') && !htmlBody.includes('<div>')) {
    const paragraphs = htmlBody
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('\n');
    htmlBody = paragraphs;
  }

  // Ensure unsubscribe footer is present
  if (!htmlBody.includes(unsubUrl)) {
    const footerParts: string[] = [];
    if (ctx.businessAddress) {
      footerParts.push(`<span>${ctx.businessAddress}</span>`);
    }
    footerParts.push(`<a href="${unsubUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>`);

    const footer = `
      <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; line-height: 1.5;">
        ${footerParts.join(' &nbsp;•&nbsp; ')}
      </div>
    `;
    htmlBody = `${htmlBody}\n${footer}`;
  }

  const completeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #111827; background-color: #ffffff; margin: 0; padding: 16px 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    ${htmlBody}
  </div>
</body>
</html>`;

  return {
    subject,
    html: completeHtml,
    plainText,
    unsubscribeUrl: unsubUrl,
  };
}
