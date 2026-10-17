import type { Metadata } from 'next';
import { EventDetailPage } from '@/features/company-pages/events-pages';

export const metadata: Metadata = { title: '이벤트 상세' };

export default async function EventDetailRoute({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const routeParams = await params;
  return <EventDetailPage eventId={routeParams.eventId} />;
}
