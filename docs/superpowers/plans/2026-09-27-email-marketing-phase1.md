# Email Marketing Phase 1 Implementation Plan — Visual Drag-and-Drop Builder & Custom Sending Domains

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 of the Email Marketing spec: a drag-and-drop visual email editor (powered by GrapesJS with dual-way BlockJson conversion and code view) and custom sending domain management with DKIM/SPF verification via Resend.

**Architecture:** GrapesJS + `grapesjs-preset-newsletter` (BSD-3-Clause) serves as the visual authoring surface on the frontend, mapping bi-directionally to the backend's existing `BlockJson` / `EmailBlock[]` schema via dedicated adapters so the battle-tested `mjml-compiler.service.ts` remains the single rendering engine. Sending domains are modeled in Prisma with `SendingDomain`, managed via Resend's Domains API, synced via Resend webhooks, surfaced in a new Domains tab in Audience management, and enforced in the campaign sender configuration.

**Tech Stack:** React 19, TypeScript, GrapesJS, `grapesjs-preset-newsletter`, Prisma, PostgreSQL, Express, Resend SDK, MJML, Vitest.

## Global Constraints

- **Tenant Isolation:** Every query and route must scope by `workspaceId` resolved from authenticated request context (`req.workspaceId`); `workspaceId` is NEVER accepted from client payload.
- **License Discipline:** MIT / Apache-2.0 / BSD only. GrapesJS & `grapesjs-preset-newsletter` are BSD-3-Clause. No AGPL/FSL/BSL packages.
- **Build on Existing Services:** Do not duplicate `campaigns.service.ts`, `mjml-compiler.service.ts`, `audience.service.ts`, or `resend-webhook.handler.ts`.
- **Do Not Touch:** Conversations/Inbox visual design, Voice/SDR pages, or Opportunities/Pipeline module.
- **Verification Gate:** Must pass `npm run typecheck`, `npm run lint`, and `npm test` at every step.

---

### Task 1: Install GrapesJS & Newsletter Preset (BSD-3-Clause)

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: None
- Produces: `grapesjs`, `grapesjs-preset-newsletter` in `node_modules`

- [ ] **Step 1: Install grapesjs and grapesjs-preset-newsletter**

Run: `npm.cmd install grapesjs grapesjs-preset-newsletter`

- [ ] **Step 2: Verify package installation and licenses**

Run: `node -e "const g = require('grapesjs'); console.log('GrapesJS loaded:', !!g);"`
Expected: `GrapesJS loaded: true`

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npm.cmd run typecheck`
Expected: Exited with code 0

- [ ] **Step 4: Commit dependencies**

```bash
git add package.json package-lock.json
git commit -m "feat(email-marketing): install grapesjs and grapesjs-preset-newsletter (BSD-3-Clause)"
```

---

### Task 2: BlockJson <-> GrapesJS Bi-Directional Adapters

**Files:**
- Create: `src/lib/grapesjsToBlockJson.ts`
- Create: `src/lib/blockJsonToGrapesjs.ts`
- Test: `src/lib/__tests__/emailBuilderAdapters.test.ts`

**Interfaces:**
- Consumes: `EmailBlock`, `BlockJson`, `BlockType` from `api/services/email-marketing/mjml-compiler.service.ts` (mirrored in frontend types)
- Produces:
  - `grapesjsToBlockJson(editorOrHtml: any): BlockJson`
  - `blockJsonToGrapesjs(blockJson: BlockJson | any): { html: string; components?: any[] }`

- [ ] **Step 1: Write failing unit tests for the adapters**

Create `src/lib/__tests__/emailBuilderAdapters.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { grapesjsToBlockJson } from '../grapesjsToBlockJson';
import { blockJsonToGrapesjs } from '../blockJsonToGrapesjs';
import type { BlockJson } from '../grapesjsToBlockJson';

