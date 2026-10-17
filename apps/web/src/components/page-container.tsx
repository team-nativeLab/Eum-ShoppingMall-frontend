import { cx } from '@eum/ui/lib/cx';
import type { ReactNode } from 'react';

/**
 * 1296 컨테이너(Figma 1440 프레임 · 좌우 72).
 * 좌우 20 여백을 항상 두고 최대 폭을 1296 + 여백 40으로 잡아, 내용 폭은 최대 1296을 유지합니다.
 * 1440에서는 바깥 여백 52 + 안쪽 20 = 72로 Figma와 같고, 1336보다 좁은 화면에서도 여백이 0이 되지 않습니다.
 * 컨테이너만 가운데 정렬합니다(HANDOFF 7.5).
 */
export function PageContainer({
  children,
  className,
  maxWidth = 'web',
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: 'web' | 'web-detail';
}) {
  const maxWidthClassName =
    maxWidth === 'web-detail' ? 'max-w-[1240px]' : 'max-w-[calc(var(--container-web)+40px)]';

  return <div className={cx('mx-auto w-full px-20', maxWidthClassName, className)}>{children}</div>;
}
