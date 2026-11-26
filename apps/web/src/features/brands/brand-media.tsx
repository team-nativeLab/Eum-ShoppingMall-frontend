import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { ImageIcon } from 'lucide-react';
import type { BrandImageSettings } from '@eum/api/types';

const DEFAULT_LOGO_SETTINGS: BrandImageSettings = { fit: 'contain', width: 240, height: 96 };

/**
 * 브랜드 로고 슬롯(Figma HF/BrandLogo). 서버 로고는 영역 안에 contain으로 맞추고,
 * 로고가 없으면 surface 바탕 + 이미지 아이콘 플레이스홀더를 같은 크기로 그립니다. 크기는 className으로 정합니다.
 */
export function BrandLogo({
  logoUrl,
  brandName,
  className,
  settings,
  loading = 'lazy',
}: {
  logoUrl: string | null;
  brandName: string;
  className?: string;
  settings?: BrandImageSettings;
  /** 첫 화면의 히어로 로고는 eager로 받아 LCP 후보가 늦지 않게 합니다. 목록 타일은 기본 lazy입니다. */
  loading?: 'lazy' | 'eager';
}) {
  const logoLabel = `${brandName} 로고`;
  const activeSettings = settings ?? DEFAULT_LOGO_SETTINGS;
  return logoUrl ? (
    // 로고 URL은 외부 호스트일 수 있어 Next Image 최적화를 거치지 않습니다(ProductImage와 같은 방식).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={logoLabel}
      loading={loading}
      className={cx('shrink-0', className)}
      style={{
        maxWidth: `${activeSettings.width}px`,
        maxHeight: `${activeSettings.height}px`,
        objectFit: activeSettings.fit,
      }}
    />
  ) : (
    <span
      role="img"
      aria-label={logoLabel}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-4 bg-surface text-ph-glyph',
        className,
      )}
    >
      <Icon icon={ImageIcon} size={20} />
    </span>
  );
}
