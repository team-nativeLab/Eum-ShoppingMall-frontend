import type { ApiConfig } from './config';
import { ApiError } from './errors';
import { createApiClient } from './http-client';
import type { ProductLimitParams, ProductListParams, ShopApi } from './shop-api';
import type {
  ApiProductDetail,
  ApiProductDetailSku,
  BrandSummary,
  Category,
  FacetCount,
  PagedResult,
  ProductFacets,
  ProductImage,
  ProductListItem,
  ProductSpecification,
  ProductSummary,
  ProductSuggestion,
  HomeContent,
  ShopPopup,
} from './types';
import { sanitizeRedirectPath } from './redirect';

type JsonRecord = Record<string, unknown>;

function asRecord(input: unknown, field: string): JsonRecord {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ApiError('INVALID_RESPONSE', `실제 API 응답(${field}) 형식이 올바르지 않습니다.`);
  }
  return input as JsonRecord;
}

function asString(input: unknown, field: string): string {
  if (typeof input !== 'string') {
    throw new ApiError('INVALID_RESPONSE', `실제 API 응답(${field}) 형식이 올바르지 않습니다.`);
  }
  return input;
}

function asNullableString(input: unknown, field: string): string | null {
  return input === null ? null : asString(input, field);
}

function asNumber(input: unknown, field: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    throw new ApiError('INVALID_RESPONSE', `실제 API 응답(${field}) 형식이 올바르지 않습니다.`);
  }
  return input;
}

function asNullableNumber(input: unknown, field: string): number | null {
  return input === null ? null : asNumber(input, field);
}

function asSafeId(input: unknown, field: string): string {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 0) {
    throw new ApiError('INVALID_RESPONSE', `실제 API 응답(${field}) ID가 안전한 정수가 아닙니다.`);
  }
  return String(input);
}

function asBoolean(input: unknown, field: string): boolean {
  if (typeof input !== 'boolean') {
    throw new ApiError('INVALID_RESPONSE', `실제 API 응답(${field}) 형식이 올바르지 않습니다.`);
  }
  return input;
}

function asImageUrl(input: unknown, field: string): string {
  const imageUrl = asString(input, field);
  if (
    !imageUrl ||
    imageUrl.includes('\\') ||
    Array.from(imageUrl).some((character) => (character.codePointAt(0) ?? 0) < 32)
  ) {
    throw new ApiError('INVALID_RESPONSE', `실제 API 응답(${field}) URL 형식이 올바르지 않습니다.`);
  }
  if (imageUrl.startsWith('/') && !imageUrl.startsWith('//')) return imageUrl;
  try {
    const parsedUrl = new URL(imageUrl);
    if (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      !parsedUrl.username &&
      !parsedUrl.password
    ) {
      return imageUrl;
    }
  } catch {
    // API 경계에서는 브라우저가 해석할 수 없는 이미지 주소를 허용하지 않습니다.
  }
  throw new ApiError('INVALID_RESPONSE', `실제 API 응답(${field}) URL 형식이 올바르지 않습니다.`);
}

function mapProductDetailImage(input: unknown, productId: string, index: number): ProductImage {
  const image = asRecord(input, '상품 상세 이미지');
  return {
    id: `api-${productId}-image-${index}`,
    url: asImageUrl(image.url, '상품 상세 이미지'),
    alt: asString(image.alt, '상품 이미지 대체 텍스트'),
  };
}

function mapProductDetailSpecification(input: unknown): ProductSpecification {
  const specification = asRecord(input, '상품 사양');
  return {
    label: asString(specification.label, '상품 사양 이름'),
    value: asString(specification.value, '상품 사양 값'),
  };
}

