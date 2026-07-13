import { useState } from 'react';
import { Search, Calendar, CalendarPlus, X, Plus, Clock, Globe } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export default function ContactAppointmentsTab({ contactId }: { contactId: string }) {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Past'>('Upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Modal Form State
  const [calendarId, setCalendarId] = useState('');
  const [title, setTitle] = useState('');
  const [timezone, setTimezone] = useState('GMT-04:00 America/New_York (EDT)');
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [locationType, setLocationType] = useState('default');

  return (
    <div className="flex flex-col h-full min-h-[400px] bg-transparent">
      {/* Header Search & Tabs */}
      <div className="space-y-3 mb-6 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Calendar Name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border/50 rounded-[6px] pl-9 pr-3 py-1.5 text-[13px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>
        
        <div className="flex bg-surface border border-border/50 rounded-[6px] p-0.5">
          {['Upcoming', 'Past'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 text-[12px] font-semibold py-1.5 rounded-[4px] transition-colors ${
                activeTab === tab 
                  ? 'bg-bg text-text-main shadow-sm' 
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-auto min-h-[50vh]">
        <div className="w-10 h-10 bg-surface border border-border/50 rounded-[10px] flex items-center justify-center mb-4">
          <Calendar className="w-5 h-5 text-text-main" />
        </div>
        <h3 className="text-[14px] font-bold text-text-main mb-1">No appointments yet</h3>
        <p className="text-[13px] text-text-muted mb-4 max-w-[220px] leading-relaxed">
          Keep things moving by creating your first appointment.
        </p>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-1.5 bg-surface border border-border rounded-[6px] text-[12px] font-semibold text-text-main hover:bg-surface-hover transition-colors flex items-center gap-2"
        >
          Add Appointment
        </button>
      </div>

      {/* Book Appointment Modal */}
      <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[100] grid w-full max-w-[800px] h-[90vh] sm:h-auto sm:max-h-[85vh] translate-x-[-50%] translate-y-[-50%] bg-bg border border-border shadow-xl sm:rounded-xl overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <Dialog.Title className="text-[16px] font-bold text-text-main">
                Book appointment
              </Dialog.Title>
              <Dialog.Close className="text-text-muted hover:text-text-main transition-colors">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <div className="flex-1 overflow-y-auto styled-scrollbar flex">
              {/* Left Column - Form */}
              <div className="flex-1 p-6 space-y-6 border-r border-border">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-text-main">Calendar</label>
                  <select 
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    className="w-full bg-surface border border-red-500/50 rounded-[6px] px-3 py-2 text-[13px] text-text-main focus:outline-none focus:border-primary/50"
                  >
                    <option value="" disabled className="text-text-muted">Select a calendar</option>
                  </select>
                  <p className="text-[12px] text-red-500 font-medium">No calendars found in the location.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-text-main">Appointment title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="(eg) Appointment with Bob"
                    className="w-full bg-surface border border-border/50 rounded-[6px] px-3 py-2 text-[13px] text-text-main focus:outline-none focus:border-primary/50"
                  />
                  <button className="text-[13px] font-semibold text-primary hover:text-primary-hover transition-colors">
                    Add description
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-[13px] font-semibold text-text-main">Date & time</label>
                  <div className="bg-surface/50 border border-border/50 rounded-[8px] p-4 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] text-text-muted">Showing slots in this timezone: (Account timezone)</label>
                      <select 
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full bg-surface border border-border/50 rounded-[6px] px-3 py-2 text-[13px] text-text-main focus:outline-none focus:border-primary/50"
                      >
                        <option value="GMT-04:00 America/New_York (EDT)">GMT-04:00 America/New_York (EDT)</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 bg-bg border border-border rounded-[4px] text-[12px] font-semibold text-primary shadow-sm">Default</button>
                      <button className="px-3 py-1.5 bg-transparent border border-transparent rounded-[4px] text-[12px] font-medium text-text-muted hover:bg-surface transition-colors">Custom</button>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[12px] font-medium text-text-main">Date</label>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full bg-surface border border-border/50 rounded-[6px] px-3 py-2 text-[13px] text-text-main focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[12px] font-medium text-text-main">Slot</label>
                        <select
                          value={slot}
                          onChange={(e) => setSlot(e.target.value)}
                          className="w-full bg-surface border border-border/50 rounded-[6px] px-3 py-2 text-[13px] text-text-muted focus:outline-none focus:border-primary/50"
                        >
                          <option value="">Please Select</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[13px] font-semibold text-text-main">Meeting location</label>
                  <div className="flex items-start gap-6">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="locationType" 
                        value="default" 
                        checked={locationType === 'default'}
                        onChange={(e) => setLocationType(e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-text-main">Calendar default</span>
                        <span className="text-[12px] text-text-muted">As configured in the calendar</span>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="locationType" 
                        value="custom" 
                        checked={locationType === 'custom'}
                        onChange={(e) => setLocationType(e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-text-main">Custom</span>
                        <span className="text-[12px] text-text-muted">Set specific to this appointment</span>
                      </div>
                    </label>
                  </div>
                </div>

              </div>

              {/* Right Column - Attendees & Notes */}
              <div className="w-[300px] p-6 space-y-8 bg-surface/10 shrink-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-text-muted border-b border-border/50 pb-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <span className="text-[13px] font-semibold">Attendees</span>
                    <span className="text-[13px] text-text-main font-bold ml-auto">1</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-text-muted">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      Contact
                    </div>
                    
                    <div className="flex items-center justify-between p-2.5 bg-surface border border-border/50 rounded-[6px] group">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-primary">C</span>
                        </div>
                        <span className="text-[13px] font-medium text-text-main">(Example) Casey Morgan</span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-text-muted hover:text-text-main"><Globe className="w-3.5 h-3.5" /></button>
                        <button className="text-text-muted hover:text-text-main"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></button>
                        <button className="text-text-muted hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[13px] font-semibold text-text-main">Internal notes</div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-[6px] text-[12px] font-medium text-text-muted hover:text-text-main transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add internal note
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-bg shrink-0">
              <div className="flex items-center gap-2 text-[13px] font-medium text-text-main">
                Status : 
                <select className="ml-2 bg-surface border border-border rounded-[6px] px-2 py-1 text-[13px] focus:outline-none">
                  <option>Confirmed</option>
                  <option>Tentative</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <Dialog.Close className="px-4 py-2 border border-border rounded-[6px] text-[13px] font-semibold text-text-main hover:bg-surface-hover transition-colors">
                  Cancel
                </Dialog.Close>
                <button 
                  className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-bold hover:bg-primary-hover transition-colors"
                  onClick={() => setIsAddOpen(false)}
                >
                  Book appointment
                </button>
              </div>
            </div>
            
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
