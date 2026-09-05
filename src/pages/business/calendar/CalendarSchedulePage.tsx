import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, Video, Phone, Users, Clock, Calendar as CalIcon,
  X, MapPin, Trash2, Edit2, Download, ExternalLink, RefreshCw,
  Search, Check, User, Sparkles, ChevronDown, CheckCircle2, AlertCircle,
  Share2, Globe, Eye, List, Grid3X3, CalendarDays, CalendarRange, Filter,
  Settings, Bell, Copy, CheckSquare, CalendarCheck2, ArrowRight, Tag,
  Building, Mail, Link as LinkIcon, Briefcase
} from 'lucide-react';
import { HeaderPortal } from '../../../components/layout/HeaderPortal';
import { SlideOverPanel } from '../../../components/ui/SlideOverPanel';
import { ConfirmDelete } from '../../../components/ui/ConfirmDelete';
import { useToast } from '../../../components/ui/Toast';
import { apiClient } from '../../../lib/apiClient';
import type { Appointment } from '../../../types/business';

// ─── Constants & Configurations ───────────────────────────────────────────────

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_HEADER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type CalendarViewType = 'month' | 'week' | 'day' | 'agenda' | 'year';

// Category color palettes matching CRM design system
const EVENT_PALETTES: Record<string, { bg: string; text: string; border: string; dot: string; label: string; icon: any }> = {
  demo: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
    label: 'Product Demo',
    icon: Sparkles,
  },
  meeting: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/30',
    dot: 'bg-blue-500',
    label: 'Strategy Session',
    icon: Users,
  },
  video: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/30',
    dot: 'bg-purple-500',
    label: 'Virtual Meeting',
    icon: Video,
  },
  calls: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
    label: 'Discovery Call',
    icon: Phone,
  },
  tasks: {
    bg: 'bg-zinc-500/10 dark:bg-zinc-500/15',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-400',
    label: 'Internal Sync',
    icon: Clock,
  },
  consultation: {
    bg: 'bg-pink-500/10 dark:bg-pink-500/15',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-500/30',
    dot: 'bg-pink-500',
    label: 'Consultation',
    icon: CalIcon,
  },
};

function getPalette(type?: string) {
  return EVENT_PALETTES[type || 'meeting'] || EVENT_PALETTES.meeting;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Safely parse local YYYY-MM-DD and optional HH:mm into a local Date object without UTC timezone shifts
function parseLocalDateAndTime(dateStr: string, timeStr: string = '10:00'): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0, 0);
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtTimeRange(start: Date, end: Date): string {
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

// Generates 7x5 or 7x6 month grid with Monday as first day of the week
function getMonthGrid(year: number, month: number) {
  const firstDayObj = new Date(year, month, 1);
  let firstDay = firstDayObj.getDay() - 1;
  if (firstDay === -1) firstDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; isCurrentMonth: boolean; dateStr: string; dateObj: Date }[] = [];

  // Trailing days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const dNum = prevMonthDays - i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    cells.push({
      day: dNum,
      isCurrentMonth: false,
      dateStr,
      dateObj: new Date(prevY, prevM, dNum),
    });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      isCurrentMonth: true,
      dateStr,
      dateObj: new Date(year, month, d),
    });
  }

  // Leading days into next month to complete the 7-column grid
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
    cells.push({
      day: nextDay,
      isCurrentMonth: false,
      dateStr,
      dateObj: new Date(nextY, nextM, nextDay),
    });
    nextDay++;
  }

  return cells;
}

// Get 7 days of the current week (Monday to Sunday)
function getWeekDays(currentDate: Date) {
  const d = new Date(currentDate);
  let day = d.getDay() - 1;
  if (day === -1) day = 6;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);

  const days: { dateObj: Date; dateStr: string; dayName: string; dayNum: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    days.push({
      dateObj: date,
      dateStr: formatDateKey(date),
      dayName: DAYS_HEADER[i],
      dayNum: date.getDate(),
    });
  }
  return days;
}

// ── Vertical Column Week Layout Calculator ───────────────────────────────────
interface DayColumnLayoutEvent {
  appointment: Appointment;
  top: number;
  height: number;
  startMinutes: number;
  endMinutes: number;
  leftPercent: number;
  widthPercent: number;
  zIndex: number;
}

