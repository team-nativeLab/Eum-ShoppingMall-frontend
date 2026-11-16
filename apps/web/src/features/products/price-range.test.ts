import { describe, expect, it } from 'vitest';
import {
  MAX_PRICE_IN_MAN_WON,
  PRICE_INPUT_MAX_DIGITS,
  formatPriceChipLabel,
  formatPriceInputValue,
  parsePriceInput,
  sanitizePriceDigits,
} from './price-range';

describe('sanitizePriceDigits', () => {
  it('keeps digits only', () => {
    expect(sanitizePriceDigits('1,2a3 만원-')).toBe('123');
    expect(sanitizePriceDigits('')).toBe('');
    expect(sanitizePriceDigits('abc')).toBe('');
  });

  it('strips separators from pasted text before limiting the length', () => {
    expect(sanitizePriceDigits('1,000,000')).toBe('1000000');
    expect(sanitizePriceDigits('12345678901')).toBe('1234567');
  });
});

describe('parsePriceInput', () => {
  it('treats two empty inputs as a cleared filter rather than an error', () => {
    expect(parsePriceInput('', '')).toEqual({ isValid: true, price: {} });
  });

  it('converts both bounds from 만원 to won', () => {
    expect(parsePriceInput('5', '30')).toEqual({
      isValid: true,
      price: { min: 50_000, max: 300_000 },
    });
  });

  it('accepts a single bound', () => {
    expect(parsePriceInput('5', '')).toEqual({ isValid: true, price: { min: 50_000 } });
    expect(parsePriceInput('', '30')).toEqual({ isValid: true, price: { max: 300_000 } });
  });

  it('allows equal bounds', () => {
    expect(parsePriceInput('10', '10')).toEqual({
      isValid: true,
      price: { min: 100_000, max: 100_000 },
    });
  });

  it('normalizes leading zeros', () => {
    expect(parsePriceInput('007', '0030')).toEqual({
      isValid: true,
      price: { min: 70_000, max: 300_000 },
    });
  });

  it('drops a zero minimum instead of sending it', () => {
    expect(parsePriceInput('0', '')).toEqual({ isValid: true, price: {} });
    expect(parsePriceInput('000', '30')).toEqual({ isValid: true, price: { max: 300_000 } });
  });

  it('rejects a zero maximum', () => {
    const parsedPrice = parsePriceInput('', '0');
    expect(parsedPrice.isValid).toBe(false);
    if (parsedPrice.isValid) return;
    expect(parsedPrice.error.field).toBe('max');
    expect(parsePriceInput('0', '0').isValid).toBe(false);
  });

  it('rejects a minimum greater than the maximum without swapping them', () => {
    const parsedPrice = parsePriceInput('30', '5');
    expect(parsedPrice).toEqual({
      isValid: false,
      error: { field: 'range', message: '최소 가격은 최대 가격보다 클 수 없습니다.' },
    });
  });

  it('rejects values above the upper limit', () => {
    expect(parsePriceInput(String(MAX_PRICE_IN_MAN_WON), '')).toEqual({
      isValid: true,
      price: { min: MAX_PRICE_IN_MAN_WON * 10_000 },
    });
    const minOverLimit = parsePriceInput(String(MAX_PRICE_IN_MAN_WON + 1), '');
    expect(minOverLimit.isValid).toBe(false);
    if (!minOverLimit.isValid) expect(minOverLimit.error.field).toBe('min');
    const maxOverLimit = parsePriceInput('', String(MAX_PRICE_IN_MAN_WON + 1));
    expect(maxOverLimit.isValid).toBe(false);
    if (!maxOverLimit.isValid) expect(maxOverLimit.error.field).toBe('max');
  });

  it('strips non-digit characters before validating', () => {
    expect(parsePriceInput('1,0', '2a0')).toEqual({
      isValid: true,
      price: { min: 100_000, max: 200_000 },
    });
  });

  it('keeps one digit beyond the upper limit so an overflow is reported', () => {
    expect(PRICE_INPUT_MAX_DIGITS).toBe(String(MAX_PRICE_IN_MAN_WON).length + 1);
    const pastedMax = sanitizePriceDigits('1,000,000');
    const parsedPaste = parsePriceInput('', pastedMax);
    expect(parsedPaste.isValid).toBe(false);
    if (!parsedPaste.isValid) expect(parsedPaste.error.field).toBe('max');
  });
});

describe('formatPriceInputValue', () => {
  it('converts won back to 만원 text and leaves unset bounds empty', () => {
    expect(formatPriceInputValue(50_000)).toBe('5');
    expect(formatPriceInputValue(undefined)).toBe('');
  });
});

describe('formatPriceChipLabel', () => {
  it('describes a range, a lower bound and an upper bound', () => {
    expect(formatPriceChipLabel({ min: 50_000, max: 300_000 })).toBe('5만원 ~ 30만원');
    expect(formatPriceChipLabel({ min: 50_000 })).toBe('5만원 이상');
    expect(formatPriceChipLabel({ max: 300_000 })).toBe('30만원 이하');
  });

  it('groups thousands with the ko-KR locale', () => {
    expect(formatPriceChipLabel({ min: 12_340_000 })).toBe('1,234만원 이상');
  });

  it('returns nothing when no price bound is applied', () => {
    expect(formatPriceChipLabel({})).toBeUndefined();
  });
});
