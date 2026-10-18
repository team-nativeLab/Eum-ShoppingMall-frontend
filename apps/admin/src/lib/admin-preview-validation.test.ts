import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_TRACKING_MAX_ROWS,
  ADMIN_TRACKING_INPUT_LIMIT_ERROR,
  getBrowserLocalDateKey,
  generateAdminCouponCode,
  saveWithGeneratedCouponCode,
  validateAdminCouponDraft,
  validateAdminQuoteDraft,
  validateAdminSettingsDraft,
  validateAdminTrackingRows,
} from './admin-preview-validation';
import { ADMIN_WITHDRAWN_MEMBER_FIXTURES } from './admin-preview-fixtures';
import { ApiError } from '@eum/api/errors';

describe('admin coupon code generation', () => {
  it('uses browser cryptographic random bytes for a high-entropy code', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: bytes.length }, (_, index) => index));
      return bytes;
    });
    const code = generateAdminCouponCode({ getRandomValues } as unknown as Crypto);

    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(code).toBe('EUM000102030405060708090A0B');
    expect(code).toHaveLength(27);
  });

  it('retries only a coupon-code collision and stops after three attempts', async () => {
    const codes = ['COLLISION', 'AVAILABLE'];
    const save = vi.fn(async (code: string) => {
      if (code === 'COLLISION') throw new ApiError('VALIDATION', '이미 사용 중인 쿠폰 코드입니다.');
      return { code };
    });
    const createCode = vi.fn(() => codes.shift() ?? 'LAST');

    await expect(saveWithGeneratedCouponCode(save, createCode)).resolves.toEqual({
      code: 'AVAILABLE',
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(createCode).toHaveBeenCalledTimes(2);

    const alwaysCollides = vi.fn(async () => {
      throw new ApiError('VALIDATION', '이미 사용 중인 쿠폰 코드입니다.');
    });
    await expect(saveWithGeneratedCouponCode(alwaysCollides, () => 'COLLISION')).rejects.toThrow(
      '이미 사용 중인 쿠폰 코드입니다.',
    );
    expect(alwaysCollides).toHaveBeenCalledTimes(3);
  });
});

