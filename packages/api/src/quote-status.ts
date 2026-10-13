import type { QuoteStatus } from './types';

/** 견적 상태 배지 톤. Web W-25와 Admin AD-06이 같은 규칙을 씁니다. */
export type QuoteStatusTone = 'dark' | 'warning' | 'outline' | 'success' | 'neutral';

/** 견적 상태별 표시 문구와 배지 톤 */
export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; tone: QuoteStatusTone }> = {
  received: { label: '접수', tone: 'dark' },
  consulting: { label: '상담중', tone: 'warning' },
  quoteSent: { label: '견적 발송', tone: 'outline' },
  completed: { label: '완료', tone: 'success' },
  canceled: { label: '취소', tone: 'neutral' },
};
