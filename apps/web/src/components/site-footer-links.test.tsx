import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteFooter } from './site-footer';

vi.mock('@/features/company/use-company-info-query', () => ({
  useCompanyInfoQuery: () => ({ data: undefined, refetch: vi.fn() }),
}));

/** 푸터 메뉴 nav는 데스크톱(전체 목록)과 모바일(모바일에서 보이는 목록) 두 개입니다. 데스크톱이 먼저입니다. */
function getFooterMenus() {
  const footerMenus = screen.getAllByRole('navigation', { name: '푸터 메뉴' });
  const [desktopFooterMenu, mobileFooterMenu] = footerMenus;
  if (!desktopFooterMenu || !mobileFooterMenu) throw new Error('푸터 메뉴를 찾을 수 없습니다.');
  return { desktopFooterMenu, mobileFooterMenu };
}

function getLinkLabels(menu: HTMLElement): string[] {
  return within(menu)
    .getAllByRole('link')
    .map((menuLink) => menuLink.textContent ?? '');
}

describe('SiteFooter 링크 목록', () => {
  it('데스크톱 푸터 메뉴는 회사소개 없이 나머지 링크를 기존 순서대로 보여 줍니다', () => {
    render(<SiteFooter />);

    const { desktopFooterMenu } = getFooterMenus();
    expect(getLinkLabels(desktopFooterMenu)).toEqual([
      '이용약관',
      '개인정보처리방침',
      '이용안내',
      '이벤트',
      '고객센터',
    ]);
    const { mobileFooterMenu } = getFooterMenus();
    expect(within(desktopFooterMenu).queryByRole('link', { name: '회사소개' })).toBeNull();
    expect(within(mobileFooterMenu).queryByRole('link', { name: '회사소개' })).toBeNull();
  });

  it('상단 메뉴와 중복되던 제품·베스트·오늘의 상품·추천상품·브랜드몰·안전 솔루션 링크는 푸터에 없습니다', () => {
    render(<SiteFooter />);

    const { desktopFooterMenu, mobileFooterMenu } = getFooterMenus();
    const removedLabels = ['제품', '베스트', '오늘의 상품', '추천상품', '브랜드몰', '안전 솔루션'];
    for (const removedLabel of removedLabels) {
      expect(within(desktopFooterMenu).queryByRole('link', { name: removedLabel })).toBeNull();
      expect(within(mobileFooterMenu).queryByRole('link', { name: removedLabel })).toBeNull();
    }
  });

  it('모바일 푸터 메뉴는 이용약관·개인정보처리방침·고객센터 3개만 보여 줍니다', () => {
    render(<SiteFooter />);

    const { mobileFooterMenu } = getFooterMenus();
    expect(getLinkLabels(mobileFooterMenu)).toEqual(['이용약관', '개인정보처리방침', '고객센터']);
  });
});