function mapProductDetailSku(input: unknown, priceVisible: boolean): ApiProductDetailSku {
  const sku = asRecord(input, '상품 SKU');
  const skuPrice = asNullableNumber(sku.price, 'SKU 판매가');
  if (priceVisible && skuPrice === null) {
    throw new ApiError('INVALID_RESPONSE', '금액 표시 상품의 SKU 판매가가 없습니다.');
  }
  return {
    id: asSafeId(sku.id, 'SKU'),
    optionName: asString(sku.optionName, 'SKU 옵션 이름'),
    price: priceVisible ? skuPrice : null,
    soldOut: asBoolean(sku.soldOut, 'SKU 품절 여부'),
  };
}

function mapProductDetail(input: unknown, requestedProductId: string): ApiProductDetail {
  const detail = asRecord(input, '상품 상세');
  const productId = asSafeId(detail.id, '상품');
  if (productId !== requestedProductId) {
    throw new ApiError(
      'INVALID_RESPONSE',
      '실제 API 응답 상품 ID가 요청한 상품과 일치하지 않습니다.',
    );
  }

  const status = asString(detail.status, '상품 상태');
  if (status === 'HIDDEN' || status === 'DELETED') {
    throw new ApiError('NOT_FOUND', '상품을 찾을 수 없습니다.');
  }
  if (status !== 'ON_SALE' && status !== 'SOLD_OUT') {
    throw new ApiError('INVALID_RESPONSE', '실제 API 응답(상품 상태)을 처리할 수 없습니다.');
  }

  const soldOut = asBoolean(detail.soldOut, '품절 여부');
  if (soldOut !== (status === 'SOLD_OUT')) {
    throw new ApiError(
      'INVALID_RESPONSE',
      '실제 API 응답(상품 상태와 품절 여부)이 일치하지 않습니다.',
    );
  }

  const priceVisible = asBoolean(detail.priceVisible, '가격 표시 여부');
  const responsePrice = asNullableNumber(detail.price, '판매가');
  const responseListPrice = asNullableNumber(detail.listPrice, '정가');
  if (priceVisible && responsePrice === null) {
    throw new ApiError('INVALID_RESPONSE', '금액 표시 상품에 판매가가 없습니다.');
  }
  if (!Array.isArray(detail.certifications) || !Array.isArray(detail.images)) {
    throw new ApiError(
      'INVALID_RESPONSE',
      '실제 API 응답(상품 상세 목록) 형식이 올바르지 않습니다.',
    );
  }
  if (!Array.isArray(detail.skus) || !Array.isArray(detail.specifications)) {
    throw new ApiError(
      'INVALID_RESPONSE',
      '실제 API 응답(상품 상세 목록) 형식이 올바르지 않습니다.',
    );
  }

  const descriptionFormat = asString(detail.descriptionFormat, '상품 상세 서식');
  if (descriptionFormat !== 'PLAIN' && descriptionFormat !== 'RICH_V1') {
    throw new ApiError('INVALID_RESPONSE', '실제 API 응답(상품 상세 서식)을 처리할 수 없습니다.');
  }
  const reviewCount = asNumber(detail.reviewCount, '리뷰 수');
  if (!Number.isSafeInteger(reviewCount) || reviewCount < 0) {
    throw new ApiError('INVALID_RESPONSE', '실제 API 응답(리뷰 수) 형식이 올바르지 않습니다.');
  }

  const mappedImages = detail.images.map((image, index) =>
    mapProductDetailImage(image, productId, index),
  );
  const certifications = detail.certifications.map((certification) =>
    asString(asRecord(certification, '상품 인증').label, '상품 인증 표시 이름'),
  );
  const skus = detail.skus.map((sku) => mapProductDetailSku(sku, priceVisible));
  return {
    kind: 'api-detail',
    id: productId,
    name: asString(detail.name, '상품명'),
    brand: asNullableString(detail.brand, '브랜드'),
    categoryId: detail.categoryId === null ? null : asSafeId(detail.categoryId, '카테고리'),
    price: priceVisible ? responsePrice : null,
    listPrice: priceVisible ? responseListPrice : null,
    priceVisible,
    stockStatus: soldOut ? 'soldOut' : 'inStock',
    thumbnailUrl: detail.imageUrl === null ? null : asImageUrl(detail.imageUrl, '대표 상품 이미지'),
    summary: asNullableString(detail.summary, '상품 요약'),
    detailDescription: asString(detail.description, '상품 상세 설명'),
    detailDescriptionFormat: descriptionFormat === 'PLAIN' ? 'plain' : 'rich-v1',
    modelName: asNullableString(detail.modelName, '모델명'),
    images: mappedImages,
    skus,
    specifications: detail.specifications.map(mapProductDetailSpecification),
    certifications,
    countryOfOrigin: asNullableString(detail.countryOfOrigin, '원산지'),
    shippingEstimate: asNullableString(detail.shippingEstimate, '배송 예정'),
    rating: asNullableNumber(detail.rating, '평점'),
    reviewCount,
    isFeatured: asBoolean(detail.featured, '추천 상품 여부'),
    todayDeal: asBoolean(detail.todayDeal, '오늘의 상품 여부'),
  };
}

