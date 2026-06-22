import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Rocket, Check, Info, MonitorPlay, Plus, X, ChevronDown, MapPin, AlertCircle } from 'lucide-react';
import { useCreateCampaign, useUpdateCampaign, useAdCampaign, useLaunchCampaign } from '../../hooks/useAdCampaigns';
import type { AdType, CampaignDraft, AdTargeting } from '../../types/ads';
import MediaLibraryModal from '../../components/ads/MediaLibraryModal';

// ── Platform logos ─────────────────────────────────────────────────────────────
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

// ── Objective lookup ──────────────────────────────────────────────────────────
const OBJECTIVE_MAP: Record<string, { platform: 'GOOGLE' | 'META'; label: string; adType: AdType }> = {
  google_sales:     { platform: 'GOOGLE', label: 'Sales',                adType: 'GOOGLE_SEARCH' },
  google_leads:     { platform: 'GOOGLE', label: 'Leads',                adType: 'GOOGLE_SEARCH' },
  google_traffic:   { platform: 'GOOGLE', label: 'Website Traffic',      adType: 'GOOGLE_SEARCH' },
  google_app:       { platform: 'GOOGLE', label: 'App Promotion',        adType: 'GOOGLE_DISPLAY' },
  google_awareness: { platform: 'GOOGLE', label: 'Brand Awareness',      adType: 'GOOGLE_DISPLAY' },
  google_local:     { platform: 'GOOGLE', label: 'Local Store Visits',   adType: 'GOOGLE_DISPLAY' },
  meta_awareness:   { platform: 'META',   label: 'Awareness',            adType: 'FACEBOOK_FEED' },
  meta_traffic:     { platform: 'META',   label: 'Traffic',              adType: 'FACEBOOK_FEED' },
  meta_engagement:  { platform: 'META',   label: 'Engagement',           adType: 'FACEBOOK_FEED' },
  meta_leads:       { platform: 'META',   label: 'Leads',                adType: 'FACEBOOK_LEAD' },
  meta_app:         { platform: 'META',   label: 'App Promotion',        adType: 'FACEBOOK_FEED' },
  meta_sales:       { platform: 'META',   label: 'Sales',                adType: 'FACEBOOK_FEED' },
};

// ── Campaign type options ─────────────────────────────────────────────────────
const GOOGLE_CAMPAIGN_TYPES = ['Search', 'Display', 'Shopping', 'Video', 'Performance Max', 'Smart'];
const META_AD_FORMATS = ['Single Image/Video', 'Carousel', 'Collection', 'Stories', 'Reels'];

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Campaign' },
  { id: 2, label: 'Budget & Schedule' },
  { id: 3, label: 'Targeting' },
  { id: 4, label: 'Creative' },
  { id: 5, label: 'Review' },
];

// ── Shared form controls ───────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
      {children}{required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg text-[13px] text-text-main border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${props.className ?? ''}`}
    />
  );
}
function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg text-[13px] text-text-main border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none ${props.className ?? ''}`}
    />
  );
}
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full appearance-none px-3 py-2.5 pr-9 rounded-lg text-[13px] text-text-main border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors [&>option]:bg-surface [&>option]:text-text-main ${props.className ?? ''}`}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
    </div>
  );
}
function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-[14px] font-bold text-text-main">{title}</h3>
        {description && <p className="text-[12px] text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}
function OptionPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
        selected
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border bg-background text-text-muted hover:border-border hover:text-text-main hover:bg-surface-hover'
      }`}
    >
      {children}
    </button>
  );
}

