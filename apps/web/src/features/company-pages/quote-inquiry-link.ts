/** 상품 상세·장바구니에서 선택한 품목을 견적 화면의 초기 선택으로 전달합니다. */
export function buildQuoteInquiryHref(productIds: readonly string[] = []) {
  const query = new URLSearchParams();
  [...new Set(productIds)].forEach((productId) => query.append('productId', productId));
  const queryString = query.toString();
  return queryString ? `/solutions?${queryString}` : '/solutions';
}