function mapProductSummary(input: unknown): ProductSummary {
  const summary = asRecord(input, '상품 목록');
  const status = asString(summary.status, '상품 상태');
  if (status === 'HIDDEN' || status === 'DELETED') {
    throw new ApiError(
      'INVALID_RESPONSE',
      '구매자에게 공개되지 않는 상품이 목록 응답에 포함되었습니다.',
    );
  }
  if (status !== 'ON_SALE' && status !== 'SOLD_OUT') {
    throw new ApiError('INVALID_RESPONSE', '실제 API 응답(상품 상태)을 처리할 수 없습니다.');
  }
  if (!Array.isArray(summary.certifications)) {
    throw new ApiError('INVALID_RESPONSE', '실제 API 응답(상품 인증) 형식이 올바르지 않습니다.');
  }
  const certifications = summary.certifications.map((entry) =>
    asString(asRecord(entry, '상품 인증').code, '상품 인증 코드'),
  );
  const soldOut = asBoolean(summary.soldOut, '품절 여부');
  if (soldOut !== (status === 'SOLD_OUT')) {
    throw new ApiError(
      'INVALID_RESPONSE',
      '실제 API 응답(상품 상태와 품절 여부)이 일치하지 않습니다.',
    );
  }
  const imageUrl = asNullableString(summary.imageUrl, '상품 이미지');
  return {
    kind: 'summary',
    id: asSafeId(summary.id, '상품'),
    name: asString(summary.name, '상품명'),
    brand: asNullableString(summary.brand, '브랜드') ?? '',
    categoryId: summary.categoryId === null ? null : asSafeId(summary.categoryId, '카테고리'),
    price: summary.price === null ? null : asNumber(summary.price, '판매가'),
    listPrice: summary.listPrice === null ? null : asNumber(summary.listPrice, '정가'),
    priceVisible: asBoolean(summary.priceVisible, '가격 표시 여부'),
    stockStatus: soldOut ? 'soldOut' : 'inStock',
    thumbnailUrl: imageUrl === null ? null : asImageUrl(imageUrl, '상품 이미지'),
    rating: summary.rating === null ? null : asNumber(summary.rating, '평점'),
    reviewCount: asNumber(summary.reviewCount, '리뷰 수'),
    certifications,
    isFeatured: asBoolean(summary.featured, '추천 상품 여부'),
    todayDeal: asBoolean(summary.todayDeal, '오늘의 상품 여부'),
    optionRequired: asBoolean(summary.optionRequired, '옵션 필수 여부'),
  };
}

