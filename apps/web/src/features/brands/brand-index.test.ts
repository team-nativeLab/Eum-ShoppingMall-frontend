import type { BrandSummary } from '@eum/api/types';
import { describe, expect, it } from 'vitest';
import {
  ALPHABET_BRAND_INDEX_KEYS,
  BRAND_INDEX_KEYS,
  CONSONANT_BRAND_INDEX_KEYS,
  ETC_BRAND_INDEX_KEY,
  filterBrandsByKeyword,
  getBrandIndexKey,
  getBrandSectionDomId,
  groupBrandsByIndexKey,
  normalizeSearchKeyword,
  sortBrandsForDirectory,
} from './brand-index';

function buildBrand(id: string, name: string, englishName: string | null = null): BrandSummary {
  return { id, name, englishName, logoUrl: null, tagline: null, productCount: 1 };
}

describe('getBrandIndexKey', () => {
  it('uses the initial consonant of a Hangul syllable', () => {
    expect(getBrandIndexKey('가구')).toBe('ㄱ');
    expect(getBrandIndexKey('한결&안전')).toBe('ㅎ');
    expect(getBrandIndexKey('워크핏')).toBe('ㅇ');
  });

  it('merges double consonants into their base consonant', () => {
    expect(getBrandIndexKey('까치')).toBe('ㄱ');
    expect(getBrandIndexKey('싸이')).toBe('ㅅ');
    expect(getBrandIndexKey('쩌르')).toBe('ㅈ');
    expect(getBrandIndexKey('뜨개')).toBe('ㄷ');
    expect(getBrandIndexKey('빠름')).toBe('ㅂ');
  });

  it('reads decomposed (NFD) Hangul input as the composed syllable', () => {
    expect(getBrandIndexKey('한결'.normalize('NFD'))).toBe('ㅎ');
    expect(getBrandIndexKey('워크핏'.normalize('NFD'))).toBe('ㅇ');
  });

  it('maps Latin letters to their uppercase alphabet key regardless of case', () => {
    expect(getBrandIndexKey('Duraguard')).toBe('D');
    expect(getBrandIndexKey('duraguard')).toBe('D');
    expect(getBrandIndexKey('  gripone')).toBe('G');
  });

  it('maps digits, symbols, compatibility jamo and blank names to #', () => {
    expect(getBrandIndexKey('3M')).toBe(ETC_BRAND_INDEX_KEY);
    expect(getBrandIndexKey('&안전')).toBe(ETC_BRAND_INDEX_KEY);
    expect(getBrandIndexKey('ㄱ브랜드')).toBe(ETC_BRAND_INDEX_KEY);
    expect(getBrandIndexKey('')).toBe(ETC_BRAND_INDEX_KEY);
    expect(getBrandIndexKey('   ')).toBe(ETC_BRAND_INDEX_KEY);
  });
});

describe('BRAND_INDEX_KEYS', () => {
  it('lists 14 consonants, 26 letters and # in display order', () => {
    expect(CONSONANT_BRAND_INDEX_KEYS).toHaveLength(14);
    expect(ALPHABET_BRAND_INDEX_KEYS).toHaveLength(26);
    expect(BRAND_INDEX_KEYS).toHaveLength(41);
    expect(BRAND_INDEX_KEYS[0]).toBe('ㄱ');
    expect(BRAND_INDEX_KEYS[14]).toBe('A');
    expect(BRAND_INDEX_KEYS[40]).toBe('#');
  });
});

