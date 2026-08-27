/**
 * ContactAppointmentsTab — Deep CRM Contact Calendar Integration
 * 
 * Synchronized with `/api/business/appointments?contactId=...`
 * Allows viewing upcoming and past meetings, booking new sessions directly for this contact,
 * joining video calls, and managing appointment statuses.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Calendar as CalIcon, Plus, Video, Phone, Users, Clock, Globe,
  X, Check, Trash2, RefreshCw, AlertCircle, Sparkles
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../ui/Toast';
import type { Appointment } from '../../types/business';

interface ContactAppointmentsTabProps {
  contactId: string;
}

const TYPE_ICONS: Record<string, any> = {
  video: Video,
  call: Phone,
  meeting: Users,
  demo: Sparkles,
  consultation: Sparkles,
};

export default function ContactAppointmentsTab({ contactId }: ContactAppointmentsTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Past'>('Upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('Discovery Session');
  const [type, setType] = useState('video');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('https://meet.google.com/new');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('scheduled');

  // Query Appointments for this contact
  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['appointments', 'contact', contactId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/business/appointments?contactId=${contactId}`);
      return data || [];
    },
  });

  // Query contact profile for details
  const { data: contact } = useQuery({
    queryKey: ['crm', 'contact', contactId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/crm/contacts/${contactId}`);
      return data?.contact || data;
    },
  });

  // Create Appointment Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/business/appointments', payload);
      return data;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Appointment Booked', `"${saved.title}" scheduled for ${date} at ${time}`);
      setIsAddOpen(false);
      setTitle('Discovery Session');
      setDescription('');
    },
    onError: (err: any) => {
      toast('error', 'Booking Failed', err?.response?.data?.error || err?.message || 'Could not create appointment');
    },
  });

  // Status Change Mutation
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

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/business/appointments/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Appointment Cancelled', 'The meeting was removed.');
    },
  });

  const nowTime = new Date().getTime();

  // Filtered lists
  const filteredList = useMemo(() => {
    return appointments.filter((apt) => {
      const aptTime = new Date(apt.startTime).getTime();
      const isUpcoming = aptTime >= nowTime;
      const isPast = aptTime < nowTime;

      if (activeTab === 'Upcoming' && !isUpcoming) return false;
      if (activeTab === 'Past' && !isPast) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          apt.title.toLowerCase().includes(q) ||
          (apt.description || '').toLowerCase().includes(q) ||
          (apt.location || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [appointments, activeTab, searchQuery, nowTime]);

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !time) {
      toast('warning', 'Missing fields', 'Please enter a title, date, and start time.');
      return;
    }

    const [h, m] = time.split(':').map(Number);
    const sDate = new Date(date);
    sDate.setHours(h, m, 0, 0);
    const eDate = new Date(sDate.getTime() + duration * 60000);

    createMutation.mutate({
      title,
      type,
      contactId,
      startTime: sDate.toISOString(),
      endTime: eDate.toISOString(),
      location,
      description,
      status,
    });
  };

  return (
    <div className="flex flex-col h-full min-h-[400px] bg-transparent">
      {/* Search & Tab bar */}
      <div className="space-y-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search meetings with this contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-border/50 rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
            />
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Book Session
          </button>
        </div>

        <div className="flex bg-surface border border-border/50 rounded-xl p-0.5">
          {(['Upcoming', 'Past'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-bg text-text-main shadow-sm'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {tab} ({appointments.filter(a => (activeTab === 'Upcoming' ? new Date(a.startTime).getTime() >= nowTime : new Date(a.startTime).getTime() < nowTime)).length})
            </button>
          ))}
        </div>
      </div>

      {/* Appointment List / Empty state */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading schedule...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto min-h-[220px] p-6 border border-dashed border-border/60 rounded-2xl bg-surface/20">
          <div className="w-10 h-10 bg-surface border border-border/50 rounded-xl flex items-center justify-center mb-3 text-text-muted">
            <CalIcon className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-text-main mb-1">No {activeTab.toLowerCase()} appointments</h3>
          <p className="text-xs text-text-muted mb-4 max-w-[240px] leading-relaxed">
            {activeTab === 'Upcoming'
              ? 'Schedule a call or discovery session to keep momentum with this contact.'
              : 'Past meetings with this contact will appear here.'}
          </p>
          {activeTab === 'Upcoming' && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Book Appointment
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredList.map((apt) => {
            const Icon = TYPE_ICONS[apt.type] || Users;
            const s = new Date(apt.startTime);
            const e = new Date(apt.endTime);
            const dateStr = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

            return (
              <div
                key={apt.id}
                className="p-3.5 bg-surface border border-border/60 rounded-2xl shadow-sm hover:border-primary/40 transition-all flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-text-main truncate">{apt.title}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-primary/30 bg-primary/10 text-primary capitalize">
                        {apt.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted font-mono">
                      <span className="flex items-center gap-1">
                        <CalIcon className="w-3 h-3" /> {dateStr}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {timeStr}
                      </span>
                    </div>

                    {apt.location && (
                      <div className="pt-0.5">
                        <a
                          href={apt.location.startsWith('http') ? apt.location : `https://${apt.location}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:underline"
                        >
                          <Globe className="w-3 h-3" /> {apt.location.replace(/^https?:\/\//, '').slice(0, 32)}
                        </a>
                      </div>
                    )}

                    {apt.description && (
                      <p className="text-[11px] text-text-muted pt-1 line-clamp-2">{apt.description}</p>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {apt.status !== 'completed' && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: apt.id, status: 'completed' })}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/20 cursor-pointer"
                      title="Mark Completed"
                    >
                      ✓ Done
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(apt.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Cancel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Book Appointment Modal */}
      <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-surface border border-border/80 rounded-3xl shadow-luxury overflow-hidden flex flex-col max-h-[90vh]">
            <form onSubmit={handleBook} className="flex flex-col h-full">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-surface-hover/30 shrink-0">
                <div>
                  <Dialog.Title className="text-sm font-black text-text-main">
                    Book Appointment with {contact?.firstName || 'Contact'}
                  </Dialog.Title>
                  <p className="text-[11px] text-text-muted">Synchronized with workspace calendar</p>
                </div>
                <Dialog.Close className="text-text-muted hover:text-text-main cursor-pointer p-1">
                  <X className="w-4 h-4" />
                </Dialog.Close>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase">Meeting Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Discovery Call, Strategy Sync"
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border/60 rounded-xl text-xs text-text-main font-semibold focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-muted uppercase">Meeting Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover/50 border border-border/60 rounded-xl text-xs text-text-main font-semibold cursor-pointer"
                    >
                      <option value="video">Video Call (Google Meet/Zoom)</option>
                      <option value="call">Phone Call</option>
                      <option value="meeting">In-Person Meeting</option>
                      <option value="demo">Product Demo</option>
                      <option value="consultation">Consultation</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-muted uppercase">Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-hover/50 border border-border/60 rounded-xl text-xs text-text-main font-semibold cursor-pointer"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-muted uppercase">Date *</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover/50 border border-border/60 rounded-xl text-xs text-text-main font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-muted uppercase">Time *</label>
                    <input
                      type="time"
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover/50 border border-border/60 rounded-xl text-xs text-text-main font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase">Meeting Location / Video Link</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="https://meet.google.com/xyz or Phone number"
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border/60 rounded-xl text-xs text-text-main"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase">Internal Notes & Goals</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add agenda, discussion topics, or preparation notes..."
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border/60 rounded-xl text-xs text-text-main resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border/60 flex items-center justify-end gap-2 bg-surface-hover/30 shrink-0">
                <Dialog.Close className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-text-muted hover:text-text-main cursor-pointer">
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Appointment
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