function mapHomeContent(input: unknown): HomeContent {
  const home = asRecord(input, '홈 콘텐츠');
  const readArray = (field: string): unknown[] => {
    const value = home[field];
    if (value === undefined) return [];
    if (!Array.isArray(value))
      throw new ApiError('INVALID_RESPONSE', `실제 API 응답(${field}) 형식이 올바르지 않습니다.`);
    return value;
  };
  const safeDestination = (value: unknown, field: string) => {
    const rawPath = asString(value, field);
    const path = sanitizeRedirectPath(rawPath, '');
    return path === '' ? '' : path;
  };
  const heroSlides = readArray('heroSlides').map((entry) => {
    const slide = asRecord(entry, '히어로 배너');
    const title = slide.title;
    const tagline = slide.tagline === undefined ? [] : slide.tagline;
    if (!Array.isArray(title) || !title.every((line) => typeof line === 'string'))
      throw new ApiError(
        'INVALID_RESPONSE',
        '실제 API 응답(히어로 제목) 형식이 올바르지 않습니다.',
      );
    if (!Array.isArray(tagline) || !tagline.every((line) => typeof line === 'string'))
      throw new ApiError(
        'INVALID_RESPONSE',
        '실제 API 응답(히어로 태그라인) 형식이 올바르지 않습니다.',
      );
    const secondary = slide.secondaryCta;
    const secondaryCta =
      secondary === null
        ? null
        : secondary === undefined
          ? undefined
          : (() => {
              const link = asRecord(secondary, '보조 링크');
              const destination = safeDestination(link.destination, '보조 링크 경로');
              return destination
                ? { label: asString(link.label, '보조 링크 이름'), destination }
                : undefined;
            })();
    const destination = safeDestination(slide.destination, '히어로 링크 경로');
    return {
      id: asSafeId(slide.id, '히어로 배너'),
      eyebrow: asString(slide.eyebrow, '히어로 문구'),
      title: title as string[],
      description:
        slide.description === undefined ? '' : asString(slide.description, '히어로 설명'),
      tagline: tagline as string[],
      imageUrl: asImageUrl(slide.imageUrl, '히어로 이미지'),
      destination,
      ctaLabel: asString(slide.ctaLabel, '히어로 버튼'),
      ...(secondaryCta ? { secondaryCta } : {}),
    };
  });
  const promoBanners = readArray('promoBanners').map((entry) => {
    const banner = asRecord(entry, '프로모션 배너');
    const title = banner.title;
    if (!Array.isArray(title) || !title.every((line) => typeof line === 'string'))
      throw new ApiError(
        'INVALID_RESPONSE',
        '실제 API 응답(프로모션 제목) 형식이 올바르지 않습니다.',
      );
    const tone = asString(banner.tone, '프로모션 스타일');
    if (tone !== 'dark' && tone !== 'light')
      throw new ApiError(
        'INVALID_RESPONSE',
        '실제 API 응답(프로모션 스타일)을 처리할 수 없습니다.',
      );
    return {
      id: asSafeId(banner.id, '프로모션 배너'),
      title: title as string[],
      description:
        banner.description === undefined ? '' : asString(banner.description, '프로모션 설명'),
      imageUrl: asImageUrl(banner.imageUrl, '프로모션 이미지'),
      tone: tone as 'dark' | 'light',
      destination: safeDestination(banner.destination, '프로모션 링크 경로'),
    };
  });
  const serviceBenefits = readArray('serviceBenefits').map((entry) => {
    const benefit = asRecord(entry, '서비스 안내');
    return {
      id: asSafeId(benefit.id, '서비스 안내'),
      title: asString(benefit.title, '서비스 안내 제목'),
      description:
        benefit.description === undefined ? '' : asString(benefit.description, '서비스 안내 설명'),
      isVisible:
        benefit.visible === undefined ? true : asBoolean(benefit.visible, '서비스 안내 표시 여부'),
    };
  });
  return {
    heroSlides,
    promoBanners,
    serviceBenefits,
    featuredProducts: readArray('featuredProducts').map(mapProductSummary),
  };
}

