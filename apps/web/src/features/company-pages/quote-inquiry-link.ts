export interface QuoteInquirySelection {
  productId: string;
  optionId?: string | null;
  quantity?: number;
}

/** 상품 상세·장바구니에서 선택한 품목 줄을 견적 화면의 초기 선택으로 전달합니다. */
export function buildQuoteInquiryHref(selections: readonly QuoteInquirySelection[] = []) {
  const query = new URLSearchParams();
  selections.forEach(({ productId, optionId, quantity }) => {
    query.append('productId', productId);
    query.append('optionId', optionId ?? '');
    query.append('quantity', String(quantity ?? 1));
  });
  const queryString = query.toString();
  return queryString ? `/solutions?${queryString}` : '/solutions';
}
