import { describe, expect, it } from 'vitest';
import { buildQuoteInquiryHref } from './quote-inquiry-link';

describe('buildQuoteInquiryHref', () => {
  it('encodes unique selected product IDs into the quote page URL', () => {
    expect(buildQuoteInquiryHref(['safety/helmet', 'safety/helmet', 'gloves'])).toBe(
      '/solutions?productId=safety%2Fhelmet&productId=gloves',
    );
  });

  it('uses the empty quote page URL when no product is selected', () => {
    expect(buildQuoteInquiryHref()).toBe('/solutions');
  });
});
