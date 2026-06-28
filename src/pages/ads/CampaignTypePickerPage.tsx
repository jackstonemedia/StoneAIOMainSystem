import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';

// ── Real Google Ads SVG logo ─────────────────────────────────────────────────
function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MetaLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

// ── Google Ads objective icons (SVG paths matching actual Google UI icons) ────
function ShoppingBagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function CursorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/>
    </svg>
  );
}
function SmartphoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  );
}
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
function MegaphoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/>
    </svg>
  );
}
function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
    </svg>
  );
}
function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
    </svg>
  );
}

// ── Data model ────────────────────────────────────────────────────────────────

interface Objective {
  id: string;
  platform: 'GOOGLE' | 'META';
  name: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  subtypes: string[];
  recommended?: boolean;
}

const GOOGLE_OBJECTIVES: Objective[] = [
  {
    id: 'google_sales',
    platform: 'GOOGLE',
    name: 'Sales',
    description: 'Drive online, in-app, phone, or in-store sales.',
    Icon: ShoppingBagIcon,
    subtypes: ['Search', 'Display', 'Shopping', 'Video', 'Performance Max'],
    recommended: true,
  },
  {
    id: 'google_leads',
    platform: 'GOOGLE',
    name: 'Leads',
    description: 'Get leads and other conversions by encouraging customers to take action.',
    Icon: UsersIcon,
    subtypes: ['Search', 'Display', 'Video', 'Performance Max', 'Smart'],
    recommended: true,
  },
  {
    id: 'google_traffic',
    platform: 'GOOGLE',
    name: 'Website Traffic',
    description: 'Get the right people to visit your website.',
    Icon: CursorIcon,
    subtypes: ['Search', 'Display', 'Shopping', 'Video'],
  },
  {
    id: 'google_app',
    platform: 'GOOGLE',
    name: 'App Promotion',
    description: 'Get more installs and interactions for your app.',
    Icon: SmartphoneIcon,
    subtypes: ['App Installs', 'App Engagement', 'App Pre-Registration'],
  },
  {
    id: 'google_awareness',
    platform: 'GOOGLE',
    name: 'Brand Awareness',
    description: 'Reach a broad audience and build brand recognition.',
    Icon: EyeIcon,
    subtypes: ['Display', 'Video', 'YouTube Masthead'],
  },
  {
    id: 'google_local',
    platform: 'GOOGLE',
    name: 'Local Store Visits',
    description: 'Drive visits to physical stores and promote local offers.',
    Icon: MapPinIcon,
    subtypes: ['Local', 'Performance Max (Local)', 'Smart'],
  },
];

const META_OBJECTIVES: Objective[] = [
  {
    id: 'meta_awareness',
    platform: 'META',
    name: 'Awareness',
    description: 'Show ads to people most likely to remember them. Reach, brand recall.',
    Icon: MegaphoneIcon,
    subtypes: ['Brand Awareness', 'Reach', 'Video Views', 'Store Location Awareness'],
  },
  {
    id: 'meta_traffic',
    platform: 'META',
    name: 'Traffic',
    description: 'Send people to a destination like your website, app, or phone call.',
    Icon: CursorIcon,
    subtypes: ['Website', 'App', 'Messenger', 'Calls'],
  },
  {
    id: 'meta_engagement',
    platform: 'META',
    name: 'Engagement',
    description: 'Get more post interactions, Page likes, event responses, or messages.',
    Icon: ThumbUpIcon,
    subtypes: ['Post Engagement', 'Page Likes', 'Event Responses', 'Video Views', 'Messages'],
  },
  {
    id: 'meta_leads',
    platform: 'META',
    name: 'Leads',
    description: 'Collect leads for your business or brand with lead forms, calls, and more.',
    Icon: UsersIcon,
    subtypes: ['Instant Forms', 'Messenger', 'Instagram', 'Calls', 'Website Signup'],
    recommended: true,
  },
  {
    id: 'meta_app',
    platform: 'META',
    name: 'App Promotion',
    description: 'Find new people to install your app and continue using it.',
    Icon: SmartphoneIcon,
    subtypes: ['App Installs', 'App Events', 'App Ads'],
  },
  {
    id: 'meta_sales',
    platform: 'META',
    name: 'Sales',
    description: 'Find people likely to purchase your product or service.',
    Icon: CartIcon,
    subtypes: ['Conversions', 'Catalog Sales', 'Messenger', 'Instagram'],
    recommended: true,
  },
];

