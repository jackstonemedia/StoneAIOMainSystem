/**
 * Autonomous Business Calendar & Scheduling Hub — Stone AIO
 *
 * Full-featured enterprise scheduling engine:
 * 1. Month, Week (7-day hourly grid), Day, and Agenda / List views.
 * 2. Synchronized date navigation (Previous, Today, Next) and interactive mini-calendar.
 * 3. Deep CRM Integration: live contact search, auto-fill, and 1-click CRM profile links.
 * 4. Availability & Slot Engine with live Public Booking simulation.
 * 5. AI Smart Scheduling Assistant (slot discovery & copy generation).
 * 6. Google Calendar / Outlook OAuth sync state indicator.
 * 7. Real-time status management (Scheduled, Confirmed, Completed, Cancelled, No Show).
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, Video, Phone, Users, Clock, Calendar as CalIcon,
  X, MapPin, Trash2, AlertCircle, RefreshCw, Check, User, Sparkles,
  Copy, Globe, Search, Mail, Share2, Bot
} from 'lucide-react';
import { SlidePanel } from '../../components/ui/SlidePanel';
import { useToast } from '../../components/ui/Toast';
import { apiClient } from '../../lib/apiClient';
import type { Appointment } from '../../types/business';

// ── Constants & Helpers ───────────────────────────────────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string; border: string; dot: string }> = {
  video: { icon: Video, label: 'Video Call', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', dot: 'bg-teal-400' },
  call: { icon: Phone, label: 'Phone Call', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  meeting: { icon: Users, label: 'Meeting', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', dot: 'bg-primary' },
  demo: { icon: Sparkles, label: 'Product Demo', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', dot: 'bg-purple-400' },
  consultation: { icon: Sparkles, label: 'Consultation', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  in_person: { icon: MapPin, label: 'In Person', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-400' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  no_show: { label: 'No Show', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
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

export default function Calendar() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Date Navigation State ──────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('week');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── Modals & Drawers ───────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [publicBookingModalOpen, setPublicBookingModalOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);

  // ── Event Form State ───────────────────────────────────────────────────────
  const [form, setForm] = useState({
    id: '',
    title: '',
    type: 'video',
    date: formatDateKey(new Date()),
    time: '09:00',
    duration: 30,
    contactId: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    location: 'https://meet.google.com/new',
    description: '',
    status: 'scheduled',
  });

  // ── Public Booking Simulator State ─────────────────────────────────────────
  const [bookingSimDate, setBookingSimDate] = useState<string>(formatDateKey(new Date()));
  const [bookingSimDuration, setBookingSimDuration] = useState<number>(30);
  const [bookingSimSlot, setBookingSimSlot] = useState<string>('');
  const [bookingSimName, setBookingSimName] = useState<string>('Alex Johnson');
  const [bookingSimEmail, setBookingSimEmail] = useState<string>('alex@austinplumbing.com');
  const [bookingSimPhone, setBookingSimPhone] = useState<string>('+1 (512) 555-0199');
  const [bookingSimType, setBookingSimType] = useState<string>('video');
  const [bookingSimNotes, setBookingSimNotes] = useState<string>('Discussing automated outbound SDR system');

  // ── AI Assistant State ─────────────────────────────────────────────────────
  const [aiContactName, setAiContactName] = useState('Sarah');
  const [aiPurpose, setAiPurpose] = useState('a 20-minute product walkthrough');
  const [aiGeneratedCopy, setAiGeneratedCopy] = useState('');

  // ── Data Queries ───────────────────────────────────────────────────────────
  const { data: appointments = [], refetch } = useQuery<Appointment[]>({
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
    enabled: publicBookingModalOpen,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { data } = await apiClient.put(`/business/appointments/${payload.id}`, payload);
        return data;
      } else {
        const { data } = await apiClient.post('/business/appointments', payload);
        return data;
      }
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', form.id ? 'Appointment Updated' : 'Appointment Scheduled', `"${saved.title}" confirmed for ${form.date} at ${form.time}`);
      setPanelOpen(false);
    },
    onError: (err: any) => {
      toast('error', 'Booking Failed', err?.response?.data?.error || err?.message || 'Could not save appointment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/business/appointments/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Appointment Cancelled', 'The event has been removed from the schedule.');
      setDeleteTarget(null);
      setPanelOpen(false);
    },
    onError: (err: any) => {
      toast('error', 'Cancellation Failed', err?.response?.data?.error || err?.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.put(`/business/appointments/${id}`, { status });
      return data;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Status Updated', `Appointment marked as ${updated.status}`);
    },
  });

  const publicBookMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/business/calendar/book', payload);
      return data;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Public Booking Confirmed!', `Appointment booked for ${res.contact?.firstName || 'Guest'} (${bookingSimSlot} on ${bookingSimDate})`);
      setPublicBookingModalOpen(false);
    },
    onError: (err: any) => {
      toast('error', 'Booking Failed', err?.response?.data?.error || err?.message);
    },
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
      toast('success', 'AI Proposal Generated', 'Open slots identified and personalized email ready.');
    },
    onError: (err: any) => {
      toast('error', 'AI Suggestion Failed', err?.response?.data?.error || err?.message);
    },
  });

  // ── Computed Date Navigation ───────────────────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = formatDateKey(new Date());

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (view === 'month') next.setMonth(next.getMonth() - 1);
    else if (view === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (view === 'month') next.setMonth(next.getMonth() + 1);
    else if (view === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // 7-day week view bounds
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay(); // 0 is Sun
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (typeFilter !== 'all' && apt.type !== typeFilter) return false;
      if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const contactName = `${apt.contact?.firstName || ''} ${apt.contact?.lastName || ''}`.toLowerCase();
        return (
          apt.title.toLowerCase().includes(q) ||
          (apt.description || '').toLowerCase().includes(q) ||
          contactName.includes(q) ||
          (apt.location || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [appointments, typeFilter, statusFilter, searchQuery]);

  // Appointments grouped by date string (YYYY-MM-DD)
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

  // Today's appointments
  const todayAppointments = useMemo(() => {
    return appointmentsByDate.get(todayStr) || [];
  }, [appointmentsByDate, todayStr]);

  // KPI Metrics
  const kpiStats = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter(a => a.status === 'completed').length;
    const scheduled = appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length;
    const noShowOrCancel = appointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const projectedRev = total * 175;

    return { total, completed, scheduled, noShowOrCancel, completionRate, projectedRev };
  }, [appointments]);

  // ── Form Handlers ──────────────────────────────────────────────────────────
  const openFormForNew = (dateStr?: string, timeStr?: string) => {
    setForm({
      id: '',
      title: '',
      type: 'video',
      date: dateStr || formatDateKey(currentDate),
      time: timeStr || '09:00',
      duration: 30,
      contactId: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      location: 'https://meet.google.com/new',
      description: '',
      status: 'scheduled',
    });
    setPanelOpen(true);
  };

  const openFormForEdit = (apt: Appointment) => {
    const sDate = new Date(apt.startTime);
    const eDate = new Date(apt.endTime);
    const durationMins = Math.max(15, Math.round((eDate.getTime() - sDate.getTime()) / 60000));

    setForm({
      id: apt.id,
      title: apt.title,
      type: apt.type || 'video',
      date: formatDateKey(sDate),
      time: `${String(sDate.getHours()).padStart(2, '0')}:${String(sDate.getMinutes()).padStart(2, '0')}`,
      duration: durationMins,
      contactId: apt.contactId || '',
      contactName: apt.contact ? `${apt.contact.firstName || ''} ${apt.contact.lastName || ''}`.trim() : '',
      contactEmail: apt.contact?.email || '',
      contactPhone: apt.contact?.phone || '',
      location: apt.location || '',
      description: apt.description || '',
      status: apt.status || 'scheduled',
    });
    setPanelOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.time) {
      toast('warning', 'Missing Details', 'Please enter an event title, date, and start time.');
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

  const handleSelectContact = (c: any) => {
    if (!c) {
      setForm(prev => ({ ...prev, contactId: '', contactName: '', contactEmail: '', contactPhone: '' }));
      return;
    }
    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.companyName || 'Contact';
    setForm(prev => ({
      ...prev,
      contactId: c.id,
      contactName: fullName,
      contactEmail: c.email || '',
      contactPhone: c.phone || '',
      title: prev.title || `Sync with ${fullName}`,
    }));
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-bg text-text-main">
      {/* ── Top Header Control Bar ────────────────────────────────────────── */}
      <div className="h-16 px-6 border-b border-border/60 flex items-center justify-between shrink-0 bg-surface/80 backdrop-blur-md z-20">
        {/* Left: Branding & Core CTA */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <CalIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-text-main tracking-tight">Calendar & Scheduling</h1>
              {syncStatus?.hasGoogleCalendar && (
                <span className="px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Google Synced
                </span>
              )}
              {syncStatus?.hasOutlookCalendar && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Outlook Synced
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted">Enterprise unified calendar & automated client booking</p>
          </div>
        </div>

        {/* Center: View Switcher */}
        <div className="flex items-center gap-1 bg-surface-hover/80 p-1 rounded-xl border border-border/60 text-xs shadow-inner">
          {(['month', 'week', 'day', 'agenda'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3.5 py-1.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                view === v
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Right: Date Navigation & Actions */}
        <div className="flex items-center gap-3">
          {/* Previous / Today / Next */}
          <div className="flex items-center gap-1 bg-surface border border-border/60 rounded-xl p-0.5">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-bold text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Current Date Text Label */}
          <span className="text-xs font-black text-text-main min-w-[140px] text-right">
            {view === 'month' && `${MONTHS[month]} ${year}`}
            {view === 'week' && `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getDate()} – ${MONTHS[weekDays[6].getMonth()]} ${weekDays[6].getDate()}, ${year}`}
            {view === 'day' && `${FULL_DAYS[currentDate.getDay()]}, ${MONTHS[month]} ${currentDate.getDate()}, ${year}`}
            {view === 'agenda' && `${MONTHS[month]} ${year} Agenda`}
          </span>

          {/* AI Assistant Button */}
          <button
            onClick={() => setAiAssistantOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs font-bold text-purple-400 hover:bg-purple-500/20 transition-all cursor-pointer"
            title="AI Smart Scheduling Assistant"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Booking
          </button>

          {/* Public Booking Link Generator */}
          <button
            onClick={() => setPublicBookingModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border/60 text-xs font-bold text-text-main hover:bg-surface-hover transition-all cursor-pointer"
            title="Test Public Client Booking Page"
          >
            <Globe className="w-3.5 h-3.5 text-primary" /> Public Page
          </button>

          {/* Primary Create Button */}
          <button
            onClick={() => openFormForNew()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Event
          </button>
        </div>
      </div>

      {/* ── KPI Analytics Header ────────────────────────────────────────── */}
      <div className="grid grid-cols-5 border-b border-border/50 bg-surface/30 shrink-0">
        {[
          { label: 'Total Bookings', value: kpiStats.total, sub: 'All calendar events', color: 'text-text-main' },
          { label: 'Confirmed & Scheduled', value: kpiStats.scheduled, sub: 'Upcoming meetings', color: 'text-blue-400' },
          { label: 'Completed Rate', value: `${kpiStats.completionRate}%`, sub: `${kpiStats.completed} completed`, color: 'text-emerald-400' },
          { label: 'No Shows & Cancelled', value: kpiStats.noShowOrCancel, sub: 'Managed exceptions', color: 'text-amber-400' },
          { label: 'Projected Value', value: `$${kpiStats.projectedRev.toLocaleString()}`, sub: 'Direct pipeline impact', color: 'text-purple-400' },
        ].map((kpi, i) => (
          <div key={i} className="p-3.5 border-r border-border/50 last:border-r-0 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">{kpi.label}</span>
            <div className="text-lg font-black tracking-tight leading-tight">
              <span className={kpi.color}>{kpi.value}</span>
            </div>
            <span className="text-[10px] text-text-muted">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Main Workspace Body ─────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Interactive Sidebar ─────────────────────────────────── */}
        <aside className="w-[280px] shrink-0 border-r border-border/60 bg-surface/40 flex flex-col overflow-y-auto">
          {/* Interactive Mini Calendar */}
          <div className="p-4 border-b border-border/60">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setMonth(d.getMonth() - 1);
                  setCurrentDate(d);
                }}
                className="p-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-black text-text-main">
                {MONTHS[month]} {year}
              </span>
              <button
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setMonth(d.getMonth() + 1);
                  setCurrentDate(d);
                }}
                className="p-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayChar, i) => (
                <span key={i} className="text-[10px] font-bold text-text-muted mb-1">
                  {dayChar}
                </span>
              ))}
              {getCalendarGrid(year, month).map((dayNum, idx) => {
                if (!dayNum) return <div key={idx} className="h-7 w-7" />;
                const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isSelected = formatDateKey(currentDate) === cellDateStr;
                const isToday = cellDateStr === todayStr;
                const hasEvents = appointmentsByDate.has(cellDateStr);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      const d = new Date(year, month, dayNum);
                      setCurrentDate(d);
                    }}
                    className={`h-7 w-7 mx-auto rounded-xl text-[11px] font-bold flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-white shadow-sm'
                        : isToday
                        ? 'border border-primary text-primary font-black'
                        : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                    }`}
                  >
                    <span>{dayNum}</span>
                    {hasEvents && !isSelected && (
                      <span className="w-1 h-1 rounded-full bg-primary absolute bottom-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="p-4 border-b border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Filter By Type</span>
              {typeFilter !== 'all' && (
                <button onClick={() => setTypeFilter('all')} className="text-[10px] text-primary hover:underline">
                  Reset
                </button>
              )}
            </div>

            <div className="space-y-1">
              {[
                { id: 'all', label: 'All Event Types', dot: 'bg-text-muted' },
                { id: 'video', label: 'Video Calls', dot: TYPE_CONFIG.video.dot },
                { id: 'call', label: 'Phone Calls', dot: TYPE_CONFIG.call.dot },
                { id: 'meeting', label: 'In-Person Meetings', dot: TYPE_CONFIG.meeting.dot },
                { id: 'demo', label: 'Product Demos', dot: TYPE_CONFIG.demo.dot },
                { id: 'consultation', label: 'Consultations', dot: TYPE_CONFIG.consultation.dot },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    typeFilter === t.id
                      ? 'bg-surface-hover text-text-main border border-border/60'
                      : 'text-text-muted hover:text-text-main hover:bg-surface-hover/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                    <span>{t.label}</span>
                  </div>
                  {t.id === 'all'
                    ? <span className="text-[10px] text-text-muted">{appointments.length}</span>
                    : <span className="text-[10px] text-text-muted">{appointments.filter(a => a.type === t.id).length}</span>
                  }
                </button>
              ))}
            </div>
          </div>

          {/* Today's Agenda Feed */}
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Today's Schedule</span>
              <span className="text-[10px] font-bold text-primary">{todayAppointments.length} events</span>
            </div>

            {todayAppointments.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/60 text-center bg-surface/20">
                <CalIcon className="w-5 h-5 text-text-muted/40 mx-auto mb-1.5" />
                <p className="text-xs text-text-muted">No appointments today</p>
                <button
                  onClick={() => openFormForNew(todayStr)}
                  className="mt-2 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  + Add Event
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {todayAppointments.map(apt => {
                  const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;
                  const time = new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div
                      key={apt.id}
                      onClick={() => openFormForEdit(apt)}
                      className={`p-2.5 rounded-xl border cursor-pointer hover:shadow-md transition-all ${cfg.bg} ${cfg.border}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-text-main truncate pr-2">{apt.title}</span>
                        <cfg.icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" /> {time}
                        </span>
                        {apt.contact && (
                          <span className="font-semibold text-text-main truncate max-w-[100px]">
                            {apt.contact.firstName}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shareable Booking Link Card */}
          <div className="p-4 border-t border-border/60 bg-surface-hover/30">
            <div className="bg-surface border border-border/60 rounded-2xl p-3 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-text-main flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-primary" /> Booking Link
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">Active</span>
              </div>
              <p className="text-[11px] text-text-muted font-mono bg-bg/80 px-2 py-1 rounded-lg border border-border/50 truncate">
                stoneaio.com/book/team
              </p>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText('https://stoneaio.com/book/team');
                  toast('success', 'Link Copied', 'Your public calendar booking link is copied to clipboard.');
                }}
                className="w-full py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Booking Link
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main Calendar Grid / Timeline ───────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-surface-hover/10">
          {/* ── Month View ────────────────────────────────────────────── */}
          {view === 'month' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-border/60 bg-surface/60 shrink-0">
                {DAYS.map((d, i) => (
                  <div key={i} className="py-2.5 text-center text-xs font-black text-text-muted uppercase tracking-wider">
                    {d}
                  </div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto">
                {getCalendarGrid(year, month).map((dayNum, idx) => {
                  if (!dayNum) {
                    return <div key={idx} className="border-b border-r border-border/40 bg-surface/10 p-2 min-h-[100px]" />;
                  }

                  const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const dayApts = appointmentsByDate.get(cellDateStr) || [];
                  const isToday = cellDateStr === todayStr;

                  return (
                    <div
                      key={idx}
                      onClick={() => openFormForNew(cellDateStr)}
                      className={`border-b border-r border-border/50 p-2 min-h-[100px] flex flex-col justify-between hover:bg-surface-hover/30 transition-colors group cursor-pointer ${
                        isToday ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          isToday ? 'bg-primary text-white font-black shadow-sm' : 'text-text-muted'
                        }`}>
                          {dayNum}
                        </span>
                        {dayApts.length > 0 && (
                          <span className="text-[10px] text-text-muted font-bold">
                            {dayApts.length} {dayApts.length === 1 ? 'event' : 'events'}
                          </span>
                        )}
                      </div>

                      {/* Event Chips in Cell */}
                      <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                        {dayApts.slice(0, 3).map(apt => {
                          const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;
                          const time = new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div
                              key={apt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openFormForEdit(apt);
                              }}
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border truncate flex items-center gap-1 hover:brightness-110 shadow-2xs ${cfg.bg} ${cfg.border} ${cfg.color}`}
                              title={`${apt.title} (${time})`}
                            >
                              <span className="shrink-0">{time}</span>
                              <span className="text-text-main truncate">{apt.title}</span>
                            </div>
                          );
                        })}
                        {dayApts.length > 3 && (
                          <div className="text-[10px] font-bold text-primary px-1">
                            +{dayApts.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Week View (7-Day Hourly Grid) ─────────────────────────── */}
          {view === 'week' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Day Columns Header */}
              <div
                className="grid border-b border-border/60 bg-surface/80 backdrop-blur-md shrink-0 sticky top-0 z-10"
                style={{ gridTemplateColumns: '70px repeat(7, minmax(140px, 1fr))' }}
              >
                <div className="h-14 border-r border-border/50 flex items-center justify-center text-[10px] font-bold text-text-muted uppercase">
                  Time
                </div>
                {weekDays.map((d, i) => {
                  const dateStr = formatDateKey(d);
                  const isToday = dateStr === todayStr;
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        setCurrentDate(d);
                        setView('day');
                      }}
                      className={`h-14 border-r border-border/50 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover/50 transition-colors ${
                        isToday ? 'bg-primary/5' : ''
                      }`}
                    >
                      <span className={`text-[10px] font-black uppercase tracking-wider ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                        {DAYS[d.getDay()]}
                      </span>
                      <span className={`text-base font-black leading-tight ${isToday ? 'text-primary' : 'text-text-main'}`}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Scrollable Hourly Time Rows */}
              <div className="flex-1 overflow-y-auto overflow-x-auto">
                <div
                  className="grid min-h-[960px] relative"
                  style={{ gridTemplateColumns: '70px repeat(7, minmax(140px, 1fr))' }}
                >
                  {/* Time Label Column */}
                  <div className="border-r border-border/50 bg-surface/20">
                    {HOURS.map(hour => (
                      <div key={hour} className="h-16 border-b border-border/30 text-[10px] font-mono text-text-muted text-center pt-2">
                        {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                      </div>
                    ))}
                  </div>

                  {/* 7 Day Columns */}
                  {weekDays.map((dayObj, dayIdx) => {
                    const dateStr = formatDateKey(dayObj);
                    const dayApts = appointmentsByDate.get(dateStr) || [];
                    const isToday = dateStr === todayStr;

                    return (
                      <div
                        key={dayIdx}
                        className={`border-r border-border/40 relative ${isToday ? 'bg-primary/[0.02]' : ''}`}
                      >
                        {/* Hour slot guidelines */}
                        {HOURS.map(hour => (
                          <div
                            key={hour}
                            onClick={() => openFormForNew(dateStr, `${String(hour).padStart(2, '0')}:00`)}
                            className="h-16 border-b border-border/30 hover:bg-primary/5 transition-colors cursor-pointer"
                          />
                        ))}

                        {/* Rendered Event Blocks */}
                        {dayApts.map(apt => {
                          const s = new Date(apt.startTime);
                          const e = new Date(apt.endTime);
                          const startHour = s.getHours() + s.getMinutes() / 60;
                          const durationHours = Math.max(0.5, (e.getTime() - s.getTime()) / 3600000);

                          // Offset from 7 AM top (64px per hour)
                          const topPx = (startHour - 7) * 64;
                          const heightPx = Math.max(34, durationHours * 64 - 4);
                          const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;

                          if (topPx < 0 || topPx > HOURS.length * 64) return null;

                          return (
                            <div
                              key={apt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openFormForEdit(apt);
                              }}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className={`absolute inset-x-1.5 rounded-xl p-2 border shadow-md flex flex-col justify-between overflow-hidden cursor-pointer hover:scale-[1.01] hover:z-20 transition-all ${cfg.bg} ${cfg.border}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-text-main truncate">{apt.title}</span>
                                <cfg.icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-text-muted mt-1">
                                <span className="font-mono">
                                  {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {apt.contact && (
                                  <span className="font-bold text-text-main truncate max-w-[80px]">
                                    {apt.contact.firstName}
                                  </span>
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

          {/* ── Day View ──────────────────────────────────────────────── */}
          {view === 'day' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Day Timeline */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-lg font-black text-text-main">
                      {FULL_DAYS[currentDate.getDay()]}, {MONTHS[month]} {currentDate.getDate()}, {year}
                    </h2>
                    <p className="text-xs text-text-muted">
                      {(appointmentsByDate.get(formatDateKey(currentDate)) || []).length} scheduled appointments
                    </p>
                  </div>
                  <button
                    onClick={() => openFormForNew(formatDateKey(currentDate))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Appointment
                  </button>
                </div>

                {(appointmentsByDate.get(formatDateKey(currentDate)) || []).length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-border/60 rounded-2xl bg-surface/20">
                    <CalIcon className="w-8 h-8 text-text-muted/40 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-text-main mb-1">No appointments scheduled for this day</h3>
                    <p className="text-xs text-text-muted mb-4">Click below to create an event or use the AI Assistant.</p>
                    <button
                      onClick={() => openFormForNew(formatDateKey(currentDate))}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Book Event
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(appointmentsByDate.get(formatDateKey(currentDate)) || []).map(apt => {
                      const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;
                      const statusCfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled;
                      const s = new Date(apt.startTime);
                      const e = new Date(apt.endTime);

                      return (
                        <div
                          key={apt.id}
                          className="bg-surface border border-border/60 rounded-2xl p-4 shadow-sm hover:border-primary/40 transition-all flex items-start justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5 flex-1">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.border}`}>
                              <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                            </div>
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-text-main">{apt.title}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}>
                                  {statusCfg.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3.5 h-3.5" />
                                  {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {apt.location && (
                                  <a
                                    href={apt.location.startsWith('http') ? apt.location : `https://${apt.location}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <Globe className="w-3.5 h-3.5" /> {apt.location.replace(/^https?:\/\//, '').slice(0, 30)}
                                  </a>
                                )}
                              </div>
                              {apt.description && (
                                <p className="text-xs text-text-muted pt-1 line-clamp-2">{apt.description}</p>
                              )}

                              {/* Linked CRM Contact Card */}
                              {apt.contact && (
                                <div className="mt-2.5 p-2 bg-surface-hover/50 rounded-xl border border-border/50 flex items-center justify-between max-w-md">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                      {apt.contact.firstName?.[0] || 'C'}
                                    </div>
                                    <span className="text-xs font-bold text-text-main">
                                      {apt.contact.firstName} {apt.contact.lastName}
                                    </span>
                                    {apt.contact.companyName && (
                                      <span className="text-[10px] text-text-muted">({apt.contact.companyName})</span>
                                    )}
                                  </div>
                                  {apt.contact.email && (
                                    <a
                                      href={`mailto:${apt.contact.email}`}
                                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                                    >
                                      <Mail className="w-3 h-3" /> {apt.contact.email}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {apt.location && apt.location.startsWith('http') && (
                              <a
                                href={apt.location}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-xl text-xs font-bold hover:bg-teal-500/20 flex items-center gap-1 cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" /> Join Call
                              </a>
                            )}
                            <button
                              onClick={() => updateStatusMutation.mutate({ id: apt.id, status: 'completed' })}
                              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-500/20 cursor-pointer"
                              title="Mark Completed"
                            >
                              ✓ Done
                            </button>
                            <button
                              onClick={() => openFormForEdit(apt)}
                              className="px-3 py-1.5 bg-surface border border-border/60 text-text-main rounded-xl text-xs font-bold hover:bg-surface-hover cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Agenda / List View ────────────────────────────────────── */}
          {view === 'agenda' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-border/60">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by title, contact, location..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-hover/60 border border-border/50 rounded-xl pl-9 pr-4 py-2 text-xs text-text-main focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-surface-hover border border-border/60 text-xs font-bold rounded-xl px-3 py-2 text-text-main focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No Show</option>
                  </select>

                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="bg-surface-hover border border-border/60 text-xs font-bold rounded-xl px-3 py-2 text-text-main focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    <option value="video">Video Calls</option>
                    <option value="call">Phone Calls</option>
                    <option value="meeting">Meetings</option>
                    <option value="demo">Product Demos</option>
                    <option value="consultation">Consultations</option>
                  </select>
                </div>
              </div>

              {/* Agenda List Items */}
              {filteredAppointments.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-border/60 rounded-2xl bg-surface/20">
                  <CalIcon className="w-8 h-8 text-text-muted/40 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-text-main">No matching appointments found</h3>
                  <p className="text-xs text-text-muted mt-1">Try adjusting your filters or create a new event.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAppointments.map(apt => {
                    const cfg = TYPE_CONFIG[apt.type] || TYPE_CONFIG.meeting;
                    const statusCfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled;
                    const s = new Date(apt.startTime);
                    const e = new Date(apt.endTime);
                    const dateFormatted = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

                    return (
                      <div
                        key={apt.id}
                        className="bg-surface border border-border/60 rounded-2xl p-4 shadow-sm hover:border-primary/40 transition-all flex flex-wrap items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-[280px]">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.border}`}>
                            <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-text-main">{apt.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
                              <span>{dateFormatted}</span>
                              <span>•</span>
                              <span>{s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Contact Chip */}
                        <div className="flex items-center gap-2 min-w-[180px]">
                          {apt.contact ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center">
                                {apt.contact.firstName?.[0] || 'C'}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-text-main block leading-tight">
                                  {apt.contact.firstName} {apt.contact.lastName}
                                </span>
                                <span className="text-[10px] text-text-muted block">
                                  {apt.contact.email || apt.contact.phone || 'CRM Contact'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted italic">No linked contact</span>
                          )}
                        </div>

                        {/* Status Dropdown */}
                        <div className="flex items-center gap-2">
                          <select
                            value={apt.status}
                            onChange={e => updateStatusMutation.mutate({ id: apt.id, status: e.target.value })}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border focus:outline-none cursor-pointer ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}
                          >
                            <option value="scheduled" className="bg-surface text-text-main">Scheduled</option>
                            <option value="confirmed" className="bg-surface text-text-main">Confirmed</option>
                            <option value="completed" className="bg-surface text-text-main">Completed</option>
                            <option value="cancelled" className="bg-surface text-text-main">Cancelled</option>
                            <option value="no_show" className="bg-surface text-text-main">No Show</option>
                          </select>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {apt.location && apt.location.startsWith('http') && (
                            <a
                              href={apt.location}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/30 cursor-pointer"
                              title="Join Video Link"
                            >
                              <Video className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => openFormForEdit(apt)}
                            className="px-3 py-1.5 bg-surface border border-border/60 text-xs font-bold text-text-main hover:bg-surface-hover rounded-xl transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(apt)}
                            className="p-2 rounded-xl text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Cancel / Delete"
                          >
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

      {/* ── Event Create / Edit SlidePanel ──────────────────────────────── */}
      <SlidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={form.id ? 'Edit Appointment' : 'Schedule New Appointment'}
        width="lg"
      >
        <form onSubmit={handleSaveForm} className="p-6 space-y-5">
          {/* Title & Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">Event Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Discovery Call with Austin Plumbing"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-surface-hover/60 border border-border/70 rounded-xl text-xs text-text-main font-semibold focus:outline-none focus:border-primary"
            />
          </div>

          {/* Event Type Grid */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">Event Type</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TYPE_CONFIG).map(([tKey, tVal]) => (
                <button
                  type="button"
                  key={tKey}
                  onClick={() => setForm(prev => ({ ...prev, type: tKey }))}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    form.type === tKey
                      ? `${tVal.bg} ${tVal.border} ${tVal.color} ring-1 ring-primary/40`
                      : 'bg-surface border-border/60 text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
                >
                  <tVal.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tVal.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Date *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-hover/60 border border-border/70 rounded-xl text-xs text-text-main font-semibold focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Start Time *</label>
              <input
                type="time"
                required
                value={form.time}
                onChange={e => setForm(prev => ({ ...prev, time: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-hover/60 border border-border/70 rounded-xl text-xs text-text-main font-semibold focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Duration</label>
              <select
                value={form.duration}
                onChange={e => setForm(prev => ({ ...prev, duration: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-surface-hover/60 border border-border/70 rounded-xl text-xs text-text-main font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value={15}>15 mins</option>
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
              </select>
            </div>
          </div>

          {/* CRM Contact Linker */}
          <div className="space-y-2 p-4 bg-surface/40 rounded-2xl border border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> CRM Attendee Contact
              </label>
              {form.contactId && (
                <button
                  type="button"
                  onClick={() => handleSelectContact(null)}
                  className="text-[10px] text-red-400 hover:underline cursor-pointer"
                >
                  Clear Link
                </button>
              )}
            </div>

            {/* Contact Select Dropdown */}
            <select
              value={form.contactId}
              onChange={e => {
                const found = crmContacts.find((c: any) => c.id === e.target.value);
                handleSelectContact(found);
              }}
              className="w-full px-3 py-2 bg-surface border border-border/70 rounded-xl text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="">-- Choose Existing CRM Contact --</option>
              {crmContacts.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.firstName || ''} {c.lastName || ''} {c.companyName ? `(${c.companyName})` : ''} - {c.email || c.phone || 'No email'}
                </option>
              ))}
            </select>

            {/* Inline Contact Details */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <input
                type="text"
                placeholder="Guest Name (e.g. Sarah Jenkins)"
                value={form.contactName}
                onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                className="px-3 py-2 bg-surface border border-border/60 rounded-xl text-xs text-text-main placeholder:text-text-muted"
              />
              <input
                type="email"
                placeholder="Guest Email"
                value={form.contactEmail}
                onChange={e => setForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                className="px-3 py-2 bg-surface border border-border/60 rounded-xl text-xs text-text-main placeholder:text-text-muted"
              />
            </div>
          </div>

          {/* Location & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Meeting Location / Link</label>
              <input
                type="text"
                placeholder="e.g. https://meet.google.com/xyz"
                value={form.location}
                onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3.5 py-2 bg-surface-hover/60 border border-border/70 rounded-xl text-xs text-text-main focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3.5 py-2 bg-surface-hover/60 border border-border/70 rounded-xl text-xs text-text-main font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
          </div>

          {/* Meeting Notes / Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">Meeting Notes & Agenda</label>
            <textarea
              rows={3}
              placeholder="Add agenda items, goals, or preparation notes..."
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-surface-hover/60 border border-border/70 rounded-xl text-xs text-text-main focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60">
            {form.id ? (
              <button
                type="button"
                onClick={() => setDeleteTarget(appointments.find(a => a.id === form.id) || null)}
                className="px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
              >
                Cancel Event
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saveMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {form.id ? 'Save Changes' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </form>
      </SlidePanel>

      {/* ── Public Client Booking Page Simulator Modal ─────────────────── */}
      {publicBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-surface border border-border/80 rounded-3xl w-full max-w-2xl shadow-luxury overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border/60 flex items-center justify-between bg-surface-hover/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-emerald-500 flex items-center justify-center text-white shadow-sm">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-text-main">Client Public Booking Simulator</h2>
                  <p className="text-xs text-text-muted">Live interactive preview of your client scheduling experience</p>
                </div>
              </div>
              <button
                onClick={() => setPublicBookingModalOpen(false)}
                className="p-2 rounded-xl text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Duration selector */}
              <div className="flex gap-2">
                {[15, 30, 45, 60].map(dur => (
                  <button
                    key={dur}
                    onClick={() => setBookingSimDuration(dur)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      bookingSimDuration === dur
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface text-text-muted border-border/60 hover:text-text-main'
                    }`}
                  >
                    {dur} min Sync
                  </button>
                ))}
              </div>

              {/* Date & Slot Picker */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-surface/50 rounded-2xl border border-border/60">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase">1. Pick Date</label>
                  <input
                    type="date"
                    value={bookingSimDate}
                    onChange={e => setBookingSimDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border/70 rounded-xl text-xs text-text-main font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase">2. Select Open Slot</label>
                  {isLoadingSlots ? (
                    <div className="text-xs text-text-muted animate-pulse py-2">Checking availability...</div>
                  ) : (slotData?.availableSlots || []).length === 0 ? (
                    <div className="text-xs text-amber-400 py-2">No open slots on this date</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {(slotData?.availableSlots || []).map((slot: string) => (
                        <button
                          key={slot}
                          onClick={() => setBookingSimSlot(slot)}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                            bookingSimSlot === slot
                              ? 'bg-emerald-500 text-black border-emerald-500 font-black shadow-sm'
                              : 'bg-surface border-border/60 text-text-main hover:border-primary'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Guest Details */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-text-muted uppercase">3. Guest Information</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={bookingSimName}
                    onChange={e => setBookingSimName(e.target.value)}
                    className="px-3.5 py-2 bg-surface border border-border/60 rounded-xl text-xs text-text-main"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={bookingSimEmail}
                    onChange={e => setBookingSimEmail(e.target.value)}
                    className="px-3.5 py-2 bg-surface border border-border/60 rounded-xl text-xs text-text-main"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Notes / Goal for the meeting"
                  value={bookingSimNotes}
                  onChange={e => setBookingSimNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface border border-border/60 rounded-xl text-xs text-text-main"
                />
              </div>
            </div>

            <div className="p-6 border-t border-border/60 flex items-center justify-between bg-surface-hover/30">
              <span className="text-xs text-text-muted">
                {bookingSimSlot ? `Selected: ${bookingSimSlot} on ${bookingSimDate}` : 'Please select a time slot'}
              </span>
              <button
                disabled={!bookingSimSlot || !bookingSimEmail || publicBookMutation.isPending}
                onClick={() => {
                  publicBookMutation.mutate({
                    name: bookingSimName,
                    email: bookingSimEmail,
                    phone: bookingSimPhone,
                    date: bookingSimDate,
                    time: bookingSimSlot,
                    durationMinutes: bookingSimDuration,
                    type: bookingSimType,
                    notes: bookingSimNotes,
                  });
                }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {publicBookMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Public Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Smart Scheduling Assistant Modal ────────────────────────── */}
      {aiAssistantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-surface border border-border/80 rounded-3xl w-full max-w-xl shadow-luxury overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border/60 flex items-center justify-between bg-surface-hover/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-primary flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-text-main">AI Smart Scheduling Assistant</h2>
                  <p className="text-xs text-text-muted">Generate email copy with live open calendar slots in 1 click</p>
                </div>
              </div>
              <button onClick={() => setAiAssistantOpen(false)} className="p-2 rounded-xl text-text-muted hover:text-text-main cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase">Prospect Name</label>
                  <input
                    type="text"
                    value={aiContactName}
                    onChange={e => setAiContactName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border/60 rounded-xl text-xs text-text-main"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase">Call Purpose</label>
                  <input
                    type="text"
                    value={aiPurpose}
                    onChange={e => setAiPurpose(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border/60 rounded-xl text-xs text-text-main"
                  />
                </div>
              </div>

              <button
                disabled={aiSuggestMutation.isPending}
                onClick={() => aiSuggestMutation.mutate()}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-primary hover:opacity-90 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {aiSuggestMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                Scan Calendar & Generate Invite Copy
              </button>

              {aiGeneratedCopy && (
                <div className="space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Generated Email Snippet</label>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(aiGeneratedCopy);
                        toast('success', 'Snippet Copied', 'Paste into your email outreach or CRM chat.');
                      }}
                      className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy Snippet
                    </button>
                  </div>
                  <textarea
                    rows={7}
                    value={aiGeneratedCopy}
                    readOnly
                    className="w-full p-3.5 bg-surface-hover/50 border border-border/60 rounded-2xl text-xs text-text-main font-mono leading-relaxed outline-none resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Modal ─────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">Cancel Appointment</h3>
                <p className="text-xs text-text-muted">This will remove the event and notify participants.</p>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              Are you sure you want to cancel <strong className="text-text-main">"{deleteTarget.title}"</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
              >
                Keep Event
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {deleteMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
