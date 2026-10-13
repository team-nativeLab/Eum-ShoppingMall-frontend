import { CART_MAX_QUANTITY } from '@eum/api/cart';
import type { ProductOption } from '@eum/api/types';
import { describe, expect, it } from 'vitest';
import {
  addPurchaseLine,
  BASE_LINE_ID,
  buildPurchaseLine,
  createInitialPurchaseLines,
  getMissingRequiredOptions,
  getOptionCommitMode,
} from './purchase-lines';

const sizeOption: ProductOption = {
  id: 'size',
  label: '사이즈',
  required: true,
  choices: [
    { id: 'm', label: 'M', priceDelta: 0 },
    { id: 'l', label: 'L', priceDelta: 1000 },
  ],
};
const colorOption: ProductOption = {
  id: 'color',
  label: '색상',
  required: true,
  choices: [{ id: 'black', label: '검정', priceDelta: 0 }],
};
const wristOption: ProductOption = {
  id: 'wrist',
  label: '손목 토시',
  required: false,
  choices: [{ id: 'add', label: '추가', priceDelta: 3000 }],
};

const buildTestProduct = (options: ProductOption[]) => ({ name: '테스트 장갑', options });

describe('getOptionCommitMode / createInitialPurchaseLines', () => {
  it('옵션이 없으면 기본 줄 하나로 시작합니다', () => {
    const product = buildTestProduct([]);
    expect(getOptionCommitMode(product)).toBe('none');
    expect(createInitialPurchaseLines(product)).toEqual([
      expect.objectContaining({ lineId: BASE_LINE_ID, displayLabel: '테스트 장갑', quantity: 1 }),
    ]);
  });

  it('선택 옵션만 있어도 기본 줄을 만들지 않고 "추가"로 확정합니다', () => {
    const product = buildTestProduct([wristOption]);
    expect(getOptionCommitMode(product)).toBe('manual');
    expect(createInitialPurchaseLines(product)).toEqual([]);
  });

  it('필수 옵션이 있으면 자동 확정이고 기본 줄이 없습니다', () => {
    const product = buildTestProduct([sizeOption, wristOption]);
    expect(getOptionCommitMode(product)).toBe('auto');
    expect(createInitialPurchaseLines(product)).toEqual([]);
  });
});

describe('buildPurchaseLine', () => {
  it('필수 옵션이 빠지면 null이고, 빠진 옵션을 상품 순서로 알려 줍니다', () => {
    const product = buildTestProduct([sizeOption, colorOption, wristOption]);
    expect(buildPurchaseLine(product, { wrist: 'add', color: 'black' })).toBeNull();
    expect(getMissingRequiredOptions(product, { wrist: 'add' }).map(({ id }) => id)).toEqual([
      'size',
      'color',
    ]);
  });

  it('필수 옵션이 채워지는 순간 미리 고른 선택 옵션까지 한 줄로 만듭니다', () => {
    const product = buildTestProduct([sizeOption, wristOption]);
    expect(buildPurchaseLine(product, { wrist: 'add', size: 'l' })).toEqual({
      lineId: 'size:l|wrist:add',
      optionId: 'size:l|wrist:add',
      optionLabel: '사이즈: L / 손목 토시: 추가',
      displayLabel: '사이즈: L / 손목 토시: 추가',
      priceDelta: 4000,
    });
  });

  it('고르는 순서가 달라도 같은 결과입니다', () => {
    const product = buildTestProduct([sizeOption, colorOption, wristOption]);
    const firstOrder = buildPurchaseLine(product, { size: 'm', color: 'black', wrist: 'add' });
    const secondOrder = buildPurchaseLine(product, { wrist: 'add', color: 'black', size: 'm' });
    expect(firstOrder).not.toBeNull();
    expect(secondOrder).toEqual(firstOrder);
  });

  it('선택 옵션만 있는 상품에서 아무것도 안 고르면 상품명 기본 줄입니다', () => {
    expect(buildPurchaseLine(buildTestProduct([wristOption]), {})).toEqual({
      lineId: BASE_LINE_ID,
      optionId: null,
      optionLabel: null,
      displayLabel: '테스트 장갑',
      priceDelta: 0,
    });
  });

  it('상품에 없는 옵션·선택지 ID는 무시합니다', () => {
    const product = buildTestProduct([sizeOption]);
    expect(buildPurchaseLine(product, { size: 'xxl' })).toBeNull();
    expect(buildPurchaseLine(product, { size: 'm', unknown: 'x' })?.lineId).toBe('size:m');
  });
});

describe('addPurchaseLine', () => {
  const lineDraft = buildPurchaseLine(buildTestProduct([sizeOption]), { size: 'm' })!;

  it('새 구성은 수량 1로 뒤에 붙고, 같은 구성은 수량만 늘립니다', () => {
    const oneLine = addPurchaseLine([], lineDraft);
    expect(oneLine).toEqual([{ ...lineDraft, quantity: 1 }]);
    expect(addPurchaseLine(oneLine, lineDraft)).toEqual([{ ...lineDraft, quantity: 2 }]);
  });

  it('수량은 장바구니 상한을 넘지 않습니다', () => {
    const fullLine = [{ ...lineDraft, quantity: CART_MAX_QUANTITY }];
    expect(addPurchaseLine(fullLine, lineDraft)[0]?.quantity).toBe(CART_MAX_QUANTITY);
  });
});
