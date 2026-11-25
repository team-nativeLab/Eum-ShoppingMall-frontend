import type { BrandSummary } from '@eum/api/types';

/** 인덱스 키 행의 「전체」 값. 실제 브랜드 키와 겹치지 않는 소문자 식별자입니다. */
export const ALL_BRAND_INDEX_FILTER = 'all';

/** 키 행 순서: ㄱ~ㅎ, A~Z, # 입니다. 섹션 순서도 같습니다. */
export const CONSONANT_BRAND_INDEX_KEYS = [
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

export const ALPHABET_BRAND_INDEX_KEYS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
] as const;

export const ETC_BRAND_INDEX_KEY = '#';

export type BrandIndexKey =
  | (typeof CONSONANT_BRAND_INDEX_KEYS)[number]
  | (typeof ALPHABET_BRAND_INDEX_KEYS)[number]
  | typeof ETC_BRAND_INDEX_KEY;

/** 키 행에서 고를 수 있는 값. 「전체」 또는 키 하나입니다. */
export type BrandIndexFilter = typeof ALL_BRAND_INDEX_FILTER | BrandIndexKey;

export const BRAND_INDEX_KEYS: readonly BrandIndexKey[] = [
  ...CONSONANT_BRAND_INDEX_KEYS,
  ...ALPHABET_BRAND_INDEX_KEYS,
  ETC_BRAND_INDEX_KEY,
];

/** 한글 음절 블록(가~힣)과 초성 계산 값입니다. 초성 index = floor((코드 - 0xAC00) / 588). */
const HANGUL_SYLLABLE_FIRST_CODE = 0xac00;
const HANGUL_SYLLABLE_LAST_CODE = 0xd7a3;
const HANGUL_SYLLABLES_PER_INITIAL = 588;

/** 유니코드 초성 19개(ㄱ~ㅎ)를 코드 순서대로 둡니다. */
const INITIAL_CONSONANTS: readonly string[] = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

/** 쌍자음은 기본 자음 키에 합칩니다(까·싸 → ㄱ·ㅅ). */
const DOUBLE_INITIAL_TO_BASE: Readonly<Record<string, string>> = {
  ㄲ: 'ㄱ',
  ㄸ: 'ㄷ',
  ㅃ: 'ㅂ',
  ㅆ: 'ㅅ',
  ㅉ: 'ㅈ',
};

/** 같은 문자열을 여러 번 비교하는 정렬에서 쓰도록 한 번만 만듭니다. */
const KOREAN_NAME_COLLATOR = new Intl.Collator('ko');

/**
 * 브랜드 이름의 첫 글자로 인덱스 키를 정합니다(englishName은 쓰지 않습니다).
 * 한글 음절은 초성, 영문 A–Z는 대문자, 그 밖(숫자·기호·호환 자모·빈 이름)은 #입니다.
 */
export function getBrandIndexKey(brandName: string): BrandIndexKey {
  const firstCharacter = getFirstCharacter(brandName);
  const firstCode = firstCharacter.codePointAt(0);

  if (
    firstCode !== undefined &&
    firstCode >= HANGUL_SYLLABLE_FIRST_CODE &&
    firstCode <= HANGUL_SYLLABLE_LAST_CODE
  ) {
    const initialIndex = Math.floor(
      (firstCode - HANGUL_SYLLABLE_FIRST_CODE) / HANGUL_SYLLABLES_PER_INITIAL,
    );
    const initial = INITIAL_CONSONANTS[initialIndex] ?? ETC_BRAND_INDEX_KEY;
    return toConsonantKey(initial);
  }

  if (/^[A-Za-z]$/.test(firstCharacter)) {
    return firstCharacter.toUpperCase() as BrandIndexKey;
  }

  return ETC_BRAND_INDEX_KEY;
}

/**
 * 검색어로 브랜드를 거릅니다. 이름과 영문명을 대소문자 무시 부분 일치로 보고,
 * 검색어가 비어 있으면 전체를 돌려줍니다. RegExp 대신 includes를 씁니다.
 */