describe('Email Builder Adapters', () => {
  it('converts basic BlockJson to HTML for GrapesJS editor', () => {
    const input: BlockJson = {
      blocks: [
        {
          id: 'b-1',
          type: 'HEADER_LOGO',
          props: { logoUrl: 'https://example.com/logo.png', altText: 'Logo', align: 'center', width: '120px' },
        },
        {
          id: 'b-2',
          type: 'TEXT',
          props: { text: 'Hello {{contact.first_name}}!' },
        },
        {
          id: 'b-3',
          type: 'BUTTON',
          props: { label: 'Click Me', href: 'https://example.com', buttonColor: '#6366f1' },
        },
        {
          id: 'b-4',
          type: 'DIVIDER',
          props: { color: '#e5e7eb' },
        },
      ],
    };

    const result = blockJsonToGrapesjs(input);
    expect(result.html).toContain('https://example.com/logo.png');
    expect(result.html).toContain('Hello {{contact.first_name}}!');
    expect(result.html).toContain('Click Me');
  });

  it('converts raw HTML string to BlockJson TEXT block', () => {
    const html = '<p>Simple paragraph with <a href="#">link</a></p>';
    const result = grapesjsToBlockJson(html);
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks[0].type).toBe('TEXT');
    expect(result.blocks[0].props.html).toBe(html);
  });

  it('parses structured HTML components back into typed EmailBlocks', () => {
    const html = `
      <div data-gjs-type="image" src="https://example.com/hero.jpg" alt="Hero"></div>
      <div data-gjs-type="text"><p>Paragraph content</p></div>
      <a data-gjs-type="link" href="https://stoneaio.com" class="button">Visit Us</a>
      <hr />
    `;
    const result = grapesjsToBlockJson(html);
    expect(result.blocks.length).toBe(4);
    expect(result.blocks[0].type).toBe('IMAGE');
    expect(result.blocks[1].type).toBe('TEXT');
    expect(result.blocks[2].type).toBe('BUTTON');
    expect(result.blocks[3].type).toBe('DIVIDER');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run src/lib/__tests__/emailBuilderAdapters.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `src/lib/grapesjsToBlockJson.ts`**

Create `src/lib/grapesjsToBlockJson.ts`:
```ts
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
          src: el.getAttribute('src') || '',
          alt: el.getAttribute('alt') || '',
          width: el.getAttribute('width') || '100%',
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
```

- [ ] **Step 4: Implement `src/lib/blockJsonToGrapesjs.ts`**

Create `src/lib/blockJsonToGrapesjs.ts`:
```ts
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

  if (blockJson.html) {
    return { html: blockJson.html };
  }

  const blocks: EmailBlock[] = Array.isArray(blockJson.blocks) ? blockJson.blocks : [];
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
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx.cmd vitest run src/lib/__tests__/emailBuilderAdapters.test.ts`
Expected: PASS (all tests pass)

- [ ] **Step 6: Commit adapters**

```bash
git add src/lib/grapesjsToBlockJson.ts src/lib/blockJsonToGrapesjs.ts src/lib/__tests__/emailBuilderAdapters.test.ts
git commit -m "feat(email-marketing): add bi-directional GrapesJS to BlockJson adapters"
```

---

### Task 3: EmailBuilderCanvas Component with Code Tab & Merge Tags

**Files:**
- Create: `src/components/email-marketing/EmailBuilderCanvas.tsx`
- Test: Manual mounting and typecheck

**Interfaces:**
- Consumes:
  - `grapesjs`
  - `grapesjs-preset-newsletter`
  - `blockJsonToGrapesjs`, `grapesjsToBlockJson`
- Produces: `<EmailBuilderCanvas value={htmlOrBlockJson} onChange={(html, blockJson) => void} />`

- [ ] **Step 1: Implement `EmailBuilderCanvas.tsx`**

Create `src/components/email-marketing/EmailBuilderCanvas.tsx`:
```tsx
import React, { useEffect, useRef, useState } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetNewsletter from 'grapesjs-preset-newsletter';
import { blockJsonToGrapesjs } from '../../lib/blockJsonToGrapesjs';
import { grapesjsToBlockJson, type BlockJson } from '../../lib/grapesjsToBlockJson';
import { Code, Eye, Tag, Layout } from 'lucide-react';

interface EmailBuilderCanvasProps {
  initialContent?: string | BlockJson | Record<string, any>;
  onChange?: (html: string, blockJson: BlockJson) => void;
  height?: string;
}

const MERGE_TAGS = [
  { label: 'First Name', tag: '{{contact.first_name | fallback:"there"}}' },
  { label: 'Last Name', tag: '{{contact.last_name}}' },
  { label: 'Email', tag: '{{contact.email}}' },
  { label: 'Company / Business', tag: '{{contact.business_name}}' },
  { label: 'Phone', tag: '{{contact.phone}}' },
  { label: 'Unsubscribe Link', tag: '{{unsubscribe_url}}' },
];

export const EmailBuilderCanvas: React.FC<EmailBuilderCanvasProps> = ({
  initialContent,
  onChange,
  height = '600px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');
  const [currentHtml, setCurrentHtml] = useState<string>('');
  const [showTagMenu, setShowTagMenu] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const initial = blockJsonToGrapesjs(initialContent || '');
    setCurrentHtml(initial.html);

    const editor = grapesjs.init({
      container: containerRef.current,
      fromElement: false,
      height: '100%',
      width: 'auto',
      storageManager: false,
      plugins: [gjsPresetNewsletter],
      pluginsOpts: {
        [gjsPresetNewsletter as any]: {
          modalTitleImport: 'Import template',
        },
      },
      components: initial.html || '<div style="padding: 20px; font-family: Arial, sans-serif;"><p>Start writing your email here...</p></div>',
    });

    editor.on('update', () => {
      const html = editor.getHtml();
      setCurrentHtml(html);
      const bj = grapesjsToBlockJson(editor);
      onChange?.(html, bj);
    });

    editorRef.current = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  const handleInsertTag = (tag: string) => {
    if (activeTab === 'visual' && editorRef.current) {
      editorRef.current.getSelected()?.append(tag);
      const html = editorRef.current.getHtml();
      setCurrentHtml(html);
      onChange?.(html, grapesjsToBlockJson(editorRef.current));
    } else {
      setCurrentHtml(prev => prev + tag);
      onChange?.(currentHtml + tag, grapesjsToBlockJson(currentHtml + tag));
    }
    setShowTagMenu(false);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCurrentHtml(val);
    const bj = grapesjsToBlockJson(val);
    onChange?.(val, bj);
  };

  const handleTabSwitch = (tab: 'visual' | 'code') => {
    if (tab === 'code' && editorRef.current) {
      setCurrentHtml(editorRef.current.getHtml());
    } else if (tab === 'visual' && editorRef.current) {
      editorRef.current.setComponents(currentHtml);
    }
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col border border-border/70 rounded-xl overflow-hidden bg-surface shadow-card" style={{ height }}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/70 bg-surface/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-1 bg-surface-hover/50 p-1 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => handleTabSwitch('visual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'visual'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            Visual Builder
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'code'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Code / HTML
          </button>
        </div>

        {/* Merge Tag Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTagMenu(!showTagMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-surface hover:bg-surface-hover text-xs font-semibold text-text-main transition-colors"
          >
            <Tag className="w-3.5 h-3.5 text-primary" />
            Insert Personalization Tag
          </button>

          {showTagMenu && (
            <div className="absolute right-0 mt-1 w-64 bg-surface border border-border rounded-xl shadow-xl z-50 p-1 py-1.5">
              <div className="px-2 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Personalization Tokens
              </div>
              {MERGE_TAGS.map(t => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => handleInsertTag(t.tag)}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-primary/10 hover:text-primary rounded-lg text-xs font-medium text-text-main flex items-center justify-between"
                >
                  <span>{t.label}</span>
                  <span className="text-[10px] text-text-muted font-mono">{t.tag.slice(0, 14)}…</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={containerRef}
          className={`h-full w-full ${activeTab === 'visual' ? 'block' : 'hidden'}`}
        />
        {activeTab === 'code' && (
          <textarea
            value={currentHtml}
            onChange={handleCodeChange}
            placeholder="Write HTML directly..."
            className="w-full h-full p-4 font-mono text-xs bg-bg text-text-main resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck on the new component**

Run: `npm.cmd run typecheck`
Expected: Exited with code 0

- [ ] **Step 3: Commit EmailBuilderCanvas**

```bash
git add src/components/email-marketing/EmailBuilderCanvas.tsx
git commit -m "feat(email-marketing): add EmailBuilderCanvas with GrapesJS newsletter preset and code view"
```

---

### Task 4: Mount Visual Canvas in TemplatesList.tsx & CampaignBuilder.tsx

**Files:**
- Modify: `src/pages/email-marketing/TemplatesList.tsx`
- Modify: `src/pages/email-marketing/CampaignBuilder.tsx`

**Interfaces:**
- Consumes: `<EmailBuilderCanvas />`
- Produces: Integrated visual & code authoring in both template modal and campaign step 2

- [ ] **Step 1: Replace raw textarea in `TemplatesList.tsx`**

In `src/pages/email-marketing/TemplatesList.tsx`:
Import `EmailBuilderCanvas` and `grapesjsToBlockJson`. Replace the modal textarea on line 667 with `EmailBuilderCanvas`, setting `editingTemplate.html` and `editingTemplate.blockJson`.

- [ ] **Step 2: Replace raw textarea in `CampaignBuilder.tsx`**

In `src/pages/email-marketing/CampaignBuilder.tsx`:
Mount `EmailBuilderCanvas` in Step 2 (Compose Email) in place of the single `<textarea ref={activeTextareaRef} ... />`, keeping support for:
- Standard broadcast email body
- A/B variant switching (`variant === 'A'` vs `'B'`)
- Drip sequence steps (`dripSteps[activeStepIndex]`)

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npm.cmd run typecheck`
Expected: Exited with code 0

- [ ] **Step 4: Commit UI integration**

```bash
git add src/pages/email-marketing/TemplatesList.tsx src/pages/email-marketing/CampaignBuilder.tsx
git commit -m "feat(email-marketing): mount EmailBuilderCanvas in TemplatesList and CampaignBuilder"
```

---

### Task 5: Prisma SendingDomain Model & Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: PostgreSQL database via Railway
- Produces: Table `sending_domains`, Enum `SendingDomainStatus`, Workspace relation `sendingDomains`

- [ ] **Step 1: Add model and enum to `prisma/schema.prisma`**

In `prisma/schema.prisma`, add under `Workspace` model:
```prisma
  sendingDomains              SendingDomain[]
```

Add the model and enum at the end of the schema:
```prisma
enum SendingDomainStatus {
  PENDING
  VERIFIED
  FAILED
}

model SendingDomain {
  id             String              @id @default(uuid())
  workspaceId    String              @map("workspace_id")
  domain         String
  resendDomainId String              @map("resend_domain_id")
  status         SendingDomainStatus @default(PENDING)
  region         String?
  dnsRecords     Json                @map("dns_records") // SPF TXT, DKIM CNAME/TXT, MX — as returned by Resend
  createdAt      DateTime            @default(now()) @map("created_at")
  verifiedAt     DateTime?           @map("verified_at")
  workspace      Workspace           @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@map("sending_domains")
}
```

- [ ] **Step 2: Push database schema and generate Prisma client**

Run: `npx.cmd prisma db push`
Expected: `The database is now in sync with the Prisma schema.`

Run: `npx.cmd prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 3: Commit schema changes**

```bash
git add prisma/schema.prisma
git commit -m "feat(email-marketing): add SendingDomain model and status enum to Prisma schema"
```

---

### Task 6: SendingDomain Service & Resend Native Domain API Integration

**Files:**
- Create: `api/services/email-marketing/sending-domain.service.ts`
- Test: `api/services/email-marketing/__tests__/sending-domain.service.test.ts`

**Interfaces:**
- Consumes: `Resend` SDK (`resend.domains.create`, `verify`, `get`, `remove`), `db.sendingDomain`
- Produces:
  - `createSendingDomain(workspaceId: string, domain: string, region?: string)`
  - `getSendingDomains(workspaceId: string)`
  - `verifySendingDomain(workspaceId: string, id: string)`
  - `deleteSendingDomain(workspaceId: string, id: string)`

- [ ] **Step 1: Write unit tests for sending-domain service**

Create `api/services/email-marketing/__tests__/sending-domain.service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSendingDomain,
  getSendingDomains,
  verifySendingDomain,
  deleteSendingDomain,
} from '../sending-domain.service.js';
import { db } from '../../../infrastructure/database/client.js';

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    sendingDomain: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      domains: {
        create: vi.fn().mockResolvedValue({
          data: {
            id: 'resend_dom_123',
            name: 'company.com',
            status: 'not_started',
            records: [{ record: 'SPF', name: 'send', type: 'TXT', ttl: 'Auto', status: 'not_started' }],
          },
          error: null,
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            id: 'resend_dom_123',
            name: 'company.com',
            status: 'verified',
            records: [{ record: 'SPF', name: 'send', type: 'TXT', ttl: 'Auto', status: 'verified' }],
          },
          error: null,
        }),
        verify: vi.fn().mockResolvedValue({
          data: { id: 'resend_dom_123' },
          error: null,
        }),
        remove: vi.fn().mockResolvedValue({
          data: { id: 'resend_dom_123', deleted: true },
          error: null,
        }),
      },
    })),
  };
});