// ── Objective Card ────────────────────────────────────────────────────────────

function ObjectiveCard({ obj, onSelect }: { obj: Objective; onSelect: () => void; }) {
  const isGoogle = obj.platform === 'GOOGLE';
  const { Icon } = obj;
  const brandColor = isGoogle ? '#4285F4' : '#1877F2';
  const brandColorBg = isGoogle ? 'rgba(66,133,244,0.08)' : 'rgba(24,119,242,0.08)';

  return (
    <button
      onClick={onSelect}
      className="group w-full text-left p-5 rounded-[16px] border border-white/5 bg-surface/40 backdrop-blur-md transition-all duration-300 hover:-translate-y-[2px] focus:outline-none relative overflow-hidden"
      style={{ boxShadow: '0 4px 20px -8px rgba(0,0,0,0.3)' }}
    >
      {/* Dynamic Glow Border on Hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[16px]"
        style={{ boxShadow: `inset 0 0 0 1.5px ${brandColor}` }}
      />
      {/* Subtle Background Glow */}
      <div 
        className="absolute -inset-4 opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle at right bottom, ${brandColor}, transparent 60%)` }}
      />

      {obj.recommended && (
        <span 
          className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-in fade-in"
          style={{ background: brandColorBg, color: brandColor, border: `1px solid ${isGoogle ? 'rgba(66,133,244,0.3)' : 'rgba(24,119,242,0.3)'}` }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: brandColor }} />
          Popular
        </span>
      )}

      <div className="flex items-start gap-4 relative z-10">
        <div
          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm"
          style={{ background: brandColorBg, border: `1px solid ${isGoogle ? 'rgba(66,133,244,0.2)' : 'rgba(24,119,242,0.2)'}` }}
        >
          <Icon className="w-6 h-6" style={{ color: brandColor }} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[15px] font-black tracking-tight text-text-main transition-colors">
              {obj.name}
            </span>
          </div>
          <p className="text-[13px] text-text-muted leading-relaxed mb-4 pr-6 line-clamp-2">
            {obj.description}
          </p>

          <div className="flex flex-wrap gap-2">
            {obj.subtypes.map((st) => (
              <span
                key={st}
                className="px-2.5 py-1 rounded-[6px] text-[10.5px] font-bold tracking-wide transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderColor: 'rgba(255,255,255,0.05)',
                  borderWidth: '1px',
                  color: 'var(--text-muted)'
                }}
              >
                {st}
              </span>
            ))}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 shrink-0 mt-3.5 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0" style={{ color: brandColor }} />
      </div>
    </button>
  );
}

// ── Platform Section ──────────────────────────────────────────────────────────