function mapPopup(input: unknown): ShopPopup {
  const popup = asRecord(input, '팝업');
  const imageUrl = asNullableString(popup.imageUrl, '팝업 이미지');
  return {
    id: asSafeId(popup.id, '팝업'),
    title: asString(popup.title, '팝업 제목'),
    imageUrl: imageUrl === null ? null : asImageUrl(imageUrl, '팝업 이미지'),
    body: asString(popup.body, '팝업 본문'),
  };
}

function mapFacetRows(input: unknown, field: string, numericValue = false): FacetCount[] {
  if (!Array.isArray(input))
    throw new ApiError('INVALID_RESPONSE', `실제 API 응답(${field}) 형식이 올바르지 않습니다.`);
  return input.map((entry) => {
    const row = asRecord(entry, field);
    return {
      value: numericValue ? asSafeId(row.value, `${field} 값`) : asString(row.value, `${field} 값`),
      label: asString(row.label, `${field} 표시 이름`),
      count: asNumber(row.count, `${field} 개수`),
    };
  });
}

function mapProductFacets(input: unknown): ProductFacets {
  const facets = asRecord(input, '상품 필터 개수');
  return {
    totalCount: asNumber(facets.totalCount, '전체 상품 수'),
    keywordTotalCount: asNumber(facets.keywordTotalCount, '검색 상품 수'),
    categories: mapFacetRows(facets.categories, '카테고리 필터', true),
    brands: mapFacetRows(facets.brands, '브랜드 필터'),
    certifications: mapFacetRows(facets.certifications, '인증 필터'),
  };
}

function mapPagedProducts(input: unknown): PagedResult<ProductListItem> {
  const page = asRecord(input, '상품 페이지');
  if (!Array.isArray(page.content))
    throw new ApiError('INVALID_RESPONSE', '실제 API 응답(상품 목록) 형식이 올바르지 않습니다.');
  return {
    items: page.content.map(mapProductSummary),
    page: asNumber(page.page, '페이지 번호') + 1,
    pageSize: asNumber(page.size, '페이지 크기'),
    totalCount: asNumber(page.totalElements, '전체 상품 수'),
  };
}

function mapCategory(input: unknown): Category {
  const category = asRecord(input, '카테고리');
  const id = asSafeId(category.id, '카테고리');
  const parentId = category.parentId === null ? null : asSafeId(category.parentId, '상위 카테고리');
  return {
    id,
    slug: asString(category.slug, '카테고리 경로'),
    name: asString(category.name, '카테고리명'),
    parentId,
    description:
      category.description === undefined
        ? null
        : asNullableString(category.description, '카테고리 소개'),
    iconKey:
      category.iconKey === undefined ? null : asNullableString(category.iconKey, '카테고리 아이콘'),
  };
}

function mapBrand(input: unknown): BrandSummary {
  const brand = asRecord(input, '브랜드');
  const mappedBrand: BrandSummary = {
    id: asSafeId(brand.id, '브랜드'),
    name: asString(brand.name, '브랜드명'),
    englishName:
      brand.englishName === undefined ? null : asNullableString(brand.englishName, '영문 브랜드명'),
    logoUrl: brand.logoUrl === undefined ? null : asNullableString(brand.logoUrl, '브랜드 로고'),
    tagline: brand.tagline === undefined ? null : asNullableString(brand.tagline, '브랜드 소개'),
    productCount: asNumber(brand.productCount, '브랜드 상품 수'),
  };
  if (brand.accentColor !== undefined)
    mappedBrand.accentColor = asString(brand.accentColor, '브랜드 강조 색상');
  if (brand.logoSettings !== undefined) {
    const logoSettings = asRecord(brand.logoSettings, '브랜드 로고 설정');
    const fit = asString(logoSettings.fit, '브랜드 로고 맞춤 방식');
    if (fit !== 'contain' && fit !== 'cover')
      throw new ApiError(
        'INVALID_RESPONSE',
        '실제 API 응답(브랜드 로고 맞춤 방식)이 올바르지 않습니다.',
      );
    mappedBrand.logoSettings = {
      fit,
      width: asNumber(logoSettings.width, '브랜드 로고 너비'),
      height: asNumber(logoSettings.height, '브랜드 로고 높이'),
    };
  }
  return mappedBrand;
}