describe('SendingDomain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates sending domain with workspace isolation', async () => {
    (db.sendingDomain.create as any).mockResolvedValue({
      id: 'dom-1',
      workspaceId: 'ws-test',
      domain: 'company.com',
      resendDomainId: 'resend_dom_123',
      status: 'PENDING',
      dnsRecords: [],
    });

    const result = await createSendingDomain('ws-test', 'company.com');
    expect(result.domain).toBe('company.com');
    expect(db.sendingDomain.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ workspaceId: 'ws-test', domain: 'company.com' }),
    });
  });

  it('lists sending domains strictly scoped by workspaceId', async () => {
    (db.sendingDomain.findMany as any).mockResolvedValue([
      { id: 'dom-1', workspaceId: 'ws-test', domain: 'company.com' },
    ]);

    const list = await getSendingDomains('ws-test');
    expect(list.length).toBe(1);
    expect(db.sendingDomain.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-test' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run api/services/email-marketing/__tests__/sending-domain.service.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `api/services/email-marketing/sending-domain.service.ts`**

Create `api/services/email-marketing/sending-domain.service.ts`:
```ts
import { Resend } from 'resend';
import { db } from '../../../infrastructure/database/client.js';
import { env } from '../../../infrastructure/config/env.js';
import { SendingDomainStatus } from '@prisma/client';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function createSendingDomain(
  workspaceId: string,
  domain: string,
  region?: string
) {
  const cleanDomain = domain.trim().toLowerCase();

  let resendDomainId = `mock_dom_${Date.now()}`;
  let dnsRecords: any = [];

  if (resend) {
    const res = await resend.domains.create({
      name: cleanDomain,
      region: (region as any) || undefined,
    });

    if (res.error) {
      throw new Error(`Resend domain creation failed: ${res.error.message}`);
    }

    if (res.data) {
      resendDomainId = res.data.id;
      dnsRecords = res.data.records || [];
    }
  }

  return db.sendingDomain.create({
    data: {
      workspaceId,
      domain: cleanDomain,
      resendDomainId,
      status: SendingDomainStatus.PENDING,
      region: region || null,
      dnsRecords,
    },
  });
}

export async function getSendingDomains(workspaceId: string) {
  return db.sendingDomain.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function verifySendingDomain(workspaceId: string, id: string) {
  const record = await db.sendingDomain.findFirst({
    where: { id, workspaceId },
  });

  if (!record) {
    throw new Error('Sending domain not found');
  }

  let newStatus: SendingDomainStatus = SendingDomainStatus.PENDING;
  let records = record.dnsRecords;
  let verifiedAt = record.verifiedAt;

  if (resend && record.resendDomainId && !record.resendDomainId.startsWith('mock_')) {
    await resend.domains.verify(record.resendDomainId);
    const domainInfo = await resend.domains.get(record.resendDomainId);

    if (domainInfo.data) {
      records = domainInfo.data.records || [];
      const statusStr = domainInfo.data.status?.toLowerCase();
      if (statusStr === 'verified') {
        newStatus = SendingDomainStatus.VERIFIED;
        verifiedAt = new Date();
      } else if (statusStr === 'failed') {
        newStatus = SendingDomainStatus.FAILED;
      }
    }
  } else {
    // In dev mode without API key, verify for testing
    newStatus = SendingDomainStatus.VERIFIED;
    verifiedAt = new Date();
  }

  return db.sendingDomain.update({
    where: { id },
    data: {
      status: newStatus,
      dnsRecords: records,
      verifiedAt,
    },
  });
}

export async function deleteSendingDomain(workspaceId: string, id: string) {
  const record = await db.sendingDomain.findFirst({
    where: { id, workspaceId },
  });

  if (!record) {
    throw new Error('Sending domain not found');
  }

  if (resend && record.resendDomainId && !record.resendDomainId.startsWith('mock_')) {
    try {
      await resend.domains.remove(record.resendDomainId);
    } catch (err: any) {
      console.warn(`[SendingDomain] Resend domain removal warning:`, err.message);
    }
  }

  return db.sendingDomain.deleteMany({
    where: { id, workspaceId },
  });
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx.cmd vitest run api/services/email-marketing/__tests__/sending-domain.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit sending-domain service**

```bash
git add api/services/email-marketing/sending-domain.service.ts api/services/email-marketing/__tests__/sending-domain.service.test.ts
git commit -m "feat(email-marketing): add SendingDomain service with Resend domains API"
```

---

### Task 7: Resend Webhook domain.updated Handling & API Routes

**Files:**
- Modify: `api/webhooks/resend-webhook.handler.ts`
- Modify: `api/routes/email-marketing.routes.ts`
- Test: `api/webhooks/__tests__/resend-domain-webhook.test.ts`

**Interfaces:**
- Consumes: Resend `domain.updated` events at `POST /api/webhooks/resend`
- Produces:
  - `GET /api/email-marketing/domains`
  - `POST /api/email-marketing/domains`
  - `POST /api/email-marketing/domains/:id/verify`
  - `DELETE /api/email-marketing/domains/:id`

- [ ] **Step 1: Write unit test for domain.updated webhook handler**

Create `api/webhooks/__tests__/resend-domain-webhook.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { handleDomainUpdatedWebhook } from '../resend-webhook.handler.js';
import { db } from '../../infrastructure/database/client.js';

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    sendingDomain: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Resend domain.updated Webhook', () => {
  it('updates sending domain status to VERIFIED when Resend domain is verified', async () => {
    (db.sendingDomain.findFirst as any).mockResolvedValue({
      id: 'dom-1',
      resendDomainId: 'resend_123',
      status: 'PENDING',
    });
    (db.sendingDomain.update as any).mockResolvedValue({
      id: 'dom-1',
      status: 'VERIFIED',
    });

    const handled = await handleDomainUpdatedWebhook({
      type: 'domain.updated',
      data: {
        id: 'resend_123',
        status: 'verified',
        records: [],
      },
    });

    expect(handled).toBe(true);
    expect(db.sendingDomain.update).toHaveBeenCalledWith({
      where: { id: 'dom-1' },
      data: expect.objectContaining({ status: 'VERIFIED' }),
    });
  });
});
```

- [ ] **Step 2: Add `handleDomainUpdatedWebhook` to `resend-webhook.handler.ts`**

Export and wire `handleDomainUpdatedWebhook` when `resendEventType === 'domain.updated'`.

- [ ] **Step 3: Add domain routes to `api/routes/email-marketing.routes.ts`**

In `api/routes/email-marketing.routes.ts`:
```ts
// ── Sending Domains ─────────────────────────────────────────────────────────

router.get('/domains', asyncHandler(async (req, res) => {
  const wid = getWid(req);
  const domains = await getSendingDomains(wid);
  res.json(domains);
}));

router.post('/domains', asyncHandler(async (req, res) => {
  const wid = getWid(req);
  const { domain, region } = req.body;
  if (!domain || typeof domain !== 'string') {
    res.status(400).json({ error: 'Valid domain is required' });
    return;
  }
  const result = await createSendingDomain(wid, domain, region);
  res.status(201).json(result);
}));

router.post('/domains/:id/verify', asyncHandler(async (req, res) => {
  const wid = getWid(req);
  const result = await verifySendingDomain(wid, req.params.id);
  res.json(result);
}));

router.delete('/domains/:id', asyncHandler(async (req, res) => {
  const wid = getWid(req);
  await deleteSendingDomain(wid, req.params.id);
  res.json({ success: true });
}));
```

- [ ] **Step 4: Run webhook tests and verify they pass**

Run: `npx.cmd vitest run api/webhooks/__tests__/resend-domain-webhook.test.ts`
Expected: PASS

- [ ] **Step 5: Verify typecheck**

Run: `npm.cmd run typecheck`
Expected: Exited with code 0

- [ ] **Step 6: Commit backend routes & webhook handler**

```bash
git add api/routes/email-marketing.routes.ts api/webhooks/resend-webhook.handler.ts api/webhooks/__tests__/resend-domain-webhook.test.ts
git commit -m "feat(email-marketing): add sending domain routes and domain.updated webhook handler"
```

---

### Task 8: Frontend Domains Management Tab & Sender Config Enforcement

**Files:**
- Modify: `src/pages/email-marketing/ListsAndSegments.tsx`
- Modify: `src/pages/email-marketing/CampaignBuilder.tsx`

**Interfaces:**
- Consumes: `GET /api/email-marketing/domains`, `POST /api/email-marketing/domains`, `POST /api/email-marketing/domains/:id/verify`
- Produces:
  - Audience -> "Domains" tab with full DNS instructions (SPF, DKIM, MX)
  - CampaignBuilder SenderConfig domain picker and unverified domain blocker

- [ ] **Step 1: Add 'domains' tab to `ListsAndSegments.tsx`**

Add `'domains'` to `type Tab = 'lists' | 'smart-lists' | 'segments' | 'suppression' | 'domains';`
Render domain cards showing:
- Domain name
- Status badge (Pending / Verified / Failed)
- "View DNS Records" modal (SPF TXT, DKIM CNAME/TXT, MX) with copy-to-clipboard buttons
- "Check DNS" verify button
- "Add Domain" modal

- [ ] **Step 2: Update SenderConfig in `CampaignBuilder.tsx`**

Query verified domains via `apiClient.get('/email-marketing/domains')`.
In Step 1 (Campaign Details / Sender Config):
- Let user choose from verified domains dropdown or type custom prefix `@verified-domain.com`.
- If user types an unverified domain, show inline warning: `⚠️ Unverified domain: All emails will be sent from the shared sender until verified.`
- Add validation in `validateStep()` to block final send if custom unverified domain is selected.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npm.cmd run typecheck`
Expected: Exited with code 0

- [ ] **Step 4: Commit frontend domain management and sender enforcement**

```bash
git add src/pages/email-marketing/ListsAndSegments.tsx src/pages/email-marketing/CampaignBuilder.tsx
git commit -m "feat(email-marketing): add Domains tab to Audience and enforce verified domains in CampaignBuilder"
```

---

### Task 9: Full Phase 1 Verification Sweep

**Files:**
- Verify entire codebase

**Interfaces:**
- Full pre-commit / CI gate verification

- [ ] **Step 1: Run complete typecheck**

Run: `npm.cmd run typecheck`
Expected: Exited with code 0

- [ ] **Step 2: Run complete lint check**

Run: `npm.cmd run lint`
Expected: 0 warnings, 0 errors

- [ ] **Step 3: Run full Vitest suite**

Run: `npm.cmd test`
Expected: All test suites pass

- [ ] **Step 4: End-to-end dev environment health check**

Check backend: `GET http://localhost:4000/api/health`
Check frontend: `GET http://localhost:5173`
Ensure dev servers remain responsive without errors.
