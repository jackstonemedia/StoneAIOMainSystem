/**
 * Outreach Scheduler Service — Native Outreach Engine
 *
 * Implements human pacing, business hour enforcement, and multi-day campaign progression:
 * 1. Human jitter pacing (random 90–180 second delays).
 * 2. Sending window checks (9:00 AM – 5:00 PM in workspace timezone, skip weekends).
 * 3. Multi-day batch planner: automatically partitions large lists across multiple days
 *    based on active mailbox capacity (40 sends / day / mailbox).
 */

import { db } from '../../../infrastructure/database/client.js';

export interface SendingWindowConfig {
  startHour?: string; // "09:00"
  endHour?: string;   // "17:00"
  timezone?: string;  // "America/New_York"
  daysOfWeek?: number[]; // [1, 2, 3, 4, 5] (1=Monday, 7=Sunday)
}

export interface DayPartition {
  dayNumber: number;
  scheduledDate: string; // ISO date YYYY-MM-DD
  recipientCount: number;
  recipientIds: string[];
}

export interface MultiDaySchedulePlan {
  totalRecipients: number;
  dailyCapacity: number;
  totalDays: number;
  partitions: DayPartition[];
}

/**
 * Generates a human randomized delay in milliseconds (default: 90–180 seconds).
 */
export function calculateJitterDelayMs(minSeconds: number = 90, maxSeconds: number = 180): number {
  const min = Math.max(1, minSeconds);
  const max = Math.max(min, maxSeconds);
  const seconds = min + Math.random() * (max - min);
  return Math.round(seconds * 1000);
}

/**
 * Checks if the given date/time is within the configured daytime business hours.
 */
export function isWithinSendingWindow(
  date: Date = new Date(),
  config: SendingWindowConfig = {}
): boolean {
  const {
    startHour = '09:00',
    endHour = '17:00',
    timezone = 'America/New_York',
    daysOfWeek = [1, 2, 3, 4, 5], // Mon-Fri
  } = config;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const weekdayStr = parts.find(p => p.type === 'weekday')?.value;
    const hourStr = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minuteStr = parts.find(p => p.type === 'minute')?.value ?? '00';

    const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

    const [startH, startM] = startHour.split(':').map(Number);
    const [endH, endM] = endHour.split(':').map(Number);
    const windowStartMinutes = startH * 60 + (startM || 0);
    const windowEndMinutes = endH * 60 + (endM || 0);

    // Map weekday abbreviation to 1-7 (Mon=1 ... Sun=7)
    const dayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };
    const currentDayNum = weekdayStr ? dayMap[weekdayStr] ?? 1 : 1;

    if (!daysOfWeek.includes(currentDayNum)) {
      return false;
    }

    return currentMinutes >= windowStartMinutes && currentMinutes < windowEndMinutes;
  } catch {
    // If timezone formatting fails, default to true
    return true;
  }
}

/**
 * Computes the next business morning sending window start timestamp.
 */
export function getNextSendingWindowStart(
  date: Date = new Date(),
  config: SendingWindowConfig = {}
): Date {
  const { startHour = '09:00', timezone: _timezone = 'America/New_York' } = config;
  const [startH, startM] = startHour.split(':').map(Number);

  // Advance by 1 day
  const next = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  next.setUTCHours(startH, startM || 0, 0, 0);

  // If Saturday (6), push to Monday (+2 days)
  if (next.getUTCDay() === 6) {
    next.setDate(next.getDate() + 2);
  }
  // If Sunday (0), push to Monday (+1 day)
  else if (next.getUTCDay() === 0) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Plans how an outreach batch is spread across days given total recipients and daily mailbox quota.
 */
export function planCampaignMultiDaySchedule(
  recipientIds: string[],
  dailyCapacity: number,
  startDate: Date = new Date()
): MultiDaySchedulePlan {
  const safeDailyCapacity = Math.max(1, dailyCapacity);
  const totalRecipients = recipientIds.length;
  const totalDays = Math.max(1, Math.ceil(totalRecipients / safeDailyCapacity));
  const partitions: DayPartition[] = [];

  let currentDate = new Date(startDate);

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    // Skip weekends when scheduling forward
    while (currentDate.getUTCDay() === 0 || currentDate.getUTCDay() === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const startIdx = dayIndex * safeDailyCapacity;
    const endIdx = Math.min(startIdx + safeDailyCapacity, totalRecipients);
    const dayRecipientIds = recipientIds.slice(startIdx, endIdx);

    const dateStr = currentDate.toISOString().split('T')[0];

    partitions.push({
      dayNumber: dayIndex + 1,
      scheduledDate: dateStr,
      recipientCount: dayRecipientIds.length,
      recipientIds: dayRecipientIds,
    });

    // Move to next calendar day for next partition
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return {
    totalRecipients,
    dailyCapacity: safeDailyCapacity,
    totalDays,
    partitions,
  };
}

/**
 * Saves multi-day partitions to database for a campaign and schedules recipient rows.
 */
export async function applyCampaignMultiDaySchedule(
  campaignId: string,
  schedulePlan: MultiDaySchedulePlan
): Promise<void> {
  // Update Campaign with multiDayProgress JSON
  await db.campaign.update({
    where: { id: campaignId },
    data: {
      dailyBatchLimit: schedulePlan.dailyCapacity,
      multiDayProgress: {
        totalRecipients: schedulePlan.totalRecipients,
        dailyCapacity: schedulePlan.dailyCapacity,
        totalDays: schedulePlan.totalDays,
        currentDay: 1,
        completedDays: 0,
        partitions: schedulePlan.partitions.map(p => ({
          dayNumber: p.dayNumber,
          scheduledDate: p.scheduledDate,
          recipientCount: p.recipientCount,
          status: p.dayNumber === 1 ? 'PROCESSING' : 'PENDING',
        })),
      },
    },
  });

  // Assign scheduledForDate to CampaignRecipient rows
  for (const partition of schedulePlan.partitions) {
    const scheduledDate = new Date(`${partition.scheduledDate}T09:00:00.000Z`);
    await db.campaignRecipient.updateMany({
      where: {
        campaignId,
        id: { in: partition.recipientIds },
      },
      data: {
        scheduledForDate: scheduledDate,
      },
    });
  }
}
