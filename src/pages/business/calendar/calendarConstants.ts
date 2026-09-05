import {
  Users, Sparkles, CheckSquare, Phone, Video, MapPin, Calendar, Clock,
  Briefcase, Compass, ShieldCheck, Zap, UserCheck, MessageSquare, LayoutGrid
} from 'lucide-react';

export interface EventTypeConfig {
  label: string;
  shortLabel: string;
  icon: any;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  timeColor: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  accentColor: string;
}

export const TYPE_CONFIG: Record<string, EventTypeConfig> = {
  demo: {
    label: 'Product Discovery & Demo',
    shortLabel: 'Demo',
    icon: Sparkles,
    cardBg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    cardBorder: 'border-emerald-500/30 border-l-[3px] border-l-emerald-500',
    textColor: 'text-emerald-200',
    timeColor: 'text-emerald-400/90',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-300',
    dotColor: 'bg-emerald-400',
    accentColor: '#10B981',
  },
  meeting: {
    label: 'Executive Strategy Session',
    shortLabel: 'Strategy',
    icon: Users,
    cardBg: 'bg-blue-500/10 hover:bg-blue-500/15',
    cardBorder: 'border-blue-500/30 border-l-[3px] border-l-blue-500',
    textColor: 'text-blue-200',
    timeColor: 'text-blue-400/90',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-300',
    dotColor: 'bg-blue-400',
    accentColor: '#3B82F6',
  },
  video: {
    label: 'Virtual Conference',
    shortLabel: 'Video',
    icon: Video,
    cardBg: 'bg-indigo-500/10 hover:bg-indigo-500/15',
    cardBorder: 'border-indigo-500/30 border-l-[3px] border-l-indigo-500',
    textColor: 'text-indigo-200',
    timeColor: 'text-indigo-400/90',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-300',
    dotColor: 'bg-indigo-400',
    accentColor: '#6366F1',
  },
  calls: {
    label: 'Client Consultation Call',
    shortLabel: 'Call',
    icon: Phone,
    cardBg: 'bg-amber-500/10 hover:bg-amber-500/15',
    cardBorder: 'border-amber-500/30 border-l-[3px] border-l-amber-500',
    textColor: 'text-amber-200',
    timeColor: 'text-amber-400/90',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-300',
    dotColor: 'bg-amber-400',
    accentColor: '#F59E0B',
  },
  tasks: {
    label: 'Internal Standup & Review',
    shortLabel: 'Standup',
    icon: CheckSquare,
    cardBg: 'bg-slate-500/10 hover:bg-slate-500/15',
    cardBorder: 'border-slate-500/30 border-l-[3px] border-l-slate-400',
    textColor: 'text-slate-200',
    timeColor: 'text-slate-400/90',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-300',
    dotColor: 'bg-slate-400',
    accentColor: '#94A3B8',
  },
  consultation: {
    label: 'VIP Advisory Session',
    shortLabel: 'Advisory',
    icon: Briefcase,
    cardBg: 'bg-purple-500/10 hover:bg-purple-500/15',
    cardBorder: 'border-purple-500/30 border-l-[3px] border-l-purple-500',
    textColor: 'text-purple-200',
    timeColor: 'text-purple-400/90',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-300',
    dotColor: 'bg-purple-400',
    accentColor: '#A855F7',
  },
};

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  confirmed: { label: 'Confirmed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  scheduled: { label: 'Scheduled', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    dot: 'bg-blue-400' },
  completed: { label: 'Completed', color: 'text-text-muted',  bg: 'bg-surface/60',     border: 'border-border/60',      dot: 'bg-zinc-400' },
  cancelled: { label: 'Cancelled', color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    dot: 'bg-rose-400' },
  no_show:   { label: 'No-Show',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
};

export const EMPTY_FORM = {
  id: '',
  title: '',
  type: 'demo',
  date: '',
  time: '10:00',
  duration: 30,
  contactId: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  location: 'Google Meet',
  description: '',
  status: 'confirmed',
};
