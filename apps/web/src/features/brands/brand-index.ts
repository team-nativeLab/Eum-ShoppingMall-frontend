/**
 * W-32 브랜드 디렉터리 색인 규칙(순수 함수).
 * 한글은 첫 글자의 초성(쌍자음은 기본 자음으로 묶음), 영문은 한 묶음(A–Z), 그 밖(숫자·기호·빈 이름)은 #입니다.
 * 묶음 순서는 ㄱ…ㅎ → A–Z → #, 묶음 안은 이름의 한국어 정렬 순서입니다.
 */

/** 색인 묶음 종류 */
export type BrandIndexGroupKind = 'kr' | 'en' | 'etc';

/** 색인 키 하나와 그 묶음에 속한 브랜드 */
export interface BrandIndexGroup<TBrand> {
  /** 앵커 id(ASCII). 예: brand-group-kr-0, brand-group-en, brand-group-etc */
  anchorId: string;
  /** 화면에 보이는 키 문자(ㄱ, A–Z, #) */
  label: string;
  kind: BrandIndexGroupKind;
  brands: TBrand[];
}

/** Figma 색인 키(쌍자음 없는 기본 자음 14개) */
export const KOREAN_INDEX_LABELS = [
  'ㄱ',
  'ㄴ',
  'ㄷ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅅ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
] as const;

/** 영문 묶음 키 표시 문자(en dash) */
export const LATIN_INDEX_LABEL = 'A–Z';
/** 그 밖 묶음 키 표시 문자 */
export const ETC_INDEX_LABEL = '#';

// 유니코드 한글 음절의 초성 19개 순서. 쌍자음은 기본 자음으로 바꿔 Figma 키 14개에 맞춥니다.
const SYLLABLE_INITIALS = [
  'ㄱ',
  'ㄱ',
  'ㄴ',
  'ㄷ',
  'ㄷ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅂ',
  'ㅅ',
  'ㅅ',
  'ㅇ',
  'ㅈ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
] as const;

// 호환용 자모(ㄲ 등)로 시작하는 이름도 같은 키로 모읍니다.
const DOUBLE_CONSONANT_BASE: Readonly<Record<string, string>> = {
  ㄲ: 'ㄱ',
  ㄸ: 'ㄷ',
  ㅃ: 'ㅂ',
  ㅆ: 'ㅅ',
  ㅉ: 'ㅈ',
};

const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;
// 초성 하나에 딸린 음절 수(중성 21 × 종성 28)
const SYLLABLES_PER_INITIAL = 21 * 28;

/** 이름 첫 글자로 색인 키 문자를 구하는 함수 */
export function getBrandIndexLabel(brandName: string): string {
  const firstCharacter = brandName.trim().charAt(0);
  if (firstCharacter === '') return ETC_INDEX_LABEL;
  const codePoint = firstCharacter.charCodeAt(0);
  if (codePoint >= HANGUL_SYLLABLE_START && codePoint <= HANGUL_SYLLABLE_END) {
    const initialIndex = Math.floor((codePoint - HANGUL_SYLLABLE_START) / SYLLABLES_PER_INITIAL);
    return SYLLABLE_INITIALS[initialIndex] ?? ETC_INDEX_LABEL;
  }
  const baseConsonant = DOUBLE_CONSONANT_BASE[firstCharacter] ?? firstCharacter;
  if ((KOREAN_INDEX_LABELS as readonly string[]).includes(baseConsonant)) return baseConsonant;
  if (/^[A-Za-z]$/.test(firstCharacter)) return LATIN_INDEX_LABEL;
  return ETC_INDEX_LABEL;
}

/**
 * 브랜드를 색인 묶음으로 나누는 함수. 브랜드가 없는 묶음도 빈 배열로 돌려줘서 키를 비활성으로 그릴 수 있습니다.
 * 원본 배열은 바꾸지 않습니다.
 */
export function groupBrandsByIndex<TBrand extends { name: string }>(
  brandList: readonly TBrand[],
): BrandIndexGroup<TBrand>[] {
  const groups: BrandIndexGroup<TBrand>[] = [
    ...KOREAN_INDEX_LABELS.map((indexLabel, labelIndex) => ({
      anchorId: `brand-group-kr-${labelIndex}`,
      label: indexLabel,
      kind: 'kr' as const,
      brands: [] as TBrand[],
    })),
    { anchorId: 'brand-group-en', label: LATIN_INDEX_LABEL, kind: 'en', brands: [] },
    { anchorId: 'brand-group-etc', label: ETC_INDEX_LABEL, kind: 'etc', brands: [] },
  ];
  const groupByLabel = new Map(groups.map((indexGroup) => [indexGroup.label, indexGroup]));
  for (const brand of brandList) {
    groupByLabel.get(getBrandIndexLabel(brand.name))?.brands.push(brand);
  }
  for (const indexGroup of groups) {
    indexGroup.brands.sort((left, right) =>
      left.name.trim().localeCompare(right.name.trim(), 'ko'),
    );
  }
  return groups;
}