function computeDayColumnLayout(events: Appointment[], hourHeight: number = 60): DayColumnLayoutEvent[] {
  if (!events || events.length === 0) return [];

  const parsed = events.map(apt => {
    const s = new Date(apt.startTime);
    const e = new Date(apt.endTime || apt.startTime);
    const startMinutes = s.getHours() * 60 + s.getMinutes();
    let endMinutes = e.getHours() * 60 + e.getMinutes();
    if (endMinutes <= startMinutes) {
      endMinutes = startMinutes + 30; // default 30 min duration
    }
    const top = (startMinutes / 60) * hourHeight;
    const height = Math.max(26, ((endMinutes - startMinutes) / 60) * hourHeight - 2);
    return {
      appointment: apt,
      startMinutes,
      endMinutes,
      top,
      height,
      column: 0,
    };
  }).sort((a, b) => a.startMinutes - b.startMinutes || (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes));

  // Group into clusters of overlapping events
  const clusters: (typeof parsed)[] = [];
  let currentCluster: typeof parsed = [];
  let clusterEnd = -1;

  for (const ev of parsed) {
    if (currentCluster.length === 0) {
      currentCluster.push(ev);
      clusterEnd = ev.endMinutes;
    } else if (ev.startMinutes < clusterEnd) {
      currentCluster.push(ev);
      clusterEnd = Math.max(clusterEnd, ev.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterEnd = ev.endMinutes;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Allocate side-by-side columns inside each overlapping cluster
  const result: DayColumnLayoutEvent[] = [];
  for (const cluster of clusters) {
    const columns: number[] = [];

    for (const ev of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] <= ev.startMinutes) {
          ev.column = i;
          columns[i] = ev.endMinutes;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev.column = columns.length;
        columns.push(ev.endMinutes);
      }
    }

    const totalCols = Math.max(1, columns.length);
    for (const ev of cluster) {
      const leftPercent = (ev.column / totalCols) * 100;
      const widthPercent = (1 / totalCols) * 100;
      result.push({
        appointment: ev.appointment,
        top: ev.top,
        height: ev.height,
        startMinutes: ev.startMinutes,
        endMinutes: ev.endMinutes,
        leftPercent,
        widthPercent,
        zIndex: 10 + ev.column,
      });
    }
  }

  return result;
}

// Initial mock events
function createDefaultSeedAppointments(): Appointment[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  return [
    {
      id: 'apt-seed-1',
      title: 'Enterprise Architecture Sync',
      type: 'demo',
      location: 'Google Meet',
      startTime: new Date(y, m, d, 10, 0).toISOString(),
      endTime: new Date(y, m, d, 10, 45).toISOString(),
      description: 'Review system requirements and enterprise data migration pipelines with engineering team.',
      status: 'confirmed',
      contact: { id: 'c1', firstName: 'Sarah', lastName: 'Jenkins', email: 'sarah.j@acmecorp.com' } as any,
    },
    {
      id: 'apt-seed-2',
      title: 'Q3 Product Strategy & Roadmap',
      type: 'meeting',
      location: 'Zoom Conference',
      startTime: new Date(y, m, d, 14, 0).toISOString(),
      endTime: new Date(y, m, d, 15, 0).toISOString(),
      description: 'Discuss executive roadmap initiatives and deliverables for the upcoming quarter.',
      status: 'confirmed',
      contact: { id: 'c2', firstName: 'David', lastName: 'Chen', email: 'david.chen@horizon.io' } as any,
    },
    {
      id: 'apt-seed-3',
      title: 'Client Onboarding & Training',
      type: 'video',
      location: 'Microsoft Teams',
      startTime: new Date(y, m, d + 1, 11, 30).toISOString(),
      endTime: new Date(y, m, d + 1, 12, 15).toISOString(),
      description: 'Walkthrough of workspace configuration, permissions, and AI agent setup.',
      status: 'confirmed',
      contact: { id: 'c3', firstName: 'Elena', lastName: 'Rostova', email: 'elena@novatech.com' } as any,
    },
    {
      id: 'apt-seed-4',
      title: 'Inbound Growth Discovery',
      type: 'calls',
      location: 'Direct Phone (+1 555-0192)',
      startTime: new Date(y, m, d + 2, 9, 0).toISOString(),
      endTime: new Date(y, m, d + 2, 9, 30).toISOString(),
      description: 'Initial discovery call to evaluate custom automation workflows.',
      status: 'confirmed',
      contact: { id: 'c4', firstName: 'Marcus', lastName: 'Vance', email: 'marcus@vancemedia.com' } as any,
    },
    {
      id: 'apt-seed-5',
      title: 'Weekly Sprint Retrospective',
      type: 'tasks',
      location: 'Internal Workspace Room A',
      startTime: new Date(y, m, d + 3, 16, 0).toISOString(),
      endTime: new Date(y, m, d + 3, 17, 0).toISOString(),
      description: 'Review completed sprint tickets, velocity metrics, and blockers.',
      status: 'confirmed',
      contact: { id: 'c5', firstName: 'Team', lastName: 'Engineering', email: 'dev@stoneaio.com' } as any,
    },
    {
      id: 'apt-seed-6',
      title: 'Consulting Advisory Session',
      type: 'consultation',
      location: 'Google Meet',
      startTime: new Date(y, m, d - 1, 13, 0).toISOString(),
      endTime: new Date(y, m, d - 1, 14, 0).toISOString(),
      description: 'Strategic review of AI pipeline deployments.',
      status: 'completed',
      contact: { id: 'c6', firstName: 'Amanda', lastName: 'Bates', email: 'amanda@apexcap.com' } as any,
    },
  ];
}

// Form Row Helper matching CRM SlideOvers 1-to-1
const FormRow = ({ label, icon: Icon, required, children }: any) => (
  <div className="space-y-1.5">
    <label className="text-[12px] font-semibold text-text-main flex items-center gap-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-text-muted" />}
      {label}
      {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

const EMPTY_FORM = {
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
  locationType: 'Google Meet',
  location: 'https://meet.google.com/new',
  description: '',
  status: 'confirmed',
  isShared: true,
  isPublic: false,
};

export default function CalendarSchedulePage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── State ──
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>('month');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local modifications state: tracks in-place edits, creations, and deletions
  const defaultSeeds = useMemo(() => createDefaultSeedAppointments(), []);
  const [editedEvents, setEditedEvents] = useState<Record<string, Appointment>>({});
  const [createdEvents, setCreatedEvents] = useState<Appointment[]>([]);
  const [deletedEventIds, setDeletedEventIds] = useState<string[]>([]);

  // Day Schedule Inspector Drawer
  const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null);

  // Slide-over & Delete State for Appointment Creation/Editing
  const [panelOpen, setPanelOpen] = useState<'appointment' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: formatDateKey(new Date()) });

  // Contact Lookup Dropdown
  const [contactSearch, setContactSearch] = useState('');
  const [contactDropOpen, setContactDropOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: ⌘K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Data Queries ──
  const { data: serverAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/business/appointments');
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  const { data: crmContacts = [] } = useQuery<any[]>({
    queryKey: ['crm', 'contacts-lookup'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/crm/contacts');
        return data?.contacts || (Array.isArray(data) ? data : []);
      } catch {
        return [];
      }
    },
  });

  // Combined events with accurate in-place edits and additions
  const allEvents = useMemo(() => {
    const baseList = serverAppointments.length > 0 ? serverAppointments : defaultSeeds;
    const deletedSet = new Set(deletedEventIds);

    // 1. Process base events: filter out deleted, apply in-place edits
    const updatedBase = baseList
      .filter(apt => !deletedSet.has(apt.id))
      .map(apt => (editedEvents[apt.id] ? { ...apt, ...editedEvents[apt.id] } : apt));

    // 2. Process newly created events: filter out deleted, apply any subsequent edits
    const updatedCreated = createdEvents
      .filter(apt => !deletedSet.has(apt.id))
      .map(apt => (editedEvents[apt.id] ? { ...apt, ...editedEvents[apt.id] } : apt));

    return [...updatedCreated, ...updatedBase];
  }, [serverAppointments, defaultSeeds, editedEvents, createdEvents, deletedEventIds]);

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = Boolean(payload.id);
      try {
        if (isEdit) {
          const { data } = await apiClient.put(`/business/appointments/${payload.id}`, payload);
          return data || payload;
        }
        const { data } = await apiClient.post('/business/appointments', payload);
        return data || { ...payload, id: `apt-${Date.now()}` };
      } catch {
        return { ...payload, id: payload.id || `apt-local-${Date.now()}` };
      }
    },
    onSuccess: (saved: Appointment) => {
      const isEdit = Boolean(form.id);
      if (isEdit) {
        // Update in-place in editedEvents map
        setEditedEvents(prev => ({
          ...prev,
          [saved.id]: saved,
        }));
        // If it was created in this session, also update the created list
        setCreatedEvents(prev => prev.map(a => (a.id === saved.id ? saved : a)));
      } else {
        // Add new appointment to created list
        setCreatedEvents(prev => [saved, ...prev]);
      }

      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', isEdit ? 'Appointment updated' : 'Appointment scheduled', `"${saved.title}" has been saved.`);
      setPanelOpen(null);
    },
    onError: (err: any) => toast('error', 'Action failed', err?.response?.data?.error || err?.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/business/appointments/${id}`);
      } catch {}
      return id;
    },
    onSuccess: (deletedId) => {
      setDeletedEventIds(prev => [...prev, deletedId]);
      setEditedEvents(prev => {
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      setCreatedEvents(prev => prev.filter(a => a.id !== deletedId));
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Appointment deleted', 'The appointment has been removed.');
      setDeleteTarget(null);
      setPanelOpen(null);
    },
    onError: (err: any) => toast('error', 'Delete failed', err?.response?.data?.error || err?.message),
  });

  // ── Date Computations ──
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayObj = new Date();
  const todayStr = formatDateKey(todayObj);

  // Period Navigation
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else if (view === 'day') d.setDate(d.getDate() - 1);
    else if (view === 'agenda') d.setMonth(d.getMonth() - 1);
    else if (view === 'year') d.setFullYear(d.getFullYear() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else if (view === 'day') d.setDate(d.getDate() + 1);
    else if (view === 'agenda') d.setMonth(d.getMonth() + 1);
    else if (view === 'year') d.setFullYear(d.getFullYear() + 1);
    setCurrentDate(d);
  };

  const jumpToday = () => setCurrentDate(new Date());

  const monthGrid = useMemo(() => getMonthGrid(year, month), [year, month]);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  // Dynamic Date Range Subtitle Text
  const dateRangeSubtitle = useMemo(() => {
    if (view === 'month') {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return `${MONTHS_SHORT[month]} 1, ${year} – ${MONTHS_SHORT[month]} ${lastDay}, ${year}`;
    }
    if (view === 'week') {
      const start = weekDays[0].dateObj;
      const end = weekDays[6].dateObj;
      return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    if (view === 'day') {
      const dayName = DAYS_FULL[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1];
      return `${dayName}, ${MONTHS_FULL[month]} ${currentDate.getDate()}, ${year}`;
    }
    if (view === 'agenda') {
      return `Upcoming schedule for ${MONTHS_FULL[month]} ${year}`;
    }
    return `Full Year Calendar Overview (${year})`;
  }, [view, year, month, currentDate, weekDays]);

  // Main Header Title
  const headerTitle = useMemo(() => {
    if (view === 'year') return `${year}`;
    if (view === 'day') return `${MONTHS_FULL[month]} ${currentDate.getDate()}, ${year}`;
    return `${MONTHS_FULL[month]} ${year}`;
  }, [view, month, year, currentDate]);

  // Filtered appointments by search query
  const filteredAppointments = useMemo(() => {
    return allEvents.filter(apt => {
      if (apt.status === 'cancelled') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = apt.title?.toLowerCase().includes(q);
        const matchLocation = apt.location?.toLowerCase().includes(q);
        const matchDesc = apt.description?.toLowerCase().includes(q);
        const matchContact = `${apt.contact?.firstName || ''} ${apt.contact?.lastName || ''} ${apt.contact?.email || ''}`.toLowerCase().includes(q);
        return matchTitle || matchLocation || matchDesc || matchContact;
      }
      return true;
    });
  }, [allEvents, searchQuery]);

  // Group appointments by date string
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of filteredAppointments) {
      if (!apt.startTime) continue;
      const key = formatDateKey(new Date(apt.startTime));
      const list = map.get(key) || [];
      list.push(apt);
      map.set(key, list);
    }
    return map;
  }, [filteredAppointments]);

  // Appointments for the selected day in inspector drawer
  const dayDetailEvents = useMemo(() => {
    if (!dayDetailDate) return [];
    return appointmentsByDate.get(formatDateKey(dayDetailDate)) || [];
  }, [dayDetailDate, appointmentsByDate]);

  // ── Appointment Form Openers ──
  const openCreateAppointment = (dateStr?: string, timeStr?: string) => {
    setForm({
      ...EMPTY_FORM,
      date: dateStr || (dayDetailDate ? formatDateKey(dayDetailDate) : formatDateKey(currentDate)),
      time: timeStr || '10:00',
    });
    setContactSearch('');
    setPanelOpen('appointment');
  };

  const openEditAppointment = (apt: Appointment) => {
    const s = new Date(apt.startTime);
    const e = new Date(apt.endTime || apt.startTime);
    const dur = Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000));
    const cn = apt.contact ? `${apt.contact.firstName || ''} ${apt.contact.lastName || ''}`.trim() : '';
    setForm({
      id: apt.id,
      title: apt.title,
      type: apt.type || 'demo',
      date: formatDateKey(s),
      time: `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`,
      duration: dur,
      contactId: apt.contactId || '',
      contactName: cn,
      contactEmail: apt.contact?.email || '',
      contactPhone: apt.contact?.phone || '',
      locationType: apt.location?.toLowerCase().includes('zoom') ? 'Zoom' : apt.location?.toLowerCase().includes('teams') ? 'Microsoft Teams' : apt.location?.toLowerCase().includes('phone') ? 'Phone Call' : 'Google Meet',
      location: apt.location || 'Google Meet',
      description: apt.description || '',
      status: apt.status || 'confirmed',
      isShared: (apt as any).isShared ?? true,
      isPublic: (apt as any).isPublic ?? false,
    });
    setContactSearch(cn);
    setPanelOpen('appointment');
  };

  const handleSaveAppointment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.title.trim() || !form.date || !form.time) {
      toast('warning', 'Missing required fields', 'Please enter an appointment title, date, and start time.');
      return;
    }
    const sDate = parseLocalDateAndTime(form.date, form.time);
    const eDate = new Date(sDate.getTime() + form.duration * 60000);

    saveMutation.mutate({
      id: form.id || undefined,
      title: form.title,
      type: form.type,
      location: form.location,
      contactId: form.contactId || undefined,
      contactName: form.contactName || undefined,
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      startTime: sDate.toISOString(),
      endTime: eDate.toISOString(),
      description: form.description,
      status: form.status,
      isShared: form.isShared,
      isPublic: form.isPublic,
      contact: form.contactName ? {
        firstName: form.contactName.split(' ')[0] || '',
        lastName: form.contactName.split(' ').slice(1).join(' ') || '',
        email: form.contactEmail,
        phone: form.contactPhone,
      } : undefined,
    });
  };

  const selectContact = (c: any) => {
    if (!c) {
      setForm(prev => ({ ...prev, contactId: '', contactName: '', contactEmail: '', contactPhone: '' }));
      setContactSearch('');
      return;
    }
    const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Contact';
    setForm(prev => ({
      ...prev,
      contactId: c.id,
      contactName: name,
      contactEmail: c.email || '',
      contactPhone: c.phone || '',
      title: prev.title || `Appointment with ${name}`,
    }));
    setContactSearch(name);
    setContactDropOpen(false);
  };

  // Week view scroll ref & real-time indicator
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const n = new Date();
      setCurrentTimeMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll week view to 8:00 AM (or 1h before current time) on mount/switch
  useEffect(() => {
    if (view === 'week' && weekScrollRef.current) {
      const curHour = new Date().getHours();
      const targetHour = Math.max(0, curHour >= 7 ? curHour - 1 : 8);
      weekScrollRef.current.scrollTop = targetHour * 60;
    }
  }, [view]);

  // Click-to-create in vertical week column
  const handleColumnClick = (dateStr: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const totalMinutes = Math.max(0, Math.min(1439, Math.floor(offsetY)));
    const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
    const hour = Math.floor(snappedMinutes / 60);
    const min = snappedMinutes % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    openCreateAppointment(dateStr, timeStr);
  };

  // Day cell click handler in Month View -> opens Day Schedule Inspector
  const handleDayClick = (cellDate: Date) => {
    setDayDetailDate(cellDate);
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-bg overflow-hidden z-0 select-none font-sans">
      
      {/* Full-tab frosted glass overlay matching CRM */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* ── Top Header Search & Actions via HeaderPortal ─────────────────────── */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search Calendar"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 py-1.5 w-[200px] sm:w-[220px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-text-muted hover:text-text-main transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-2.5 text-[10px] font-medium text-text-muted/60 border border-border/60 rounded px-1 py-0.5 pointer-events-none">
                ⌘K
              </span>
            )}
          </div>

          <button onClick={() => openCreateAppointment()} className="btn-secondary">
            <Plus className="w-4 h-4" /> Add Event
          </button>
        </div>
      </HeaderPortal>

      {/* ── Action & Navigation Toolbar matching CRM ─────────────────────────── */}
      <div className="px-6 sm:px-8 pt-5 pb-3 flex flex-wrap items-center justify-between gap-4 shrink-0 border-b border-border/40">
        
        {/* Left: View Switcher Tabs matching CRM Smart Tabs */}
        <div className="flex items-center gap-1 bg-surface-hover/70 border border-border/60 rounded-lg p-1">
          {[
            { id: 'month', label: 'Month', icon: CalendarDays },
            { id: 'week', label: 'Week', icon: CalendarRange },
            { id: 'day', label: 'Day', icon: Clock },
            { id: 'agenda', label: 'Agenda', icon: List },
            { id: 'year', label: 'Year', icon: Grid3X3 },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = view === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-semibold transition-all ${
                  isActive
                    ? 'bg-surface text-text-main shadow-xs border border-border/60'
                    : 'text-text-muted hover:text-text-main hover:bg-surface/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Date title & Period Navigator */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <h2 className="text-[15px] font-bold text-text-main tracking-tight leading-none">
              {headerTitle}
            </h2>
            <p className="text-[11px] text-text-muted font-medium mt-0.5">
              {dateRangeSubtitle}
            </p>
          </div>

          {/* Period Navigator: < [ Today ] > */}
          <div className="flex items-center bg-surface-hover border border-border rounded-[8px] p-0.5 shadow-sm">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={jumpToday}
              className="px-3 py-1 text-[12px] font-semibold text-text-main hover:bg-surface rounded-[6px] transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface transition-colors"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main CRM Content Container: mx-8 mt-6 mb-6 rounded-[8px] ────────── */}
      <div className="flex-1 overflow-auto mx-6 sm:mx-8 mt-4 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex flex-col custom-scrollbar">

        {/* ── 1. MONTH VIEW ───────────────────────────────────────────── */}
        {view === 'month' && (
          <div className="flex-1 flex flex-col min-h-full">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 border-b border-border/50 bg-surface/80 backdrop-blur-md sticky top-0 z-10">
              {DAYS_HEADER.map(d => (
                <div key={d} className="py-2.5 px-3 text-[12px] font-semibold text-text-muted">
                  {d}
                </div>
              ))}
            </div>

            {/* 7-Column Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-border/50 flex-1">
              {monthGrid.map((cell, idx) => {
                const dayEvents = appointmentsByDate.get(cell.dateStr) || [];
                const isToday = cell.dateStr === todayStr;
                const isSelected = dayDetailDate && cell.dateStr === formatDateKey(dayDetailDate);

                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(cell.dateObj)}
                    className={`min-h-[110px] sm:min-h-[125px] p-2 flex flex-col justify-between hover:bg-surface-hover/40 transition-all cursor-pointer group ${
                      !cell.isCurrentMonth ? 'bg-surface/10 opacity-40' : 'bg-transparent'
                    } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                  >
                    {/* Top: Day Number & Day schedule quick trigger */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[12px] font-bold w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isToday
                            ? 'bg-primary text-white shadow-sm font-bold'
                            : cell.isCurrentMonth
                            ? 'text-text-main group-hover:text-primary'
                            : 'text-text-muted'
                        }`}
                      >
                        {cell.day}
                      </span>

                      {/* Hover Add Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateAppointment(cell.dateStr, '10:00');
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface text-text-muted hover:text-text-main transition-opacity"
                        title="Add event to this day"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Event Pills List inside Cell */}
                    <div className="space-y-1 flex-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map(apt => {
                        const palette = getPalette(apt.type);
                        const s = new Date(apt.startTime);

                        return (
                          <div
                            key={apt.id}
                            onClick={e => {
                              e.stopPropagation();
                              openEditAppointment(apt);
                            }}
                            className={`px-2 py-1 rounded-[6px] border text-[11px] font-semibold flex items-center justify-between gap-1 truncate transition-all hover:scale-[1.01] shadow-2xs ${palette.bg} ${palette.border} ${palette.text}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${palette.dot}`} />
                              <span className="truncate">{apt.title}</span>
                            </div>
                            <span className="text-[10px] font-medium opacity-80 shrink-0 ml-1">
                              {fmtTime(s)}
                            </span>
                          </div>
                        );
                      })}

                      {dayEvents.length > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDayClick(cell.dateObj);
                          }}
                          className="text-[11px] font-semibold text-primary block px-1 pt-0.5 hover:underline"
                        >
                          +{dayEvents.length - 3} more...
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 2. VERTICAL COLUMN WEEK VIEW ────────────────────────────── */}
        {view === 'week' && (
          <div className="flex-1 flex flex-col min-h-0 bg-bg select-none">
            {/* Sticky Week Header */}
            <div className="flex border-b border-border/60 bg-surface/90 backdrop-blur-md sticky top-0 z-20 shadow-xs">
              {/* Timezone Gutter */}
              <div className="w-16 shrink-0 py-3 px-2 flex flex-col items-center justify-center border-r border-border/50 text-[10px] font-bold text-text-muted/70 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-text-muted mb-0.5" />
                <span>GMT</span>
              </div>

              {/* 7 Day Columns Header */}
              <div className="flex-1 grid grid-cols-7 divide-x divide-border/50">
                {weekDays.map(d => {
                  const isToday = d.dateStr === todayStr;
                  const dayEventsCount = (appointmentsByDate.get(d.dateStr) || []).length;

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => handleDayClick(d.dateObj)}
                      className={`py-2.5 px-2 text-center cursor-pointer transition-all hover:bg-surface-hover/60 group ${
                        isToday ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className={`text-[11px] font-bold uppercase tracking-wider ${
                        isToday ? 'text-primary' : 'text-text-muted group-hover:text-text-main'
                      }`}>
                        {d.dayName}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mt-1">
                        <div className={`text-[13px] font-extrabold w-7 h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${
                          isToday
                            ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20'
                            : 'text-text-main group-hover:bg-surface-hover'
                        }`}>
                          {d.dayNum}
                        </div>
                        {dayEventsCount > 0 && (
                          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-surface-hover text-text-muted border border-border/60">
                            {dayEventsCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable 24-Hour Time Grid */}
            <div
              ref={weekScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar flex"
            >
              {/* Left Time Label Column */}
              <div className="w-16 shrink-0 border-r border-border/50 bg-surface/30 relative select-none" style={{ height: '1440px' }}>
                {Array.from({ length: 24 }).map((_, hour) => {
                  if (hour === 0) return null;
                  const hourFormatted = `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`;
                  return (
                    <div
                      key={hour}
                      className="absolute right-2.5 text-[10px] font-semibold text-text-muted/80 -translate-y-1/2"
                      style={{ top: `${hour * 60}px` }}
                    >
                      {hourFormatted}
                    </div>
                  );
                })}
              </div>

              {/* 7 Vertical Day Columns Container */}
              <div className="flex-1 grid grid-cols-7 divide-x divide-border/40 relative" style={{ height: '1440px' }}>
                {/* Background Hour & Half-Hour Gridlines across all 7 days */}
                <div className="absolute inset-0 pointer-events-none flex flex-col">
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <div
                      key={hour}
                      className="relative border-t border-border/40"
                      style={{ height: '60px' }}
                    >
                      {/* 30-minute subtle dashed divider line */}
                      <div className="absolute top-[30px] left-0 right-0 border-t border-dashed border-border/20" />
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {weekDays.map(d => {
                  const isToday = d.dateStr === todayStr;
                  const dayEvents = appointmentsByDate.get(d.dateStr) || [];
                  const layoutEvents = computeDayColumnLayout(dayEvents, 60);

                  return (
                    <div
                      key={d.dateStr}
                      onClick={(e) => handleColumnClick(d.dateStr, e)}
                      className={`relative h-[1440px] cursor-pointer transition-colors group ${
                        isToday ? 'bg-primary/[0.02]' : 'hover:bg-surface-hover/10'
                      }`}
                    >
                      {/* Red Current Time Line if Today */}
                      {isToday && (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none flex items-center -translate-y-1/2"
                          style={{ top: `${currentTimeMinutes}px` }}
                        >
                          <div className="w-2.5 h-2.5 -ml-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                          <div className="flex-1 h-[2px] bg-red-500 shadow-xs" />
                        </div>
                      )}

                      {/* Positioned Event Cards */}
                      {layoutEvents.map(lev => {
                        const apt = lev.appointment;
                        const palette = getPalette(apt.type);
                        const s = new Date(apt.startTime);
                        const e = new Date(apt.endTime || s);
                        const isShort = lev.height < 40;
                        const isTiny = lev.height < 28;

                        return (
                          <div
                            key={apt.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openEditAppointment(apt);
                            }}
                            style={{
                              top: `${lev.top}px`,
                              height: `${lev.height}px`,
                              left: `${lev.leftPercent}%`,
                              width: `calc(${lev.widthPercent}% - 3px)`,
                              zIndex: lev.zIndex,
                            }}
                            className={`absolute rounded-md border p-1.5 overflow-hidden transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-md hover:scale-[1.01] hover:z-30 flex flex-col justify-between ${palette.bg} ${palette.border} ${palette.text}`}
                            title={`${apt.title} (${fmtTimeRange(s, e)})`}
                          >
                            <div className="min-w-0 flex-1">
                              {/* Event Header */}
                              <div className="flex items-center gap-1 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${palette.dot}`} />
                                <span className="text-[11px] font-bold text-text-main truncate leading-tight">
                                  {apt.title}
                                </span>
                              </div>

                              {/* Time & Details if height allows */}
                              {!isTiny && (
                                <div className="text-[10px] opacity-85 font-medium truncate mt-0.5 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                  <span>{fmtTimeRange(s, e)}</span>
                                </div>
                              )}

                              {!isShort && apt.location && (
                                <div className="text-[9px] opacity-75 truncate mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                  <span>{apt.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 3. DAY VIEW ─────────────────────────────────────────────── */}
        {view === 'day' && (
          <div className="flex-1 flex flex-col min-h-full divide-y divide-border/50">
            {/* Daily summary stats bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-surface/40">
              <div className="p-3 rounded-[8px] border border-border bg-surface/60">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Scheduled Events</div>
                <div className="text-xl font-bold text-text-main mt-0.5">
                  {(appointmentsByDate.get(formatDateKey(currentDate)) || []).length} events
                </div>
              </div>
              <div className="p-3 rounded-[8px] border border-border bg-surface/60">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Duration</div>
                <div className="text-xl font-bold text-text-main mt-0.5">
                  {(appointmentsByDate.get(formatDateKey(currentDate)) || []).reduce((acc, a) => {
                    const s = new Date(a.startTime).getTime();
                    const e = new Date(a.endTime || a.startTime).getTime();
                    return acc + Math.round((e - s) / 60000);
                  }, 0)} mins
                </div>
              </div>
              <div className="p-3 rounded-[8px] border border-border bg-surface/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Quick Schedule</div>
                  <div className="text-[13px] font-semibold text-text-main mt-0.5">Book this date</div>
                </div>
                <button
                  onClick={() => openCreateAppointment(formatDateKey(currentDate))}
                  className="btn-secondary text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Book Slot
                </button>
              </div>
            </div>

            {/* 24-Hour Timeline */}
            <div className="divide-y divide-border/50 flex-1 overflow-y-auto custom-scrollbar">
              {Array.from({ length: 14 }).map((_, i) => {
                const hour = i + 7; // 7 AM to 8 PM
                const hourFormatted = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
                const hourKey = `${String(hour).padStart(2, '0')}:00`;
                const dateKey = formatDateKey(currentDate);
                const dayEvents = (appointmentsByDate.get(dateKey) || []).filter(apt => {
                  const s = new Date(apt.startTime);
                  return s.getHours() === hour;
                });

                return (
                  <div key={hour} className="flex min-h-[68px] hover:bg-surface-hover/20 transition-colors">
                    <div className="w-24 p-3 text-[11px] font-semibold text-text-muted border-r border-border/50 bg-surface/20 shrink-0">
                      {hourFormatted}
                    </div>

                    <div
                      onClick={() => openCreateAppointment(dateKey, hourKey)}
                      className="flex-1 p-2 flex flex-col gap-2 cursor-pointer"
                    >
                      {dayEvents.map(apt => {
                        const palette = getPalette(apt.type);
                        const s = new Date(apt.startTime);
                        const e = new Date(apt.endTime || s);

                        return (
                          <div
                            key={apt.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openEditAppointment(apt);
                            }}
                            className={`p-3 rounded-[8px] border flex flex-wrap items-center justify-between gap-3 transition-all hover:scale-[1.005] shadow-xs ${palette.bg} ${palette.border} ${palette.text}`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${palette.dot}`} />
                                <span className="text-[13px] font-bold text-text-main">{apt.title}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-current opacity-80 uppercase">
                                  {palette.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] opacity-80">
                                <span className="flex items-center gap-1 font-semibold">
                                  <Clock className="w-3 h-3" />
                                  {fmtTimeRange(s, e)}
                                </span>
                                {apt.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {apt.location}
                                  </span>
                                )}
                                {apt.contact && (
                                  <span className="flex items-center gap-1 font-medium">
                                    <User className="w-3 h-3" />
                                    {apt.contact.firstName} {apt.contact.lastName} ({apt.contact.email})
                                  </span>
                                )}
                              </div>
                              {apt.description && (
                                <p className="text-[12px] text-text-muted font-normal pt-1 max-w-xl line-clamp-1">
                                  {apt.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {apt.location?.toLowerCase().includes('http') || apt.location?.toLowerCase().includes('meet') || apt.location?.toLowerCase().includes('zoom') ? (
                                <a
                                  href={apt.location.startsWith('http') ? apt.location : `https://${apt.location}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={ev => ev.stopPropagation()}
                                  className="h-7 px-2.5 rounded-[6px] bg-primary text-white text-[11px] font-semibold flex items-center gap-1 shadow-2xs hover:bg-primary-hover transition-colors"
                                >
                                  <Video className="w-3 h-3" />
                                  Join Call
                                </a>
                              ) : null}
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  openEditAppointment(apt);
                                }}
                                className="p-1.5 rounded-[6px] hover:bg-surface border border-border/60 text-text-muted hover:text-text-main transition-colors"
                                title="Edit Event"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 4. AGENDA / LIST VIEW ───────────────────────────────────── */}
        {view === 'agenda' && (
          <div className="flex-1 flex flex-col min-h-full">
            {filteredAppointments.length === 0 ? (
              <div className="p-12 text-center space-y-3 my-auto">
                <div className="w-12 h-12 rounded-full bg-surface border border-border mx-auto flex items-center justify-center text-text-muted">
                  <CalIcon className="w-6 h-6" />
                </div>
                <div className="text-base font-bold text-text-main">No events scheduled</div>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  There are no events matching your search. Click below to schedule a new meeting or event.
                </p>
                <button
                  onClick={() => openCreateAppointment()}
                  className="btn-secondary inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Event
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {Array.from(appointmentsByDate.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dateKey, events]) => {
                    const dateObj = parseLocalDateAndTime(dateKey);
                    const isToday = dateKey === todayStr;

                    return (
                      <div key={dateKey} className="p-4 sm:p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[12px] font-bold px-2.5 py-0.5 rounded-[6px] ${
                            isToday ? 'bg-primary text-white' : 'bg-surface border border-border text-text-main'
                          }`}>
                            {isToday ? 'Today' : DAYS_FULL[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1]}
                          </span>
                          <span className="text-[13px] font-bold text-text-muted">
                            {MONTHS_FULL[dateObj.getMonth()]} {dateObj.getDate()}, {dateObj.getFullYear()}
                          </span>
                        </div>

                        <div className="space-y-2 pl-2">
                          {events.map(apt => {
                            const palette = getPalette(apt.type);
                            const s = new Date(apt.startTime);
                            const e = new Date(apt.endTime || s);

                            return (
                              <div
                                key={apt.id}
                                onClick={() => openEditAppointment(apt)}
                                className={`p-3.5 rounded-[8px] border flex flex-wrap items-center justify-between gap-4 cursor-pointer transition-all hover:scale-[1.005] shadow-xs ${palette.bg} ${palette.border} ${palette.text}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-[6px] bg-surface border border-border/50 text-text-main shrink-0 mt-0.5">
                                    <Clock className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[14px] font-bold text-text-main">{apt.title}</span>
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-current uppercase">
                                        {palette.label}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-[11px] opacity-85">
                                      <span className="font-semibold">{fmtTimeRange(s, e)}</span>
                                      {apt.location && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-3 h-3" />
                                          {apt.location}
                                        </span>
                                      )}
                                      {apt.contact && (
                                        <span className="flex items-center gap-1 font-medium">
                                          <User className="w-3 h-3" />
                                          {apt.contact.firstName} {apt.contact.lastName}
                                        </span>
                                      )}
                                    </div>
                                    {apt.description && (
                                      <p className="text-[12px] text-text-muted font-normal max-w-xl line-clamp-1">
                                        {apt.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      openEditAppointment(apt);
                                    }}
                                    className="p-1.5 rounded-[6px] hover:bg-surface border border-border text-text-muted hover:text-text-main transition-colors"
                                    title="Edit Event"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── 5. YEAR VIEW ────────────────────────────────────────────── */}
        {view === 'year' && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar">
            {Array.from({ length: 12 }).map((_, mIdx) => {
              const miniGrid = getMonthGrid(year, mIdx);
              const isCurrentMonth = todayObj.getFullYear() === year && todayObj.getMonth() === mIdx;

              return (
                <div
                  key={mIdx}
                  className={`p-3.5 rounded-[8px] border bg-surface/30 shadow-sm transition-colors hover:border-primary/50 ${
                    isCurrentMonth ? 'border-primary/50 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => {
                        const d = new Date(currentDate);
                        d.setMonth(mIdx);
                        setCurrentDate(d);
                        setView('month');
                      }}
                      className="text-[13px] font-bold text-text-main hover:text-primary transition-colors text-left"
                    >
                      {MONTHS_FULL[mIdx]}
                    </button>
                    {isCurrentMonth && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-[4px] bg-primary/20 text-primary">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-7 text-center mb-1">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                      <span key={i} className="text-[10px] font-bold text-text-muted">
                        {d}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-y-1 text-center">
                    {miniGrid.map((cell, cIdx) => {
                      const hasEvents = (appointmentsByDate.get(cell.dateStr) || []).length > 0;
                      const isToday = cell.dateStr === todayStr;

                      return (
                        <button
                          key={cIdx}
                          onClick={() => handleDayClick(cell.dateObj)}
                          className={`w-6 h-6 mx-auto rounded-full flex flex-col items-center justify-center text-[10px] font-semibold transition-all relative ${
                            isToday
                              ? 'bg-primary text-white font-bold'
                              : cell.isCurrentMonth
                              ? 'text-text-main hover:bg-surface-hover'
                              : 'text-text-muted/30 pointer-events-none'
                          }`}
                        >
                          <span>{cell.day}</span>
                          {hasEvents && !isToday && (
                            <span className="w-1 h-1 rounded-full bg-primary absolute bottom-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ── 6. DAY SCHEDULE DRAWER (Built using SlideOverPanel matching CRM) ──── */}
      <SlideOverPanel
        isOpen={Boolean(dayDetailDate)}
        onClose={() => setDayDetailDate(null)}
        title={dayDetailDate ? `Schedule — ${DAYS_FULL[dayDetailDate.getDay() === 0 ? 6 : dayDetailDate.getDay() - 1]}, ${MONTHS_FULL[dayDetailDate.getMonth()]} ${dayDetailDate.getDate()}` : 'Day Schedule'}
        width="w-[500px]"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => openCreateAppointment(formatDateKey(dayDetailDate!))}
              className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Appointment
            </button>
            <button
              type="button"
              onClick={() => setDayDetailDate(null)}
              className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        {dayDetailDate && (
          <div className="space-y-4 pb-4">
            {/* Quick summary card */}
            <div className="p-3.5 rounded-[6px] bg-surface-hover border border-border flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                  {formatDateKey(dayDetailDate) === todayStr ? 'Today’s Schedule' : 'Schedule Overview'}
                </span>
                <span className="text-[14px] font-bold text-text-main">
                  {dayDetailEvents.length} {dayDetailEvents.length === 1 ? 'Appointment' : 'Appointments'} Scheduled
                </span>
              </div>
              <span className="text-xs text-text-muted">
                {dayDetailEvents.reduce((acc, a) => {
                  const s = new Date(a.startTime).getTime();
                  const e = new Date(a.endTime || a.startTime).getTime();
                  return acc + Math.round((e - s) / 60000);
                }, 0)} mins total
              </span>
            </div>

            {/* List of Day Events */}
            {dayDetailEvents.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-[6px] bg-surface/30 space-y-3 my-6">
                <CalendarCheck2 className="w-8 h-8 text-text-muted mx-auto" />
                <div className="text-[13px] font-semibold text-text-main">No appointments scheduled</div>
                <p className="text-[12px] text-text-muted max-w-xs mx-auto">
                  There are no scheduled events on this date. Click below to add an appointment.
                </p>
                <button
                  type="button"
                  onClick={() => openCreateAppointment(formatDateKey(dayDetailDate))}
                  className="px-3 py-1.5 bg-primary/15 text-primary hover:bg-primary/25 rounded-[6px] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Schedule on this date
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {dayDetailEvents.map(apt => {
                  const palette = getPalette(apt.type);
                  const s = new Date(apt.startTime);
                  const e = new Date(apt.endTime || s);

                  return (
                    <div
                      key={apt.id}
                      onClick={() => openEditAppointment(apt)}
                      className={`p-3.5 rounded-[6px] border transition-all cursor-pointer hover:border-primary/50 shadow-xs space-y-2.5 ${palette.bg} ${palette.border} ${palette.text}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${palette.dot}`} />
                            <span className="text-[13px] font-bold text-text-main">{apt.title}</span>
                          </div>
                          <div className="text-[11px] font-semibold mt-0.5 opacity-85 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {fmtTimeRange(s, e)}
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-current uppercase">
                          {palette.label}
                        </span>
                      </div>

                      {/* Contact & Location info */}
                      <div className="space-y-1 text-xs">
                        {apt.location && (
                          <div className="flex items-center gap-1.5 opacity-90">
                            <MapPin className="w-3 h-3 text-primary shrink-0" />
                            <span>{apt.location}</span>
                          </div>
                        )}
                        {apt.contact && (
                          <div className="flex items-center gap-1.5 opacity-90">
                            <User className="w-3 h-3 text-primary shrink-0" />
                            <span>{apt.contact.firstName} {apt.contact.lastName}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-current/15">
                        {apt.location?.toLowerCase().includes('http') || apt.location?.toLowerCase().includes('meet') || apt.location?.toLowerCase().includes('zoom') ? (
                          <a
                            href={apt.location.startsWith('http') ? apt.location : `https://${apt.location}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={ev => ev.stopPropagation()}
                            className="px-2.5 py-1 rounded-[6px] bg-primary text-white text-[11px] font-semibold flex items-center gap-1 hover:bg-primary-hover transition-colors shadow-2xs"
                          >
                            <Video className="w-3 h-3" /> Join Call
                          </a>
                        ) : null}

                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openEditAppointment(apt);
                          }}
                          className="px-2.5 py-1 rounded-[6px] bg-surface hover:bg-surface-hover border border-border text-[11px] font-semibold text-text-main flex items-center gap-1 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </SlideOverPanel>

      {/* ── 7. APPOINTMENT SLIDEOVER (1-to-1 matching NewContactSlideOver) ────── */}
      <SlideOverPanel
        isOpen={panelOpen === 'appointment'}
        onClose={() => setPanelOpen(null)}
        title={form.id ? 'Edit Appointment' : 'Add Appointment'}
        width="w-[500px]"
        footer={
          <>
            {form.id && (
              <button
                type="button"
                onClick={() => setDeleteTarget({ id: form.id } as Appointment)}
                className="mr-auto px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-[6px] text-[13px] font-semibold flex items-center gap-1.5 transition-colors border border-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setPanelOpen(null)}
              className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => handleSaveAppointment()}
              className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm flex items-center gap-1.5"
            >
              {saveMutation.isPending ? 'Saving...' : form.id ? 'Save Changes' : 'Save Appointment'}
            </button>
          </>
        }
      >
        <div className="space-y-5 pb-8 relative text-text-main">
          
          {/* Section 1: Appointment Info */}
          <div className="space-y-4">
            <FormRow label="Appointment Title" icon={Sparkles} required>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Discovery Call, Strategy Roadmap, Design Sync"
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
              />
            </FormRow>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Category" icon={Tag}>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="demo">Product Demo (Emerald)</option>
                  <option value="meeting">Strategy Session (Blue)</option>
                  <option value="video">Virtual Meeting (Purple)</option>
                  <option value="calls">Discovery Call (Amber)</option>
                  <option value="tasks">Internal Sync (Zinc)</option>
                  <option value="consultation">Consultation (Pink)</option>
                </select>
              </FormRow>

              <FormRow label="Status" icon={CheckCircle2}>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="tentative">Tentative</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </FormRow>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Section 2: CRM Attendee / Contact */}
          <div className="space-y-4">
            <h3 className="text-[14px] font-bold text-text-main flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" /> Attendee & Contact Context
            </h3>

            <div ref={contactRef} className="relative">
              <FormRow label="CRM Contact Search" icon={User}>
                <input
                  type="text"
                  value={contactSearch}
                  onFocus={() => setContactDropOpen(true)}
                  onChange={e => {
                    setContactSearch(e.target.value);
                    setContactDropOpen(true);
                  }}
                  placeholder="Search contacts by name or email..."
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
                />
              </FormRow>

              {contactDropOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-[8px] shadow-2xl max-h-48 overflow-y-auto z-50 p-1 divide-y divide-border/30">
                  <div
                    onClick={() => selectContact(null)}
                    className="px-3 py-2 text-xs text-text-muted hover:bg-surface-hover rounded-[6px] cursor-pointer"
                  >
                    (No contact assigned)
                  </div>
                  {crmContacts
                    .filter((c: any) => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(contactSearch.toLowerCase()))
                    .map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => selectContact(c)}
                        className="px-3 py-2 text-xs text-text-main hover:bg-surface-hover rounded-[6px] cursor-pointer flex items-center justify-between"
                      >
                        <span className="font-semibold">{c.firstName} {c.lastName}</span>
                        <span className="text-text-muted text-[11px]">{c.email}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {form.contactName && (
              <div className="flex items-center justify-between p-2.5 rounded-[6px] bg-surface-hover border border-border text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px]">
                    {form.contactName[0]}
                  </div>
                  <div>
                    <span className="font-semibold text-text-main block">{form.contactName}</span>
                    {form.contactEmail && <span className="text-text-muted text-[11px]">{form.contactEmail}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => selectContact(null)}
                  className="text-text-muted hover:text-red-400 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Section 3: Schedule & Duration */}
          <div className="space-y-4">
            <h3 className="text-[14px] font-bold text-text-main flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" /> Date & Time
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Date" icon={CalIcon} required>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all"
                />
              </FormRow>

              <FormRow label="Start Time" icon={Clock} required>
                <input
                  type="time"
                  required
                  value={form.time}
                  onChange={e => setForm({ ...form, time: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all"
                />
              </FormRow>
            </div>

            <FormRow label="Duration" icon={Clock}>
              <div className="grid grid-cols-5 gap-1.5">
                {[15, 30, 45, 60, 90].map(dur => (
                  <button
                    type="button"
                    key={dur}
                    onClick={() => setForm({ ...form, duration: dur })}
                    className={`py-1.5 rounded-[6px] text-xs font-semibold transition-all ${
                      form.duration === dur
                        ? 'bg-primary text-white shadow-xs font-bold'
                        : 'bg-surface-hover border border-border text-text-muted hover:text-text-main'
                    }`}
                  >
                    {dur}m
                  </button>
                ))}
              </div>
            </FormRow>
          </div>

          <div className="h-px bg-border" />

          {/* Section 4: Meeting Location & Link */}
          <div className="space-y-4">
            <h3 className="text-[14px] font-bold text-text-main flex items-center gap-1.5">
              <Video className="w-4 h-4 text-primary" /> Location & Platform
            </h3>

            <div className="flex flex-wrap gap-1.5">
              {['Google Meet', 'Zoom', 'Microsoft Teams', 'Phone Call', 'In-Person'].map(loc => (
                <button
                  type="button"
                  key={loc}
                  onClick={() => {
                    let url = form.location;
                    if (loc === 'Google Meet') url = 'https://meet.google.com/new';
                    else if (loc === 'Zoom') url = 'https://zoom.us/join';
                    else if (loc === 'Microsoft Teams') url = 'https://teams.microsoft.com';
                    else if (loc === 'Phone Call') url = 'Direct Phone (+1)';
                    setForm({ ...form, locationType: loc, location: url });
                  }}
                  className={`px-2.5 py-1 rounded-[6px] text-xs font-medium border transition-colors ${
                    form.locationType === loc
                      ? 'bg-primary/20 text-primary border-primary/40 font-bold'
                      : 'bg-surface-hover border-border text-text-muted hover:text-text-main'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>

            <FormRow label="Meeting URL or Address" icon={MapPin}>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="https://meet.google.com/new or physical address"
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
              />
            </FormRow>
          </div>

          <div className="h-px bg-border" />

          {/* Section 5: Team Sharing & Visibility */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 p-2.5 rounded-[6px] border border-border bg-surface-hover cursor-pointer text-xs font-semibold">
              <input
                type="checkbox"
                checked={form.isShared}
                onChange={e => setForm({ ...form, isShared: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className="flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-text-muted" /> Shared with Team
              </span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-[6px] border border-border bg-surface-hover cursor-pointer text-xs font-semibold">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={e => setForm({ ...form, isPublic: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-text-muted" /> Public Booking
              </span>
            </label>
          </div>

          <div className="h-px bg-border" />

          {/* Section 6: Agenda & Notes */}
          <div className="space-y-4">
            <FormRow label="Meeting Agenda / Notes" icon={Edit2}>
              <textarea
                rows={3}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Enter meeting objectives, agenda items, or client context..."
                className="w-full p-3 text-[13px] bg-surface-hover border border-border rounded-[6px] text-text-main focus:outline-none focus:border-primary custom-scrollbar resize-none placeholder:text-text-muted"
              />
            </FormRow>
          </div>

        </div>
      </SlideOverPanel>

      {/* Delete Confirmation Modal */}
      <ConfirmDelete
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget?.id && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Appointment"
        description="Are you sure you want to delete this appointment from the calendar?"
      />
    </div>
  );
}