// ── Tag input ─────────────────────────────────────────────────────────────────
function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}) {
  const [inputVal, setInputVal] = useState('');

  const add = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInputVal('');
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mb-2">
        <Input
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 px-3 py-2 rounded-lg border border-border bg-surface text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map(v => (
            <span key={v} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-primary text-[12px] font-semibold">
              {v}
              <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="text-primary/70 hover:text-primary">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Location Autocomplete ─────────────────────────────────────────────────────
const LOCATION_DATABASE = [
  // Countries
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy',
  'Brazil', 'Mexico', 'Japan', 'China', 'India', 'South Korea', 'Netherlands', 'Belgium',
  'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Portugal', 'Ireland',
  'New Zealand', 'Singapore', 'Hong Kong', 'UAE', 'Saudi Arabia', 'South Africa', 'Argentina',
  'Colombia', 'Chile', 'Peru', 'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Greece',
  // US States
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
  'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
  'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  // US Cities
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
  'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
  'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC',
  'Indianapolis, IN', 'San Francisco, CA', 'Seattle, WA', 'Denver, CO', 'Nashville, TN',
  'Oklahoma City, OK', 'El Paso, TX', 'Washington, DC', 'Boston, MA', 'Memphis, TN',
  'Louisville, KY', 'Portland, OR', 'Las Vegas, NV', 'Milwaukee, WI', 'Albuquerque, NM',
  'Tucson, AZ', 'Fresno, CA', 'Sacramento, CA', 'Mesa, AZ', 'Kansas City, MO',
  'Atlanta, GA', 'Omaha, NE', 'Colorado Springs, CO', 'Raleigh, NC', 'Long Beach, CA',
  'Virginia Beach, VA', 'Minneapolis, MN', 'Tampa, FL', 'New Orleans, LA', 'Arlington, TX',
  'Bakersfield, CA', 'Honolulu, HI', 'Anaheim, CA', 'Aurora, CO', 'Santa Ana, CA',
  'Corpus Christi, TX', 'Riverside, CA', 'St. Louis, MO', 'Lexington, KY', 'Pittsburgh, PA',
  'Anchorage, AK', 'Stockton, CA', 'Cincinnati, OH', 'St. Paul, MN', 'Greensboro, NC',
  'Toledo, OH', 'Newark, NJ', 'Plano, TX', 'Henderson, NV', 'Orlando, FL',
  'Chandler, AZ', 'Laredo, TX', 'Madison, WI', 'Durham, NC', 'Lubbock, TX',
  'Winston-Salem, NC', 'Garland, TX', 'Glendale, AZ', 'Hialeah, FL', 'Reno, NV',
  'Baton Rouge, LA', 'Irvine, CA', 'Chesapeake, VA', 'Irving, TX', 'Scottsdale, AZ',
  'North Las Vegas, NV', 'Fremont, CA', 'Gilbert, AZ', 'San Bernardino, CA', 'Birmingham, AL',
  'Rochester, NY', 'Richmond, VA', 'Spokane, WA', 'Des Moines, IA', 'Montgomery, AL',
  'Modesto, CA', 'Fayetteville, NC', 'Tacoma, WA', 'Shreveport, LA', 'Fontana, CA',
  'Moreno Valley, CA', 'Glendale, CA', 'Akron, OH', 'Yonkers, NY', 'Huntington Beach, CA',
  'Little Rock, AR', 'Columbus, GA', 'Augusta, GA', 'Grand Rapids, MI', 'Overland Park, KS',
  'Tallahassee, FL', 'Providence, RI', 'Cape Coral, FL', 'Knoxville, TN', 'Tempe, AZ',
  'Brownsville, TX', 'Mobile, AL', 'Newport News, VA', 'Peoria, AZ', 'Huntsville, AL',
  'Salt Lake City, UT', 'Frisco, TX', 'Sioux Falls, SD', 'Jackson, MS', 'Ontario, CA',
  'Elk Grove, CA', 'Garden Grove, CA', 'Chattanooga, TN', 'Oceanside, CA', 'Fort Lauderdale, FL',
  'Rancho Cucamonga, CA', 'Santa Clarita, CA', 'Vancouver, WA', 'Oxnard, CA', 'Eugene, OR',
  'Savannah, GA', 'Aurora, IL', 'Cary, NC', 'Dayton, OH', 'Worcester, MA',
  'Pasadena, TX', 'Hampton, VA', 'Pomona, CA', 'Escondido, CA', 'Mesquite, TX',
  'Sunnyvale, CA', 'Paterson, NJ', 'Salinas, CA', 'Torrance, CA', 'Palmdale, CA',
  'Lancaster, CA', 'Hayward, CA', 'Macon, GA', 'Fort Collins, CO', 'Waco, TX',
  // Canadian Cities
  'Toronto, ON', 'Montreal, QC', 'Vancouver, BC', 'Calgary, AB', 'Edmonton, AB',
  'Ottawa, ON', 'Winnipeg, MB', 'Quebec City, QC', 'Hamilton, ON', 'Kitchener, ON',
  // UK Cities
  'London, UK', 'Birmingham, UK', 'Leeds, UK', 'Glasgow, UK', 'Sheffield, UK',
  'Bradford, UK', 'Edinburgh, UK', 'Liverpool, UK', 'Manchester, UK', 'Bristol, UK',
  // Australian Cities
  'Sydney, NSW', 'Melbourne, VIC', 'Brisbane, QLD', 'Perth, WA', 'Adelaide, SA',
  'Gold Coast, QLD', 'Canberra, ACT', 'Newcastle, NSW', 'Wollongong, NSW',
];

function LocationAutocomplete({
  values,
  onChange,
}: {
  values: string[];
  onChange: (vals: string[]) => void;
}) {
  const [inputVal, setInputVal] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = (q: string) => {
    if (!q.trim()) { setSuggestions([]); return; }
    const lower = q.toLowerCase();
    const results = LOCATION_DATABASE
      .filter(loc => loc.toLowerCase().includes(lower) && !values.includes(loc))
      .slice(0, 8);
    setSuggestions(results);
    setHighlightIndex(-1);
  };

  const add = (loc: string) => {
    const trimmed = loc.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputVal('');
    setSuggestions([]);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && suggestions[highlightIndex]) {
        add(suggestions[highlightIndex]);
      } else if (inputVal.trim()) {
        add(inputVal);
      }
    }
    if (e.key === 'Escape') { setSuggestions([]); setHighlightIndex(-1); }
  };

  return (
    <div>
      <Label>Locations</Label>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => { setInputVal(e.target.value); search(e.target.value); }}
            onFocus={() => { setFocused(true); search(inputVal); }}
            onBlur={() => setTimeout(() => { setSuggestions([]); setFocused(false); }, 150)}
            onKeyDown={handleKeyDown}
            placeholder="Search city, state, or country..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-[13px] text-text-main border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
        {suggestions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-border bg-surface shadow-luxury overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => add(s)}
                className={`w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-2.5 transition-colors ${
                  i === highlightIndex ? 'bg-primary/10 text-primary' : 'text-text-main hover:bg-surface-hover'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {values.map(v => (
            <span key={v} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-primary text-[12px] font-semibold">
              <MapPin className="w-3 h-3" />
              {v}
              <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="text-primary/70 hover:text-primary">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Headline input with character limit ───────────────────────────────────────
function HeadlineList({
  headlines,
  onChange,
  maxChars = 30,
  maxItems = 15,
  minItems = 3,
  label,
  placeholder,
}: {
  headlines: string[];
  onChange: (h: string[]) => void;
  maxChars?: number;
  maxItems?: number;
  minItems?: number;
  label: string;
  placeholder?: string;
}) {
  const list = headlines.length < minItems
    ? [...headlines, ...Array(minItems - headlines.length).fill('')]
    : headlines;

  const update = (i: number, val: string) => {
    const next = [...list];
    next[i] = val;
    onChange(next.filter((_, idx) => idx < next.length));
  };
  const addRow = () => { if (list.length < maxItems) onChange([...list, '']); };
  const removeRow = (i: number) => { if (list.length > minItems) onChange(list.filter((_, idx) => idx !== i)); };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>{label}</Label>
        <span className="text-[11px] text-text-muted">{list.filter(Boolean).length}/{maxItems}</span>
      </div>
      <div className="space-y-2">
        {list.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-text-muted w-5 shrink-0 text-right">{i + 1}</span>
            <div className="relative flex-1">
              <input
                type="text"
                value={h}
                onChange={e => update(i, e.target.value)}
                placeholder={placeholder || `${label} ${i + 1}`}
                maxLength={maxChars}
                className={`w-full px-3 py-2 pr-14 rounded-lg text-[13px] border bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
                  h.length > maxChars * 0.9
                    ? 'border-amber-400/60 text-text-main'
                    : 'border-border text-text-main'
                }`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tabular-nums ${
                h.length >= maxChars ? 'text-red-400' : h.length > maxChars * 0.8 ? 'text-amber-400' : 'text-text-muted'
              }`}>
                {h.length}/{maxChars}
              </span>
            </div>
            {list.length > minItems && (
              <button type="button" onClick={() => removeRow(i)} className="shrink-0 text-text-muted hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {list.length < maxItems && (
        <button
          type="button"
          onClick={addRow}
          className="mt-2 flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-main transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}

// ── Step 1: Campaign Settings ─────────────────────────────────────────────────
function Step1Campaign({
  draft,
  setDraft,
  objectiveId,
  platform,
}: {
  draft: Partial<CampaignDraft>;
  setDraft: (fn: (d: Partial<CampaignDraft>) => Partial<CampaignDraft>) => void;
  objectiveId: string;
  platform: 'GOOGLE' | 'META';
}) {
  const objInfo = OBJECTIVE_MAP[objectiveId];
  const types = platform === 'GOOGLE' ? GOOGLE_CAMPAIGN_TYPES : META_AD_FORMATS;

  return (
    <div className="space-y-5">
      <SectionCard title="Campaign name" description="Give your campaign a descriptive name to identify it later.">
        <div>
          <Label required>Name</Label>
          <Input
            type="text"
            value={draft.name || ''}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder={`e.g., ${objInfo?.label || 'Campaign'} — ${new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })}`}
          />
        </div>
      </SectionCard>

      {platform === 'GOOGLE' && (
        <SectionCard title="Campaign type" description="Select how you want to reach people with your ads.">
          <div>
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {types.map(t => (
                <OptionPill
                  key={t}
                  selected={draft.objective === t}
                  onClick={() => setDraft(d => ({ ...d, objective: t }))}
                >
                  {t}
                </OptionPill>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-2.5">
              {draft.objective === 'Search' && 'Text ads that appear in Google search results when people search for your products or services.'}
              {draft.objective === 'Display' && 'Image ads shown across 3 million+ websites and apps in the Google Display Network.'}
              {draft.objective === 'Shopping' && 'Product listings that appear in Google Search and Google Shopping.'}
              {draft.objective === 'Video' && 'Video ads that appear on YouTube and across the web.'}
              {draft.objective === 'Performance Max' && 'Access all Google channels with a single campaign. Machine learning optimizes across Search, Display, YouTube, and more.'}
              {draft.objective === 'Smart' && 'A simplified campaign with automated targeting, creatives, and bidding.'}
              {!draft.objective && 'Choose a campaign type to see details.'}
            </p>
          </div>
        </SectionCard>
      )}

      {platform === 'META' && (
        <SectionCard title="Ad format" description="Choose how your creative will be presented.">
          <div>
            <Label>Format</Label>
            <div className="flex flex-wrap gap-2">
              {types.map(t => (
                <OptionPill
                  key={t}
                  selected={draft.objective === t}
                  onClick={() => setDraft(d => ({ ...d, objective: t }))}
                >
                  {t}
                </OptionPill>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {platform === 'META' && objectiveId === 'meta_leads' && (
        <SectionCard title="Lead form" description="Collect contact info directly in the app — no website needed.">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#1877F2]/8 border border-[#1877F2]/20">
            <MetaLogo size={18} />
            <div>
              <p className="text-[13px] font-semibold text-text-main mb-0.5">Instant Forms enabled</p>
              <p className="text-[12px] text-text-muted">Your lead form will be pre-filled with the user's Facebook profile data for higher conversion.</p>
            </div>
          </div>
        </SectionCard>
      )}

      {platform === 'META' && (
        <SectionCard title="Facebook Page" description="Required — your ad will run on behalf of your connected page.">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-primary/8 border border-primary/20">
            <MetaLogo size={18} />
            <div>
              <p className="text-[13px] font-semibold text-text-main mb-0.5">Auto-connected</p>
              <p className="text-[12px] text-text-muted">Your ad will automatically run on behalf of the primary Facebook Page tied to your connected account.</p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}


// ── Step 2: Budget & Schedule ─────────────────────────────────────────────────
function Step2Budget({
  draft,
  setDraft,
  platform,
}: {
  draft: Partial<CampaignDraft>;
  setDraft: (fn: (d: Partial<CampaignDraft>) => Partial<CampaignDraft>) => void;
  platform: 'GOOGLE' | 'META';
}) {
  const dailyBudget = (draft.budgetAmountCents ?? 5000) / 100;

  const BID_STRATEGIES_GOOGLE = [
    { value: 'MAXIMIZE_CONVERSIONS', label: 'Maximize Conversions', desc: 'Get as many conversions as possible within your budget.' },
    { value: 'TARGET_CPA', label: 'Target CPA', desc: 'Try to get conversions at or below your target cost per action.' },
    { value: 'TARGET_ROAS', label: 'Target ROAS', desc: 'Maximize conversion value while achieving your target return on ad spend.' },
    { value: 'MAXIMIZE_CLICKS', label: 'Maximize Clicks', desc: 'Get the most clicks within your budget.' },
    { value: 'MANUAL_CPC', label: 'Manual CPC', desc: 'Set your own maximum cost-per-click bids for full control.' },
  ];

  return (
    <div className="space-y-5">
      <SectionCard title="Budget" description="Set how much you want to spend.">
        <div>
          <Label>Budget type</Label>
          <div className="flex gap-2">
            {(['DAILY', 'LIFETIME'] as const).map(bt => (
              <OptionPill key={bt} selected={draft.budgetType === bt} onClick={() => setDraft(d => ({ ...d, budgetType: bt }))}>
                {bt === 'DAILY' ? 'Daily budget' : 'Lifetime budget'}
              </OptionPill>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            {draft.budgetType === 'DAILY'
              ? 'You\'ll be charged up to your daily limit. Spend may vary day-to-day but will average your daily budget over a month.'
              : 'You set a total budget for the full campaign duration. Delivery is automatically paced.'}
          </p>
        </div>

        <div>
          <Label required>{draft.budgetType === 'DAILY' ? 'Daily budget' : 'Total budget'}</Label>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px] font-semibold">$</span>
            <Input
              type="number"
              value={dailyBudget || ''}
              onChange={e => setDraft(d => ({ ...d, budgetAmountCents: Math.round(parseFloat(e.target.value) * 100) }))}
              className="pl-7"
              min={1}
              step={0.01}
              placeholder="50.00"
            />
          </div>
          {dailyBudget > 0 && (
            <p className="text-[11px] text-text-muted mt-1.5">
              Estimated {draft.budgetType === 'DAILY'
                ? `$${(dailyBudget * 30.4).toFixed(0)}/month maximum`
                : 'flat total spend'}
            </p>
          )}
        </div>
      </SectionCard>

      {platform === 'GOOGLE' && (
        <SectionCard title="Bidding strategy" description="Tell Google how to optimize your bids for your goals.">
          <div className="space-y-2">
            {BID_STRATEGIES_GOOGLE.map(bs => (
              <label
                key={bs.value}
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                  draft.bidStrategy === bs.value
                    ? 'border-primary bg-primary/8'
                    : 'border-border hover:border-border hover:bg-surface-hover'
                }`}
              >
                <input
                  type="radio"
                  name="bidStrategy"
                  value={bs.value}
                  checked={draft.bidStrategy === bs.value}
                  onChange={() => setDraft(d => ({ ...d, bidStrategy: bs.value }))}
                  className="mt-0.5 accent-primary shrink-0"
                />
                <div>
                  <p className="text-[13px] font-semibold text-text-main">{bs.label}</p>
                  <p className="text-[12px] text-text-muted mt-0.5">{bs.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {draft.bidStrategy === 'TARGET_CPA' && (
            <div className="pt-2">
              <Label>Target CPA</Label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px] font-semibold">$</span>
                <Input
                  type="number"
                  className="pl-7"
                  placeholder="25.00"
                  value={draft.targetCpaCents ? draft.targetCpaCents / 100 : ''}
                  onChange={e => setDraft(d => ({ ...d, targetCpaCents: Math.round(parseFloat(e.target.value) * 100) }))}
                />
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {platform === 'META' && (
        <SectionCard title="Bidding" description="How Meta optimizes your bids.">
          <div>
            <Label>Optimization goal</Label>
            <Select
              value={draft.bidStrategy || 'LOWEST_COST'}
              onChange={e => setDraft(d => ({ ...d, bidStrategy: e.target.value }))}
            >
              <option value="LOWEST_COST">Lowest Cost (auto)</option>
              <option value="COST_CAP">Cost Cap</option>
              <option value="BID_CAP">Bid Cap</option>
              <option value="VALUE_OPTIMIZATION">Value Optimization</option>
            </Select>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Schedule" description="Choose when your campaign runs.">
        <div>
          <Label>Run time</Label>
          <div className="flex gap-2 flex-wrap">
            {(['CONTINUOUS', 'SCHEDULED'] as const).map(st => (
              <OptionPill key={st} selected={draft.scheduleType === st} onClick={() => setDraft(d => ({ ...d, scheduleType: st }))}>
                {st === 'CONTINUOUS' ? 'Run continuously' : 'Set a start and end date'}
              </OptionPill>
            ))}
          </div>
        </div>

        {draft.scheduleType === 'SCHEDULED' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Start date</Label>
              <Input
                type="date"
                value={draft.startDate || ''}
                onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>End date (optional)</Label>
              <Input
                type="date"
                value={draft.endDate || ''}
                onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))}
              />
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Step 3: Targeting ─────────────────────────────────────────────────────────
function Step3Targeting({
  draft,
  setDraft,
  platform,
  objectiveId,
}: {
  draft: Partial<CampaignDraft>;
  setDraft: (fn: (d: Partial<CampaignDraft>) => Partial<CampaignDraft>) => void;
  platform: 'GOOGLE' | 'META';
  objectiveId: string;
}) {
  const targeting = draft.targeting || {};
  const update = (patch: Partial<AdTargeting>) =>
    setDraft(d => ({ ...d, targeting: { ...d.targeting, ...patch } }));

  const PREDEFINED_LOCATIONS = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Brazil', 'Mexico'];
  const INTEREST_SUGGESTIONS = ['Real Estate', 'Home Services', 'Fitness & Wellness', 'Finance', 'Healthcare', 'Technology', 'Food & Dining', 'Travel', 'Fashion', 'Education'];

  return (
    <div className="space-y-5">
      <SectionCard title="Locations" description="Target users in specific countries, regions, or cities.">
        <LocationAutocomplete
          values={targeting.locations || []}
          onChange={locs => update({ locations: locs })}
        />
      </SectionCard>

      {platform === 'GOOGLE' && (draft.objective === 'Search' || !draft.objective) && (
        <SectionCard title="Keywords" description="Your ads show when people search for these terms. One keyword per line.">
          <div>
            <Label>Search keywords</Label>
            <Textarea
              rows={8}
              value={(targeting.keywords || []).map((k: any) => typeof k === 'string' ? k : k.text).join('\n')}
              onChange={e => {
                const kws = e.target.value.split('\n').filter(Boolean).map(t => ({
                  text: t.trim().replace(/^["\[\]]+|["\[\]]+$/g, ''),
                  matchType: t.startsWith('[') ? 'EXACT' : t.startsWith('"') ? 'PHRASE' : 'BROAD' as any,
                }));
                update({ keywords: kws });
              }}
              placeholder={'roofing company near me\n"roof repair service"\n[roof installation]'}
            />
            <div className="mt-2 flex items-start gap-2 text-[11px] text-text-muted">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Use <code className="text-primary">[brackets]</code> for exact match, <code className="text-primary">"quotes"</code> for phrase match, or plain text for broad match.</span>
            </div>
          </div>

          <div>
            <Label>Negative keywords (optional)</Label>
            <Textarea
              rows={3}
              value={''}
              placeholder={'free\ncheap\nDIY'}
            />
            <p className="text-[11px] text-text-muted mt-1">Prevent your ads from showing for these terms.</p>
          </div>
        </SectionCard>
      )}

      {platform === 'META' && (
        <>
          <SectionCard title="Audience" description="Define who sees your ads on Facebook and Instagram.">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Min age</Label>
                <Select
                  value={targeting.ageMin || 18}
                  onChange={e => update({ ageMin: parseInt(e.target.value) })}
                >
                  {[18,21,25,30,35,40,45,50,55,60,65].map(a => <option key={a} value={a}>{a}</option>)}
                </Select>
              </div>
              <div>
                <Label>Max age</Label>
                <Select
                  value={targeting.ageMax || 65}
                  onChange={e => update({ ageMax: parseInt(e.target.value) })}
                >
                  {[25,30,35,40,45,50,55,60,65].map(a => <option key={a} value={a}>{a === 65 ? '65+' : a}</option>)}
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select
                  value={(targeting.genders || ['ALL'])[0]}
                  onChange={e => update({ genders: [e.target.value as any] })}
                >
                  <option value="ALL">All genders</option>
                  <option value="MALE">Men</option>
                  <option value="FEMALE">Women</option>
                </Select>
              </div>
            </div>

            <TagInput
              label="Detailed interests"
              values={targeting.interests || []}
              onChange={ints => update({ interests: ints })}
              placeholder="e.g., Homeowners, Real Estate"
            />
            {(!targeting.interests || targeting.interests.length === 0) && (
              <div>
                <p className="text-[11px] text-text-muted mb-2">Suggestions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_SUGGESTIONS.map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => update({ interests: [...(targeting.interests || []), i] })}
                      className="px-2.5 py-1 rounded-md border border-border text-[11px] text-text-muted hover:text-text-main hover:border-primary/40 transition-colors"
                    >
                      + {i}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Placements" description="Where your ads appear across Meta's platforms.">
            <div>
              <Label>Placement type</Label>
              <div className="flex gap-2 flex-wrap">
                {['Automatic (Recommended)', 'Manual placements'].map(p => (
                  <OptionPill
                    key={p}
                    selected={(draft as any).__placements === p}
                    onClick={() => setDraft(d => ({ ...d, __placements: p } as any))}
                  >
                    {p}
                  </OptionPill>
                ))}
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                Automatic placements deliver your ads across Facebook, Instagram, Messenger, and Audience Network for the best results.
              </p>
            </div>
          </SectionCard>
        </>
      )}

      {platform === 'GOOGLE' && (
        <SectionCard title="Languages" description="Target users in specific languages.">
          <div>
            <Label>Languages</Label>
            <div className="flex flex-wrap gap-2">
              {['English', 'Spanish', 'French', 'German', 'Portuguese'].map(lang => (
                <OptionPill
                  key={lang}
                  selected={((draft as any).__langs || ['English']).includes(lang)}
                  onClick={() => {
                    const curr: string[] = (draft as any).__langs || ['English'];
                    const next = curr.includes(lang) ? curr.filter(l => l !== lang) : [...curr, lang];
                    setDraft(d => ({ ...d, __langs: next } as any));
                  }}
                >
                  {lang}
                </OptionPill>
              ))}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Step 4: Creative ──────────────────────────────────────────────────────────
function Step4Creative({
  draft,
  setDraft,
  platform,
  objectiveId,
}: {
  draft: Partial<CampaignDraft>;
  setDraft: (fn: (d: Partial<CampaignDraft>) => Partial<CampaignDraft>) => void;
  platform: 'GOOGLE' | 'META';
  objectiveId: string;
}) {
  const creative = draft.creative || {};
  const update = (patch: Partial<typeof creative>) =>
    setDraft(d => ({ ...d, creative: { ...d.creative, ...patch } }));

  const isLeadAd = objectiveId === 'meta_leads' || objectiveId === 'google_leads';
  const [showMediaModal, setShowMediaModal] = useState(false);

  return (
    <div className="space-y-5">
      {/* URL */}
      <SectionCard title="Final URL" description={isLeadAd ? "Required for your privacy policy and ad creative." : "Where users go when they click your ad."}>
        <div>
          <Label required>Website URL</Label>
            <Input
              type="url"
              value={creative.finalUrl || ''}
              onChange={e => update({ finalUrl: e.target.value })}
              placeholder="https://yourwebsite.com/landing-page"
            />
          </div>
        </SectionCard>
      )}

      {/* Google Search: Headlines + Descriptions */}
      {platform === 'GOOGLE' && (draft.objective !== 'Display' && draft.objective !== 'Video') && (
        <SectionCard
          title="Responsive search ad"
          description="Google automatically combines up to 3 headlines and 2 descriptions to create the best-performing ad."
        >
          <HeadlineList
            label="Headlines"
            headlines={creative.headlines || []}
            onChange={h => update({ headlines: h })}
            maxChars={30}
            maxItems={15}
            minItems={3}
            placeholder="Add a headline"
          />
          <HeadlineList
            label="Descriptions"
            headlines={creative.descriptions || []}
            onChange={d => update({ descriptions: d })}
            maxChars={90}
            maxItems={4}
            minItems={2}
            placeholder="Add a description"
          />
        </SectionCard>
      )}

      {/* Google Display: Image + headline */}
      {platform === 'GOOGLE' && draft.objective === 'Display' && (
        <SectionCard title="Responsive display ad" description="Upload images and write copy. Google resizes and reformats them automatically.">
          <div>
            <Label>Marketing images</Label>
            {creative.imageUrls?.[0] ? (
              <div className="relative group rounded-xl overflow-hidden border border-border aspect-video">
                <img src={creative.imageUrls[0]} alt="Creative" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button onClick={() => setShowMediaModal(true)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold shadow-sm">
                    Change Image
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => setShowMediaModal(true)} className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 hover:bg-surface-hover transition-colors cursor-pointer">
                <svg className="w-8 h-8 text-text-muted mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path d="M21 15l-5-5L5 21"/>
                </svg>
                <p className="text-[13px] font-medium text-text-muted">Click to open Media Library</p>
                <p className="text-[11px] text-text-muted mt-1">Select or upload from your existing assets.</p>
              </div>
            )}
          </div>
          <HeadlineList
            label="Headlines"
            headlines={creative.headlines || []}
            onChange={h => update({ headlines: h })}
            maxChars={30}
            maxItems={5}
            minItems={1}
            placeholder="Add a headline"
          />
          <HeadlineList
            label="Descriptions"
            headlines={creative.descriptions || []}
            onChange={d => update({ descriptions: d })}
            maxChars={90}
            maxItems={5}
            minItems={1}
            placeholder="Add a description"
          />
        </SectionCard>
      )}

      {/* Meta: Primary text + headline + image */}
      {platform === 'META' && (
        <>
          <SectionCard title="Ad copy" description="Write the text that appears in your ad.">
            <div>
              <Label required>Primary text</Label>
              <Textarea
                rows={4}
                value={creative.primaryText || ''}
                onChange={e => update({ primaryText: e.target.value })}
                placeholder="Write the main body text for your ad. Keep it concise and focus on your unique value..."
              />
              <p className="text-[11px] text-text-muted mt-1.5">
                {(creative.primaryText || '').length}/125 recommended
              </p>
            </div>

            <div>
              <Label>Headline</Label>
              <Input
                value={creative.headlines?.[0] || ''}
                onChange={e => update({ headlines: [e.target.value] })}
                placeholder="Bold headline under your image"
                maxLength={40}
              />
              <p className="text-[11px] text-text-muted mt-1">{(creative.headlines?.[0] || '').length}/40</p>
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Input
                value={creative.descriptions?.[0] || ''}
                onChange={e => update({ descriptions: [e.target.value] })}
                placeholder="Additional details below the headline"
                maxLength={30}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Call to action</Label>
                <Select
                  value={creative.callToAction || 'LEARN_MORE'}
                  onChange={e => update({ callToAction: e.target.value })}
                >
                  <option value="LEARN_MORE">Learn More</option>
                  <option value="SHOP_NOW">Shop Now</option>
                  <option value="GET_QUOTE">Get Quote</option>
                  <option value="BOOK_NOW">Book Now</option>
                  <option value="CONTACT_US">Contact Us</option>
                  <option value="SIGN_UP">Sign Up</option>
                  <option value="DOWNLOAD">Download</option>
                  <option value="GET_OFFER">Get Offer</option>
                  <option value="APPLY_NOW">Apply Now</option>
                </Select>
              </div>
              <div>
                <Label>Display link (optional)</Label>
                <Input value="" placeholder="yourwebsite.com" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Media" description="Select your image or video creative.">
            <div>
              <Label>Ad image or video</Label>
              {creative.imageUrls?.[0] ? (
                <div className="relative group rounded-xl overflow-hidden border border-border aspect-square w-64 max-w-full">
                  <img src={creative.imageUrls[0]} alt="Creative" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => setShowMediaModal(true)} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold shadow-sm">
                      Change Media
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {['1:1 Square (1080×1080)', '1.91:1 Landscape (1200×628)', '9:16 Story (1080×1920)'].slice(0, 2).map(format => (
                    <div key={format} onClick={() => setShowMediaModal(true)} className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 hover:bg-surface-hover transition-colors cursor-pointer">
                      <svg className="w-6 h-6 text-text-muted mx-auto mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path d="M21 15l-5-5L5 21"/>
                      </svg>
                      <p className="text-[11px] font-medium text-text-muted">{format}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}

      {/* Meta Lead form fields */}
      {platform === 'META' && isLeadAd && (
        <>
          <SectionCard title="Lead form" description="Choose the fields to collect from potential leads.">
            <div>
              <Label>Form fields</Label>
              <div className="space-y-2">
                {[
                  { id: 'FULL_NAME', label: 'Full Name', required: true },
                  { id: 'EMAIL', label: 'Email', required: true },
                  { id: 'PHONE', label: 'Phone Number', required: false },
                  { id: 'COMPANY', label: 'Company Name', required: false },
                  { id: 'ADDRESS', label: 'Street Address', required: false },
                ].map(field => (
                  <label key={field.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface-hover transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={field.required}
                      disabled={field.required}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <span className="text-[13px] font-medium text-text-main">{field.label}</span>
                      {field.required && <span className="ml-2 text-[10px] text-primary font-bold uppercase">Required</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            </div>
          </SectionCard>
        </>
      )}

      {/* Google Lead Form Extension */}
      {platform === 'GOOGLE' && isLeadAd && (
        <SectionCard title="Lead form extension" description="Collect leads directly in Google search results — no website needed.">
          <div>
            <Label required>Headline</Label>
            <Input
              value={creative.headlines?.[0] || ''}
              onChange={e => update({ headlines: [e.target.value] })}
              placeholder="Get a free estimate"
              maxLength={30}
            />
          </div>
          <div>
            <Label required>Business name</Label>
            <Input placeholder="Your Company Name" maxLength={25} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} placeholder="Tell people what they'll get..." maxLength={200} />
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Step 5: Review ────────────────────────────────────────────────────────────
function Step5Review({
  draft,
  objectiveId,
  platform,
}: {
  draft: Partial<CampaignDraft>;
  objectiveId: string;
  platform: 'GOOGLE' | 'META';
}) {
  const objInfo = OBJECTIVE_MAP[objectiveId];
  const daily = (draft.budgetAmountCents ?? 0) / 100;

  const rows = [
    { label: 'Campaign name', value: draft.name || '—' },
    { label: 'Platform', value: platform === 'GOOGLE' ? 'Google Ads' : 'Meta Ads' },
    { label: 'Objective', value: objInfo?.label || '—' },
    { label: 'Campaign type', value: draft.objective || '—' },
    { label: 'Budget', value: daily > 0 ? `$${daily.toFixed(2)} / ${draft.budgetType?.toLowerCase() || 'day'}` : '—' },
    { label: 'Bid strategy', value: draft.bidStrategy?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) || 'Default' },
    { label: 'Schedule', value: draft.scheduleType === 'CONTINUOUS' ? 'Continuous' : `${draft.startDate || '?'} → ${draft.endDate || 'No end'}` },
    { label: 'Locations', value: (draft.targeting?.locations || []).join(', ') || '—' },
    { label: 'Keywords', value: platform === 'GOOGLE' ? `${(draft.targeting?.keywords || []).length} keywords` : 'N/A' },
  ];

  const warnings: string[] = [];
  if (!draft.name) warnings.push('Campaign name is required');
  if (!daily) warnings.push('Set a budget');
  if (!draft.targeting?.locations?.length) warnings.push('Add at least one location');
  if (platform === 'GOOGLE' && draft.objective === 'Search' && !(draft.targeting?.keywords?.length)) warnings.push('Add search keywords');
  if (!draft.creative?.headlines?.length) warnings.push('Add ad headlines');
  if (!draft.creative?.finalUrl) warnings.push('Add a website URL for the ad destination');
  if (!draft.creative?.imageUrls?.length && platform === 'META') warnings.push('Upload an ad image or video');

  return (
    <div className="space-y-5">
      {warnings.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-400/30 bg-amber-400/8 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p className="text-[13px] font-bold text-amber-400 mb-1">Before you launch</p>
            <ul className="space-y-0.5">
              {warnings.map(w => (
                <li key={w} className="text-[12px] text-text-muted">· {w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <SectionCard title="Campaign summary" description="Review your settings before launching.">
        <dl className="divide-y divide-border/50">
          {rows.map(row => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <dt className="text-[12px] text-text-muted shrink-0 w-32">{row.label}</dt>
              <dd className="text-[12px] font-semibold text-text-main text-right">{row.value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title="Creative preview" description="">
        {platform === 'GOOGLE' ? (
          <div className="p-4 rounded-xl border border-border bg-background font-['Arial',sans-serif] max-w-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] bg-border/80 text-text-muted px-1.5 py-0.5 rounded font-semibold">Ad</span>
              <span className="text-[12px] text-green-600">{(draft.creative?.finalUrl || 'yourwebsite.com').replace(/^https?:\/\//, '').split('/')[0]}</span>
            </div>
            <div className="text-[18px] text-blue-600 font-medium leading-snug mb-1">
              {(draft.creative?.headlines || []).slice(0, 3).filter(Boolean).join(' | ') || 'Your Ad Headline'}
            </div>
            <div className="text-[13px] text-text-main">
              {draft.creative?.descriptions?.[0] || 'Your ad description appears here.'}
            </div>
          </div>
        ) : (
          <div className="max-w-sm border border-border rounded-xl overflow-hidden bg-surface">
            <div className="flex items-center gap-2 p-3 border-b border-border/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">S</div>
              <div>
                <p className="text-[12px] font-semibold text-text-main">Your Page Name</p>
                <p className="text-[10px] text-text-muted">Sponsored</p>
              </div>
            </div>
            {draft.creative?.primaryText && (
              <div className="px-3 pt-3 pb-2 text-[13px] text-text-main">{draft.creative.primaryText}</div>
            )}
            {draft.creative?.imageUrls?.[0] ? (
              <img src={draft.creative.imageUrls[0]} alt="Creative preview" className="w-full aspect-square object-cover border-y border-border/50" />
            ) : (
              <div className="h-40 bg-gradient-to-br from-primary/10 to-primary/25 flex items-center justify-center border-y border-border/50">
                <span className="text-[11px] text-text-muted">Ad image</span>
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-background/50">
              <div>
                <p className="text-[11px] text-text-muted">{(draft.creative?.finalUrl || 'yourwebsite.com').replace(/^https?:\/\//, '').split('/')[0]}</p>
                <p className="text-[13px] font-semibold text-text-main">{draft.creative?.headlines?.[0] || 'Your Headline'}</p>
              </div>
              <button className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[12px] font-semibold border border-primary/30">
                {draft.creative?.callToAction?.replace(/_/g, ' ') || 'Learn More'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="p-4 rounded-xl bg-primary/6 border border-primary/20 flex items-start gap-3">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[12px] text-text-muted">
          <strong className="text-text-main">Launching</strong> submits this campaign to {platform === 'GOOGLE' ? 'Google' : 'Meta'} for review. Most campaigns enter review within 24 hours. You can edit or pause at any time.
        </p>
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isComplete = step.id < currentStep;
        const isActive = step.id === currentStep;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                isComplete
                  ? 'bg-primary text-white'
                  : isActive
                  ? 'bg-primary/20 text-primary border-2 border-primary'
                  : 'bg-border/60 text-text-muted'
              }`}>
                {isComplete ? <Check className="w-3.5 h-3.5" /> : step.id}
              </div>
              <span className={`text-[12px] font-semibold hidden sm:block ${isActive ? 'text-text-main' : 'text-text-muted'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 sm:w-16 h-px mx-2 transition-colors ${i < currentStep - 1 ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main CampaignBuilder ──────────────────────────────────────────────────────
export default function CampaignBuilder() {
  const { id, type: typeParam } = useParams<{ id: string; type: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  // Resolve objective from URL param
  const objectiveId = typeParam || 'google_leads';
  const objInfo = OBJECTIVE_MAP[objectiveId] || OBJECTIVE_MAP['google_leads'];
  const platform = objInfo.platform;

  const { data: existingCampaign, isLoading } = useAdCampaign(id || '');
  const { mutate: create, isPending: isCreating } = useCreateCampaign();
  const { mutate: update, isPending: isUpdating } = useUpdateCampaign();
  const { mutate: launch, isPending: isLaunching } = useLaunchCampaign();

  const [step, setStep] = useState(1);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<CampaignDraft>>({
    adType: objInfo.adType,
    name: '',
    objective: '',
    budgetType: 'DAILY',
    budgetAmountCents: 5000,
    scheduleType: 'CONTINUOUS',
    bidStrategy: 'MAXIMIZE_CONVERSIONS',
    targeting: { locations: ['United States'] },
    creative: { headlines: [], descriptions: [] },
  });

  useEffect(() => {
    if (existingCampaign) {
      setDraft({
        adType: existingCampaign.adType as AdType,
        name: existingCampaign.name,
        objective: existingCampaign.objective,
        budgetType: existingCampaign.budgetType,
        budgetAmountCents: existingCampaign.budgetAmountCents,
        scheduleType: existingCampaign.scheduleType,
        startDate: existingCampaign.startDate || undefined,
        endDate: existingCampaign.endDate || undefined,
        bidStrategy: existingCampaign.bidStrategy || 'MAXIMIZE_CONVERSIONS',
        targeting: existingCampaign.targeting,
        creative: existingCampaign.creative,
      });
    }
  }, [existingCampaign]);

  // Ensure creative.descriptions is never empty (backend requires min 1)
  const prepareDraft = useCallback((d: Partial<CampaignDraft>): Partial<CampaignDraft> => {
    const creative = d.creative || {};
    const descriptions = (creative.descriptions || []).filter(Boolean);
    if (descriptions.length === 0) {
      // fallback: use primaryText or first headline as description
      const fallback = creative.primaryText || (creative.headlines || [])[0] || 'Contact us today';
      return { ...d, creative: { ...creative, descriptions: [fallback.slice(0, 90)] } };
    }
    return d;
  }, []);

  const handleSaveDraft = useCallback(() => {
    setSaveError(null);
    const prepared = prepareDraft(draft);
    if (isEditing) {
      update({ id, data: prepared }, {
        onSuccess: () => navigate('/ads/campaigns'),
        onError: (e: any) => setSaveError(e?.message || 'Failed to save. Check all required fields.'),
      });
    } else {
      create(prepared, {
        onSuccess: () => navigate('/ads/campaigns'),
        onError: (e: any) => setSaveError(e?.message || 'Failed to save. Check all required fields.'),
      });
    }
  }, [draft, isEditing, id, prepareDraft]);

  const handleLaunch = useCallback(() => {
    setLaunchError(null);
    const prepared = prepareDraft(draft);

    // Hard validation before launch
    if (!prepared.name) return setLaunchError('Campaign name is required.');
    if (!prepared.targeting?.locations?.length) return setLaunchError('At least one location is required.');
    if (!prepared.creative?.finalUrl) return setLaunchError('Website URL is required for the ad destination.');
    if (platform === 'META' && !prepared.creative?.imageUrls?.length) return setLaunchError('An ad image or video is required for Meta Ads.');

    if (!id) {
      create(prepared, {
        onSuccess: (newC: any) => {
          launch(newC.id, {
            onSuccess: () => navigate(`/ads/campaigns/${newC.id}`),
            onError: (e: any) => setLaunchError(e?.message || 'Launch failed. Please try again.'),
          });
        },
        onError: (e: any) => setLaunchError(e?.message || 'Could not save campaign. Check all required fields.'),
      });
    } else {
      update({ id, data: prepared }, {
        onSuccess: () => {
          launch(id, {
            onSuccess: () => navigate(`/ads/campaigns/${id}`),
            onError: (e: any) => setLaunchError(e?.message || 'Launch failed. Please try again.'),
          });
        },
        onError: (e: any) => setLaunchError(e?.message || 'Could not save campaign. Check all required fields.'),
      });
    }
  }, [draft, id, isEditing, prepareDraft]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isSaving = isCreating || isUpdating;
  const isLastStep = step === STEPS.length;

  const creative = draft.creative || {};

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Top header ────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-16 border-b border-border bg-surface flex items-center justify-between px-6 gap-4 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/ads/campaigns/new')}
            className="text-text-muted hover:text-text-main transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: platform === 'GOOGLE' ? 'rgba(234,67,53,0.1)' : 'rgba(24,119,242,0.1)' }}>
              {platform === 'GOOGLE' ? <GoogleLogo size={16} /> : <MetaLogo size={16} />}
            </div>
            <div>
              <p className="text-[13px] font-bold text-text-main leading-tight">{isEditing ? 'Edit Campaign' : 'New Campaign'}</p>
              <p className="text-[11px] text-text-muted">{platform === 'GOOGLE' ? 'Google Ads' : 'Meta Ads'} · {objInfo.label}</p>
            </div>
          </div>
        </div>

        {/* Progress bar (desktop) */}
        <div className="hidden lg:flex flex-1 items-center justify-center px-8">
          <ProgressBar currentStep={step} totalSteps={STEPS.length} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving || isLaunching}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : <><Save className="w-3.5 h-3.5" /> Save draft</>}
          </button>
          {isLastStep && (
            <button
              onClick={handleLaunch}
              disabled={isSaving || isLaunching || existingCampaign?.status === 'ACTIVE'}
              className="flex items-center gap-1.5 h-9 px-4 bg-primary text-white rounded-lg text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-colors"
            >
              {isLaunching ? 'Launching...' : <><Rocket className="w-3.5 h-3.5" /> Launch</>}
            </button>
          )}
        </div>
      </header>

      {/* ── Content area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex bg-bg">
        {/* Main form */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Mobile step indicator */}
            <div className="lg:hidden mb-6 overflow-x-auto pb-1">
              <ProgressBar currentStep={step} totalSteps={STEPS.length} />
            </div>

            {/* Step label */}
            <div className="mb-6">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">
                Step {step} of {STEPS.length}
              </p>
              <h2 className="text-[20px] font-black text-text-main tracking-tight">
                {STEPS[step - 1].label}
              </h2>
            </div>

            {/* Save / Launch error banners */}
            {saveError && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-xl border border-red-400/30 bg-red-400/8 text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold mb-0.5">Couldn't save draft</p>
                  <p className="text-[11px] opacity-80">{saveError}</p>
                </div>
                <button onClick={() => setSaveError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {launchError && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-xl border border-red-400/30 bg-red-400/8 text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold mb-0.5">Launch failed</p>
                  <p className="text-[11px] opacity-80">{launchError}</p>
                </div>
                <button onClick={() => setLaunchError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Step content */}
            {step === 1 && <Step1Campaign draft={draft} setDraft={setDraft} objectiveId={objectiveId} platform={platform} />}
            {step === 2 && <Step2Budget draft={draft} setDraft={setDraft} platform={platform} />}
            {step === 3 && <Step3Targeting draft={draft} setDraft={setDraft} platform={platform} objectiveId={objectiveId} />}
            {step === 4 && <Step4Creative draft={draft} setDraft={setDraft} platform={platform} objectiveId={objectiveId} />}
            {step === 5 && <Step5Review draft={draft} objectiveId={objectiveId} platform={platform} />}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-5 border-t border-border/50">
              <button
                type="button"
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="flex items-center gap-2 h-10 px-5 rounded-lg border border-border text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => setStep(s => Math.min(STEPS.length, s + 1))}
                  className="flex items-center gap-2 h-10 px-6 bg-primary text-white rounded-lg text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLaunch}
                  disabled={isSaving || isLaunching}
                  className="flex items-center gap-2 h-10 px-6 bg-primary text-white rounded-lg text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isLaunching ? 'Launching...' : <><Rocket className="w-4 h-4" /> Launch Campaign</>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div
          className="hidden xl:flex w-[400px] shrink-0 border-l border-border bg-surface flex-col overflow-hidden shadow-[inset_1px_0_0_0_rgba(0,0,0,0.02)]"
        >
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-surface">
            <MonitorPlay className="w-4 h-4 text-text-muted" />
            <h3 className="text-[12px] font-bold text-text-main">Live Preview</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {platform === 'GOOGLE' ? (
              <div className="rounded-xl border border-border bg-white p-4 font-['Arial',sans-serif]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold border border-gray-200">Ad</span>
                  <span className="text-[11px] text-green-700">{(creative.finalUrl || 'yourwebsite.com').replace(/^https?:\/\//, '').split('/')[0]}</span>
                </div>
                <div className="text-[18px] text-blue-700 font-medium leading-snug mb-1.5">
                  {(creative.headlines || []).filter(Boolean).slice(0, 3).join(' | ') || 'Your Headline Here'}
                </div>
                <div className="text-[13px] text-gray-800 leading-relaxed">
                  {creative.descriptions?.[0] || 'Your description shows here and tells users what to do. Keep it informative.'}
                </div>
                {creative.imageUrls?.[0] && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 aspect-video">
                    <img src={creative.imageUrls[0]} className="w-full h-full object-cover" alt="Ad preview" />
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
                <div className="flex items-center gap-2 p-3.5 border-b border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[12px]">S</div>
                  <div>
                    <p className="text-[13px] font-semibold text-text-main leading-tight">Your Page</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Sponsored</p>
                  </div>
                </div>
                {creative.primaryText && (
                  <div className="px-3.5 pt-3 pb-2 text-[14px] text-text-main leading-relaxed">{creative.primaryText}</div>
                )}
                {creative.imageUrls?.[0] ? (
                  <div className="w-full aspect-square border-y border-border/50 bg-black flex items-center justify-center">
                     <img src={creative.imageUrls[0]} alt="Creative preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-primary/10 to-primary/25 flex items-center justify-center border-y border-border/50">
                    <span className="text-[12px] text-text-muted">Ad image</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3.5 bg-surface hover:bg-surface-hover transition-colors cursor-pointer">
                  <div>
                    <p className="text-[11px] text-text-muted mb-0.5">{(creative.finalUrl || 'yourwebsite.com').replace(/^https?:\/\//, '').split('/')[0]}</p>
                    <p className="text-[14px] font-bold text-text-main leading-tight">{creative.headlines?.[0] || 'Your Headline'}</p>
                    {creative.descriptions?.[0] && <p className="text-[13px] text-text-muted mt-1">{creative.descriptions[0]}</p>}
                  </div>
                  <span className="px-3 py-1.5 bg-border text-text-main rounded-md text-[12px] font-bold shrink-0 ml-2">
                    {(creative.callToAction || 'LEARN_MORE').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 p-3 rounded-lg border border-border/50 bg-surface">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-2">Campaign Summary</p>
              <div className="space-y-1.5">
                {[
                  { k: 'Name', v: draft.name || '—' },
                  { k: 'Budget', v: draft.budgetAmountCents ? `$${(draft.budgetAmountCents/100).toFixed(0)}/day` : '—' },
                  { k: 'Locations', v: (draft.targeting?.locations || []).join(', ') || '—' },
                ].map(item => (
                  <div key={item.k} className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-text-muted">{item.k}</span>
                    <span className="text-[10px] font-semibold text-text-main text-right truncate max-w-[120px]">{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