describe('filterBrandsByKeyword', () => {
  const brands = [
    buildBrand('brand-workfit', '워크핏', 'WORKFIT'),
    buildBrand('brand-duraguard', 'Duraguard', 'DURAGUARD'),
    buildBrand('brand-null-english', '파이어킵', null),
  ];

  it('returns every brand when the keyword is blank after trimming', () => {
    expect(filterBrandsByKeyword(brands, '')).toEqual(brands);
    expect(filterBrandsByKeyword(brands, '   ')).toEqual(brands);
  });

  it('matches the name and the English name case-insensitively', () => {
    expect(filterBrandsByKeyword(brands, 'work').map((brand) => brand.id)).toEqual([
      'brand-workfit',
    ]);
    expect(filterBrandsByKeyword(brands, 'DURA').map((brand) => brand.id)).toEqual([
      'brand-duraguard',
    ]);
    expect(filterBrandsByKeyword(brands, '워크').map((brand) => brand.id)).toEqual([
      'brand-workfit',
    ]);
  });

  it('does not fail on a null English name', () => {
    expect(filterBrandsByKeyword(brands, '파이')).toEqual([brands[2]]);
    expect(filterBrandsByKeyword(brands, 'xyz')).toEqual([]);
  });

  it('compares Hangul in NFC even when the keyword or the name is decomposed', () => {
    expect(filterBrandsByKeyword(brands, '워크'.normalize('NFD')).map((brand) => brand.id)).toEqual(
      ['brand-workfit'],
    );
  });
});

describe('groupBrandsByIndexKey', () => {
  it('places every brand in exactly one section and orders sections ㄱ~ㅎ, A–Z, #', () => {
    const brands = [
      buildBrand('b1', '#특수'),
      buildBrand('b2', 'Duraguard'),
      buildBrand('b3', '워크핏'),
      buildBrand('b4', '가나'),
      buildBrand('b5', 'Zeta'),
    ];

    const sections = groupBrandsByIndexKey(brands);

    expect(sections.map((section) => section.key)).toEqual(['ㄱ', 'ㅇ', 'D', 'Z', '#']);
    const sectionBrandCount = sections.reduce((total, section) => total + section.brands.length, 0);
    expect(sectionBrandCount).toBe(brands.length);
  });

  it('creates sections only for keys that have brands', () => {
    const sections = groupBrandsByIndexKey([buildBrand('b1', '세이프원')]);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.key).toBe('ㅅ');
  });

  it('sorts inside a section by Korean name and breaks ties by id', () => {
    const sections = groupBrandsByIndexKey([
      buildBrand('brand-b', '가나'),
      buildBrand('brand-c', '가다'),
      buildBrand('brand-a', '가나'),
    ]);

    expect(sections[0]?.brands.map((brand) => brand.id)).toEqual(['brand-a', 'brand-b', 'brand-c']);
  });

  it('returns no sections for an empty list', () => {
    expect(groupBrandsByIndexKey([])).toEqual([]);
  });
});

describe('zero-width characters', () => {
  it('ignores U+200B and U+FEFF when judging the index key', () => {
    expect(getBrandIndexKey('​한결')).toBe('ㅎ');
    expect(getBrandIndexKey('﻿가구')).toBe('ㄱ');
    expect(getBrandIndexKey('​﻿Duraguard')).toBe('D');
    expect(getBrandIndexKey('​﻿')).toBe(ETC_BRAND_INDEX_KEY);
  });

  it('ignores zero-width characters in the search keyword and the brand text', () => {
    const brands = [buildBrand('brand-workfit', '워크핏', 'WORKFIT')];

    expect(filterBrandsByKeyword(brands, '​워﻿크').map((brand) => brand.id)).toEqual([
      'brand-workfit',
    ]);
    expect(filterBrandsByKeyword(brands, '​﻿ ')).toEqual(brands);
    expect(normalizeSearchKeyword('​ ﻿')).toBe('');
  });
});

describe('sortBrandsForDirectory', () => {
  it('returns a new sorted array and leaves the input order unchanged', () => {
    const input = [buildBrand('b2', '나'), buildBrand('b1', '가')];

    const sorted = sortBrandsForDirectory(input);

    expect(sorted.map((brand) => brand.id)).toEqual(['b1', 'b2']);
    expect(input.map((brand) => brand.id)).toEqual(['b2', 'b1']);
  });
});

describe('getBrandSectionDomId', () => {
  it('builds a stable section id and maps # to a DOM-safe slug', () => {
    expect(getBrandSectionDomId('D')).toBe('brand-section-D');
    expect(getBrandSectionDomId('ㅅ')).toBe('brand-section-ㅅ');
    expect(getBrandSectionDomId('#')).toBe('brand-section-etc');
  });
});