function PlatformSection({ platform, objectives, onSelect }: { platform: 'GOOGLE' | 'META'; objectives: Objective[]; onSelect: (id: string) => void; }) {
  const isGoogle = platform === 'GOOGLE';
  const brandColor = isGoogle ? '#4285F4' : '#1877F2';

  return (
    <div className="flex flex-col gap-5 relative">
      {/* Giant subtle background glow behind the entire column */}
      <div 
        className="absolute top-10 left-1/2 -translate-x-1/2 w-3/4 h-full blur-[100px] opacity-[0.03] pointer-events-none rounded-full"
        style={{ background: brandColor }}
      />

      {/* Platform header */}
      <div className="flex items-center gap-3.5 mb-2 relative z-10 px-2">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 shadow-lg ring-1 ring-white/10"
          style={{ background: isGoogle ? 'rgba(234,67,53,0.15)' : 'rgba(24,119,242,0.15)' }}
        >
          {isGoogle ? <GoogleLogo size={20} /> : <MetaLogo size={20} />}
        </div>
        <div>
          <h2 className="text-[17px] font-black text-text-main tracking-tight flex items-center gap-2">
            {isGoogle ? 'Google Ads' : 'Meta Ads'}
          </h2>
          <p className="text-[12px] font-medium text-text-muted/80 mt-0.5">
            {isGoogle
              ? 'Search, Display, Shopping & Video'
              : 'Facebook, Instagram & Messenger'}
          </p>
        </div>
        <div
          className="ml-auto px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border"
          style={{
            background: isGoogle ? 'rgba(234,67,53,0.1)' : 'rgba(24,119,242,0.1)',
            borderColor: isGoogle ? 'rgba(234,67,53,0.2)' : 'rgba(24,119,242,0.2)',
            color: isGoogle ? '#EA4335' : '#1877F2',
          }}
        >
          {objectives.length} Goals
        </div>
      </div>

      {/* Objective cards */}
      <div className="grid grid-cols-1 gap-3 relative z-10">
        {objectives.map((obj) => (
          <ObjectiveCard key={obj.id} obj={obj} onSelect={() => onSelect(obj.id)} />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CampaignTypePickerPage() {
  const navigate = useNavigate();

  const handleSelect = (objectiveId: string) => {
    navigate(`/ads/campaigns/new/${objectiveId}`);
  };

  return (
    <div className="flex flex-col min-h-screen relative" style={{ background: 'var(--bg)' }}>
      {/* Background ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Sticky header */}
      <header
        className="shrink-0 sticky top-0 z-30 border-b backdrop-blur-2xl"
        style={{ background: 'rgba(15,26,43,0.6)', borderColor: 'var(--border)' }}
      >
        <div className="px-8 h-16 flex items-center gap-5">
          <button
            onClick={() => navigate('/ads/campaigns')}
            className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors text-[13px] font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </button>
          <div
            className="w-px h-6 shrink-0"
            style={{ background: 'var(--border)' }}
          />
          <div>
            <span className="text-[14px] font-black text-text-main tracking-tight">New Campaign</span>
            <span className="mx-2.5 text-text-muted opacity-40">/</span>
            <span className="text-[13px] font-bold text-text-muted">Choose Objective</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 py-12 px-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Page title */}
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <h1 className="text-[36px] font-black text-text-main tracking-tight mb-3">
              What do you want to achieve?
            </h1>
            <p className="text-[15px] font-medium text-text-muted leading-relaxed">
              Your objective determines which campaign types, bidding strategies, and ad formats are available.
              Choose the goal that perfectly aligns with your business outcomes.
            </p>
          </div>

          {/* Two-column platform grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <PlatformSection
              platform="GOOGLE"
              objectives={GOOGLE_OBJECTIVES}
              onSelect={handleSelect}
            />
            <PlatformSection
              platform="META"
              objectives={META_OBJECTIVES}
              onSelect={handleSelect}
            />
          </div>

          {/* Bottom guidance card */}
          <div className="mt-16 relative group cursor-default">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-primary/20 rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative p-6 rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl flex items-start gap-5">
              <div className="p-3 rounded-xl shrink-0 bg-gradient-to-br from-purple-500/20 to-primary/20 ring-1 ring-white/10 shadow-inner">
                <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
              </div>
              <div className="pt-0.5">
                <p className="text-[15px] font-black text-text-main tracking-tight mb-1.5">Pro Tip: Not sure which to pick?</p>
                <p className="text-[13.5px] font-medium text-text-muted leading-relaxed max-w-3xl">
                  For most small businesses capturing local leads: we strongly recommend <strong className="text-text-main">Meta Leads</strong> (which uses high-converting instant forms with no landing page needed) 
                  or <strong className="text-text-main">Google Search (Leads)</strong> if you have a landing page and want high-intent search traffic. 
                  Both sync captured leads directly into your CRM.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
