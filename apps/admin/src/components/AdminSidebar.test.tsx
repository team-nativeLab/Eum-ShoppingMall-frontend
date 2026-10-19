import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AdminSidebar } from './AdminSidebar';

const expectedGroups = {
  '상품 관리': ['상품 관리', '카테고리 관리', '브랜드 관리'],
  '운영 콘텐츠': ['홈 편성', '이벤트 관리', '공지 관리', 'FAQ 관리'],
  '주문·견적': ['주문 관리', '취소·반품·교환', '견적 문의'],
  '문의·고객지원': ['1:1 문의', '상품 문의', '상품 리뷰'],
  '회원·운영 설정': [
    '회원 관리',
    '적립금 관리',
    '배송·할인 설정',
    '회사·정책 정보',
    '쿠폰 관리',
  ],
} as const;

function CurrentPath() {
  const location = useLocation();

  return <output aria-label="현재 경로">{location.pathname}</output>;
}

function renderSidebar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminSidebar />
      <CurrentPath />
    </MemoryRouter>,
  );
}

describe('관리자 사이드바 그룹 탐색', () => {
  it('대시보드를 단독으로 두고 기존 19개 메뉴를 각각 한 그룹에 표시한다', () => {
    renderSidebar();

    const dashboardGroup = screen.getByRole('region', { name: '대시보드' });
    const dashboardList = within(dashboardGroup).getByRole('list');
    expect(within(dashboardList).getAllByRole('link')).toHaveLength(1);
    expect(within(dashboardList).getByRole('link', { name: '대시보드' })).toHaveAttribute(
      'href',
      '/',
    );

    for (const [groupName, menuLabels] of Object.entries(expectedGroups)) {
      const group = screen.getByRole('region', { name: groupName });
      const groupLinks = within(group).getAllByRole('link');
      expect(groupLinks).toHaveLength(menuLabels.length);

      for (const menuLabel of menuLabels) {
        expect(within(group).getAllByRole('link', { name: menuLabel })).toHaveLength(1);
      }
    }

    expect(screen.getAllByRole('link')).toHaveLength(19);
  });

  it('상품 하위 경로에서 상품 메뉴와 현재 하위 링크만 활성화하고 대시보드는 비활성으로 둔다', () => {
    renderSidebar('/products/new');

    const productGroup = screen.getByRole('region', { name: '상품 관리' });
    expect(screen.getByRole('link', { name: '상품 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(productGroup).getByRole('link', { name: '상품 등록' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(productGroup).getByRole('link', { name: '상품 목록' }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '대시보드' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '브랜드 관리' })).not.toHaveAttribute('aria-current');
  });

  it('상품 수정 경로에서도 상품 하위 메뉴를 유지하며 목록 링크는 활성화하지 않는다', () => {
    renderSidebar('/products/product-42');

    expect(screen.getByRole('link', { name: '상품 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '상품 목록' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '상품 등록' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '대시보드' })).not.toHaveAttribute('aria-current');
  });

  it('브랜드 목록·등록·수정 경로를 브랜드 메뉴와 하위 메뉴에 반영한다', () => {
    const renderedBrandRegistration = renderSidebar('/brands/new');

    expect(screen.getByRole('link', { name: '브랜드 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const productGroup = screen.getByRole('region', { name: '상품 관리' });
    expect(within(productGroup).getByRole('link', { name: '브랜드 등록' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '대시보드' })).not.toHaveAttribute('aria-current');

    renderedBrandRegistration.unmount();
    renderSidebar('/brands/brand-42');

    expect(screen.getByRole('link', { name: '브랜드 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const brandGroupAfterRoute = screen.getByRole('region', { name: '상품 관리' });
    expect(
      within(brandGroupAfterRoute).getByRole('link', { name: '브랜드 목록' }),
    ).not.toHaveAttribute('aria-current');
    expect(
      within(brandGroupAfterRoute).getByRole('link', { name: '브랜드 등록' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('대시보드에서만 루트 링크가 활성화된다', () => {
    renderSidebar('/');

    expect(screen.getByRole('link', { name: '대시보드' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link')).toHaveLength(19);
  });

  it('Tab으로 링크에 초점을 이동하고 Enter로 라우트를 연다', async () => {
    const user = userEvent.setup();
    renderSidebar('/products/new');

    await user.tab();
    expect(screen.getByRole('link', { name: '대시보드' })).toHaveFocus();
    expect(screen.getByRole('link', { name: '대시보드' })).toHaveClass('focus-ring');

    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/');
  });
});