function buildProductQuery(params: ProductListParams = {}): URLSearchParams {
  const query = new URLSearchParams();
  if (params.categoryId) query.set('categoryId', params.categoryId);
  if (params.keyword) query.set('query', params.keyword);
  params.brand?.forEach((brand) => query.append('brand', brand));
  if (params.minPrice !== undefined) query.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined) query.set('maxPrice', String(params.maxPrice));
  params.certification?.forEach((certification) => query.append('certification', certification));
  if (params.excludeSoldOut !== undefined)
    query.set('excludeSoldOut', String(params.excludeSoldOut));
  if (params.collection) query.set('collection', params.collection);
  const sort = params.sortBy ?? 'recommended';
  const sortMap = {
    recommended: 'recommended',
    newest: 'newest',
    priceAsc: 'price_asc',
    priceDesc: 'price_desc',
    popular: 'popular',
    ratingDesc: 'popular',
  };
  query.set('sort', sortMap[sort]);
  query.set('page', String(Math.max(0, (params.page ?? 1) - 1)));
  query.set('size', String(params.pageSize ?? 24));
  return query;
}

function buildProductLimit(params?: ProductLimitParams): number {
  const requestedLimit = params?.limit ?? 10;
  return Number.isFinite(requestedLimit)
    ? Math.min(20, Math.max(1, Math.trunc(requestedLimit)))
    : 10;
}

function encodeProductId(productId: string): string {
  if (!/^(0|[1-9]\d*)$/.test(productId) || !Number.isSafeInteger(Number(productId))) {
    throw new ApiError('VALIDATION', '상품 ID는 안전한 숫자 형식이어야 합니다.');
  }
  return encodeURIComponent(productId);
}

// 아직 연결되지 않은 엔드포인트를 호출하면 바로 실패시키는 함수
function notImplemented(endpointName: string): () => Promise<never> {
  return () =>
    Promise.reject(
      new ApiError('NOT_IMPLEMENTED', `실제 API(${endpointName})는 아직 연결되지 않았습니다.`),
    );
}

/**
 * 실제 서버용 ShopApi. 연결되지 않은 엔드포인트는 명시적으로 실패시킵니다.
 */
