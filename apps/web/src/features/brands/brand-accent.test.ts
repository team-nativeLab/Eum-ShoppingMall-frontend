import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND_ACCENT_COLOR } from '@eum/api/brand-defaults';
import { getBrandBandTone, resolveBrandAccentColor } from './brand-accent';

/** WCAG 2.x 상대휘도와 대비비를 테스트 안에서 따로 계산합니다(구현 함수와 독립된 검산). */
function toRelativeLuminance(hexColor: string): number {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const srgb = parseInt(hexColor.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function getContrastRatio(firstHex: string, secondHex: string): number {
  const first = toRelativeLuminance(firstHex);
  const second = toRelativeLuminance(secondHex);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('resolveBrandAccentColor', () => {
  it('uses the default color when the accent color is missing', () => {
    expect(resolveBrandAccentColor(undefined)).toBe(DEFAULT_BRAND_ACCENT_COLOR);
    expect(resolveBrandAccentColor(null)).toBe(DEFAULT_BRAND_ACCENT_COLOR);
    expect(resolveBrandAccentColor('')).toBe(DEFAULT_BRAND_ACCENT_COLOR);
  });

  it('uses the default color when the value is not a six-digit hex color', () => {
    expect(resolveBrandAccentColor('red')).toBe(DEFAULT_BRAND_ACCENT_COLOR);
    expect(resolveBrandAccentColor('#12345')).toBe(DEFAULT_BRAND_ACCENT_COLOR);
    expect(resolveBrandAccentColor('#GGGGGG')).toBe(DEFAULT_BRAND_ACCENT_COLOR);
    expect(resolveBrandAccentColor('#466B9A ')).toBe(DEFAULT_BRAND_ACCENT_COLOR);
  });

  it('keeps a valid six-digit hex color in either letter case', () => {
    expect(resolveBrandAccentColor('#466B9A')).toBe('#466B9A');
    expect(resolveBrandAccentColor('#466b9a')).toBe('#466b9a');
  });

  it('keeps the default color value in one place', () => {
    expect(DEFAULT_BRAND_ACCENT_COLOR).toBe('#2F6F62');
  });
});

describe('getBrandBandTone', () => {
  it('picks white text for the default dark green, which has higher contrast with white', () => {
    const tone = getBrandBandTone('#2F6F62');

    expect(tone.textClassName).toBe('text-inverse');
  });

  it('picks black text for a light color, which has higher contrast with black', () => {
    const tone = getBrandBandTone('#F2F2F2');

    expect(tone.textClassName).toBe('text-text-accent-black');
  });

  it('picks the color with higher contrast at both ends of the range', () => {
    expect(getBrandBandTone('#FFFFFF').textClassName).toBe('text-text-accent-black');
    expect(getBrandBandTone('#000000').textClassName).toBe('text-inverse');
  });

  it('resolves an invalid color to the default tone', () => {
    expect(getBrandBandTone('red')).toEqual(getBrandBandTone(DEFAULT_BRAND_ACCENT_COLOR));
  });
});

describe('getBrandBandTone 글자 대비(WCAG AA)', () => {
  // 중간 밝기, 휘도 경계(약 0.179) 양쪽, 기본색과 대표 샘플을 넣습니다.
  const candidateColors = [
    '#767676',
    '#757575',
    '#777777',
    '#808080',
    '#959595',
    '#2F6F62',
    '#466B9A',
    '#F2F2F2',
    '#000000',
    '#FFFFFF',
  ];

  it.each(candidateColors)('keeps at least 4.5:1 between the chosen text color and %s', (color) => {
    const tone = getBrandBandTone(color);
    const chosenTextHex =
      tone.textClassName === 'text-inverse'
        ? '#FFFFFF'
        : tone.textClassName === 'text-text-accent-black'
          ? '#000000'
          : null;

    expect(chosenTextHex, `${color}의 글자색 클래스`).not.toBeNull();
    if (chosenTextHex === null) return;
    expect(getContrastRatio(color, chosenTextHex)).toBeGreaterThanOrEqual(4.5);
  });
});
