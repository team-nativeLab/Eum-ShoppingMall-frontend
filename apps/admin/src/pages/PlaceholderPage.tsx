import { NoticeInline } from '@eum/ui/components/NoticeInline';

interface PlaceholderPageProps {
  title: string;
  /** Figma 화면 번호(예: AD-03) */
  screenId: string;
}

/** 아직 구현하지 않은 관리자 화면 자리표시 */
export function PlaceholderPage({ title, screenId }: PlaceholderPageProps) {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="text-h1">
        {title}
      </h1>
      <NoticeInline tone="info" className="mt-24">
        {screenId} 화면은 6단계에서 구현합니다.
      </NoticeInline>
    </section>
  );
}