describe('admin preview form validation', () => {
  it('rejects invalid quote amounts, expired dates, empty notices, and unsupported attachments', () => {
    const errors = validateAdminQuoteDraft(
      {
        amount: '0',
        expiresAt: '2020-01-01',
        notice: '',
        attachments: [new File(['bad'], 'quote.pdf', { type: 'application/x-msdownload' })],
      },
      '2026-10-15',
    );
    expect(errors).toContain('견적 금액은 1원 이상 10억원 이하로 입력해 주세요.');
    expect(errors).toContain('유효기간은 오늘 이후 날짜로 선택해 주세요.');
    expect(errors).toContain('고객 안내 내용을 입력해 주세요.');
    expect(errors).toContain('PDF 형식 파일 1개만 첨부할 수 있습니다.');
  });

  it('accepts a quote at the allowed amount and supported file boundaries', () => {
    const errors = validateAdminQuoteDraft(
      {
        amount: '1000000000',
        expiresAt: '2026-10-15',
        notice: '견적 안내',
        attachments: [new File(['pdf'], 'quote.pdf', { type: 'application/pdf' })],
      },
      '2026-10-15',
    );
    expect(errors).toEqual([]);
  });

  it('requires exactly one PDF with matching extension and MIME type', () => {
    const errors = validateAdminQuoteDraft(
      {
        amount: '100',
        expiresAt: '2026-10-15',
        notice: '안내',
        attachments: [
          new File(['pdf'], 'quote.pdf', { type: 'application/pdf' }),
          new File(['pdf'], 'second.pdf', { type: 'application/pdf' }),
        ],
      },
      '2026-10-15',
    );
    expect(errors).toContain('견적서 PDF 파일은 1개만 첨부할 수 있습니다.');
  });

  it('formats the current browser-local calendar date', () => {
    expect(getBrowserLocalDateKey(new Date(2026, 0, 2, 0, 15))).toBe('2026-01-02');
  });

  it('rejects coupon rates beyond 100 and an invalid validity range', () => {
    const errors = validateAdminCouponDraft({
      name: '데모 쿠폰',
      benefitType: 'rate',
      benefitValue: '100.1',
      maxDiscountAmount: '-1',
      minimumOrderAmount: '0',
      startsAt: '2026-12-01',
      endsAt: '2026-11-30',
      notice: '',
    });
    expect(errors).toContain('할인율은 0보다 크고 100% 이하여야 합니다.');
    expect(errors).toContain('최대 할인 금액은 0원 이상으로 입력해 주세요.');
    expect(errors).toContain('종료일은 시작일 이후 날짜로 선택해 주세요.');
  });

  it('rejects expired coupon periods and negative fixed-coupon maximum discounts', () => {
    const expiredCouponErrors = validateAdminCouponDraft(
      {
        name: '만료 쿠폰',
        benefitType: 'amount',
        benefitValue: '1000',
        maxDiscountAmount: '-1',
        minimumOrderAmount: '0',
        startsAt: '2026-10-01',
        endsAt: '2026-10-14',
        notice: '',
      },
      '2026-10-15',
    );

    expect(expiredCouponErrors).toContain('종료일은 오늘 또는 이후 날짜로 선택해 주세요.');
    expect(expiredCouponErrors).toContain('최대 할인 금액은 0원 이상으로 입력해 주세요.');
  });

  it('distinguishes blank, duplicate, unselected, and partial tracking rows', () => {
    const result = validateAdminTrackingRows(
      'order-a,택배사,123\n\norder-a,택배사,456\norder-outside,택배사,789\norder-b,택배사',
      ['order-a', 'order-b'],
    );
    expect(result.validRows).toEqual([
      { orderId: 'order-a', carrier: '택배사', trackingNumber: '123' },
    ]);
    expect(result.errors.some((error) => error.includes('비어 있습니다'))).toBe(true);
    expect(result.errors.some((error) => error.includes('중복'))).toBe(true);
    expect(result.errors.some((error) => error.includes('선택된 주문'))).toBe(true);
    expect(result.errors.some((error) => error.includes('일부 주문만'))).toBe(true);
  });

  it('rejects oversized tracking input before allocating per-row validation errors', () => {
    const result = validateAdminTrackingRows(
      Array(ADMIN_TRACKING_MAX_ROWS + 1)
        .fill('invalid')
        .join('\n'),
      ['order-a'],
    );
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([ADMIN_TRACKING_INPUT_LIMIT_ERROR]);
  });

  it('allows 100 invoice rows followed by a final newline', () => {
    const rows = Array.from(
      { length: ADMIN_TRACKING_MAX_ROWS },
      (_, index) => `order-${index},택배사,${index}`,
    );
    const selectedOrderIds = rows.map((_, index) => `order-${index}`);
    const result = validateAdminTrackingRows(`${rows.join('\n')}\n`, selectedOrderIds);

    expect(result.validRows).toHaveLength(ADMIN_TRACKING_MAX_ROWS);
    expect(result.errors).toEqual([]);
  });

  it('rejects negative or out-of-range settings values', () => {
    expect(
      validateAdminSettingsDraft({ shippingFee: '-1', businessDiscountRate: '100.1' }),
    ).toEqual([
      'shippingFee: 0 이상 숫자로 입력해 주세요.',
      'businessDiscountRate: 할인율은 100% 이하여야 합니다.',
    ]);
  });

  it('keeps synthetic withdrawal contacts masked', () => {
    expect(ADMIN_WITHDRAWN_MEMBER_FIXTURES).toHaveLength(2);
    expect(
      ADMIN_WITHDRAWN_MEMBER_FIXTURES.every(
        (member) => member.email.includes('*') && member.phone.includes('*'),
      ),
    ).toBe(true);
  });
});
