import { describe, expect, it } from 'vitest';
import { parseCheckoutSelection, serializeCheckoutSelection } from './checkout-selection-storage';

describe('checkout selection tab storage', () => {
  it('round trips a partial cart selection without selecting other items', () => {
    const serializedSelection = serializeCheckoutSelection({
      cartItemIds: ['cart-item-a'],
      directLines: [],
      selectionMode: 'explicit',
      selectionSource: 'cart',
      checkoutStarted: true,
    });

    expect(serializedSelection).not.toBeNull();
    expect(parseCheckoutSelection(serializedSelection ?? null)).toEqual({
      cartItemIds: ['cart-item-a'],
      directLines: [],
      selectionMode: 'explicit',
      selectionSource: 'cart',
      checkoutStarted: true,
    });
  });

  it('fails closed when a started checkout selection is corrupt instead of defaulting to all items', () => {
    expect(parseCheckoutSelection('{invalid')).toEqual({
      cartItemIds: [],
      directLines: [],
      selectionMode: 'explicit',
      selectionSource: 'cart',
      checkoutStarted: true,
    });
  });

  it('stores only checkout item IDs and selection flow state', () => {
    const serializedSelection = serializeCheckoutSelection({
      cartItemIds: ['cart-item-a', 'cart-item-b'],
      directLines: [],
      selectionMode: 'explicit',
      selectionSource: 'cart',
      checkoutStarted: true,
    });

    expect(JSON.parse(serializedSelection ?? 'null')).toEqual({
      version: 2,
      cartItemIds: ['cart-item-a', 'cart-item-b'],
      directLines: [],
      selectionMode: 'explicit',
      selectionSource: 'cart',
      checkoutStarted: true,
    });
  });

  it('keeps first-visit default selection implicit', () => {
    expect(
      serializeCheckoutSelection({
        cartItemIds: [],
        directLines: [],
        selectionMode: 'defaultAll',
        selectionSource: 'cart',
        checkoutStarted: false,
      }),
    ).toBeNull();
    expect(parseCheckoutSelection(null)).toEqual({
      cartItemIds: [],
      directLines: [],
      selectionMode: 'defaultAll',
      selectionSource: 'cart',
      checkoutStarted: false,
    });
  });

  it('round trips direct lines with the prior cart selection without persisting product data', () => {
    const selection = {
      cartItemIds: ['cart-item-a'],
      directLines: [
        { productId: 'product-a', optionId: 'size:m', quantity: 2 },
        { productId: 'product-a', optionId: 'size:l', quantity: 1 },
      ],
      selectionMode: 'explicit' as const,
      selectionSource: 'direct' as const,
      checkoutStarted: true,
    };

    const serializedSelection = serializeCheckoutSelection(selection);

    expect(parseCheckoutSelection(serializedSelection)).toEqual(selection);
    expect(JSON.parse(serializedSelection ?? 'null')).toEqual({
      version: 2,
      ...selection,
    });
  });

  it('round trips a default-all cart selection alongside a direct checkout intent', () => {
    const selection = {
      cartItemIds: [],
      directLines: [{ productId: 'product-a', optionId: null, quantity: 1 }],
      selectionMode: 'defaultAll' as const,
      selectionSource: 'direct' as const,
      checkoutStarted: true,
    };

    expect(parseCheckoutSelection(serializeCheckoutSelection(selection))).toEqual(selection);
  });

  it('migrates an existing cart selection snapshot from version 1', () => {
    expect(
      parseCheckoutSelection(
        JSON.stringify({
          version: 1,
          cartItemIds: ['cart-item-a'],
          selectionMode: 'explicit',
          checkoutStarted: true,
        }),
      ),
    ).toEqual({
      cartItemIds: ['cart-item-a'],
      directLines: [],
      selectionMode: 'explicit',
      selectionSource: 'cart',
      checkoutStarted: true,
    });
  });

  it('fails closed for malformed direct lines and duplicate product-option lines', () => {
    const malformedSelection = {
      version: 2,
      cartItemIds: [],
      directLines: [{ productId: 'product-a', optionId: 'size:m', quantity: 1000 }],
      selectionMode: 'explicit',
      selectionSource: 'direct',
      checkoutStarted: true,
    };
    const duplicateSelection = {
      ...malformedSelection,
      directLines: [
        { productId: 'product-a', optionId: 'size:m', quantity: 1 },
        { productId: 'product-a', optionId: 'size:m', quantity: 1 },
      ],
    };
    const failedClosed = {
      cartItemIds: [],
      directLines: [],
      selectionMode: 'explicit',
      selectionSource: 'cart',
      checkoutStarted: true,
    };

    expect(parseCheckoutSelection(JSON.stringify(malformedSelection))).toEqual(failedClosed);
    expect(parseCheckoutSelection(JSON.stringify(duplicateSelection))).toEqual(failedClosed);
  });
});
