export interface ProductInquirySelection {
  productId: string;
  optionId?: string | null;
  quantity?: number;
}

/** 상품 상세·장바구니에서 선택한 상품 문맥을 고객센터 문의 화면에 전달합니다. */
export function buildProductInquiryHref(selections: readonly ProductInquirySelection[] = []) {
  const query = new URLSearchParams();
  selections.forEach(({ productId, optionId, quantity }) => {
    query.append('productId', productId);
    query.append('optionId', optionId ?? '');
    query.append('quantity', String(quantity ?? 1));
  });
  const queryString = query.toString();
  return queryString ? `/support/inquiry?${queryString}` : '/support/inquiry';
}
