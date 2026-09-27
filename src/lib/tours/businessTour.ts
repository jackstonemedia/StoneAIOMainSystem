import type { Tour } from './types';

export const businessTour: Tour = {
  key: 'business',
  title: 'Business Hub & Calendar',
  description: 'Configure your company profile, booking schedules, team, and integrations.',
  section: 'Business',
  iconName: 'Building2',
  badge: 'Settings',
  steps: [
    {
      id: 'business-schedule-view',
      target: '[data-tour="business-schedule-view"]',
      title: 'Calendar & Bookings Schedule',
      body: 'Manage your appointments, sync with Google/Outlook calendars, and view upcoming client sessions.',
      placement: 'bottom',
      route: '/business/calendar',
    },
    {
      id: 'business-booking-links',
      target: '[data-tour="business-booking-links"]',
      title: 'Custom Booking Links',
      body: 'Create shareable booking links with automated reminder emails, buffer times, and payment collection.',
      placement: 'bottom',
      route: '/business/calendar',
    },
    {
      id: 'business-availability-tab',
      target: '[data-tour="business-availability-tab"]',
      title: 'Weekly Availability Rules',
      body: 'Set working hours, recurring blackout periods, and custom timezone preferences for your booking pages.',
      placement: 'bottom',
      route: '/business/calendar',
    },
    {
      id: 'business-calendar-settings',
      target: '[data-tour="business-calendar-settings"]',
      title: 'Calendar Sync & Integrations',
      body: 'Configure 2-way calendar sync, reminder templates, and automated CRM deal updates upon appointment completion.',
      placement: 'bottom',
      route: '/business/calendar',
    },
  ],
};
