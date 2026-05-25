# Design

## Theme

Dark by default. The primary user is a business owner checking their pipeline at a desk or in an office — ambient light is mixed, sessions are long, and the navy palette reduces eye fatigue while projecting seriousness. The warm cream light theme is available for bright environments.

## Color Palette

### Dark theme (default)

| Role | Value | Notes |
|---|---|---|
| Background (canvas) | `#1e293b` | Slate 800 — the outermost layer |
| Surface (panels, sidebars, tables) | `#0F1A2B` | Deep navy — primary content surface |
| Surface hover | `#132136` | Subtle interactive state |
| Border | `#2E4568` | Visible but not harsh |
| Border subtle | `rgba(82,103,125,0.25)` | Dividers, separators |
| Primary | `#52677D` | Muted steel-blue — action color |
| Primary hover | `#6B84A0` | Brightened on interaction |
| Primary light | `rgba(82,103,125,0.18)` | Background tints, selections |
| Text main | `#D1CFC9` | Warm-tinted off-white |
| Text muted | `#BDC4D4` | Secondary labels, placeholders |

### Accent colors

| Name | Value | Use |
|---|---|---|
| Green | `#10B981` | Success, active status, positive delta |
| Amber | `#F59E0B` | Warning, in-progress, follow-up needed |
| Purple | `#8B5CF6` | Tags, pipeline stages, categorization |
| Teal | `#14B8A6` | Highlights, featured items |
| Red | `#EF4444` | Error, danger, overdue |
| Blue | `#3B82F6` | Info, links |
| Orange | `#F97316` | Secondary warning, campaigns |

### Color strategy

Restrained. The navy surface carries the identity. Accents appear at ≤10% of any surface — used to signal status (badges, pipeline dots, active indicators), never as background fills.

## Typography

| Role | Family | Size | Weight | Notes |
|---|---|---|---|---|
| Body | Inter | 13.5–14px | 400 | `-0.01em` tracking, optical sizing 14–32 |
| Label caps | Inter | 10px | 600 | `0.1em` tracking, uppercase — section headers |
| Table header | Inter | 11px | 600 | `0.06em` tracking, uppercase |
| Badge | Inter | 11px | 600 | `0.01em` tracking |
| Page title | Inter | 22px | 700 | `-0.025em` tracking |
| Page subtitle | Inter | 13px | 400 | Muted color |
| Monospace | JetBrains Mono | 13px | 400–500 | Code, IDs, technical values |

Line length capped at 65–75ch for body text blocks. Hierarchy through scale + weight contrast.

## Elevation & Shadows

Three-tier shadow system:

- **Card**: `0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.25)` — default resting state
- **Interactive**: `0 4px 16px rgba(82,103,125,0.3), 0 2px 6px rgba(0,0,0,0.3)` — hover/active lift
- **Luxury**: `0 1px 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.35), 0 16px 40px rgba(0,0,0,0.25)` — modals, popovers

Glassmorphism (`backdrop-filter: blur(20px) saturate(160%)`) is used sparingly for overlaid panels — not as a default card style.

## Spacing & Layout

Spacing varies for rhythm — not uniform padding throughout. Page containers use `32px` padding. Sections separated by `28px` margin. Internal card padding: `16–20px`. Dense table rows: `12px` vertical.

Borders radius: `12px` cards, `9px` inputs and buttons, `8px` ghost elements, `20px` badges/pills.

## Components

### Buttons
- **Primary** (`btn-primary`): `#52677D` fill, `#D1CFC9` text, `border-radius: 9px`, lifts `-1px` on hover
- **Secondary** (`btn-secondary`): surface fill, border, same radius
- **Ghost** (`btn-ghost`): transparent, muted text, no border
- **Danger** (`btn-danger`): `rgba(239,68,68,0.12)` fill, red text and border

### Badges
Pill shape (`border-radius: 20px`), 8 semantic variants (success, warning, danger, info, purple, teal, neutral, orange). Background tint + matching border + text — always legible.

### Cards
- `card-primary` / `card-surface`: surface bg, `border-radius: 12px`, 1px border
- `card-ghost`: transparent with dashed border — for empty states
- `glass-card-hover`: glassmorphism with lift on hover

### Inputs
`input-luxury`: bg canvas, 1px border, 9px radius, Inter 13.5px. Focus: primary border + 3px glow ring.

### Tables
Headers: `surface` bg, uppercase 11px caps labels, bottom border. Rows: `table-row-hover` on hover. Rows animate in with `row-enter` (6px translate + fade, 250ms ease-out).

### Tags
`border-radius: 6px`, surface-hover bg, 11.5px Inter 500, 1px border. Used for contact labels, categories.

### Skeleton loaders
Shimmer animation (1.6s ease-in-out) on surface gradient. Variants: text (13px h), title (20px h), avatar (circular).

## Motion

Timing functions: `ease-out` curves. `cubic-bezier(0.16,1,0.3,1)` for slide-in panels. No bounce or elastic.

Key animations:
- `fade-up`: 400ms, 14px Y offset — page entry, list items
- `scale-in`: 250ms — modals, dropdowns
- `slide-in-right`: 350ms — side panels
- `shimmer`: 1.6s loop — skeleton loaders
- `row-enter`: 250ms — table rows appearing

Staggered children: 60ms delay increments up to 8 items.

Respect `prefers-reduced-motion`: disable transforms and loops, keep opacity transitions only.

## Texture

Dot-grid background: `radial-gradient(border-subtle 1px, transparent 1px)` at `28px 28px` repeat on body. Fixed position, pointer-events: none, z-index: 0. Adds depth without noise.

## Do / Don't

| Do | Don't |
|---|---|
| Use navy surface + restrained primary accent | Use generic blue as primary brand color |
| Dense readable tables with label-caps headers | Stack cards in identical grid layouts |
| Earn glassmorphism — overlaid panels only | Apply glass to every card by default |
| Vary spacing for visual rhythm | Use identical padding everywhere |
| Single solid accent per badge | Gradient text |
| Subtle row hover states | Side-stripe left border accents on list items |
