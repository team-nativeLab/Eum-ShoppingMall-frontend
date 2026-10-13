import { describe, expect, it } from 'vitest';
import { parseCheckoutSelection, serializeCheckoutSelection } from './checkout-selection-storage';

describe('checkout selection tab storage', () => {
  it('round trips a partial cart selection without selecting other items', () => {
    const serializedSelection = serializeCheckoutSelection({
      cartItemIds: ['cart-item-a'],
      selectionMode: 'explicit',
      checkoutStarted: true,
    });

    expect(serializedSelection).not.toBeNull();
    expect(parseCheckoutSelection(serializedSelection ?? null)).toEqual({
      cartItemIds: ['cart-item-a'],
      selectionMode: 'explicit',
      checkoutStarted: true,
    });
  });

  it('fails closed when a started checkout selection is corrupt instead of defaulting to all items', () => {
    expect(parseCheckoutSelection('{invalid')).toEqual({
      cartItemIds: [],
      selectionMode: 'explicit',
      checkoutStarted: true,
    });
  });

  it('stores only checkout item IDs and selection flow state', () => {
    const serializedSelection = serializeCheckoutSelection({
      cartItemIds: ['cart-item-a', 'cart-item-b'],
      selectionMode: 'explicit',
      checkoutStarted: true,
    });

    expect(JSON.parse(serializedSelection ?? 'null')).toEqual({
      version: 1,
      cartItemIds: ['cart-item-a', 'cart-item-b'],
      selectionMode: 'explicit',
      checkoutStarted: true,
    });
  });

  it('keeps first-visit default selection implicit', () => {
    expect(
      serializeCheckoutSelection({
        cartItemIds: [],
        selectionMode: 'defaultAll',
        checkoutStarted: false,
      }),
    ).toBeNull();
    expect(parseCheckoutSelection(null)).toEqual({
      cartItemIds: [],
      selectionMode: 'defaultAll',
      checkoutStarted: false,
    });
  });
});
