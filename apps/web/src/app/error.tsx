'use client';

import { Button } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';

/** App Router 경계에서 화면 오류를 안내하고 재요청할 수 있게 합니다. */
export default function AppErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      className="mx-auto w-full max-w-[760px] px-20 py-80"
      aria-labelledby="route-error-title"
    >
      <h1 id="route-error-title" className="text-h2">
        페이지를 불러오지 못했습니다
      </h1>
      <p className="mt-8 text-body-s text-text-2">잠시 후 다시 시도해 주세요.</p>
      <NoticeInline tone="danger" className="mt-20" role="alert">
        요청 중 문제가 발생했습니다.
      </NoticeInline>
      <Button className="mt-20" onClick={reset}>
        다시 시도
      </Button>
    </section>
  );
}
