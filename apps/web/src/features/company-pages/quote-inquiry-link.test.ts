import { describe, expect, it } from 'vitest';
import { buildQuoteInquiryHref } from './quote-inquiry-link';

describe('buildQuoteInquiryHref', () => {
  it('preserves each selected line and encodes its product, option, and quantity', () => {
    expect(
      buildQuoteInquiryHref([
        { productId: 'safety/helmet', optionId: 'color:white', quantity: 4 },
        { productId: 'safety/helmet', optionId: 'color:black', quantity: 2 },
        { productId: 'gloves', optionId: null, quantity: 1 },
      ]),
    ).toBe(
      '/solutions?productId=safety%2Fhelmet&optionId=color%3Awhite&quantity=4&productId=safety%2Fhelmet&optionId=color%3Ablack&quantity=2&productId=gloves&optionId=&quantity=1',
    );
  });

  it('keeps option and quantity parameters aligned when an earlier selection omits them', () => {
    expect(
      buildQuoteInquiryHref([
        { productId: 'helmet' },
        { productId: 'gloves', optionId: 'size:large', quantity: 6 },
      ]),
    ).toBe(
      '/solutions?productId=helmet&optionId=&quantity=1&productId=gloves&optionId=size%3Alarge&quantity=6',
    );
  });

  it('uses the empty quote page URL when no product is selected', () => {
    expect(buildQuoteInquiryHref()).toBe('/solutions');
  });
});
