/**
 * Public Booking Page — Stone AIO
 *
 * Standalone, unauthenticated scheduling interface for prospective clients and leads.
 * Allows picking appointment duration, selecting a date and time slot, entering contact info,
 * and receiving instant calendar invites (.ics, Google Calendar, Outlook).
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Mail,
  Phone,
  CheckCircle2,
  CalendarPlus,
  Download,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface BookingInfo {
  workspaceId: string;
  workspaceName: string;
  slug: string;
  bookingTitle: string;
  bookingDescription: string;
  availableDurations: number[];
  defaultDuration: number;
}

interface BookingConfirmation {
  success: boolean;
  appointment: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    status: string;
  };
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  icsUrl?: string;
}

export default function PublicBookingPage() {
  const { slug = 'default' } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();

  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    // Default to tomorrow if today is late afternoon
    if (today.getHours() >= 17) {
      today.setDate(today.getDate() + 1);
    }
    return today.toISOString().split('T')[0];
  });

  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState<boolean>(true);

  // Form fields
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>(searchParams.get('email') || '');
  const [phone, setPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null);

  // 1. Fetch workspace booking info
  useEffect(() => {
    async function fetchInfo() {
      setIsLoadingInfo(true);
      try {
        const res = await fetch(`/api/public/calendar/booking-info/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error('Failed to load scheduling page');
        const data = await res.json();
        setBookingInfo(data);
        if (data.defaultDuration) {
          setSelectedDuration(data.defaultDuration);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load booking information.');
      } finally {
        setIsLoadingInfo(false);
      }
    }
    fetchInfo();
  }, [slug]);

  // 2. Fetch available slots for the selected date & duration
  useEffect(() => {
    if (!bookingInfo || !selectedDate) return;

    let isCancelled = false;
    async function fetchSlots() {
      setIsLoadingSlots(true);
      setSelectedSlot(null);
      setErrorMessage(null);
      try {
        const url = `/api/public/calendar/slots/${encodeURIComponent(slug)}?date=${selectedDate}&durationMinutes=${selectedDuration}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Could not fetch available slots');
        const data = await res.json();
        if (!isCancelled) {
          setSlots(data.availableSlots || []);
        }
      } catch {
        if (!isCancelled) {
          setSlots([]);
        }
      } finally {
        if (!isCancelled) setIsLoadingSlots(false);
      }
    }

    fetchSlots();
    return () => {
      isCancelled = true;
    };
  }, [bookingInfo, selectedDate, selectedDuration, slug]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !selectedDate) {
      setErrorMessage('Please pick an available date and time slot.');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid work email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/public/calendar/book/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          date: selectedDate,
          time: selectedSlot,
          durationMinutes: selectedDuration,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete booking');
      }

      setBookingConfirmation(data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred while booking. Please try another slot.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    const today = new Date();
    if (year === today.getFullYear() && month <= today.getMonth()) return;
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const formatSlotDisplay = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  };

  // Google Calendar Link generator
  const getGoogleCalendarUrl = () => {
    if (!bookingConfirmation?.appointment) return '#';
    const { title, startTime, endTime } = bookingConfirmation.appointment;
    const s = new Date(startTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const e = new Date(endTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const details = encodeURIComponent('Confirmed discovery meeting with Stone AIO.');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${s}/${e}&details=${details}&location=Online+Video+Meeting`;
  };

  // Outlook Calendar Link generator
  const getOutlookCalendarUrl = () => {
    if (!bookingConfirmation?.appointment) return '#';
    const { title, startTime, endTime } = bookingConfirmation.appointment;
    const s = encodeURIComponent(new Date(startTime).toISOString());
    const e = encodeURIComponent(new Date(endTime).toISOString());
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent('Confirmed discovery meeting with Stone AIO.');
    return `https://outlook.office.com/calendar/0/deeplink/compose?subject=${subject}&startdt=${s}&enddt=${e}&body=${body}&location=Online+Meeting`;
  };

  if (isLoadingInfo) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400 font-medium">Loading scheduling calendar...</p>
        </div>
      </div>
    );
  }

  // ── Success State ──────────────────────────────────────────────────────────
  if (bookingConfirmation) {
    const appt = bookingConfirmation.appointment;
    const dateFormatted = new Date(appt.startTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = new Date(appt.startTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="text-xs uppercase tracking-widest font-bold text-blue-400 mb-2">Booking Confirmed</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">You're on the calendar!</h1>
            <p className="text-slate-400 text-sm max-w-md mb-8">
              A calendar invitation has been reserved for <strong className="text-slate-200">{name}</strong> ({email}).
            </p>

            <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 mb-8 text-left space-y-3">
              <div className="flex items-center gap-3 text-slate-200 text-sm">
                <CalendarIcon className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-semibold">{dateFormatted}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200 text-sm">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{timeFormatted} ({appt.durationMinutes} minutes)</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200 text-sm">
                <User className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{bookingInfo?.workspaceName || 'Stone AIO'}</span>
              </div>
            </div>

            <div className="w-full space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all hover:scale-[1.01]"
                >
                  <CalendarPlus className="w-4 h-4 text-blue-400" />
                  Add to Google Calendar
                </a>
                <a
                  href={getOutlookCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all hover:scale-[1.01]"
                >
                  <CalendarPlus className="w-4 h-4 text-sky-400" />
                  Add to Outlook
                </a>
              </div>

              {bookingConfirmation.icsUrl && (
                <a
                  href={bookingConfirmation.icsUrl}
                  download
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4" />
                  Download .ics Calendar Invite
                </a>
              )}
            </div>

            <button
              onClick={() => {
                setBookingConfirmation(null);
                setSelectedSlot(null);
              }}
              className="mt-8 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              &larr; Book another session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Scheduling Interface ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10 selection:bg-blue-600 selection:text-white">
      <main className="max-w-5xl mx-auto w-full my-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Column: Meeting Details & Duration */}
          <div className="lg:col-span-5 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between bg-slate-900/50">
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md">
                  S
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">{bookingInfo?.workspaceName || 'Stone AIO'}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Available to book
                  </div>
                </div>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight">
                {bookingInfo?.bookingTitle || 'Discovery Session'}
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                {bookingInfo?.bookingDescription || 'Choose a time below to connect with our team.'}
              </p>

              {/* Duration Selector */}
              <div className="space-y-2 mb-6">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Meeting Length
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(bookingInfo?.availableDurations || [15, 30, 45, 60]).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setSelectedDuration(dur)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                        selectedDuration === dur
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>{selectedDuration} Minutes Strategy Call</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Video Conference Details Provided Upon Booking</span>
                </div>
              </div>
            </div>

            <div className="pt-8 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Powered by <strong>Stone AIO</strong></span>
              <span>UTC Scheduling Engine</span>
            </div>
          </div>

          {/* Right Column: Date Picker, Slots, and Guest Form */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!selectedSlot ? (
              <div className="space-y-6">
                {/* Month header & navigation */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-400" />
                    {monthNames[month]} {year}
                  </h2>
                  <div className="flex items-center gap-1 bg-slate-950 rounded-xl p-1 border border-slate-800">
                    <button
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextMonth}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Day grid */}
                <div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 mb-2 uppercase">
                    <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-9" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNumber = i + 1;
                      const dayDate = new Date(year, month, dayNumber);
                      const isPast = dayDate < new Date(new Date().setHours(0, 0, 0, 0));
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                      const isSelected = selectedDate === dateStr;

                      return (
                        <button
                          key={dayNumber}
                          type="button"
                          disabled={isPast}
                          onClick={() => setSelectedDate(dateStr)}
                          className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 ring-2 ring-blue-400'
                              : isPast
                              ? 'text-slate-600 cursor-not-allowed opacity-40'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white bg-slate-950/40'
                          }`}
                        >
                          {dayNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Available Slots */}
                <div className="pt-4 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-300">
                      Available Slots for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {slots.length} available
                    </span>
                  </div>

                  {isLoadingSlots ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-8 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-4">
                      <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-slate-400 font-medium">No open slots on this date.</p>
                      <p className="text-[11px] text-slate-500 mt-1">Please select another day on the calendar.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                      {slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 hover:border-blue-500 hover:text-blue-400 transition-all text-slate-300 flex items-center justify-center gap-1.5 group"
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                          {formatSlotDisplay(slot)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Contact details step once slot is selected */
              <form onSubmit={handleBookingSubmit} className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedSlot(null)}
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    &larr; Change time slot
                  </button>
                  <div className="text-right text-xs">
                    <span className="text-slate-400">Selected: </span>
                    <strong className="text-white">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {formatSlotDisplay(selectedSlot)}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Your Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Work Email <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="jane@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    What would you like to discuss?
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Briefly tell us about your project or questions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reserving Your Session...
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
