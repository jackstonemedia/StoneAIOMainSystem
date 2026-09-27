import type { Tour } from './types';
import { crmTour } from './crmTour';
import { automationsTour } from './automationsTour';
import { emailMarketingTour } from './emailMarketingTour';
import { conversationsTour } from './conversationsTour';
import { adsTour } from './adsTour';
import { businessTour } from './businessTour';

export const TOURS: Record<string, Tour> = {
  crm: crmTour,
  automations: automationsTour,
  'email-marketing': emailMarketingTour,
  conversations: conversationsTour,
  ads: adsTour,
  business: businessTour,
};

export function getTour(key: string): Tour | undefined {
  return TOURS[key];
}

export function getAllTours(): Tour[] {
  return Object.values(TOURS);
}

export function getTourForRoute(pathname: string): Tour | undefined {
  if (pathname.startsWith('/crm')) return crmTour;
  if (pathname.startsWith('/automations')) return automationsTour;
  if (pathname.startsWith('/email-marketing') || pathname.startsWith('/marketing')) return emailMarketingTour;
  if (pathname.startsWith('/conversations') || pathname.startsWith('/inbox')) return conversationsTour;
  if (pathname.startsWith('/ads')) return adsTour;
  if (pathname.startsWith('/business')) return businessTour;
  return undefined;
}
