import {
  CART_MAX_QUANTITY,
  createCartOptionId,
  formatCartOptionLabel,
  resolveCartOption,
} from '@eum/api/cart';
import type { Product, ProductOption, ProductOptionChoice } from '@eum/api/types';

/** 옵션 없는 기본 구성 줄의 식별자 */
export const BASE_LINE_ID = 'base';

/** 고르는 중인 옵션 선택값(옵션 ID → 선택지 ID) */
export type OptionChoices = Readonly<Record<string, string>>;

/**
 * 구매 영역에 쌓이는 선택 줄 하나.
 * lineId는 장바구니 옵션 식별자와 같은 규칙(@eum/api/cart)으로 만들어, 같은 구성을 다시 고르면 수량만 늘립니다.
 */
export interface PurchaseLine {
  lineId: string;
  optionId: string | null;
  optionLabel: string | null;
  /** 줄에 표시할 문구(옵션이 없으면 상품명) */
  displayLabel: string;
  /** 고른 선택지 추가금 합계 */
  priceDelta: number;
  /** 선택 SKU에 연결된 이미지 URL. 이미지가 없으면 null */
  skuImageUrl?: string | null;
  quantity: number;
}

/** 수량이 정해지기 전의 줄(buildPurchaseLine 결과) */
export type PurchaseLineDraft = Omit<PurchaseLine, 'quantity'>;

/**
 * 상품의 옵션 확정 방식.
 * - none: 옵션이 없어 기본 줄 하나로 시작합니다.
 * - auto: 필수 옵션이 있어, 필수 옵션을 모두 고르는 순간 줄이 생깁니다(그때까지 고른 선택 옵션 포함).
 * - manual: 선택 옵션만 있어, "추가" 버튼으로 줄을 확정합니다(아무것도 안 골랐으면 기본 구성).
 */
export type OptionCommitMode = 'none' | 'auto' | 'manual';

/** 상품 옵션 구성으로 확정 방식을 정하는 함수 */
export function getOptionCommitMode(product: Pick<Product, 'options'>): OptionCommitMode {
  if (product.options.length === 0) return 'none';
  return product.options.some((productOption) => productOption.required) ? 'auto' : 'manual';
}

/** 처음 보여 줄 선택 줄. 옵션이 하나라도 있으면 기본 줄을 만들지 않습니다. */
export function createInitialPurchaseLines(
  product: Pick<Product, 'name' | 'options'>,
): PurchaseLine[] {
  if (product.options.length > 0) return [];
  return [
    {
      lineId: BASE_LINE_ID,
      optionId: null,
      optionLabel: null,
      displayLabel: product.name,
      priceDelta: 0,
      quantity: 1,
    },
  ];
}

/** 아직 고르지 않은 필수 옵션 목록(상품 옵션 순서) */
export function getMissingRequiredOptions(
  product: Pick<Product, 'options'>,
  choices: OptionChoices,
): ProductOption[] {
  return product.options.filter(
    (productOption) => productOption.required && !findChoice(productOption, choices),
  );
}

// 선택값이 상품 옵션에 실제로 있는 선택지인지 확인해 돌려주는 함수(없는 ID는 무시)
function findChoice(
  productOption: ProductOption,
  choices: OptionChoices,
): ProductOptionChoice | undefined {
  const choiceId = choices[productOption.id];
  if (!choiceId) return undefined;
  return productOption.choices.find((choice) => choice.id === choiceId);
}

/**
 * 고른 옵션으로 선택 줄 초안을 만드는 순수 함수.
 * - 필수 옵션이 하나라도 빠졌으면 null입니다.
 * - 줄 식별자·문구·추가금은 고른 순서가 아니라 상품 옵션 순서로 만들므로, 고르는 순서가 결과를 바꾸지 않습니다.
 * - 고른 옵션이 하나도 없으면(선택 옵션만 있는 상품의 기본 구성) 상품명 기본 줄입니다.
 * - 상품에 없는 옵션·선택지 ID는 무시합니다.
 */
export function buildPurchaseLine(
  product: Pick<Product, 'name' | 'options' | 'skus'>,
  choices: OptionChoices,
): PurchaseLineDraft | null {
  if (getMissingRequiredOptions(product, choices).length > 0) return null;
  const chosenOptions = product.options.flatMap((productOption) => {
    const choice = findChoice(productOption, choices);
    return choice ? [{ productOption, choice }] : [];
  });
  const optionId = createCartOptionId(
    chosenOptions.map(({ productOption, choice }) => ({
      optionId: productOption.id,
      choiceId: choice.id,
    })),
  );
  const optionLabel = formatCartOptionLabel(
    chosenOptions.map(({ productOption, choice }) => ({
      optionLabel: productOption.label,
      choiceLabel: choice.label,
    })),
  );
  const optionResolution = resolveCartOption(product, optionId);
  if (!optionResolution.isAvailable) return null;
  return {
    lineId: optionId ?? BASE_LINE_ID,
    optionId,
    optionLabel,
    displayLabel: optionLabel ?? product.name,
    priceDelta: optionResolution.priceDelta,
    ...(optionResolution.sku ? { skuImageUrl: optionResolution.sku.imageUrl } : {}),
  };
}

/** 줄 초안을 목록에 더하는 함수. 같은 구성이 이미 있으면 수량만 1 늘립니다(상한 CART_MAX_QUANTITY). */
export function addPurchaseLine(
  currentLines: readonly PurchaseLine[],
  lineDraft: PurchaseLineDraft,
): PurchaseLine[] {
  if (currentLines.some((line) => line.lineId === lineDraft.lineId)) {
    return currentLines.map((line) =>
      line.lineId === lineDraft.lineId
        ? { ...line, quantity: Math.min(CART_MAX_QUANTITY, line.quantity + 1) }
        : line,
    );
  }
  return [...currentLines, { ...lineDraft, quantity: 1 }];
}
