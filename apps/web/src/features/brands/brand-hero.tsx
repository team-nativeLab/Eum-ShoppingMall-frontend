import type { BrandSummary } from '@eum/api/types';
import { cx } from '@eum/ui/lib/cx';
import { PageContainer } from '@/components/page-container';
import { getBrandBandTone, resolveBrandAccentColor } from './brand-accent';
import { BrandLogo } from './brand-media';

const HERO_TITLE_ID = 'brand-hero-title';

// 히어로 로고 박스는 목록 타일보다 큽니다. 모바일 240×96, 데스크톱 320×160 안에서 contain으로 맞춥니다.
const HERO_LOGO_BOX_CLASS_NAME =
  'flex h-96 w-full max-w-240 items-center justify-center lg:h-160 lg:max-w-320';
const HERO_LOGO_SETTINGS_WIDTH = 320;
const HERO_LOGO_SETTINGS_HEIGHT = 160;

/**
 * 브랜드 페이지 상단 히어로입니다. 과거 BrandSpotlightBand의 배경·열 구조를 되살리되 「제품 보기」 버튼은 두지 않습니다.
 * 배경은 브랜드 accentColor라 토큰으로 줄 수 없는 예외입니다. 값은 resolveBrandAccentColor로 검증한 hex만 들어갑니다.
 * 글자색은 배경 대비가 높은 쪽(흰색 또는 검정)을 고릅니다.
 */
export function BrandHero({ brand }: { brand: BrandSummary }) {
  const accentColor = resolveBrandAccentColor(brand.accentColor);
  const tone = getBrandBandTone(accentColor);

  return (
    <section
      aria-labelledby={HERO_TITLE_ID}
      style={{ backgroundColor: accentColor }}
      className={cx('py-24 lg:py-64', tone.textClassName)}
    >
      <PageContainer className="flex flex-col gap-20 lg:flex-row-reverse lg:items-center lg:gap-24">
        {brand.logoUrl ? (
          <div className="flex items-center justify-center lg:min-w-0 lg:flex-1">
            <div className={HERO_LOGO_BOX_CLASS_NAME}>
              <BrandLogo
                logoUrl={brand.logoUrl}
                brandName={brand.name}
                className="size-full"
                loading="eager"
                settings={{
                  fit: brand.logoSettings?.fit ?? 'contain',
                  width: HERO_LOGO_SETTINGS_WIDTH,
                  height: HERO_LOGO_SETTINGS_HEIGHT,
                }}
              />
            </div>
          </div>
        ) : (
          // 로고가 없어도 데스크톱에서 텍스트가 왼쪽에 머물도록 빈 열을 둡니다(행 방향이 역순이라 이 열은 오른쪽). 모바일에서는 그리지 않습니다.
          <div aria-hidden="true" className="hidden lg:block lg:flex-1" />
        )}
        <div className="flex min-w-0 flex-col gap-20 lg:w-636 lg:shrink-0 lg:gap-32">
          <h1 id={HERO_TITLE_ID} className="min-w-0 text-web-h2 break-words lg:text-web-display-l">
            {brand.name}
          </h1>
          {brand.tagline ? (
            <p className="min-w-0 text-body-l break-words lg:text-web-body-xl">{brand.tagline}</p>
          ) : null}
          <p className="text-body-s">제품 {brand.productCount.toLocaleString('ko-KR')}개</p>
        </div>
      </PageContainer>
    </section>
  );
}
