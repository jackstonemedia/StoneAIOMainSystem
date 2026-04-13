import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, Mail, MessageSquare, Calendar, Video, Inbox,
  PhoneCall, PhoneOff, Mic, MicOff, Pause, Play,
  Send, Bold, Italic, Link2, Paperclip, ChevronDown,
  Clock, Check, CheckCheck, Image, Plus, X, ExternalLink,
  RefreshCw, Settings, Users, Search, Archive, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'calls' | 'email' | 'sms' | 'meetings' | 'video' | 'inbox';

// ── VoIP Dialpad ──────────────────────────────────────────────
type CallState = 'idle' | 'dialing' | 'connected' | 'ended';

function VoIPDialpad() {
  const [number, setNumber] = useState('');
  const [callState, setCallState] = useState<CallState>('idle');
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const CALL_LOG = [
    { id: '1', name: 'Alex Johnson', number: '+1 555-0101', dir: 'out', duration: '4m 32s', time: '2 hours ago', status: 'answered' },
    { id: '2', name: 'Maria Garcia', number: '+1 555-0102', dir: 'in', duration: '1m 12s', time: 'Yesterday', status: 'answered' },
    { id: '3', name: 'Unknown', number: '+1 555-9999', dir: 'in', duration: '—', time: 'Yesterday', status: 'missed' },
    { id: '4', name: 'David Chen', number: '+1 555-0105', dir: 'out', duration: '12m 04s', time: '3 days ago', status: 'answered' },
  ];

  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callState !== 'connected') setDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const dial = (digit: string) => setNumber(n => n + digit);
  const startCall = () => { if (!number.trim()) return; setCallState('dialing'); setTimeout(() => setCallState('connected'), 1800); };
  const endCall = () => { setCallState('ended'); setTimeout(() => { setCallState('idle'); setNumber(''); setMuted(false); setHeld(false); }, 1200); };

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex gap-6 h-full">
      {/* Dialpad */}
      <div className="w-[300px] shrink-0">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-[14px] font-bold text-slate-800 mb-4">Soft Phone</h2>
          {/* Display */}
          <div className="bg-slate-900 rounded-xl px-4 py-3 mb-4 min-h-[52px] flex items-center justify-between">
            <span className="text-[18px] font-mono font-bold text-white tracking-widest">{number || <span className="text-slate-500 text-[14px]">Enter number</span>}</span>
            {number && <button onClick={() => setNumber(n => n.slice(0, -1))} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>}
          </div>

          {/* Call state */}
          {callState !== 'idle' && (
            <div className={`mb-4 rounded-xl p-3 text-center ${callState === 'dialing' ? 'bg-amber-50 text-amber-700' : callState === 'connected' ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-500'}`}>
              <p className="text-[12px] font-bold uppercase tracking-wider">{callState === 'dialing' ? 'Dialing...' : callState === 'connected' ? 'Connected' : 'Call Ended'}</p>
              {callState === 'connected' && <p className="text-[20px] font-mono font-bold mt-1">{fmtTime(duration)}</p>}
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
              <button key={d} onClick={() => dial(d)} disabled={callState !== 'idle'}
                className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 font-bold text-[16px] text-slate-800 transition-colors disabled:opacity-40 active:scale-95">
                {d}
              </button>
            ))}
          </div>

          {/* Controls */}
          {callState === 'idle' ? (
            <button onClick={startCall} disabled={!number.trim()}
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-40 shadow-sm">
              <PhoneCall className="w-5 h-5" /> Call
            </button>
          ) : callState === 'connected' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMuted(m => !m)}
                  className={`py-2 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-2 transition-colors ${muted ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />} {muted ? 'Unmute' : 'Mute'}
                </button>
                <button onClick={() => setHeld(h => !h)}
                  className={`py-2 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-2 transition-colors ${held ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  {held ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />} {held ? 'Resume' : 'Hold'}
                </button>
              </div>
              <button onClick={endCall} className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                <PhoneOff className="w-5 h-5" /> End Call
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Call log */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-slate-800">Call Log</h2>
          <button className="text-[12px] font-semibold text-[#0073ea] hover:underline">+ Log manual call</button>
        </div>
        <div className="divide-y divide-slate-100">
          {CALL_LOG.map(call => (
            <div key={call.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${call.status === 'missed' ? 'bg-red-50' : call.dir === 'in' ? 'bg-blue-50' : 'bg-green-50'}`}>
                <Phone className={`w-4 h-4 ${call.status === 'missed' ? 'text-red-500' : call.dir === 'in' ? 'text-blue-500' : 'text-green-500'}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[13px] text-slate-800">{call.name}</p>
                <p className="text-[11px] text-slate-400">{call.number} · {call.dir === 'in' ? '↙ Inbound' : '↗ Outbound'}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold text-slate-600">{call.duration}</p>
                <p className="text-[11px] text-slate-400">{call.time}</p>
              </div>
              {call.status === 'missed' && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Missed</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Email Composer ─────────────────────────────────────────────
function EmailTab() {
  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [connected, setConnected] = useState<string[]>([]);

  const THREADS = [
    { id: '1', from: 'Alex Johnson', email: 'alex@acme.com', subject: 'Re: Proposal Review', preview: 'Thanks for sending over the deck. I reviewed it with the team...', time: '2h ago', read: false, tracking: { opens: 3, clicks: 1 } },
    { id: '2', from: 'Maria Garcia', email: 'maria@techflow.io', subject: 'Meeting follow-up', preview: 'Great call yesterday! I wanted to circle back on the pricing...', time: 'Yesterday', read: true, tracking: { opens: 1, clicks: 0 } },
    { id: '3', from: 'James Lee', email: 'james@orbit.dev', subject: 'Contract questions', preview: 'Hi, I had a couple of questions about the SLA terms in section 4...', time: '3d ago', read: true, tracking: { opens: 5, clicks: 3 } },
  ];

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar */}
      <div className="w-[280px] shrink-0 flex flex-col gap-4">
        {/* Sync cards */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-[13px] font-bold text-slate-700 mb-3">Email Sync</h2>
          {[{ name: 'Gmail', color: 'bg-red-500', icon: '✉' }, { name: 'Outlook', color: 'bg-blue-500', icon: '📧' }].map(provider => {
            const isConnected = connected.includes(provider.name);
            return (
              <div key={provider.name} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg ${provider.color} flex items-center justify-center text-white text-[12px]`}>{provider.icon}</div>
                  <div>
                    <p className="text-[12px] font-semibold text-slate-700">{provider.name}</p>
                    <p className="text-[10px] text-slate-400">{isConnected ? 'Synced 2 min ago' : 'Not connected'}</p>
                  </div>
                </div>
                <button onClick={() => setConnected(prev => isConnected ? prev.filter(p => p !== provider.name) : [...prev, provider.name])}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${isConnected ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600' : 'bg-[#e5f0ff] text-[#0073ea] hover:bg-[#0073ea] hover:text-white'}`}>
                  {isConnected ? 'Connected' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
        <button onClick={() => setComposing(true)} className="w-full py-2.5 bg-[#0073ea] hover:bg-[#0060c2] text-white font-bold text-[13px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Compose Email
        </button>
      </div>

      {/* Email list */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-slate-800">Inbox Threads</h2>
          <button className="text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {THREADS.map(thread => (
            <div key={thread.id} className={`flex gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${!thread.read ? 'bg-[#f0f7ff]' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0073ea] to-[#a25ddc] flex items-center justify-center text-white font-bold text-[13px] shrink-0">
                {thread.from[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[13px] ${!thread.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{thread.from}</span>
                  <span className="text-[11px] text-slate-400">{thread.time}</span>
                </div>
                <p className={`text-[12px] ${!thread.read ? 'font-semibold text-slate-800' : 'text-slate-600'} truncate`}>{thread.subject}</p>
                <p className="text-[11px] text-slate-400 truncate">{thread.preview}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> {thread.tracking.opens} opens
                  </span>
                  {thread.tracking.clicks > 0 && <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded">{thread.tracking.clicks} clicks</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compose modal */}
      <AnimatePresence>
        {composing && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 z-40" onClick={() => setComposing(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed bottom-0 right-8 w-[520px] bg-white border border-slate-200 rounded-t-2xl shadow-2xl z-50">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-800 rounded-t-2xl">
                <h3 className="text-[13px] font-bold text-white">New Email</h3>
                <button onClick={() => setComposing(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 space-y-3">
                <input value={to} onChange={e => setTo(e.target.value)} placeholder="To: email@company.com"
                  className="w-full px-3 py-2 border-b border-slate-200 text-[13px] text-slate-800 focus:outline-none placeholder:text-slate-400" />
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
                  className="w-full px-3 py-2 border-b border-slate-200 text-[13px] text-slate-800 focus:outline-none font-medium placeholder:text-slate-400" />
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={7} placeholder="Write your message..."
                  className="w-full px-3 py-2 text-[13px] text-slate-700 focus:outline-none resize-none placeholder:text-slate-400 leading-relaxed" />
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400">
                    <button className="hover:text-slate-700 transition-colors"><Bold className="w-4 h-4" /></button>
                    <button className="hover:text-slate-700 transition-colors"><Italic className="w-4 h-4" /></button>
                    <button className="hover:text-slate-700 transition-colors"><Link2 className="w-4 h-4" /></button>
                    <button className="hover:text-slate-700 transition-colors"><Paperclip className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => { setComposing(false); setTo(''); setSubject(''); setBody(''); }}
                    className="flex items-center gap-2 px-5 py-2 bg-[#0073ea] text-white text-[13px] font-semibold rounded-xl hover:bg-[#0060c2] transition-colors shadow-sm">
                    <Send className="w-4 h-4" /> Send
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── SMS Tab ────────────────────────────────────────────────────
function SMSTab() {
  const [threads] = useState([
    { id: '1', name: 'Alex Johnson', number: '+1 555-0101', messages: [{ dir: 'out', text: 'Hi Alex, just wanted to check in on the proposal.', time: '10:32 AM' }, { dir: 'in', text: "Thanks! I'll review it today and get back to you.", time: '10:45 AM' }] },
    { id: '2', name: 'Maria Garcia', number: '+1 555-0102', messages: [{ dir: 'out', text: 'Maria, great talking yesterday! Do you have time Thursday?', time: 'Yesterday' }] },
  ]);
  const [activeThread, setActiveThread] = useState(threads[0]);
  const [msg, setMsg] = useState('');

  return (
    <div className="flex h-full gap-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Thread list */}
      <div className="w-[240px] shrink-0 border-r border-slate-100">
        <div className="px-4 py-3 border-b border-slate-100"><h2 className="font-bold text-[13px] text-slate-800">SMS Conversations</h2></div>
        <div className="divide-y divide-slate-100">
          {threads.map(t => (
            <button key={t.id} onClick={() => setActiveThread(t)}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${activeThread.id === t.id ? 'bg-[#e5f0ff]' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0073ea] to-[#a25ddc] flex items-center justify-center text-white font-bold text-[12px] mb-1">{t.name[0]}</div>
              <p className="font-semibold text-[12px] text-slate-800">{t.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{t.messages[t.messages.length - 1]?.text}</p>
            </button>
          ))}
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 flex flex-col">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0073ea] to-[#a25ddc] flex items-center justify-center text-white font-bold text-[13px]">{activeThread.name[0]}</div>
          <div><p className="font-bold text-[13px] text-slate-800">{activeThread.name}</p><p className="text-[11px] text-slate-400">{activeThread.number}</p></div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {activeThread.messages.map((m, i) => (
            <div key={i} className={`flex ${m.dir === 'out' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-[13px] ${m.dir === 'out' ? 'bg-[#0073ea] text-white rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-bl-md'}`}>
                <p>{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.dir === 'out' ? 'text-white/70' : 'text-slate-400'} text-right`}>{m.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex items-end gap-3">
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={1} placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0073ea]/30 resize-none" />
          <button onClick={() => setMsg('')} className="p-2.5 bg-[#0073ea] text-white rounded-xl hover:bg-[#0060c2] transition-colors shadow-sm">
            <Send className="w-4 h-4" />
          </button>
          <button className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"><Image className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

// ── Meeting Scheduler ──────────────────────────────────────────
function MeetingSchedulerTab() {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const HOURS = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
  const [availability, setAvailability] = useState<Set<string>>(new Set(['Mon-9:00 AM', 'Mon-10:00 AM', 'Tue-2:00 PM', 'Wed-11:00 AM', 'Thu-3:00 PM', 'Fri-10:00 AM', 'Fri-11:00 AM']));
  const [duration, setDuration] = useState(30);
  const [meetingName, setMeetingName] = useState('30-Minute Intro Call');
  const [linkCopied, setLinkCopied] = useState(false);
  const bookingLink = `https://book.stone-aio.com/u/you/${duration}min`;

  const toggleSlot = (slot: string) => setAvailability(prev => { const s = new Set(prev); s.has(slot) ? s.delete(slot) : s.add(slot); return s; });

  const copyLink = () => { navigator.clipboard?.writeText(bookingLink).catch(() => {}); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };

  const UPCOMING = [
    { name: 'Alex Johnson', type: '30-min call', time: 'Tomorrow, 2:00 PM', avatar: 'A' },
    { name: 'David Chen', type: '60-min demo', time: 'Fri, Apr 12 · 11:00 AM', avatar: 'D' },
  ];

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 space-y-5">
        {/* Settings */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-[14px] font-bold text-slate-800 mb-4">Meeting Settings</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Meeting Name</label>
              <input value={meetingName} onChange={e => setMeetingName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0073ea]/30" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Duration</label>
              <div className="flex gap-2">
                {[15, 30, 60].map(d => (
                  <button key={d} onClick={() => setDuration(d)}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-colors ${duration === d ? 'bg-[#0073ea] text-white border-[#0073ea]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {d}m
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Booking link */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="flex-1 text-[12px] text-slate-600 font-mono truncate">{bookingLink}</span>
            <button onClick={copyLink} className={`text-[12px] font-bold px-3 py-1 rounded-lg transition-colors ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-[#0073ea] text-white hover:bg-[#0060c2]'}`}>
              {linkCopied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Availability grid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-[14px] font-bold text-slate-800 mb-4">Availability <span className="text-[12px] font-normal text-slate-400">— click to toggle</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-[90px]" />
                  {DAYS.map(d => <th key={d} className="text-[11px] font-bold text-slate-500 pb-2">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour}>
                    <td className="text-[11px] text-slate-400 pr-3 py-0.5 text-right whitespace-nowrap">{hour}</td>
                    {DAYS.map(day => {
                      const slot = `${day}-${hour}`;
                      const on = availability.has(slot);
                      return (
                        <td key={day} className="px-0.5 py-0.5">
                          <button onClick={() => toggleSlot(slot)}
                            className={`w-full h-8 rounded-lg transition-all border ${on ? 'bg-[#0073ea] border-[#0073ea] shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-200 hover:bg-slate-100'}`} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Upcoming meetings */}
      <div className="w-[260px] shrink-0">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-[14px] font-bold text-slate-800 mb-4">Upcoming Meetings</h2>
          {UPCOMING.length === 0 ? (
            <p className="text-[12px] text-slate-400 italic text-center py-4">No upcoming meetings</p>
          ) : UPCOMING.map((m, i) => (
            <div key={i} className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0073ea] to-[#a25ddc] flex items-center justify-center text-white font-bold text-[13px] shrink-0">{m.avatar}</div>
              <div>
                <p className="font-semibold text-[12px] text-slate-800">{m.name}</p>
                <p className="text-[11px] text-[#0073ea] font-medium">{m.type}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{m.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Video Tab ──────────────────────────────────────────────────
function VideoTab() {
  const platforms = [
    { name: 'Zoom', logo: '🎥', action: 'Start Zoom Call', link: 'https://zoom.us/start' },
    { name: 'Google Meet', logo: '🟢', action: 'Start Google Meet', link: 'https://meet.google.com/new' },
    { name: 'Teams', logo: '🟣', action: 'Start Teams Call', link: 'https://teams.microsoft.com' },
  ];
  const RECENT = [
    { contact: 'Alex Johnson', platform: 'Zoom', duration: '45 min', date: 'Yesterday', notes: 'Covered Q2 roadmap. Next: send contract.' },
    { contact: 'David Chen', platform: 'Google Meet', duration: '30 min', date: '3 days ago', notes: 'Demo session. Very positive.' },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {platforms.map(p => (
          <a key={p.name} href={p.link} target="_blank" rel="noopener noreferrer"
            className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-3 hover:border-[#0073ea]/40 hover:shadow-md transition-all shadow-sm">
            <span className="text-3xl">{p.logo}</span>
            <span className="font-bold text-[14px] text-slate-800">{p.name}</span>
            <span className="flex items-center gap-1.5 px-4 py-2 bg-[#0073ea] text-white rounded-xl text-[12px] font-semibold">
              <ExternalLink className="w-3.5 h-3.5" /> {p.action}
            </span>
          </a>
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-bold text-[14px] text-slate-800">Recent Video Calls</h2></div>
        <div className="divide-y divide-slate-100">
          {RECENT.map((r, i) => (
            <div key={i} className="px-6 py-4 flex gap-4">
              <Video className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-[13px] text-slate-800">{r.contact}</span>
                  <span className="text-[11px] text-slate-400">via {r.platform}</span>
                </div>
                <p className="text-[12px] text-slate-500">{r.notes}</p>
                <p className="text-[11px] text-slate-400 mt-1">{r.duration} · {r.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared Inbox ───────────────────────────────────────────────
function SharedInboxTab() {
  const THREADS = [
    { id: '1', source: 'email', from: 'alex@acme.com', subject: 'Contract question', preview: 'Hi, can you clarify the SLA terms?', time: '10m ago', assignee: null, unread: true },
    { id: '2', source: 'sms', from: '+1 555-0102', subject: 'SMS from Maria Garcia', preview: 'Just checking if Thursday still works?', time: '1h ago', assignee: 'You', unread: false },
    { id: '3', source: 'form', from: 'Lead Form', subject: 'New lead: contact page', preview: 'Name: Tom Park · Email: tom@startup.io · Message: Interested in your CRM...', time: '2h ago', assignee: null, unread: true },
    { id: '4', source: 'email', from: 'james@orbit.dev', subject: 'Renewal discussion', preview: 'We are happy with the platform and want to talk renewal...', time: 'Yesterday', assignee: 'Sarah', unread: false },
  ];
  const SOURCE_ICONS: Record<string, any> = { email: Mail, sms: MessageSquare, form: Inbox };
  const SOURCE_COLORS: Record<string, string> = { email: 'bg-blue-50 text-blue-500', sms: 'bg-green-50 text-green-500', form: 'bg-purple-50 text-purple-500' };
  const TEAM = ['You', 'Sarah', 'Mike', 'Unassigned'];
  const [assignees, setAssignees] = useState<Record<string, string>>({});

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-bold text-[14px] text-slate-800">Shared Inbox</h2>
        <div className="flex items-center gap-2 text-slate-400">
          <Search className="w-4 h-4" /><Archive className="w-4 h-4" /><Tag className="w-4 h-4" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {THREADS.map(t => {
          const Icon = SOURCE_ICONS[t.source] || Mail;
          return (
            <div key={t.id} className={`flex gap-4 px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer ${t.unread ? 'bg-[#f0f7ff]' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${SOURCE_COLORS[t.source]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[13px] ${t.unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{t.from}</span>
                  <span className="text-[11px] text-slate-400">{t.time}</span>
                </div>
                <p className={`text-[12px] truncate ${t.unread ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{t.subject}</p>
                <p className="text-[11px] text-slate-400 truncate">{t.preview}</p>
              </div>
              <div>
                <select value={assignees[t.id] || t.assignee || ''} onChange={e => setAssignees(prev => ({ ...prev, [t.id]: e.target.value }))}
                  className="text-[11px] font-semibold border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0073ea]/30 bg-white">
                  <option value="">Assign...</option>
                  {TEAM.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Communications Page ───────────────────────────────────
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'calls', label: 'Calls', icon: Phone },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'meetings', label: 'Meetings', icon: Calendar },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'inbox', label: 'Shared Inbox', icon: Inbox },
];

export default function Communications() {
  const [activeTab, setActiveTab] = useState<Tab>(() => (localStorage.getItem('crm_comm_tab') as Tab) || 'calls');
  const setTab = (t: Tab) => { setActiveTab(t); localStorage.setItem('crm_comm_tab', t); };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc]">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0">
        <div>
          <h1 className="text-[20px] font-bold text-slate-800 tracking-tight">Communications</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Calls, email, SMS, meetings, video, and shared inbox — all in one place.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-[13px] hover:bg-slate-50 transition-colors">
          <Settings className="w-4 h-4 text-slate-400" /> Settings
        </button>
      </header>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-8 py-3 bg-white border-b border-slate-100 shrink-0 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap ${activeTab === id ? 'bg-[#0073ea] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full">
            {activeTab === 'calls' && <VoIPDialpad />}
            {activeTab === 'email' && <EmailTab />}
            {activeTab === 'sms' && <SMSTab />}
            {activeTab === 'meetings' && <MeetingSchedulerTab />}
            {activeTab === 'video' && <VideoTab />}
            {activeTab === 'inbox' && <SharedInboxTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
