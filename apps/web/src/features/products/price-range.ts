/** 상품 목록 가격 필터에 적용된 범위. 단위는 원이며 비어 있으면 그 쪽은 제한하지 않습니다. */
export interface AppliedPrice {
  min?: number;
  max?: number;
}

export type PriceInputError = { field: 'min' | 'max' | 'range'; message: string };

export type PriceInputParseResult =
  { isValid: true; price: AppliedPrice } | { isValid: false; error: PriceInputError };

/** 입력창은 만원 단위 정수를 받고, API에는 원 단위로 보냅니다. */
export const PRICE_UNIT_WON = 10_000;

/** 입력 가능한 최대 가격(만원). 원 단위로 환산해도 JavaScript 안전 정수 범위 안에 머물게 하는 상한입니다. */
export const MAX_PRICE_IN_MAN_WON = 999_999;
/**
 * 입력창에 남기는 최대 자릿수. 상한보다 한 자리 더 받아 상한 초과를 오류로 알리되,
 * `maxLength`로 붙여넣기 원문을 먼저 자르지 않도록 정제(`\D` 제거) 뒤에 적용합니다.
 */
export const PRICE_INPUT_MAX_DIGITS = String(MAX_PRICE_IN_MAN_WON).length + 1;

/** 숫자가 아닌 문자를 모두 제거하고 자릿수를 제한합니다. 붙여넣기·전각 숫자·한글 입력 대응. */
export function sanitizePriceDigits(rawText: string): string {
  return rawText.replace(/\D/g, '').slice(0, PRICE_INPUT_MAX_DIGITS);
}

/** 숫자 문자열을 정수로 바꿉니다. 빈 문자열은 undefined이며 앞자리 0은 숫자 변환으로 정규화됩니다. */
function parseManWon(digits: string): number | undefined {
  return digits === '' ? undefined : Number(digits);
}

/**
 * 최소·최대 입력(만원)을 검증하고 원 단위 범위로 바꿉니다.
 * 최소 0은 "제한 없음"으로 보고, 최대 0은 오류입니다. 최소가 최대보다 크면 자동으로 바꾸지 않고 오류로 돌려줍니다.
 */
export function parsePriceInput(minText: string, maxText: string): PriceInputParseResult {
  const minInMan = parseManWon(sanitizePriceDigits(minText));
  const maxInMan = parseManWon(sanitizePriceDigits(maxText));

  if (minInMan !== undefined && minInMan > MAX_PRICE_IN_MAN_WON) {
    return {
      isValid: false,
      error: {
        field: 'min',
        message:
          '최소 가격은 ' +
          MAX_PRICE_IN_MAN_WON.toLocaleString('ko-KR') +
          '만원 이하로 입력해 주세요.',
      },
    };
  }
  if (maxInMan !== undefined && maxInMan > MAX_PRICE_IN_MAN_WON) {
    return {
      isValid: false,
      error: {
        field: 'max',
        message:
          '최대 가격은 ' +
          MAX_PRICE_IN_MAN_WON.toLocaleString('ko-KR') +
          '만원 이하로 입력해 주세요.',
      },
    };
  }
  if (maxInMan === 0) {
    return {
      isValid: false,
      error: { field: 'max', message: '최대 가격은 1만원 이상으로 입력해 주세요.' },
    };
  }

  // 최소 0은 가격 조건이 없는 것과 같으므로 보내지 않습니다(0을 보내면 가격 미공개 상품이 빠집니다).
  const effectiveMinInMan = minInMan === 0 ? undefined : minInMan;
  if (effectiveMinInMan !== undefined && maxInMan !== undefined && effectiveMinInMan > maxInMan) {
    return {
      isValid: false,
      error: { field: 'range', message: '최소 가격은 최대 가격보다 클 수 없습니다.' },
    };
  }

  const price: AppliedPrice = {};
  if (effectiveMinInMan !== undefined) price.min = effectiveMinInMan * PRICE_UNIT_WON;
  if (maxInMan !== undefined) price.max = maxInMan * PRICE_UNIT_WON;
  return { isValid: true, price };
}

/** 적용된 원 단위 가격을 입력창에 다시 보여 줄 만원 단위 문자열로 바꿉니다. */
export function formatPriceInputValue(priceInWon: number | undefined): string {
  return priceInWon === undefined ? '' : String(priceInWon / PRICE_UNIT_WON);
}

function formatManWon(priceInWon: number): string {
  return (priceInWon / PRICE_UNIT_WON).toLocaleString('ko-KR') + '만원';
}

/** 활성 필터 칩에 쓰는 가격 라벨. 가격 조건이 없으면 undefined입니다. */
export function formatPriceChipLabel(appliedPrice: AppliedPrice): string | undefined {
  const { min, max } = appliedPrice;
  if (min !== undefined && max !== undefined) return formatManWon(min) + ' ~ ' + formatManWon(max);
  if (min !== undefined) return formatManWon(min) + ' 이상';
  if (max !== undefined) return formatManWon(max) + ' 이하';
  return undefined;
}
