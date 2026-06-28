import { useState, useRef } from 'react';
import { Plus, X, ChevronDown, MapPin } from 'lucide-react';
import type { AdType } from '../../../../types/ads';

// ── Platform logos ─────────────────────────────────────────────────────────────
export function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function MetaLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

// ── Objective lookup ──────────────────────────────────────────────────────────
export const OBJECTIVE_MAP: Record<string, { platform: 'GOOGLE' | 'META'; label: string; adType: AdType }> = {
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
export const GOOGLE_CAMPAIGN_TYPES = ['Search', 'Display', 'Shopping', 'Video', 'Performance Max', 'Smart'];
export const META_AD_FORMATS = ['Single Image/Video', 'Carousel', 'Collection', 'Stories', 'Reels'];

// ── Steps ─────────────────────────────────────────────────────────────────────
export const STEPS = [
  { id: 1, label: 'Campaign' },
  { id: 2, label: 'Budget & Schedule' },
  { id: 3, label: 'Targeting' },
  { id: 4, label: 'Creative' },
  { id: 5, label: 'Review' },
];

// ── Shared form controls ───────────────────────────────────────────────────────
export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
      {children}{required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

export function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg text-[13px] text-text-main border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${props.className ?? ''}`}
    />
  );
}

export function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg text-[13px] text-text-main border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none ${props.className ?? ''}`}
    />
  );
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
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

export function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
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

export function OptionPill({
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
export function TagInput({
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

export function LocationAutocomplete({
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
export function HeadlineList({
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
