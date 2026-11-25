import type { BrandImageSettings, BrandSummary } from '@eum/api/types';
import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Ref } from 'react';
import { PageContainer } from '@/components/page-container';
import { buildBrandProductsHref } from '@/features/products/product-navigation';
import { getBrandBandTone, resolveBrandAccentColor } from './brand-accent';
import { BrandLogo, getBrandSubline } from './brand-media';
import { useBrandQuery } from './use-brand-query';

const SPOTLIGHT_TITLE_ID = 'brand-spotlight-title';

// 히어로 로고 박스는 목록 타일(120×48)보다 큽니다. 데스크톱 최대 320×160에 맞추고, 모바일은 기본 240×96 박스입니다.
// 박스는 사진 열 폭(w-full)을 넘지 않고, 높이·최대 폭은 모바일 240×96, 데스크톱 320×160입니다.
const HERO_LOGO_BOX_CLASS_NAME =
  'flex h-96 w-full max-w-240 items-center justify-center lg:h-160 lg:max-w-320';
const HERO_LOGO_MAX_SETTINGS_WIDTH = 320;
const HERO_LOGO_MAX_SETTINGS_HEIGHT = 160;

// 밴드 CTA의 크기 규칙입니다. 색은 밴드 톤에서 받습니다.
const SPOTLIGHT_CTA_CLASS =
  'inline-flex h-48 w-fit items-center justify-center gap-8 rounded-capsule px-24 text-label-l whitespace-nowrap';

/**
 * 선택 브랜드를 보여 주는 상단 다크 밴드(Figma 614:11628 기준).
 * 로고와 이름은 목록 요약으로 바로 그리고, 상세 조회가 끝나면 주력 분야(부제)를 채웁니다.
 */
export function BrandSpotlightBand({
  brand,
  sectionRef,
}: {
  brand: BrandSummary;
  /** 카드 선택 시 밴드 위치를 재려고 부모가 잡는 ref */
  sectionRef?: Ref<HTMLElement>;
}) {
  const accentColor = resolveBrandAccentColor(brand.accentColor);
  const tone = getBrandBandTone(accentColor);
  const detailQuery = useBrandQuery(brand.id);
  const detail = detailQuery.data;
  const subline = getBrandSubline({
    englishName: brand.englishName,
    mainField: detail?.mainField ?? null,
  });

  return (
    <section
      ref={sectionRef}
      aria-labelledby={SPOTLIGHT_TITLE_ID}
      // 배경은 브랜드 accentColor라 토큰으로 줄 수 없는 예외입니다. 값은 resolveBrandAccentColor로 검증한 hex만 들어갑니다.
      style={{ backgroundColor: accentColor }}
      className={cx('py-24 lg:py-0', tone.textClassName)}
    >
      <PageContainer className="flex flex-col gap-20 lg:h-400 lg:flex-row-reverse lg:items-center lg:gap-24 lg:py-48">
        <BrandSpotlightLogoColumn
          brandName={brand.name}
          logoUrl={brand.logoUrl}
          logoSettings={brand.logoSettings}
        />
        {/* 모바일 텍스트 열 높이는 제목 2줄 + 보조 1줄 + 소개 2줄 + 버튼 기준(220)으로 고정합니다. 데스크톱은 밴드 높이(lg:h-400)가 정합니다. */}
        <div className="flex min-h-220 min-w-0 flex-col gap-20 lg:min-h-0 lg:w-636 lg:shrink-0 lg:gap-32">
          <div className="flex min-w-0 flex-col gap-8">
            <h2 id={SPOTLIGHT_TITLE_ID} className="line-clamp-2 text-h2 break-words lg:text-web-h2">
              {brand.name}
            </h2>
            {subline ? (
              <p className="line-clamp-1 text-label-s break-words lg:text-label-m">{subline}</p>
            ) : null}
          </div>
          {brand.tagline ? (
            <p className="line-clamp-2 text-body-m break-words">{brand.tagline}</p>
          ) : null}
          {brand.productCount > 0 ? (
            <Link
              href={buildBrandProductsHref(brand.name)}
              className={cx(SPOTLIGHT_CTA_CLASS, tone.ctaClassName, tone.focusClassName)}
            >
              제품 보기
              <Icon icon={ArrowRight} size={16} />
            </Link>
          ) : (
            // 상품이 없으면 이동 대상이 없으므로 비활성 버튼으로 둡니다(포커스·클릭 모두 막힘).
            <button
              type="button"
              disabled
              className={cx(
                SPOTLIGHT_CTA_CLASS,
                'cursor-not-allowed bg-pressed-dark text-text-disabled',
              )}
            >
              제품 보기
              <Icon icon={ArrowRight} size={16} />
            </button>
          )}
        </div>
      </PageContainer>
    </section>
  );
}

/**
 * 사진 열에는 로고만 가운데에 둡니다. 로고는 목록 요약의 logoUrl로 그리므로 상세 조회를 기다리지 않습니다.
 * 로고가 없으면 같은 자리를 비웁니다(플레이스홀더를 그리지 않습니다).
 */
function BrandSpotlightLogoColumn({
  brandName,
  logoUrl,
  logoSettings,
}: {
  brandName: string;
  logoUrl: string | null;
  logoSettings: BrandImageSettings | undefined;
}) {
  return (
    <div className="flex h-220 shrink-0 items-center justify-center lg:h-304 lg:min-w-0 lg:flex-1">
      {/* 로고가 없으면 사진 열을 비워 둡니다. 밝은 플레이스홀더 박스는 어두운 밴드 위에서 튀므로 그리지 않습니다. */}
      {logoUrl ? (
        // 로고 박스는 사진 열 폭을 넘지 않습니다. 전역 카테고리 여백 때문에 1024~1335에서는 열이 좁아지므로, 박스가 열 폭에 맞춰 줄고 로고는 그 안에서 contain으로 맞습니다.
        <div className={HERO_LOGO_BOX_CLASS_NAME}>
          <BrandLogo
            logoUrl={logoUrl}
            brandName={brandName}
            className="size-full"
            settings={{
              fit: logoSettings?.fit ?? 'contain',
              width: HERO_LOGO_MAX_SETTINGS_WIDTH,
              height: HERO_LOGO_MAX_SETTINGS_HEIGHT,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
