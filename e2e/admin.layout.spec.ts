import { expect, test } from '@playwright/test';

test('관리자 레이아웃: 모의 로그인 후 사이드바와 본문 제목', async ({ page }, testInfo) => {
  await page.goto('/products');
  await expect(page.getByRole('heading', { level: 1, name: '관리자 로그인' })).toBeVisible();

  await page.getByLabel('아이디').fill('admin');
  await page.getByLabel('비밀번호').fill('e2e-demo-only');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/products$/);

  const adminMenu = page.getByRole('navigation', { name: '관리자 메뉴' });
  await expect(adminMenu.getByRole('link', { name: '상품 관리' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { level: 1, name: '상품 관리' })).toBeVisible();
  await expect(page.getByRole('link', { name: '본문 바로가기' })).toHaveAttribute(
    'href',
    '#admin-main-content',
  );
  await expect(page.locator('#admin-main-content')).toHaveAttribute('tabindex', '-1');

  await testInfo.attach('admin-products-after-mock-login', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});
