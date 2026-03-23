import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, Users, Plus, ChevronLeft, ChevronRight, 
  MapPin, Video, Phone, CheckCircle2, MoreHorizontal
} from 'lucide-react';

export default function Calendar() {
  const [view, setView] = useState<'month' | 'week' | 'day'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const mockAppointments = [
    { id: 1, title: 'Discovery Call with Acme Corp', time: '10:00 AM - 10:45 AM', type: 'video', status: 'confirmed' },
    { id: 2, title: 'Product Demo - Jane Doe', time: '1:30 PM - 2:00 PM', type: 'video', status: 'confirmed' },
    { id: 3, title: 'Follow-up Call', time: '3:00 PM - 3:15 PM', type: 'phone', status: 'pending' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-bg font-sans overflow-hidden">
      
      {/* Header */}
      <header className="px-8 py-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">Calendar & Booking</h1>
            <p className="text-sm text-text-muted mt-1">Manage your schedule and share appointment booking links.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-sm font-medium text-text-main border border-border rounded-lg bg-bg hover:bg-surface-hover transition-colors">
              View Booking Page
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-all shadow-md">
              <Plus className="w-5 h-5" />
              New Appointment
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Mini Calendar & Integrations */}
        <div className="w-72 border-r border-border bg-surface flex flex-col p-6 overflow-y-auto shrink-0">
          
          {/* Mini Calendar (Static Mock) */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-text-main">October 2023</h3>
              <div className="flex gap-1">
                <button className="p-1 hover:bg-surface-hover rounded"><ChevronLeft className="w-4 h-4 text-text-muted" /></button>
                <button className="p-1 hover:bg-surface-hover rounded"><ChevronRight className="w-4 h-4 text-text-muted" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              <span className="text-text-muted font-medium">S</span>
              <span className="text-text-muted font-medium">M</span>
              <span className="text-text-muted font-medium">T</span>
              <span className="text-text-muted font-medium">W</span>
              <span className="text-text-muted font-medium">T</span>
              <span className="text-text-muted font-medium">F</span>
              <span className="text-text-muted font-medium">S</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {Array.from({ length: 31 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`p-1.5 rounded-full cursor-pointer flex items-center justify-center ${
                    i === 14 ? 'bg-primary text-white font-medium shadow-sm' 
                    : 'text-text-main hover:bg-bg'
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          <hr className="border-border my-6" />

          {/* Calendars List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-text-main uppercase tracking-wider">My Calendars</h3>
              <button className="p-1 text-text-muted hover:text-primary transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
            
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" defaultChecked className="rounded border-border text-primary focus:ring-primary/20 bg-bg" />
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm text-text-main group-hover:text-primary transition-colors">Discovery Calls</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" defaultChecked className="rounded border-border text-primary focus:ring-primary/20 bg-bg" />
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                <span className="text-sm text-text-main group-hover:text-primary transition-colors">Product Demos</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" defaultChecked className="rounded border-border text-primary focus:ring-primary/20 bg-bg" />
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-sm text-text-main group-hover:text-primary transition-colors">Personal Events</span>
              </label>
            </div>
          </div>

          <hr className="border-border my-6" />

          {/* Integrations Status */}
          <div className="bg-bg border border-border rounded-xl p-4">
            <h3 className="font-semibold text-sm text-text-main mb-3">Sync Status</h3>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-text-muted">Google Calendar connected</span>
            </div>
            <button className="text-xs text-primary font-medium hover:underline mt-1">Manage Connections</button>
          </div>

        </div>

        {/* Right Area: Large Calendar View */}
        <div className="flex-1 flex flex-col bg-bg overflow-hidden relative">
          
          {/* Calendar Toolbar */}
          <div className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 bg-surface/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-text-main">Oct 15 - 21, 2023</h2>
              <div className="flex gap-1">
                <button className="p-1.5 border border-border bg-surface rounded-md hover:bg-bg transition-colors"><ChevronLeft className="w-4 h-4 text-text-muted" /></button>
                <button className="p-1.5 border border-border bg-surface rounded-md hover:bg-bg transition-colors text-sm font-medium px-3 text-text-main tracking-tight">Today</button>
                <button className="p-1.5 border border-border bg-surface rounded-md hover:bg-bg transition-colors"><ChevronRight className="w-4 h-4 text-text-muted" /></button>
              </div>
            </div>

            <div className="flex bg-surface p-1 rounded-lg border border-border">
              {(['day', 'week', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                    view === v 
                      ? 'bg-bg text-primary shadow-sm border border-border' 
                      : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Grid (Week View Mock) */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex min-h-[800px] relative">
              {/* Time axis */}
              <div className="w-16 flex flex-col pt-[40px] border-r border-border shrink-0 bg-bg z-20">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-16 text-xs text-text-muted font-medium text-right pr-3 -mt-2">
                    {i + 8 === 12 ? '12:00 PM' : `${(i + 8) % 12 || 12}:00 ${i + 8 >= 12 ? 'PM' : 'AM'}`}
                  </div>
                ))}
              </div>

              {/* Days Columns & Grid */}
              <div className="flex-1 flex relative">
                
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-0 pt-[40px] pointer-events-none flex flex-col z-0">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-16 border-t border-border/60 w-full" />
                  ))}
                </div>

                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => (
                  <div key={day} className="flex-1 border-r border-border relative z-10">
                    <div className="h-[40px] border-b border-border flex flex-col items-center justify-center bg-surface sticky top-0 z-30 shadow-sm">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{day}</span>
                        <span className={`text-sm font-bold ${i === 2 ? 'w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center' : 'text-text-main'}`}>
                          {15 + i}
                        </span>
                      </div>
                    </div>
                    
                    {/* Mock Events (Only on Wed for demonstration) */}
                    {i === 2 && (
                      <div className="relative w-full h-full pt-[40px]">
                        {/* 10:00 AM Event (starts at 2 hours down = 2 * 64 = 128px) */}
                        <div className="absolute top-[128px] left-2 right-2 h-[48px] bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 overflow-hidden shadow-sm hover:ring-2 ring-blue-500/50 cursor-pointer transition-all hover:bg-blue-500/20 z-20">
                          <div className="w-1 h-full bg-blue-500 absolute left-0 top-0 rounded-l-lg"></div>
                          <h4 className="text-xs font-semibold text-blue-500/90 truncate pl-1">Discovery Call with Acme Corp</h4>
                          <p className="text-[10px] text-blue-500/70 pl-1 mt-0.5 font-medium">10:00 AM - 10:45 AM</p>
                        </div>

                        {/* 1:30 PM Event (13.5 hours on timeline. 13.5 - 8 = 5.5 hours down = 5.5 * 64 = 352px) */}
                        <div className="absolute top-[352px] left-2 right-2 h-[32px] bg-purple-500/10 border border-purple-500/30 rounded-lg p-1.5 overflow-hidden shadow-sm hover:ring-2 ring-purple-500/50 cursor-pointer transition-all hover:bg-purple-500/20 z-20">
                          <div className="w-1 h-full bg-purple-500 absolute left-0 top-0 rounded-l-lg"></div>
                          <h4 className="text-[11px] font-semibold text-purple-500/90 truncate pl-1">Product Demo - Jane Doe</h4>
                        </div>
                      </div>
                    )}
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
