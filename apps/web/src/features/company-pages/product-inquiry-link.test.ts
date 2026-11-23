import { describe, expect, it } from 'vitest';
import { buildProductInquiryHref } from './product-inquiry-link';

describe('buildProductInquiryHref', () => {
  it('routes selected product lines to support with options and quantities', () => {
    const href = buildProductInquiryHref([
      { productId: 'helmet-1', optionId: 'color:white', quantity: 3 },
      { productId: 'glove-2', quantity: 2 },
    ]);
    const query = new URLSearchParams(href.split('?')[1]);

    expect(href.startsWith('/support/inquiry?')).toBe(true);
    expect(query.getAll('productId')).toEqual(['helmet-1', 'glove-2']);
    expect(query.getAll('optionId')).toEqual(['color:white', '']);
    expect(query.getAll('quantity')).toEqual(['3', '2']);
  });

  it('opens the support form without product context when no lines are selected', () => {
    expect(buildProductInquiryHref()).toBe('/support/inquiry');
  });
});
