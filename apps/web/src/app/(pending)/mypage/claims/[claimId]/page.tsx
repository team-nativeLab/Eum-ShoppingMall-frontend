import type { Metadata } from 'next';
import { ClaimDetailPage } from '@/features/mypage/claim-detail-page';

export const metadata: Metadata = { title: '신청 상세' };

export default async function ClaimDetailRoute({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  const routeParams = await params;
  return <ClaimDetailPage claimId={routeParams.claimId} />;
}
