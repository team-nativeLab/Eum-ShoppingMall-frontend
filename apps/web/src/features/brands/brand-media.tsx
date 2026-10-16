import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { ImageIcon } from 'lucide-react';

/**
 * 브랜드 로고 슬롯(Figma HF/BrandLogo). 서버 로고는 영역 안에 contain으로 맞추고,
 * 로고가 없으면 surface 바탕 + 이미지 아이콘 플레이스홀더를 같은 크기로 그립니다. 크기는 className으로 정합니다.
 */
export function BrandLogo({
  logoUrl,
  brandName,
  className,
}: {
  logoUrl: string | null;
  brandName: string;
  className?: string;
}) {
  const logoLabel = `${brandName} 로고`;
  return logoUrl ? (
    // 로고 URL은 외부 호스트일 수 있어 Next Image 최적화를 거치지 않습니다(ProductImage와 같은 방식).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={logoLabel}
      loading="lazy"
      className={cx('shrink-0 object-contain', className)}
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
 * 브랜드 히어로 사진. 첫 화면에서 보이므로 eager/high로 요청합니다.
 * 호출하는 히어로 영역이 높이를 예약하며, 실제 이미지 비율은 영역에 맞춰 자릅니다.
 * 장식용이라 alt를 비웁니다(브랜드 이름은 옆 제목이 읽어 줍니다).
 */
export function BrandCover({
  coverImageUrl,
  className,
}: {
  coverImageUrl: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverImageUrl}
      alt=""
      loading="eager"
      fetchPriority="high"
      decoding="async"
      className={cx('size-full object-cover', className)}
    />
  );
}

/** 사진이 없는 브랜드의 데스크톱 히어로 오른쪽 로고 패널(Figma Media=NoPhoto). 왼쪽 로고와 겹치므로 장식으로 숨깁니다. */
export function BrandLogoPanel({
  logoUrl,
  brandName,
}: {
  logoUrl: string | null;
  brandName: string;
}) {
  return (
    <div aria-hidden="true" className="flex size-full items-center justify-center bg-pressed-dark">
      <div className="flex h-96 w-240 items-center justify-center rounded-8 bg-inverse">
        <BrandLogo logoUrl={logoUrl} brandName={brandName} className="h-64 w-180" />
      </div>
    </div>
  );
}

/** 히어로 보조 줄(영문 표기 · 주력 분야). 둘 다 없으면 null */
export function getBrandSubline(brand: {
  englishName: string | null;
  mainField?: string | null;
}): string | null {
  const sublineParts = [brand.englishName, brand.mainField].filter(
    (sublinePart): sublinePart is string => Boolean(sublinePart?.trim()),
  );
  return sublineParts.length > 0 ? sublineParts.join(' · ') : null;
}