export function filterBrandsByKeyword(
  brands: readonly BrandSummary[],
  keyword: string,
): BrandSummary[] {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (normalizedKeyword === '') return [...brands];

  return brands.filter((brand) => {
    const normalizedName = normalizeSearchText(brand.name);
    const normalizedEnglishName = normalizeSearchText(brand.englishName ?? '');
    return (
      normalizedName.includes(normalizedKeyword) ||
      normalizedEnglishName.includes(normalizedKeyword)
    );
  });
}

/** 검색 결과처럼 섹션 없이 한 목록으로 보일 때의 정렬입니다(한국어 이름순, 같으면 id순). */
export function sortBrandsForDirectory(brands: readonly BrandSummary[]): BrandSummary[] {
  return [...brands].sort(compareBrandsForDirectory);
}

export interface BrandIndexSection {
  key: BrandIndexKey;
  /** 이 키에 속한 브랜드입니다. 섹션 안은 한국어 이름순이고 같으면 id순입니다. */
  brands: BrandSummary[];
}

/**
 * 브랜드를 인덱스 키별 섹션으로 묶습니다. 브랜드가 없는 키는 섹션을 만들지 않습니다.
 * 각 브랜드는 정확히 한 섹션에만 들어갑니다.
 */
export function groupBrandsByIndexKey(brands: readonly BrandSummary[]): BrandIndexSection[] {
  const brandsByKey = new Map<BrandIndexKey, BrandSummary[]>();
  for (const brand of brands) {
    const key = getBrandIndexKey(brand.name);
    const keyBrands = brandsByKey.get(key) ?? [];
    keyBrands.push(brand);
    brandsByKey.set(key, keyBrands);
  }

  return BRAND_INDEX_KEYS.flatMap((key) => {
    const keyBrands = brandsByKey.get(key);
    if (!keyBrands) return [];
    return [{ key, brands: [...keyBrands].sort(compareBrandsForDirectory) }];
  });
}

/** 섹션 요소의 DOM id입니다. #는 id에 쓰기 불편하므로 etc로 바꿉니다. */
export function getBrandSectionDomId(key: BrandIndexKey): string {
  return `brand-section-${getIndexKeySlug(key)}`;
}

/** 키 행 버튼의 DOM id입니다. 「전체」는 all입니다. */
export function getBrandIndexKeyDomId(filter: BrandIndexFilter): string {
  const slug = filter === ALL_BRAND_INDEX_FILTER ? ALL_BRAND_INDEX_FILTER : getIndexKeySlug(filter);
  return `brand-index-key-${slug}`;
}

function getIndexKeySlug(key: BrandIndexKey): string {
  return key === ETC_BRAND_INDEX_KEY ? 'etc' : key;
}

function compareBrandsForDirectory(first: BrandSummary, second: BrandSummary): number {
  const nameOrder = KOREAN_NAME_COLLATOR.compare(first.name, second.name);
  if (nameOrder !== 0) return nameOrder;
  if (first.id < second.id) return -1;
  if (first.id > second.id) return 1;
  return 0;
}

function toConsonantKey(initial: string): BrandIndexKey {
  const baseConsonant = DOUBLE_INITIAL_TO_BASE[initial] ?? initial;
  return baseConsonant as BrandIndexKey;
}

/** 이름을 NFC로 맞춘 뒤 첫 코드 포인트를 고릅니다(NFD로 들어온 자모도 음절로 합쳐집니다). */
function getFirstCharacter(brandName: string): string {
  const normalizedName = normalizeBrandText(brandName).trim();
  return [...normalizedName][0] ?? '';
}

/** 검색어가 비었는지 판단하는 정규화입니다. 제로폭 문자만 든 입력은 빈 검색어로 봅니다. */
export function normalizeSearchKeyword(keyword: string): string {
  return normalizeSearchText(keyword);
}

function normalizeSearchText(text: string): string {
  return normalizeBrandText(text).trim().toLowerCase();
}

/** 화면에 보이지 않지만 글자로 세어지는 제로폭 문자(U+200B, U+FEFF)를 지우고 NFC로 맞춥니다. */
function normalizeBrandText(text: string): string {
  return text.replaceAll('\u200B', '').replaceAll('\uFEFF', '').normalize('NFC');
}
