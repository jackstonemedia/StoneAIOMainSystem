import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, Video, Phone, Users, Clock, Calendar as CalIcon, X, MapPin
} from 'lucide-react';
import { SlidePanel } from '../../components/ui/SlidePanel';
import { useToast } from '../../components/ui/Toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOURS  = Array.from({length:10},(_,i)=>i+8); // 8am–5pm

const typeConfig: Record<string,{icon:any;color:string;bg:string}> = {
  call:    {icon:Phone, color:'text-blue-400',   bg:'bg-blue-400/10   border-blue-400/30'},
  meeting: {icon:Users, color:'text-purple-400', bg:'bg-purple-400/10 border-purple-400/30'},
  video:   {icon:Video, color:'text-teal-400',   bg:'bg-teal-400/10   border-teal-400/30'},
};

function getCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Get start of the iso-date-only string for today */
function today() { return new Date().toISOString().split('T')[0]; }

export default function Calendar() {
  const { toast } = useToast();
  const now = new Date();
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [view, setView]           = useState<'month'|'week'>('week');
  const [newOpen, setNewOpen]     = useState(false);
  const [form, setForm]           = useState({ title:'', type:'call', date:'', time:'09:00', duration:60, attendee:'', location:'' });

  const { data: apts = [] } = useQuery<any[]>({
    queryKey: ['appointments'],
    queryFn: () => fetch('/api/business/appointments').then(r => r.ok ? r.json() : []),
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
    const ds = d.toISOString().split('T')[0];
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
    toast('success', 'Appointment created', `${form.title} scheduled for ${form.date}`);
    setNewOpen(false);
    setForm({ title:'', type:'call', date:'', time:'09:00', duration:60, attendee:'', location:'' });
  };

  return (
    <div className="h-full flex overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col bg-surface/50 overflow-y-auto">
        {/* Mini calendar */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"><ChevronLeft className="w-4 h-4"/></button>
            <span className="text-sm font-semibold">{MONTHS[viewMonth].slice(0,3)} {viewYear}</span>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"><ChevronRight className="w-4 h-4"/></button>
          </div>
          <div className="grid grid-cols-7 gap-0">
            {['S','M','T','W','T','F','S'].map((d,i)=>(
              <div key={i} className="text-center text-[10px] font-semibold text-text-muted py-1">{d}</div>
            ))}
            {grid.map((day, idx) => {
              const dateStr = day ? `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
              const isToday = dateStr === todayStr;
              return (
                <button key={idx} disabled={!day} className={`h-7 w-7 mx-auto text-xs rounded-full flex items-center justify-center transition-colors ${!day?'':'hover:bg-surface-hover'} ${isToday?'bg-primary text-white font-bold':'text-text-muted'}`}>
                  {day || ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Today's events */}
        <div className="p-4 flex-1">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Today</div>
          {aptsForDay(now).length === 0 ? (
            <p className="text-xs text-text-muted">No events today</p>
          ) : aptsForDay(now).map((apt: any) => {
            const cfg = typeConfig[apt.type] || typeConfig.meeting;
            const time = new Date(apt.startTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            return (
              <div key={apt.id} className={`mb-2 p-2.5 rounded-xl border ${cfg.bg} bg-opacity-50`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <cfg.icon className={`w-3 h-3 ${cfg.color}`} />
                  <span className="text-xs font-semibold text-text-main truncate">{apt.title}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-text-muted">
                  <Clock className="w-2.5 h-2.5" />{time}
                  {apt.contact?.name && <span>· {apt.contact.name}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Booking link */}
        <div className="p-4 border-t border-border">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <div className="text-xs font-semibold text-primary mb-1">Booking Link</div>
            <div className="text-[10px] text-text-muted font-mono mb-2">stone.aio/book/jack</div>
            <button
              onClick={() => { navigator.clipboard?.writeText('https://stone.aio/book/jack'); toast('success','Copied!','Booking link copied to clipboard'); }}
              className="w-full py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg hover:bg-primary/20 transition-colors"
            >
              Copy Link
            </button>
          </div>
        </div>
      </aside>

      {/* Main calendar area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-border px-6 flex items-center justify-between shrink-0 bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button className="btn-primary py-2 px-4 text-sm" onClick={() => setNewOpen(true)}>
              <Plus className="w-4 h-4" /> New Event
            </button>
            <div className="flex bg-surface border border-border rounded-lg p-0.5">
              {(['week','month'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${view===v?'bg-bg text-primary border border-border shadow-sm':'text-text-muted hover:text-text-main'}`}>{v}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-border hover:border-primary/30 text-text-muted hover:text-text-main transition-colors"><ChevronLeft className="w-4 h-4"/></button>
            <span className="text-sm font-semibold min-w-[150px] text-center">{MONTHS[now.getMonth()]} {now.getFullYear()}</span>
            <button className="p-2 rounded-lg border border-border hover:border-primary/30 text-text-muted hover:text-text-main transition-colors"><ChevronRight className="w-4 h-4"/></button>
            <button onClick={() => {}} className="px-3 py-1.5 text-xs font-semibold border border-primary/30 text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors">Today</button>
          </div>
        </div>

        {/* Week view */}
        <div className="flex-1 overflow-auto">
          {/* Day header */}
          <div className="grid sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-border" style={{gridTemplateColumns:'64px repeat(5,1fr)'}}>
            <div className="h-14 border-r border-border" />
            {weekDays.map((d, i) => {
              const isToday = d.toISOString().split('T')[0] === todayStr;
              return (
                <div key={i} className={`h-14 border-r border-border flex flex-col items-center justify-center ${isToday?'bg-primary/5':''}`}>
                  <span className="text-[10px] font-semibold text-text-muted uppercase">{DAYS[d.getDay()]}</span>
                  <span className={`text-lg font-bold mt-0.5 ${isToday?'text-primary':''}`}>{d.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid relative" style={{gridTemplateColumns:'64px repeat(5,1fr)'}}>
            {/* Time labels */}
            <div className="border-r border-border">
              {HOURS.map(h => (
                <div key={h} style={{height:64}} className="border-b border-border/50 flex items-start justify-end pr-3 pt-1">
                  <span className="text-[10px] text-text-muted">{h === 12 ? '12pm' : h > 12 ? `${h-12}pm` : `${h}am`}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((d, di) => {
              const dayApts = aptsForDay(d);
              const isToday = d.toISOString().split('T')[0] === todayStr;
              return (
                <div key={di} className={`border-r border-border relative ${isToday?'bg-primary/[0.02]':''}`} style={{height: HOURS.length * 64}}>
                  {HOURS.map(h => <div key={h} style={{height:64}} className="border-b border-border/30" />)}
                  {dayApts.map((apt: any) => {
                    const cfg = typeConfig[apt.type] || typeConfig.meeting;
                    const top = hourPx(apt.startTime);
                    const height = durationPx(apt.startTime, apt.endTime);
                    const time = new Date(apt.startTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
                    return (
                      <div key={apt.id} className={`absolute left-1 right-1 rounded-lg border px-2 py-1 cursor-pointer hover:opacity-90 transition-opacity ${cfg.bg}`}
                        style={{top:`${top}px`, height:`${height}px`, overflow:'hidden'}}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <cfg.icon className={`w-2.5 h-2.5 ${cfg.color} shrink-0`} />
                          <span className={`text-[10px] font-bold ${cfg.color} truncate`}>{apt.title}</span>
                        </div>
                        <p className="text-[9px] text-text-muted leading-tight">{time}{apt.contact?.name ? ` · ${apt.contact.name}` : ''}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Event Panel */}
      <SlidePanel open={newOpen} onClose={() => setNewOpen(false)} title="New Event" subtitle="Schedule a call, meeting, or appointment"
        actions={<>
          <button className="btn-secondary text-sm py-2 px-4" onClick={() => setNewOpen(false)}>Cancel</button>
          <button className="btn-primary text-sm py-2 px-4" onClick={handleCreate}>Create Event</button>
        </>}
      >
        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Title *</label>
            <input className="input-luxury" placeholder="e.g. Discovery Call with Acme"
              value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['call','meeting','video'] as const).map(t => {
                const cfg = typeConfig[t];
                return (
                  <button key={t} onClick={() => setForm(f=>({...f,type:t}))}
                    className={`p-3 rounded-xl border text-center transition-all ${form.type===t?`${cfg.bg} border-current`:'border-border hover:border-primary/30'}`}>
                    <cfg.icon className={`w-4 h-4 mx-auto mb-1 ${form.type===t?cfg.color:'text-text-muted'}`} />
                    <span className={`text-xs font-semibold capitalize ${form.type===t?cfg.color:'text-text-muted'}`}>{t}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Date *</label>
              <input type="date" className="input-luxury" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Time</label>
              <input type="time" className="input-luxury" value={form.time} onChange={e => setForm(f=>({...f,time:e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Duration</label>
            <select className="input-luxury" value={form.duration} onChange={e => setForm(f=>({...f,duration:+e.target.value}))}>
              {[15,30,45,60,90,120].map(d=><option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Attendee</label>
            <input className="input-luxury" placeholder="Contact name or email"
              value={form.attendee} onChange={e => setForm(f=>({...f,attendee:e.target.value}))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Location / Link</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input className="input-luxury pl-9" placeholder="Zoom link, address, or phone"
                value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} />
            </div>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}
