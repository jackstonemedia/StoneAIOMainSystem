import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Plus, Video, Phone, Users, Clock, Calendar as CalIcon, X, MapPin, Trash2, AlertCircle, RefreshCw, Edit2
} from 'lucide-react';
import { SlidePanel } from '../../components/ui/SlidePanel';
import { useToast } from '../../components/ui/Toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOURS  = Array.from({length:10},(_,i)=>i+8); // 8am–5pm

const typeConfig: Record<string,{icon:any;color:string;bg:string}> = {
  call:    {icon:Phone, color:'text-text-muted', bg:'bg-primary/10 border-primary/30'},
  meeting: {icon:Users, color:'text-primary',    bg:'bg-primary/20 border-primary/50'},
  video:   {icon:Video, color:'text-teal-400',   bg:'bg-teal-400/10 border-teal-400/30'},
};

function getCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function today() { return new Date().toLocaleString('en-CA',{timeZoneName:'short'}).split(' ')[0]; }

function ConfirmDelete({ title, onConfirm, onClose, loading }: { title: string; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.15 }}
        className="relative z-10 bg-surface border border-border rounded-[14px] shadow-2xl w-[400px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-[8px] bg-red-400/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-text-main">Cancel Appointment</h3>
            <p className="text-[12px] text-text-muted">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-[13px] text-text-muted mb-6">Are you sure you want to cancel <strong className="text-text-main">"{title}"</strong>?</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-[7px] border border-border text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">Go Back</button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 rounded-[7px] bg-red-500 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Calendar() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [view, setView]           = useState<'month'|'week'>('week');
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm]           = useState({ id: '', title:'', type:'call', date:'', time:'09:00', duration:60, attendee:'', location:'' });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: apts = [], isLoading } = useQuery<any[]>({
    queryKey: ['appointments'],
    queryFn: () => fetch('/api/business/appointments').then(r => r.ok ? r.json() : []),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/business/appointments/${data.id}` : '/api/business/appointments';
      const method = data.id ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', form.id ? 'Appointment updated' : 'Appointment created', `${form.title} scheduled for ${form.date}`);
      setPanelOpen(false);
    },
    onError: () => toast('error', 'Failed to save appointment'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/business/appointments/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      toast('success', 'Appointment cancelled');
      setDeleteTarget(null);
      setPanelOpen(false);
    },
    onError: () => toast('error', 'Failed to cancel'),
  });

  /* ── Week view helpers ── */
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  const weekDays = Array.from({length:5},(_,i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate()+i);
    return d;
  });

  function aptsForDay(d: Date) {
    const ds = d.toLocaleString('en-CA',{timeZoneName:'short'}).split(' ')[0];
    return apts.filter((a:any) => a.startTime?.startsWith(ds));
  }

  function hourPx(iso: string) {
    const d = new Date(iso);
    return (d.getHours() - 8 + d.getMinutes()/60) * 64; // 64px/hour
  }
  function durationPx(start: string, end: string) {
    return Math.max(32, (new Date(end).getTime()-new Date(start).getTime())/3600000*64);
  }

  /* ── Month mini-calendar ── */
  const grid = getCalendarGrid(viewYear, viewMonth);
  const todayStr = today();
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y=>y-1); } else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y=>y+1); } else setViewMonth(m=>m+1); };

  const handleCreate = () => {
    if (!form.title.trim() || !form.date) { toast('warning', 'Please fill in title and date'); return; }
    const startTime = new Date(`${form.date}T${form.time}:00`);
    const endTime   = new Date(startTime.getTime() + form.duration * 60000);
    saveMutation.mutate({
      id: form.id || undefined,
      title: form.title,
      type: form.type,
      location: form.location || null,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: 'scheduled',
    });
  };

  const openForm = (apt?: any, slotDate?: string, slotTime?: string) => {
    if (apt) {
      const d = new Date(apt.startTime);
      const e = new Date(apt.endTime);
      setForm({
        id: apt.id,
        title: apt.title,
        type: apt.type,
        date: d.toLocaleString('en-CA',{timeZoneName:'short'}).split(' ')[0],
        time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
        duration: Math.round((e.getTime() - d.getTime()) / 60000),
        attendee: apt.contact?.name || '',
        location: apt.location || '',
      });
    } else {
      setForm({
        id: '',
        title: '',
        type: 'call',
        date: slotDate || todayStr,
        time: slotTime || '09:00',
        duration: 60,
        attendee: '',
        location: '',
      });
    }
    setPanelOpen(true);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 border-r border-border flex flex-col bg-surface/50 overflow-y-auto">
        {/* Mini calendar */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"><ChevronLeft className="w-4 h-4"/></button>
            <span className="text-[13px] font-bold text-text-main">{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"><ChevronRight className="w-4 h-4"/></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['S','M','T','W','T','F','S'].map((d,i)=>(
              <div key={i} className="text-center text-[10px] font-bold text-text-muted mb-2">{d}</div>
            ))}
            {grid.map((day, idx) => {
              const dateStr = day ? `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
              const isToday = dateStr === todayStr;
              return (
                <button key={idx} disabled={!day} className={`h-7 w-7 mx-auto text-[11px] font-medium rounded-full flex items-center justify-center transition-all ${!day?'':'hover:bg-surface-hover hover:text-text-main'} ${isToday?'bg-primary text-white font-bold':'text-text-muted'}`}>
                  {day || ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Today's events */}
        <div className="p-5 flex-1">
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 text-left">Today</div>
          {aptsForDay(now).length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-border rounded-xl">
              <CalIcon className="w-6 h-6 text-text-muted/50 mb-2" />
              <p className="text-[12px] font-medium text-text-muted">No events today</p>
            </div>
          ) : aptsForDay(now).map((apt: any) => {
            const cfg = typeConfig[apt.type] || typeConfig.meeting;
            const time = new Date(apt.startTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            return (
              <div key={apt.id} onClick={() => openForm(apt)} className={`mb-3 p-3 rounded-[10px] border cursor-pointer hover:opacity-90 card-hover-lift ${cfg.bg}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-bold text-text-main truncate pr-2">{apt.title}</span>
                  <cfg.icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-[11px] font-medium text-text-muted">
                  <Clock className="w-3 h-3 text-text-muted/70" />{time}
                </div>
              </div>
            );
          })}
        </div>

        {/* Booking link */}
        <div className="p-5 border-t border-border">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-[12px] font-bold text-text-main mb-1">Booking Link</div>
            <div className="text-[11px] text-text-muted font-mono mb-3 bg-bg px-2 py-1.5 rounded-md border border-border truncate">stone.aio/book/jack</div>
            <button
              onClick={() => { navigator.clipboard?.writeText('https://stone.aio/book/jack'); toast('success','Copied!','Booking link copied to clipboard'); }}
              className="w-full py-2 bg-surface-hover border border-border text-text-main text-[12px] font-bold rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
            >
              Copy Link
            </button>
          </div>
        </div>
      </aside>

      {/* Main calendar area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface-hover/20">
        {/* Header */}
        <div className="h-[72px] border-b border-border px-8 flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20" onClick={() => openForm()}>
              <Plus className="w-4 h-4" /> New Event
            </button>
            <div className="flex gap-1.5 bg-bg border border-border rounded-[8px] p-1">
              {(['week','month'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 rounded-[5px] text-[12px] font-semibold capitalize transition-all ${view===v?'bg-surface text-primary border border-border shadow-sm':'text-text-muted hover:text-text-main'}`}>{v}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => {}} className="px-4 py-1.5 text-[13px] font-bold border border-border text-text-main bg-surface rounded-[8px] hover:bg-surface-hover hover:border-primary/40 transition-colors">Today</button>
            <div className="flex items-center gap-1 ml-2">
              <button className="p-1.5 rounded-[6px] border border-border bg-surface hover:bg-surface-hover hover:border-primary/40 text-text-muted hover:text-text-main transition-colors"><ChevronLeft className="w-4 h-4"/></button>
              <button className="p-1.5 rounded-[6px] border border-border bg-surface hover:bg-surface-hover hover:border-primary/40 text-text-muted hover:text-text-main transition-colors"><ChevronRight className="w-4 h-4"/></button>
            </div>
            <span className="text-[15px] font-bold min-w-[150px] text-right text-text-main tracking-tight">{MONTHS[now.getMonth()]} {now.getFullYear()}</span>
          </div>
        </div>

        {/* KPIs bar (New for Business Owners) */}
        <div className="grid grid-cols-4 border-b border-border bg-surface/40 shrink-0">
          {[
            { label: 'Total Appointments', value: apts.length, trend: '+12%' },
            { label: 'Completed', value: apts.filter((a:any) => a.status === 'completed').length, trend: '+5%' },
            { label: 'No Shows', value: '0', trend: '-2%' },
            { label: 'Projected Revenue', value: `$${apts.length * 150}`, trend: '+18%' }
          ].map((kpi, i) => (
            <div key={i} className="p-4 border-r border-border last:border-r-0 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">{kpi.label}</span>
              <div className="flex items-end gap-2">
                <span className="text-[18px] font-black text-text-main">{kpi.value}</span>
                <span className="text-[12px] font-bold text-emerald-400 mb-0.5">{kpi.trend}</span>
              </div>
            </div>
          ))}
        </div>

        {/* View Grid */}
        <div className="flex-1 overflow-auto flex flex-col">
          {view === 'week' ? (
            <>
              {/* Day header */}
              <div className="grid sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-border shadow-sm shrink-0" style={{gridTemplateColumns:'80px repeat(5,minmax(180px,1fr))'}}>
                <div className="h-16 border-r border-border" />
                {weekDays.map((d, i) => {
                  const dateStr = d.toLocaleString('en-CA',{timeZoneName:'short'}).split(' ')[0];
                  const isToday = dateStr === todayStr;
                  return (
                    <div key={i} className={`h-16 border-r border-border flex flex-col items-center justify-center ${isToday?'bg-primary/5':''}`}>
                      <span className={`text-[12px] font-bold uppercase tracking-wider ${isToday?'text-primary':'text-text-muted'}`}>{DAYS[d.getDay()]}</span>
                      <span className={`text-[18px] font-bold mt-0.5 ${isToday?'text-primary':'text-text-main'}`}>{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className="grid relative" style={{gridTemplateColumns:'80px repeat(5,minmax(180px,1fr))'}}>
                {/* Time labels */}
                <div className="border-r border-border bg-surface/30">
                  {HOURS.map(h => (
                    <div key={h} style={{height:64}} className="border-b border-border/50 flex items-start justify-end pr-4 pt-1.5">
                      <span className="text-[11px] font-semibold text-text-muted">{h === 12 ? '12 PM' : h > 12 ? `${h-12} PM` : `${h} AM`}</span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((d, di) => {
                  const dateStr = d.toLocaleString('en-CA',{timeZoneName:'short'}).split(' ')[0];
                  const dayApts = aptsForDay(d);
                  const isToday = dateStr === todayStr;
                  return (
                    <div key={di} className={`border-r border-border relative ${isToday?'bg-primary/[0.02]':''}`} style={{height: HOURS.length * 64}}>
                      {HOURS.map(h => (
                        <div key={h} style={{height:64}} className="border-b border-border/30 hover:bg-surface-hover/20 cursor-pointer transition-colors"
                          onClick={() => openForm(null, dateStr, `${String(h).padStart(2,'0')}:00`)} />
                      ))}
                      {dayApts.map((apt: any) => {
                        const cfg = typeConfig[apt.type] || typeConfig.meeting;
                        const top = hourPx(apt.startTime);
                        const height = durationPx(apt.startTime, apt.endTime);
                        const time = new Date(apt.startTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
                        return (
                          <motion.div key={apt.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            onClick={(e) => { e.stopPropagation(); openForm(apt); }}
                            className={`absolute left-1.5 right-1.5 rounded-[8px] border p-2 cursor-pointer transition-all hover:z-10 shadow-sm ${cfg.bg}`}
                            style={{top:`${top}px`, height:`${height}px`, overflow:'hidden'}}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[12px] font-bold ${cfg.color} truncate`}>{apt.title}</span>
                              <cfg.icon className={`w-3.5 h-3.5 ${cfg.color} shrink-0 opacity-80`} />
                            </div>
                            <p className={`text-[10px] font-medium leading-tight ${cfg.color} opacity-80`}>{time}{apt.contact?.name ? ` · ${apt.contact.name}` : ''}</p>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Month View Array */
            <div className="flex-1 flex flex-col border border-border mt-4 mx-6 rounded-xl overflow-hidden mb-6 bg-surface shadow-sm">
              <div className="grid grid-cols-7 border-b border-border bg-surface-hover/50 shrink-0">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="py-2.5 text-center text-[12px] font-bold text-text-muted uppercase tracking-wider">{d}</div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-border gap-[1px]">
                {grid.map((day, idx) => {
                  const dateStr = day ? `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
                  const isToday = dateStr === todayStr;
                  const dayApts = day ? apts.filter((a:any) => a.startTime?.startsWith(dateStr)) : [];
                  return (
                    <div key={idx} className={`bg-surface p-1.5 flex flex-col ${!day ? 'opacity-30 pointer-events-none' : 'hover:bg-surface-hover/20 cursor-pointer'} transition-colors`}
                      onClick={() => day && openForm(null, dateStr, '09:00')}>
                      <div className="flex justify-end p-1">
                        <span className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-white' : 'text-text-main'}`}>
                          {day || ''}
                        </span>
                      </div>
                      <div className="flex-1 flex flex-col gap-1 mt-1 overflow-y-auto px-0.5 styled-scrollbar">
                        {dayApts.map((apt:any, i:number) => {
                          const cfg = typeConfig[apt.type] || typeConfig.meeting;
                          const time = new Date(apt.startTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
                          return (
                            <div key={i} onClick={(e) => { e.stopPropagation(); openForm(apt); }} 
                              className={`text-[10px] font-semibold truncate px-2 py-1 rounded-[4px] border border-border shadow-sm ${cfg.bg} ${cfg.color}`}>
                              {time} · {apt.title}
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
        </div>
      </div>

      {/* Entry Form */}
      <SlidePanel open={panelOpen} onClose={() => setPanelOpen(false)} title={form.id ? "Edit Event" : "New Event"} subtitle="Schedule a call, meeting, or appointment"
        actions={<>
          {form.id && (
            <button className="mr-auto text-text-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 transition-colors"
              onClick={() => setDeleteTarget(form)}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button className="px-4 py-2 border border-border rounded-[7px] text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors" onClick={() => setPanelOpen(false)}>Cancel</button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-[7px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
            onClick={handleCreate} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <CalIcon className="w-3.5 h-3.5"/>}
            {form.id ? 'Save Changes' : 'Create Event'}
          </button>
        </>}
      >
        <div className="p-6 space-y-6">
          <div>
            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Event Title <span className="text-red-400">*</span></label>
            <input className="w-full px-3 py-2 bg-surface border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted/50" placeholder="e.g. Discovery Call with Acme"
              value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Event Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['call','meeting','video'] as const).map(t => {
                const cfg = typeConfig[t];
                return (
                  <button key={t} onClick={() => setForm(f=>({...f,type:t}))}
                    className={`p-3 rounded-[8px] border text-center transition-all ${form.type===t?`${cfg.bg} border-current ring-1 ring-primary/20`:'bg-surface border-border hover:border-primary/30'}`}>
                    <cfg.icon className={`w-4 h-4 mx-auto mb-1.5 ${form.type===t?cfg.color:'text-text-muted'}`} />
                    <span className={`text-[12px] font-bold capitalize ${form.type===t?cfg.color:'text-text-muted'}`}>{t}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Date <span className="text-red-400">*</span></label>
              <input type="date" className="w-full px-3 py-2 bg-surface border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Time</label>
              <input type="time" className="w-full px-3 py-2 bg-surface border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" value={form.time} onChange={e => setForm(f=>({...f,time:e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Duration</label>
            <select className="w-full px-3 py-2 bg-surface border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" value={form.duration} onChange={e => setForm(f=>({...f,duration:+e.target.value}))}>
              {[15,30,45,60,90,120].map(d=><option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
          <hr className="border-border" />
          <div>
             <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Attendee Contact</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted/50" placeholder="Search contacts..."
                value={form.attendee} onChange={e => setForm(f=>({...f,attendee:e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Location or Link</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted/50" placeholder="Zoom link, office address..."
                value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} />
            </div>
          </div>
        </div>
      </SlidePanel>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDelete
            title={deleteTarget.title}
            onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
            onClose={() => setDeleteTarget(null)}
            loading={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
