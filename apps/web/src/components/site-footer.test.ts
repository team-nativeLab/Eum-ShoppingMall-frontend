import { describe, expect, it } from 'vitest';
import { getCustomerCenterTelHref } from './site-footer';

describe('getCustomerCenterTelHref', () => {
  it('서버가 준 customerCenterTel을 우선합니다', () => {
    expect(
      getCustomerCenterTelHref({
        customerCenterPhone: '1588-0000 (내선 2번)',
        customerCenterTel: '+82-1588-0000',
      }),
    ).toBe('tel:+8215880000');
  });

  it('customerCenterTel이 없으면 표시 문자열의 첫 번호만 씁니다(내선 숫자는 제외)', () => {
    expect(
      getCustomerCenterTelHref({
        customerCenterPhone: '1588-0000 (내선 2번)',
        customerCenterTel: null,
      }),
    ).toBe('tel:15880000');
  });

  it('걸 수 있는 번호가 없으면 링크를 만들지 않습니다', () => {
    expect(
      getCustomerCenterTelHref({ customerCenterPhone: '준비 중', customerCenterTel: '' }),
    ).toBeNull();
    expect(
      getCustomerCenterTelHref({ customerCenterPhone: '', customerCenterTel: null }),
    ).toBeNull();
  });
});
