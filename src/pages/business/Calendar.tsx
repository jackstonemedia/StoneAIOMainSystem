/**
 * Calendar & Scheduling Hub — Stone AIO
 * Visual rework: frosted-glass CRM aesthetic, cleaner week grid, SlideOverPanel form.
 * Data layer (API calls, mutations, computed values) unchanged from prior version.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, Video, Phone, Users, Clock, Calendar as CalIcon,
  X, MapPin, Trash2, AlertCircle, RefreshCw, Check, User, Sparkles,
  Copy, Globe, Search, Mail, Share2, Bot, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SlideOverPanel } from '../../components/ui/SlideOverPanel';
import { ConfirmDelete } from '../../components/ui/ConfirmDelete';
import { useToast } from '../../components/ui/Toast';
import { apiClient } from '../../lib/apiClient';
import type { Appointment } from '../../types/business';

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM – 9 PM

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string; border: string; dot: string; pill: string }> = {
  video:        { icon: Video,    label: 'Video Call',     color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    dot: 'bg-teal-400',    pill: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  call:         { icon: Phone,    label: 'Phone Call',     color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: 'bg-amber-400',   pill: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  meeting:      { icon: Users,    label: 'Meeting',        color: 'text-primary',     bg: 'bg-primary/10',     border: 'border-primary/30',     dot: 'bg-primary',     pill: 'bg-primary/20 text-primary border-primary/30' },
  demo:         { icon: Sparkles, label: 'Product Demo',   color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  dot: 'bg-purple-400',  pill: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  consultation: { icon: Sparkles, label: 'Consultation',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400', pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  in_person:    { icon: MapPin,   label: 'In Person',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    dot: 'bg-blue-400',    pill: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
  confirmed:  { label: 'Confirmed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  completed:  { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  cancelled:  { label: 'Cancelled', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30' },
  no_show:    { label: 'No Show',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
};

const EMPTY_FORM = {
  id: '',
  title: '',
  type: 'video',
  date: '',
  time: '09:00',
  duration: 30,
  contactId: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  location: 'https://meet.google.com/new',
  description: '',
  status: 'scheduled',
};

function getCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Calendar() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Navigation & view ─────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('week');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── Panels & modals ────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [publicBookingOpen, setPublicBookingOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({ ...EMPTY_FORM, date: formatDateKey(new Date()) });

  // ── Contact combobox ───────────────────────────────────────────────────────
  const [contactSearch, setContactSearch] = useState('');
  const [contactDropOpen, setContactDropOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) setContactDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Public booking sim ─────────────────────────────────────────────────────
  const [bookingSimDate, setBookingSimDate] = useState<string>(formatDateKey(new Date()));
  const [bookingSimDuration, setBookingSimDuration] = useState<number>(30);
  const [bookingSimSlot, setBookingSimSlot] = useState<string>('');
  const [bookingSimName, setBookingSimName] = useState<string>('Alex Johnson');
  const [bookingSimEmail, setBookingSimEmail] = useState<string>('alex@example.com');
  const [bookingSimPhone, setBookingSimPhone] = useState<string>('+1 (512) 555-0199');
  const [bookingSimType, setBookingSimType] = useState<string>('video');
  const [bookingSimNotes, setBookingSimNotes] = useState<string>('');

  // ── AI assistant ───────────────────────────────────────────────────────────
  const [aiContactName, setAiContactName] = useState('');
  const [aiPurpose, setAiPurpose] = useState('a 20-minute product walkthrough');
  const [aiGeneratedCopy, setAiGeneratedCopy] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['appointments', typeFilter, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      const { data } = await apiClient.get(`/business/appointments?${params.toString()}`);
      return data || [];
    },
  });

  const { data: crmContacts = [] } = useQuery<any[]>({
    queryKey: ['crm', 'contacts-lookup'],
    queryFn: async () => {
      const { data } = await apiClient.get('/crm/contacts');
      return data?.contacts || (Array.isArray(data) ? data : []);
    },
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['calendar', 'sync-status'],
    queryFn: async () => {
      const { data } = await apiClient.get('/business/calendar/sync-status');
      return data;
    },
  });

  const { data: slotData, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['calendar', 'slots', bookingSimDate, bookingSimDuration],
    queryFn: async () => {
      const { data } = await apiClient.get(`/business/calendar/slots?date=${bookingSimDate}&durationMinutes=${bookingSimDuration}`);
      return data;
    },
    enabled: publicBookingOpen,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { data } = await apiClient.put(`/business/appointments/${payload.id}`, payload);
        return data;
      }
      const { data } = await apiClient.post('/business/appointments', payload);
      return data;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', form.id ? 'Appointment updated' : 'Appointment scheduled', `"${saved.title}" confirmed for ${form.date} at ${form.time}`);
      setPanelOpen(false);
    },
    onError: (err: any) => toast('error', 'Booking failed', err?.response?.data?.error || err?.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/business/appointments/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Appointment cancelled');
      setDeleteTarget(null);
      setPanelOpen(false);
    },
    onError: (err: any) => toast('error', 'Cancellation failed', err?.response?.data?.error || err?.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.put(`/business/appointments/${id}`, { status });
      return data;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Status updated', `Marked as ${updated.status}`);
    },
  });

  const publicBookMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/business/calendar/book', payload);
      return data;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Booking confirmed!', `Booked for ${res.contact?.firstName || 'Guest'}`);
      setPublicBookingOpen(false);
    },
    onError: (err: any) => toast('error', 'Booking failed', err?.response?.data?.error || err?.message),
  });

  const aiSuggestMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/business/calendar/ai-suggest', {
        contactName: aiContactName,
        purpose: aiPurpose,
        durationMinutes: 30,
        calendarUrl: 'https://stoneaio.com/book/growth-team',
      });
      return data;
    },
    onSuccess: (data) => {
      setAiGeneratedCopy(data.suggestedEmailCopy);
      toast('success', 'AI proposal generated');
    },
    onError: (err: any) => toast('error', 'AI suggestion failed', err?.response?.data?.error || err?.message),
  });

  // ── Date navigation ────────────────────────────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = formatDateKey(new Date());

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };
  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };
  const handleToday = () => setCurrentDate(new Date());

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }), [weekStart]);

  // ── Filtered appointments ─────────────────────────────────────────────────
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      if (typeFilter !== 'all' && apt.type !== typeFilter) return false;
      if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const cn = `${apt.contact?.firstName || ''} ${apt.contact?.lastName || ''}`.toLowerCase();
        return apt.title.toLowerCase().includes(q) || cn.includes(q) || (apt.location || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [appointments, typeFilter, statusFilter, searchQuery]);

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

  const todayAppointments = useMemo(() =>
    (appointmentsByDate.get(todayStr) || []).sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    ), [appointmentsByDate, todayStr]);

  // KPI stats
  const kpi = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter(a => a.status === 'completed').length;
    const upcoming = appointments.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length;
    const noShow = appointments.filter(a => a.status === 'no_show').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, upcoming, noShow, rate };
  }, [appointments]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const openCreate = (dateStr?: string, timeStr?: string) => {
    setForm({ ...EMPTY_FORM, date: dateStr || formatDateKey(currentDate), time: timeStr || '09:00' });
    setContactSearch('');
    setPanelOpen(true);
  };

  const openEdit = (apt: Appointment) => {
    const s = new Date(apt.startTime);
    const e = new Date(apt.endTime);
    const dur = Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000));
    const cn = apt.contact ? `${apt.contact.firstName || ''} ${apt.contact.lastName || ''}`.trim() : '';
    setForm({
      id: apt.id,
      title: apt.title,
      type: apt.type || 'video',
      date: formatDateKey(s),
      time: `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`,
      duration: dur,
      contactId: apt.contactId || '',
      contactName: cn,
      contactEmail: apt.contact?.email || '',
      contactPhone: apt.contact?.phone || '',
      location: apt.location || '',
      description: apt.description || '',
      status: apt.status || 'scheduled',
    });
    setContactSearch(cn);
    setPanelOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.time) {
      toast('warning', 'Missing details', 'Please enter a title, date, and time.');
      return;
    }
    const [h, m] = form.time.split(':').map(Number);
    const sDate = new Date(form.date);
    sDate.setHours(h, m, 0, 0);
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
      title: prev.title || `Sync with ${name}`,
    }));
    setContactSearch(name);
    setContactDropOpen(false);
  };

  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase();
    return crmContacts.filter((c: any) =>
      `${c.firstName || ''} ${c.lastName || ''} ${c.email || ''}`.toLowerCase().includes(q)
    );
  }, [crmContacts, contactSearch]);

  // Current time for week/day red line
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nowTopPx = ((nowMinutes / 60) - 7) * 64;

  // ── View label ─────────────────────────────────────────────────────────────
  const viewLabel = useMemo(() => {
    if (view === 'month') return `${MONTHS[month]} ${year}`;
    if (view === 'week') {
      const s = weekDays[0];
      const e = weekDays[6];
      if (s.getMonth() === e.getMonth()) return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${year}`;
      return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${year}`;
    }
    if (view === 'day') return `${FULL_DAYS[currentDate.getDay()]}, ${MONTHS[month]} ${currentDate.getDate()}, ${year}`;
    return `${MONTHS[month]} ${year} — Agenda`;
  }, [view, month, year, weekDays, currentDate]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full relative bg-bg overflow-hidden text-text-main">
      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* ── Top Control Bar ── */}
      <div className="h-[60px] px-6 border-b border-border/60 flex items-center justify-between shrink-0 bg-surface/60 backdrop-blur-md z-20">
        {/* Left: title + sync badges */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <CalIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-black text-text-main tracking-tight">Calendar</span>
              {syncStatus?.hasGoogleCalendar && (
                <span className="px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Google
                </span>
              )}
              {syncStatus?.hasOutlookCalendar && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Outlook
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted">Scheduling & booking hub</p>
          </div>
        </div>

        {/* Center: view switcher + nav */}
        <div className="flex items-center gap-3">
          {/* Nav arrows + today + label */}
          <div className="flex items-center gap-1 bg-surface border border-border/60 rounded-xl p-0.5">
            <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={handleToday} className="px-2.5 py-1 text-[12px] font-bold text-text-main hover:bg-surface-hover rounded-lg transition-colors">
              Today
            </button>
            <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-[13px] font-bold text-text-main min-w-[200px] text-center">{viewLabel}</span>

          {/* View tabs */}
          <div className="flex items-center gap-0.5 bg-surface-hover/60 border border-border/50 p-0.5 rounded-xl">
            {(['month', 'week', 'day', 'agenda'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-all ${
                  view === v ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiAssistantOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[12px] font-bold text-purple-400 hover:bg-purple-500/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Booking
          </button>
          <button
            onClick={() => setPublicBookingOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border/60 text-[12px] font-bold text-text-main hover:bg-surface-hover transition-all"
          >
            <Globe className="w-3.5 h-3.5 text-primary" /> Book Link
          </button>
          <button
            onClick={() => openCreate()}
            className="btn-primary text-[12px]"
          >
            <Plus className="w-4 h-4" /> New Event
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-4 border-b border-border/40 shrink-0">
        {[
          { label: 'Total', value: kpi.total, color: 'text-text-main', sub: 'all events' },
          { label: 'Upcoming', value: kpi.upcoming, color: 'text-blue-400', sub: 'scheduled / confirmed' },
          { label: 'Completed', value: `${kpi.rate}%`, color: 'text-emerald-400', sub: `${kpi.completed} done` },
          { label: 'No Shows', value: kpi.noShow, color: 'text-amber-400', sub: 'flagged' },
        ].map((k, i) => (
          <div key={i} className="p-3 border-r border-border/40 last:border-r-0 flex items-center gap-3">
            <div>
              <div className={`text-[22px] font-black leading-none ${k.color}`}>{k.value}</div>
              <div className="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-0.5">{k.label}</div>
              <div className="text-[10px] text-text-muted">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* ── Left Sidebar ── */}
          <aside className="w-[240px] shrink-0 border-r border-border/50 bg-surface/30 flex flex-col overflow-y-auto">
            {/* Mini Calendar */}
            <div className="p-4 border-b border-border/40">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }}
                  className="p-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[12px] font-black text-text-main">{MONTHS[month].slice(0, 3)} {year}</span>
                <button
                  onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }}
                  className="p-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <span key={i} className="text-[9px] font-bold text-text-muted mb-1">{d}</span>
                ))}
                {getCalendarGrid(year, month).map((dayNum, idx) => {
                  if (!dayNum) return <div key={idx} className="h-6 w-6" />;
                  const cellDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isSelected = formatDateKey(currentDate) === cellDate;
                  const isToday = cellDate === todayStr;
                  const hasEvents = appointmentsByDate.has(cellDate);
                  return (
                    <button
                      key={idx}
                      onClick={() => { setCurrentDate(new Date(year, month, dayNum)); }}
                      className={`h-6 w-6 mx-auto rounded-lg text-[11px] font-bold relative transition-all ${
                        isSelected ? 'bg-primary text-white shadow-sm'
                          : isToday ? 'ring-1 ring-primary text-primary'
                          : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                      }`}
                    >
                      {dayNum}
                      {hasEvents && !isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type filter */}
            <div className="p-4 border-b border-border/40 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Filter by type</span>
                {typeFilter !== 'all' && (
                  <button onClick={() => setTypeFilter('all')} className="text-[10px] text-primary hover:underline">Reset</button>
                )}
              </div>
              {[
                { id: 'all', label: 'All Types', dot: 'bg-text-muted/60' },
                ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({ id, label: c.label, dot: c.dot })),
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                    typeFilter === t.id
                      ? 'bg-surface-hover text-text-main border border-border/60'
                      : 'text-text-muted hover:text-text-main hover:bg-surface-hover/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`} />
                    <span>{t.label}</span>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {t.id === 'all' ? appointments.length : appointments.filter(a => a.type === t.id).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Today's schedule */}
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Today</span>
                <span className="text-[10px] font-bold text-primary">{todayAppointments.length} events</span>
              </div>
              {todayAppointments.length === 0 ? (
                <div className="p-3 rounded-xl border border-dashed border-border/50 text-center bg-surface/20">
                  <CalIcon className="w-4 h-4 text-text-muted/30 mx-auto mb-1" />
                  <p className="text-[11px] text-text-muted">No events today</p>
                  <button
                    onClick={() => openCreate(todayStr)}
                    className="mt-1.5 text-[11px] font-bold text-primary hover:underline"
                  >
                    + Add Event
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {todayAppointments.map(apt => {
                    const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;
                    return (
                      <button
                        key={apt.id}
                        onClick={() => openEdit(apt)}
                        className={`w-full text-left p-2.5 rounded-xl border hover:shadow-md transition-all ${cfg.bg} ${cfg.border}`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-[12px] font-bold text-text-main truncate">{apt.title}</span>
                          <cfg.icon className={`w-3 h-3 shrink-0 ${cfg.color}`} />
                        </div>
                        <span className="text-[10px] text-text-muted font-mono">{fmtTime(new Date(apt.startTime))}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Booking link card */}
            <div className="p-4 border-t border-border/40">
              <div className="bg-surface border border-border/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-text-main flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-primary" /> Booking Link
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">Active</span>
                </div>
                <p className="text-[10px] text-text-muted font-mono bg-bg/60 px-2 py-1 rounded-lg border border-border/40 truncate">
                  stoneaio.com/book/team
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText('https://stoneaio.com/book/team');
                    toast('success', 'Link copied!');
                  }}
                  className="w-full py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold rounded-lg text-[11px] transition-all flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3 h-3" /> Copy Link
                </button>
              </div>
            </div>
          </aside>

          {/* ── Main Calendar Area ── */}
          <main className="flex-1 flex flex-col overflow-hidden">

            {/* ══ Month View ══ */}
            {view === 'month' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-7 border-b border-border/40 bg-surface/40 shrink-0">
                  {DAYS_SHORT.map((d, i) => (
                    <div key={i} className="py-2.5 text-center text-[11px] font-black text-text-muted uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="flex-1 grid grid-cols-7 overflow-y-auto" style={{ gridAutoRows: 'minmax(100px, 1fr)' }}>
                  {getCalendarGrid(year, month).map((dayNum, idx) => {
                    if (!dayNum) return <div key={idx} className="border-b border-r border-border/30 bg-surface/5" />;
                    const cellDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const dayApts = (appointmentsByDate.get(cellDate) || []).sort((a, b) =>
                      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                    );
                    const isToday = cellDate === todayStr;
                    const isExpanded = expandedDay === cellDate;
                    const SHOW_LIMIT = 3;

                    return (
                      <div
                        key={idx}
                        onClick={() => openCreate(cellDate)}
                        className={`border-b border-r border-border/40 p-2 flex flex-col hover:bg-surface-hover/20 transition-colors cursor-pointer ${isToday ? 'bg-primary/5' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[12px] font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday ? 'bg-primary text-white shadow-sm' : 'text-text-muted'
                          }`}>
                            {dayNum}
                          </span>
                          {dayApts.length > 0 && (
                            <span className="text-[9px] text-text-muted">{dayApts.length}</span>
                          )}
                        </div>
                        <div className="space-y-0.5 flex-1 overflow-hidden">
                          {dayApts.slice(0, isExpanded ? undefined : SHOW_LIMIT).map(apt => {
                            const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;
                            return (
                              <div
                                key={apt.id}
                                onClick={e => { e.stopPropagation(); openEdit(apt); }}
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border truncate flex items-center gap-1 hover:opacity-90 ${cfg.bg} ${cfg.border} ${cfg.color}`}
                                title={apt.title}
                              >
                                <span className="shrink-0 font-mono">{fmtTime(new Date(apt.startTime))}</span>
                                <span className="text-text-main truncate">{apt.title}</span>
                              </div>
                            );
                          })}
                          {!isExpanded && dayApts.length > SHOW_LIMIT && (
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedDay(cellDate); }}
                              className="text-[10px] font-bold text-primary px-1 hover:underline"
                            >
                              +{dayApts.length - SHOW_LIMIT} more
                            </button>
                          )}
                          {isExpanded && (
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedDay(null); }}
                              className="text-[10px] font-bold text-text-muted px-1 hover:text-text-main"
                            >
                              Show less
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ Week View ══ */}
            {view === 'week' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Day column headers */}
                <div
                  className="grid border-b border-border/40 bg-surface/60 backdrop-blur-md shrink-0 sticky top-0 z-10"
                  style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
                >
                  <div className="h-14 border-r border-border/40 flex items-end justify-center pb-2">
                    <span className="text-[9px] font-bold text-text-muted uppercase">GMT</span>
                  </div>
                  {weekDays.map((d, i) => {
                    const dateStr = formatDateKey(d);
                    const isToday = dateStr === todayStr;
                    const count = (appointmentsByDate.get(dateStr) || []).length;
                    return (
                      <button
                        key={i}
                        onClick={() => { setCurrentDate(d); setView('day'); }}
                        className={`h-14 border-r border-border/40 flex flex-col items-center justify-center transition-colors hover:bg-surface-hover/50 ${isToday ? 'bg-primary/5' : ''}`}
                      >
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                          {DAYS_SHORT[d.getDay()]}
                        </span>
                        <span className={`text-[18px] font-black leading-tight ${isToday ? 'text-primary' : 'text-text-main'}`}>
                          {d.getDate()}
                        </span>
                        {count > 0 && (
                          <span className="text-[9px] text-text-muted">{count} event{count !== 1 ? 's' : ''}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable grid */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <div
                    className="grid relative"
                    style={{ gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: `${HOURS.length * 64}px` }}
                  >
                    {/* Hour labels */}
                    <div className="border-r border-border/40 bg-surface/20">
                      {HOURS.map(h => (
                        <div key={h} className="h-16 border-b border-border/20 flex items-start justify-center pt-1">
                          <span className="text-[9px] font-mono text-text-muted/60">
                            {h > 12 ? `${h - 12}pm` : h === 12 ? '12pm' : `${h}am`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 7 day columns */}
                    {weekDays.map((dayObj, dayIdx) => {
                      const dateStr = formatDateKey(dayObj);
                      const dayApts = (appointmentsByDate.get(dateStr) || []);
                      const isToday = dateStr === todayStr;

                      return (
                        <div
                          key={dayIdx}
                          className={`border-r border-border/40 relative ${isToday ? 'bg-primary/[0.02]' : ''}`}
                        >
                          {/* Hour lines */}
                          {HOURS.map(hour => (
                            <div
                              key={hour}
                              onClick={() => openCreate(dateStr, `${String(hour).padStart(2, '0')}:00`)}
                              className="h-16 border-b border-border/20 hover:bg-primary/5 transition-colors cursor-pointer"
                            />
                          ))}

                          {/* Now line */}
                          {isToday && nowTopPx >= 0 && nowTopPx <= HOURS.length * 64 && (
                            <div
                              className="absolute left-0 right-0 z-20 pointer-events-none"
                              style={{ top: `${nowTopPx}px` }}
                            >
                              <div className="relative flex items-center">
                                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1 shadow-sm" />
                                <div className="h-[1.5px] bg-red-500 flex-1 opacity-70" />
                              </div>
                            </div>
                          )}

                          {/* Event blocks */}
                          {dayApts.map(apt => {
                            const s = new Date(apt.startTime);
                            const e = new Date(apt.endTime);
                            const startHour = s.getHours() + s.getMinutes() / 60;
                            const durationH = Math.max(0.5, (e.getTime() - s.getTime()) / 3600000);
                            const topPx = (startHour - 7) * 64;
                            const heightPx = Math.max(28, durationH * 64 - 3);
                            const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;
                            if (topPx < 0 || topPx > HOURS.length * 64) return null;

                            return (
                              <button
                                key={apt.id}
                                onClick={e => { e.stopPropagation(); openEdit(apt); }}
                                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                                className={`absolute inset-x-1 rounded-xl p-1.5 border shadow-md flex flex-col justify-between overflow-hidden hover:scale-[1.01] hover:z-20 transition-all text-left ${cfg.bg} ${cfg.border}`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span className="text-[11px] font-bold text-text-main truncate leading-tight">{apt.title}</span>
                                  <cfg.icon className={`w-3 h-3 shrink-0 mt-0.5 ${cfg.color}`} />
                                </div>
                                {heightPx > 40 && (
                                  <span className="text-[9px] text-text-muted font-mono">
                                    {fmtTime(s)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ══ Day View ══ */}
            {view === 'day' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/40">
                  <div>
                    <h2 className="text-[18px] font-black text-text-main">
                      {FULL_DAYS[currentDate.getDay()]}, {MONTHS[month]} {currentDate.getDate()}, {year}
                    </h2>
                    <p className="text-[12px] text-text-muted mt-0.5">
                      {(appointmentsByDate.get(formatDateKey(currentDate)) || []).length} appointments
                    </p>
                  </div>
                  <button
                    onClick={() => openCreate(formatDateKey(currentDate))}
                    className="btn-primary text-[12px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Event
                  </button>
                </div>

                {(appointmentsByDate.get(formatDateKey(currentDate)) || []).length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-border/50 rounded-2xl bg-surface/20">
                    <CalIcon className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
                    <p className="text-[14px] font-bold text-text-main mb-1">No appointments</p>
                    <p className="text-[12px] text-text-muted mb-4">Click below to schedule one.</p>
                    <button onClick={() => openCreate(formatDateKey(currentDate))} className="btn-primary text-[12px]">
                      Book Event
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(appointmentsByDate.get(formatDateKey(currentDate)) || [])
                      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                      .map(apt => {
                        const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;
                        const statusCfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled;
                        const s = new Date(apt.startTime);
                        const e = new Date(apt.endTime);
                        return (
                          <div key={apt.id} className="bg-surface/60 border border-border/50 rounded-2xl p-4 shadow-sm hover:border-primary/30 transition-all flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3.5 flex-1">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} border ${cfg.border}`}>
                                <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-[14px] font-bold text-text-main">{apt.title}</h3>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}>
                                    {statusCfg.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-[12px] text-text-muted flex-wrap">
                                  <span className="flex items-center gap-1 font-mono">
                                    <Clock className="w-3.5 h-3.5" />
                                    {fmtTime(s)} – {fmtTime(e)}
                                  </span>
                                  {apt.location && (
                                    <a href={apt.location.startsWith('http') ? apt.location : `https://${apt.location}`} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-1 text-primary hover:underline" onClick={e => e.stopPropagation()}>
                                      <Globe className="w-3.5 h-3.5" />
                                      {apt.location.replace(/^https?:\/\//, '').slice(0, 30)}
                                    </a>
                                  )}
                                </div>
                                {apt.contact && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center">
                                      {apt.contact.firstName?.[0] || 'C'}
                                    </div>
                                    <span className="text-[12px] font-semibold text-text-main">
                                      {apt.contact.firstName} {apt.contact.lastName}
                                    </span>
                                    {apt.contact.email && (
                                      <a href={`mailto:${apt.contact.email}`} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                                        <Mail className="w-3 h-3" /> {apt.contact.email}
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {apt.location?.startsWith('http') && (
                                <a href={apt.location} target="_blank" rel="noreferrer"
                                  className="px-3 py-1.5 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-xl text-[12px] font-bold hover:bg-teal-500/20 flex items-center gap-1.5">
                                  <Video className="w-3.5 h-3.5" /> Join
                                </a>
                              )}
                              <button
                                onClick={() => updateStatusMutation.mutate({ id: apt.id, status: 'completed' })}
                                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-[12px] font-bold hover:bg-emerald-500/20"
                              >
                                ✓ Done
                              </button>
                              <button onClick={() => openEdit(apt)} className="px-3 py-1.5 bg-surface border border-border/50 text-[12px] font-bold text-text-main hover:bg-surface-hover rounded-xl transition-colors">
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* ══ Agenda View ══ */}
            {view === 'agenda' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Search + filter bar */}
                <div className="flex items-center gap-3 bg-surface/60 border border-border/50 rounded-2xl p-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search appointments..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-surface-hover/60 border border-border/50 rounded-xl pl-9 pr-4 py-2 text-[12px] text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-surface-hover border border-border/50 text-[12px] font-bold rounded-xl px-3 py-2 text-text-main focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([v, s]) => (
                      <option key={v} value={v}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {filteredAppointments.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-border/50 rounded-2xl bg-surface/20">
                    <CalIcon className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
                    <p className="text-[14px] font-bold text-text-main">No appointments found</p>
                    <p className="text-[12px] text-text-muted mt-1">Adjust your filters or create a new event.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAppointments
                      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                      .map(apt => {
                        const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;
                        const statusCfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled;
                        const s = new Date(apt.startTime);
                        const e = new Date(apt.endTime);
                        const dateStr = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

                        return (
                          <div key={apt.id} className="bg-surface/60 border border-border/50 rounded-2xl p-4 shadow-sm hover:border-primary/30 transition-all flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 min-w-[260px]">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} border ${cfg.border}`}>
                                <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                              </div>
                              <div>
                                <p className="text-[14px] font-bold text-text-main">{apt.title}</p>
                                <p className="text-[11px] text-text-muted font-mono">{dateStr} · {fmtTime(s)}–{fmtTime(e)}</p>
                              </div>
                            </div>

                            {/* Contact */}
                            <div className="min-w-[160px]">
                              {apt.contact ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center">
                                    {apt.contact.firstName?.[0] || 'C'}
                                  </div>
                                  <div>
                                    <p className="text-[12px] font-bold text-text-main">{apt.contact.firstName} {apt.contact.lastName}</p>
                                    <p className="text-[10px] text-text-muted">{apt.contact.email || ''}</p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[12px] text-text-muted italic">No contact</span>
                              )}
                            </div>

                            {/* Status select */}
                            <select
                              value={apt.status}
                              onChange={e => updateStatusMutation.mutate({ id: apt.id, status: e.target.value })}
                              onClick={e => e.stopPropagation()}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border focus:outline-none cursor-pointer ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}
                            >
                              {Object.entries(STATUS_CONFIG).map(([v, s]) => (
                                <option key={v} value={v} className="bg-surface text-text-main">{s.label}</option>
                              ))}
                            </select>

                            <div className="flex items-center gap-2">
                              {apt.location?.startsWith('http') && (
                                <a href={apt.location} target="_blank" rel="noreferrer"
                                  className="p-2 rounded-xl bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/30" title="Join">
                                  <Video className="w-4 h-4" />
                                </a>
                              )}
                              <button onClick={() => openEdit(apt)} className="px-3 py-1.5 bg-surface border border-border/50 text-[12px] font-bold text-text-main hover:bg-surface-hover rounded-xl transition-colors">
                                Edit
                              </button>
                              <button onClick={() => setDeleteTarget(apt)} className="p-2 rounded-xl text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}

      {/* ── Create / Edit SlideOverPanel ── */}
      {panelOpen && (
          <SlideOverPanel
            isOpen={true}
            onClose={() => setPanelOpen(false)}
            title={form.id ? 'Edit Appointment' : 'New Appointment'}
            width="w-[500px]"
            footer={
              <>
                {form.id && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(appointments.find(a => a.id === form.id) || null)}
                    className="mr-auto px-3 py-2 text-[12px] font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Cancel Event
                  </button>
                )}
                <button onClick={() => setPanelOpen(false)} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover">
                  Close
                </button>
                <button
                  type="submit"
                  form="cal-apt-form"
                  disabled={saveMutation.isPending || !form.title.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saveMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {form.id ? 'Save Changes' : 'Confirm Booking'}
                </button>
              </>
            }
          >
            <form id="cal-apt-form" onSubmit={handleSave} className="space-y-5 pb-6">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-text-main">Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Discovery Call with Acme"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-[13px] text-text-main font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-text-main">Event Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, type: key }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all ${
                        form.type === key
                          ? `${val.bg} ${val.border} ${val.color}`
                          : 'bg-surface-hover border-border text-text-muted hover:text-text-main'
                      }`}
                    >
                      <val.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{val.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date / Time / Duration */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-text-main">Date *</label>
                  <input type="date" required value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-xl text-[12px] text-text-main font-semibold focus:outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-text-main">Time *</label>
                  <input type="time" required value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-xl text-[12px] text-text-main font-semibold focus:outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-text-main">Duration</label>
                  <select value={form.duration} onChange={e => setForm(p => ({ ...p, duration: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-xl text-[12px] text-text-main font-semibold focus:outline-none focus:border-primary cursor-pointer">
                    {[15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60}h`}</option>)}
                  </select>
                </div>
              </div>

              {/* Contact combobox */}
              <div className="space-y-1.5" ref={contactRef}>
                <label className="text-[12px] font-bold text-text-main">CRM Contact</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onFocus={() => setContactDropOpen(true)}
                    onChange={e => { setContactSearch(e.target.value); setForm(p => ({ ...p, contactId: '' })); setContactDropOpen(true); }}
                    className="w-full pl-9 pr-4 py-2.5 bg-surface-hover border border-border rounded-xl text-[12px] text-text-main font-semibold focus:outline-none focus:border-primary"
                  />
                  {form.contactId && (
                    <button type="button" onClick={() => selectContact(null)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <AnimatePresence>
                    {contactDropOpen && filteredContacts.length > 0 && (
                      <motion.ul
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-luxury max-h-48 overflow-y-auto"
                      >
                        <li>
                          <button type="button" onClick={() => selectContact(null)} className="w-full text-left px-3 py-2 text-[12px] text-text-muted hover:bg-surface-hover">
                            — No contact —
                          </button>
                        </li>
                        {filteredContacts.map((c: any) => (
                          <li key={c.id}>
                            <button type="button" onClick={() => selectContact(c)} className="w-full text-left px-3 py-2 text-[12px] text-text-main hover:bg-surface-hover font-medium">
                              {c.firstName} {c.lastName}
                              {c.email && <span className="text-text-muted ml-1">({c.email})</span>}
                            </button>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Location + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-text-main">Location / Link</label>
                  <input
                    type="text"
                    placeholder="https://meet.google.com/..."
                    value={form.location}
                    onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-surface-hover border border-border rounded-xl text-[12px] text-text-main focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-text-main">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-xl text-[12px] text-text-main font-semibold focus:outline-none focus:border-primary cursor-pointer">
                    {Object.entries(STATUS_CONFIG).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-text-main">Notes / Agenda</label>
                <textarea
                  rows={3}
                  placeholder="Agenda items, goals, prep notes..."
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-[12px] text-text-main focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </form>
          </SlideOverPanel>
        )}

      {/* ── Confirm Delete ── */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        title={`Cancel "${deleteTarget?.title ?? 'appointment'}"`}
        message="This appointment will be permanently removed from the calendar."
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />

      {/* ── Public Booking Simulator Modal ── */}
      <AnimatePresence>
        {publicBookingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="bg-surface border border-border/80 rounded-3xl w-full max-w-xl shadow-luxury overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-border/60 flex items-center justify-between bg-surface-hover/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-white shadow-sm">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-black text-text-main">Public Booking Simulator</h2>
                    <p className="text-[11px] text-text-muted">Preview your client scheduling experience</p>
                  </div>
                </div>
                <button onClick={() => setPublicBookingOpen(false)} className="p-2 rounded-xl text-text-muted hover:text-text-main transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="flex gap-2">
                  {[15, 30, 45, 60].map(dur => (
                    <button key={dur} onClick={() => setBookingSimDuration(dur)}
                      className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all ${bookingSimDuration === dur ? 'bg-primary text-white border-primary' : 'bg-surface text-text-muted border-border/60 hover:text-text-main'}`}>
                      {dur} min
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 bg-surface/50 rounded-2xl border border-border/50">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-text-muted uppercase">1. Pick Date</label>
                    <input type="date" value={bookingSimDate} onChange={e => setBookingSimDate(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border/60 rounded-xl text-[12px] text-text-main font-semibold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-text-muted uppercase">2. Select Slot</label>
                    {isLoadingSlots ? (
                      <div className="text-[12px] text-text-muted animate-pulse py-2">Checking availability...</div>
                    ) : (slotData?.availableSlots || []).length === 0 ? (
                      <div className="text-[12px] text-amber-400 py-2">No open slots on this date</div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                        {(slotData?.availableSlots || []).map((slot: string) => (
                          <button key={slot} onClick={() => setBookingSimSlot(slot)}
                            className={`py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all ${bookingSimSlot === slot ? 'bg-emerald-500 text-black border-emerald-500 shadow-sm' : 'bg-surface border-border/60 text-text-main hover:border-primary'}`}>
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Full Name" value={bookingSimName} onChange={e => setBookingSimName(e.target.value)}
                    className="px-3.5 py-2 bg-surface border border-border/60 rounded-xl text-[12px] text-text-main" />
                  <input type="email" placeholder="Email Address" value={bookingSimEmail} onChange={e => setBookingSimEmail(e.target.value)}
                    className="px-3.5 py-2 bg-surface border border-border/60 rounded-xl text-[12px] text-text-main" />
                </div>
                <input type="text" placeholder="Notes / goal for the meeting" value={bookingSimNotes} onChange={e => setBookingSimNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface border border-border/60 rounded-xl text-[12px] text-text-main" />
              </div>
              <div className="p-5 border-t border-border/60 flex items-center justify-between bg-surface-hover/30">
                <span className="text-[12px] text-text-muted">
                  {bookingSimSlot ? `${bookingSimSlot} on ${bookingSimDate}` : 'No slot selected'}
                </span>
                <button
                  disabled={!bookingSimSlot || !bookingSimEmail || publicBookMutation.isPending}
                  onClick={() => publicBookMutation.mutate({ name: bookingSimName, email: bookingSimEmail, phone: bookingSimPhone, date: bookingSimDate, time: bookingSimSlot, durationMinutes: bookingSimDuration, type: bookingSimType, notes: bookingSimNotes })}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-[12px] shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {publicBookMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Booking
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── AI Scheduling Assistant Modal ── */}
      <AnimatePresence>
        {aiAssistantOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="bg-surface border border-border/80 rounded-3xl w-full max-w-lg shadow-luxury overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-border/60 flex items-center justify-between bg-surface-hover/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-primary flex items-center justify-center text-white shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-black text-text-main">AI Scheduling Assistant</h2>
                    <p className="text-[11px] text-text-muted">Generate personalized booking email copy</p>
                  </div>
                </div>
                <button onClick={() => setAiAssistantOpen(false)} className="p-2 rounded-xl text-text-muted hover:text-text-main transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Prospect Name</label>
                    <input type="text" value={aiContactName} onChange={e => setAiContactName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border/60 rounded-xl text-[12px] text-text-main" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Call Purpose</label>
                    <input type="text" value={aiPurpose} onChange={e => setAiPurpose(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border/60 rounded-xl text-[12px] text-text-main" />
                  </div>
                </div>
                <button
                  disabled={aiSuggestMutation.isPending}
                  onClick={() => aiSuggestMutation.mutate()}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-primary hover:opacity-90 text-white font-bold rounded-xl text-[12px] flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {aiSuggestMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                  Scan Calendar & Generate Copy
                </button>
                {aiGeneratedCopy && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Generated Copy</label>
                      <button onClick={() => { navigator.clipboard?.writeText(aiGeneratedCopy); toast('success', 'Copied!'); }}
                        className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <textarea
                      rows={7}
                      value={aiGeneratedCopy}
                      readOnly
                      className="w-full p-3.5 bg-surface-hover/50 border border-border/60 rounded-2xl text-[12px] text-text-main font-mono leading-relaxed outline-none resize-none"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
