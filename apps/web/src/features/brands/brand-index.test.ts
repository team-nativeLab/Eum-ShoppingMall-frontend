import { describe, expect, it } from 'vitest';
import { getBrandIndexLabel, groupBrandsByIndex } from './brand-index';

describe('brand index', () => {
  it('한글 첫 글자의 초성을 쓰고 쌍자음은 기본 자음으로 묶습니다', () => {
    expect(getBrandIndexLabel('그립원')).toBe('ㄱ');
    expect(getBrandIndexLabel('까치안전')).toBe('ㄱ');
    expect(getBrandIndexLabel('뚝심')).toBe('ㄷ');
    expect(getBrandIndexLabel('빠른손')).toBe('ㅂ');
    expect(getBrandIndexLabel('쌍용보호')).toBe('ㅅ');
    expect(getBrandIndexLabel('짱짱')).toBe('ㅈ');
    expect(getBrandIndexLabel('하이세이프')).toBe('ㅎ');
    expect(getBrandIndexLabel('ㄲ브랜드')).toBe('ㄱ');
  });

  it('영문은 대소문자와 관계없이 A–Z, 숫자·기호·빈 이름은 #입니다', () => {
    expect(getBrandIndexLabel('Duraguard')).toBe('A–Z');
    expect(getBrandIndexLabel('zeta')).toBe('A–Z');
    expect(getBrandIndexLabel('3M')).toBe('#');
    expect(getBrandIndexLabel('(주)안전')).toBe('#');
    expect(getBrandIndexLabel('')).toBe('#');
    expect(getBrandIndexLabel('   ')).toBe('#');
  });

  it('앞뒤 공백을 무시하고 첫 글자를 봅니다', () => {
    expect(getBrandIndexLabel('  세이프가드')).toBe('ㅅ');
    expect(getBrandIndexLabel(' alpha')).toBe('A–Z');
  });

  it('한글 → A–Z → # 순서로 묶고, 묶음 안은 이름순, 빈 묶음도 남깁니다', () => {
    const groups = groupBrandsByIndex([
      { name: 'beta' },
      { name: '사일런트' },
      { name: '3M' },
      { name: 'Alpha' },
      { name: '세이프가드' },
      { name: '그립원' },
      { name: '사인랩' },
    ]);

    expect(groups.map((indexGroup) => indexGroup.label)).toEqual([
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
      'A–Z',
      '#',
    ]);
    const groupNames = (label: string) =>
      groups.find((indexGroup) => indexGroup.label === label)?.brands.map((brand) => brand.name);
    expect(groupNames('ㄱ')).toEqual(['그립원']);
    expect(groupNames('ㄴ')).toEqual([]);
    expect(groupNames('ㅅ')).toEqual(['사인랩', '사일런트', '세이프가드']);
    expect(groupNames('A–Z')).toEqual(['Alpha', 'beta']);
    expect(groupNames('#')).toEqual(['3M']);
  });

  it('앵커 id는 ASCII이고 빈 배열이면 모든 묶음이 비어 있습니다', () => {
    const groups = groupBrandsByIndex([]);
    expect(groups.every((indexGroup) => indexGroup.brands.length === 0)).toBe(true);
    expect(groups[0]?.anchorId).toBe('brand-group-kr-0');
    expect(groups.at(-2)?.anchorId).toBe('brand-group-en');
    expect(groups.at(-1)?.anchorId).toBe('brand-group-etc');
    expect(groups.every((indexGroup) => /^[\x20-\x7e]+$/.test(indexGroup.anchorId))).toBe(true);
  });
});
