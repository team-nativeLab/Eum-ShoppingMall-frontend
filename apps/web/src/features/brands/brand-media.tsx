import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { ImageIcon } from 'lucide-react';
import type { BrandImageSettings } from '@eum/api/types';

const DEFAULT_LOGO_SETTINGS: BrandImageSettings = { fit: 'contain', width: 240, height: 96 };
const DEFAULT_COVER_SETTINGS: BrandImageSettings = { fit: 'cover', width: 1200, height: 704 };

/**
 * 브랜드 로고 슬롯(Figma HF/BrandLogo). 서버 로고는 영역 안에 contain으로 맞추고,
 * 로고가 없으면 surface 바탕 + 이미지 아이콘 플레이스홀더를 같은 크기로 그립니다. 크기는 className으로 정합니다.
 */
export function BrandLogo({
  logoUrl,
  brandName,
  className,
  settings,
}: {
  logoUrl: string | null;
  brandName: string;
  className?: string;
  settings?: BrandImageSettings;
}) {
  const logoLabel = `${brandName} 로고`;
  const activeSettings = settings ?? DEFAULT_LOGO_SETTINGS;
  return logoUrl ? (
    // 로고 URL은 외부 호스트일 수 있어 Next Image 최적화를 거치지 않습니다(ProductImage와 같은 방식).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={logoLabel}
      loading="lazy"
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

/**
 * 브랜드 밴드 사진. 첫 화면에서 보이므로 eager/high로 요청합니다(기본값, 호출부가 바꾸지 않음).
 * 호출하는 영역이 높이를 예약하며, 실제 이미지 비율은 영역에 맞춰 자릅니다.
 * 장식용이라 alt를 비웁니다(브랜드 이름은 옆 제목이 읽어 줍니다).
 */
export function BrandCover({
  coverImageUrl,
  className,
  settings,
  onError,
}: {
  coverImageUrl: string;
  className?: string;
  settings?: BrandImageSettings;
  /** 이미지 로드 실패 시 호출됩니다. 호출한 쪽이 사진 대신 대체 화면을 정합니다. */
  onError?: () => void;
}) {
  const activeSettings = settings ?? DEFAULT_COVER_SETTINGS;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverImageUrl}
      alt=""
      loading="eager"
      fetchPriority="high"
      decoding="async"
      onError={onError}
      className={cx('size-full object-cover', className)}
      style={{
        maxWidth: `${activeSettings.width}px`,
        maxHeight: `${activeSettings.height}px`,
        objectFit: activeSettings.fit,
      }}
    />
  );
}

/** 브랜드 밴드 보조 줄(영문 표기 · 주력 분야). 둘 다 없으면 null */
export function getBrandSubline(brand: {
  englishName: string | null;
  mainField?: string | null;
}): string | null {
  const sublineParts = [brand.englishName, brand.mainField].filter(
    (sublinePart): sublinePart is string => Boolean(sublinePart?.trim()),
  );
  return sublineParts.length > 0 ? sublineParts.join(' · ') : null;
}
