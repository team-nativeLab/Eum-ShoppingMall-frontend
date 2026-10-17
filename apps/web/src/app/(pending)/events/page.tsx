import type { Metadata } from 'next';
import { EventsPage } from '@/features/company-pages/events-pages';

export const metadata: Metadata = { title: '이벤트' };

export default function EventsRoute() {
  return <EventsPage />;
}