export function createRealApi(config: ApiConfig): ShopApi {
  const client = createApiClient(config.baseUrl);
  const get = (path: string, signal?: AbortSignal, requireEnvelope = false) =>
    client.request(path, { signal, requireEnvelope });
  return {
    suppliers: {
      adminList: notImplemented('suppliers.adminList'),
      saveAdmin: notImplemented('suppliers.saveAdmin'),
      deleteAdmin: notImplemented('suppliers.deleteAdmin'),
    },
    products: {
      list: notImplemented('products.list'),
      listCatalog: async (params, options): Promise<PagedResult<ProductListItem>> =>
        mapPagedProducts(
          await get(`/api/v1/products?${buildProductQuery(params)}`, options?.signal),
        ),
      getById: notImplemented('products.getById'),
      getDetailById: async (productId, options): Promise<ApiProductDetail> => {
        const encodedProductId = encodeProductId(productId);
        const response = await get(`/api/v1/products/${encodedProductId}`, options?.signal);
        return mapProductDetail(response, productId);
      },
      suggest: async (keyword, options): Promise<ProductSuggestion[]> => {
        const query = new URLSearchParams({ query: keyword });
        const response = await get(`/api/v1/products/suggestions?${query}`, options?.signal);
        if (!Array.isArray(response))
          throw new ApiError(
            'INVALID_RESPONSE',
            '실제 API 응답(검색 제안) 형식이 올바르지 않습니다.',
          );
        return response.slice(0, 5).map((entry) => {
          const suggestion = asRecord(entry, '검색 제안');
          return {
            productId: asSafeId(suggestion.productId, '상품'),
            name: asString(suggestion.name, '상품명'),
            brand: asNullableString(suggestion.brand, '브랜드') ?? '',
          };
        });
      },
      facets: async (params, options): Promise<ProductFacets> => {
        const query = new URLSearchParams();
        if (params?.categoryId) query.set('categoryId', params.categoryId);
        if (params?.keyword) query.set('query', params.keyword);
        return mapProductFacets(await get(`/api/v1/products/facets?${query}`, options?.signal));
      },
      listReviews: notImplemented('products.listReviews'),
      getReviewSummary: notImplemented('products.getReviewSummary'),
      adminListReviews: notImplemented('products.adminListReviews'),
      updateReviewAdmin: notImplemented('products.updateReviewAdmin'),
      listQuestions: notImplemented('products.listQuestions'),
      adminListQuestions: notImplemented('products.adminListQuestions'),
      updateQuestionAdmin: notImplemented('products.updateQuestionAdmin'),
      listRelated: async (productId, params, options): Promise<ProductListItem[]> => {
        const query = new URLSearchParams({ limit: String(buildProductLimit(params)) });
        const response = await get(
          `/api/v1/products/${encodeProductId(productId)}/related?${query}`,
          options?.signal,
        );
        if (!Array.isArray(response))
          throw new ApiError(
            'INVALID_RESPONSE',
            '실제 API 응답(관련 상품) 형식이 올바르지 않습니다.',
          );
        return response.map(mapProductSummary);
      },
      listRecommended: notImplemented('products.listRecommended'),
      listCatalogRecommended: async (params, options): Promise<ProductListItem[]> => {
        const query = new URLSearchParams({ limit: String(buildProductLimit(params)) });
        const response = await get(`/api/v1/products/recommended?${query}`, options?.signal);
        if (!Array.isArray(response))
          throw new ApiError(
            'INVALID_RESPONSE',
            '실제 API 응답(추천 상품) 형식이 올바르지 않습니다.',
          );
        return response.map(mapProductSummary);
      },
      adminList: notImplemented('products.adminList'),
      saveAdmin: notImplemented('products.saveAdmin'),
      deleteAdmin: notImplemented('products.deleteAdmin'),
    },
    brands: {
      list: async (options): Promise<BrandSummary[]> => {
        const response = await get('/api/v1/brands', options?.signal);
        if (!Array.isArray(response))
          throw new ApiError(
            'INVALID_RESPONSE',
            '실제 API 응답(브랜드 목록) 형식이 올바르지 않습니다.',
          );
        return response.map(mapBrand);
      },
      getById: notImplemented('brands.getById'),
      adminList: notImplemented('brands.adminList'),
      saveAdmin: notImplemented('brands.saveAdmin'),
      deleteAdmin: notImplemented('brands.deleteAdmin'),
    },
    search: {
      recommendedKeywords: async (options): Promise<string[]> => {
        const response = await get('/api/v1/search/recommended-keywords', options?.signal);
        if (!Array.isArray(response) || response.some((entry) => typeof entry !== 'string'))
          throw new ApiError(
            'INVALID_RESPONSE',
            '실제 API 응답(추천 검색어) 형식이 올바르지 않습니다.',
          );
        return response;
      },
    },
    checkout: { getOptions: notImplemented('checkout.getOptions') },
    settings: {
      getAdmin: notImplemented('settings.getAdmin'),
      saveAdmin: notImplemented('settings.saveAdmin'),
    },
    categories: {
      list: async (options): Promise<Category[]> => {
        const response = await get('/api/v1/categories', options?.signal);
        if (!Array.isArray(response))
          throw new ApiError(
            'INVALID_RESPONSE',
            '실제 API 응답(카테고리 목록) 형식이 올바르지 않습니다.',
          );
        return response.map(mapCategory);
      },
      adminList: notImplemented('categories.adminList'),
      save: notImplemented('categories.save'),
      delete: notImplemented('categories.delete'),
    },
    home: {
      getContent: async (options): Promise<HomeContent> =>
        mapHomeContent(await get('/api/v1/home', options?.signal, true)),
      getAdminContent: notImplemented('home.getAdminContent'),
      saveAdminContent: notImplemented('home.saveAdminContent'),
    },
    company: {
      getInfo: notImplemented('company.getInfo'),
      getAdminInfo: notImplemented('company.getAdminInfo'),
      saveAdminInfo: notImplemented('company.saveAdminInfo'),
    },
    legalDocuments: {
      getPublished: notImplemented('legalDocuments.getPublished'),
      adminList: notImplemented('legalDocuments.adminList'),
      saveAdmin: notImplemented('legalDocuments.saveAdmin'),
    },
    orders: {
      adminList: notImplemented('orders.adminList'),
      adminGetById: notImplemented('orders.adminGetById'),
      updateAdmin: notImplemented('orders.updateAdmin'),
      listByMember: notImplemented('orders.listByMember'),
      getById: notImplemented('orders.getById'),
      create: notImplemented('orders.create'),
    },
    claims: {
      adminList: notImplemented('claims.adminList'),
      updateAdmin: notImplemented('claims.updateAdmin'),
      submit: notImplemented('claims.submit'),
      completeOrderCancellation: notImplemented('claims.completeOrderCancellation'),
      listByMember: notImplemented('claims.listByMember'),
    },
    coupons: {
      list: notImplemented('coupons.list'),
      historyList: notImplemented('coupons.historyList'),
      availableList: notImplemented('coupons.availableList'),
      acquire: notImplemented('coupons.acquire'),
      redeemCode: notImplemented('coupons.redeemCode'),
      adminList: notImplemented('coupons.adminList'),
      saveAdmin: notImplemented('coupons.saveAdmin'),
      deleteAdmin: notImplemented('coupons.deleteAdmin'),
    },
    points: {
      list: notImplemented('points.list'),
      adminList: notImplemented('points.adminList'),
      adjustAdmin: notImplemented('points.adjustAdmin'),
    },
    addresses: { list: notImplemented('addresses.list') },
    notices: {
      list: notImplemented('notices.list'),
      adminList: notImplemented('notices.adminList'),
      saveAdmin: notImplemented('notices.saveAdmin'),
      deleteAdmin: notImplemented('notices.deleteAdmin'),
    },
    popups: {
      list: async (options): Promise<ShopPopup[]> => {
        const response = await get('/api/v1/popups', options?.signal, true);
        if (!Array.isArray(response))
          throw new ApiError(
            'INVALID_RESPONSE',
            '실제 API 응답(팝업 목록) 형식이 올바르지 않습니다.',
          );
        return response.map(mapPopup);
      },
      adminList: notImplemented('popups.adminList'),
      saveAdmin: notImplemented('popups.saveAdmin'),
      deleteAdmin: notImplemented('popups.deleteAdmin'),
    },
    events: {
      list: notImplemented('events.list'),
      getById: notImplemented('events.getById'),
      adminList: notImplemented('events.adminList'),
      saveAdmin: notImplemented('events.saveAdmin'),
      deleteAdmin: notImplemented('events.deleteAdmin'),
    },
    faqs: {
      list: notImplemented('faqs.list'),
      adminList: notImplemented('faqs.adminList'),
      saveAdmin: notImplemented('faqs.saveAdmin'),
      deleteAdmin: notImplemented('faqs.deleteAdmin'),
    },
    inquiries: {
      submit: notImplemented('inquiries.submit'),
      listByMember: notImplemented('inquiries.listByMember'),
      adminList: notImplemented('inquiries.adminList'),
      updateAdmin: notImplemented('inquiries.updateAdmin'),
    },
    members: {
      getCurrent: notImplemented('members.getCurrent'),
      list: notImplemented('members.list'),
      adminList: notImplemented('members.adminList'),
    },
  };
}
