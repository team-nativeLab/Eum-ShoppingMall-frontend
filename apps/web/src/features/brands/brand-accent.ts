import { DEFAULT_BRAND_ACCENT_COLOR } from '@eum/api/brand-defaults';

const BRAND_ACCENT_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

/** 밴드 글자·버튼·포커스 색 묶음. 모두 불투명 토큰 클래스입니다. */
export interface BrandBandTone {
  /** 밴드 제목·설명·본문 글자색 */
  textClassName: string;
  /** 「제품 보기」 버튼 색 */
  ctaClassName: string;
  /** 버튼 포커스 외곽선. 배경과 대비되는 색을 씁니다. */
  focusClassName: string;
}

const LIGHT_TEXT_TONE: BrandBandTone = {
  textClassName: 'text-inverse',
  ctaClassName: 'bg-inverse text-text-1 hover:bg-surface',
  focusClassName:
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse',
};

const DARK_TEXT_TONE: BrandBandTone = {
  textClassName: 'text-text-accent-black',
  ctaClassName: 'bg-text-accent-black text-inverse hover:bg-pressed-dark',
  focusClassName:
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-1',
};

/** 서버 accentColor를 밴드 배경색으로 검증합니다. 없거나 `#RRGGBB` 형식이 아니면 기본색을 씁니다. */
export function resolveBrandAccentColor(value?: string | null): string {
  return value && BRAND_ACCENT_COLOR_PATTERN.test(value) ? value : DEFAULT_BRAND_ACCENT_COLOR;
}

/** sRGB 채널 한 개(두 자리 hex)를 WCAG 선형값으로 바꿉니다. */
function toLinearChannel(hexChannel: string): number {
  const srgbChannel = parseInt(hexChannel, 16) / 255;
  return srgbChannel <= 0.03928 ? srgbChannel / 12.92 : ((srgbChannel + 0.055) / 1.055) ** 2.4;
}

/** WCAG 상대휘도(0~1). 입력은 검증된 `#RRGGBB`여야 합니다. */
function getRelativeLuminance(hexColor: string): number {
  const linearRed = toLinearChannel(hexColor.slice(1, 3));
  const linearGreen = toLinearChannel(hexColor.slice(3, 5));
  const linearBlue = toLinearChannel(hexColor.slice(5, 7));
  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}

/**
 * 배경색에 대해 흰 글자와 검정 글자의 WCAG 대비비를 비교해 더 높은 쪽을 고릅니다.
 * 밝기 임계값을 따로 두지 않아, 대비가 높은 쪽이 항상 선택됩니다.
 */
export function getBrandBandTone(accentColor: string): BrandBandTone {
  const luminance = getRelativeLuminance(resolveBrandAccentColor(accentColor));
  const contrastWithWhite = (1 + 0.05) / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / (0 + 0.05);
  return contrastWithWhite >= contrastWithBlack ? LIGHT_TEXT_TONE : DARK_TEXT_TONE;
}
