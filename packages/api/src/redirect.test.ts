import { describe, expect, it } from 'vitest';
import { sanitizeRedirectPath } from './redirect';

describe('sanitizeRedirectPath', () => {
  it('같은 사이트 경로는 pathname+search+hash로 돌려줍니다', () => {
    expect(sanitizeRedirectPath('/mypage/orders?page=2#top')).toBe('/mypage/orders?page=2#top');
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/mypage\\..\\admin',
    '/a/\\b',
    'javascript:alert(1)',
    '/a\nb',
    '/a\tb',
    '/../admin',
    '/mypage/./orders',
    '/mypage/..',
    '/%2e//evil.com',
    '/%2E%2E//evil.com',
    '/%2e%2e//evil.com',
    '/%2e/%2e//x',
    '/a/%2E/b',
    '',
  ])('외부·우회 주소 %j는 fallback으로 바꿉니다', (rawRedirect) => {
    expect(sanitizeRedirectPath(rawRedirect, '/')).toBe('/');
  });

  it('null·undefined는 fallback입니다', () => {
    expect(sanitizeRedirectPath(null, '/login')).toBe('/login');
    expect(sanitizeRedirectPath(undefined)).toBe('/');
  });

  it('점이 들어간 정상 경로와 인코딩된 문자는 그대로 둡니다', () => {
    expect(sanitizeRedirectPath('/products/v1.2/item')).toBe('/products/v1.2/item');
    expect(sanitizeRedirectPath('/search?q=%2e%2e')).toBe('/search?q=%2e%2e');
    expect(sanitizeRedirectPath('/category/%ED%95%9C')).toBe('/category/%ED%95%9C');
  });

  it('검색어 안의 점은 경로 세그먼트가 아니라 허용합니다', () => {
    expect(sanitizeRedirectPath('/search?q=../x')).toBe('/search?q=../x');
  });
});
