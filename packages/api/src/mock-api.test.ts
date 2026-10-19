import { describe, expect, it } from 'vitest';
import { ApiConfigError } from './errors';
import { createMockApi } from './mock-api';
import { calculateCartTotals, createCartOptionId, groupCartItems } from './cart';
import { mockBrands } from './mock/brands';
import { mockProducts } from './mock/products';
import { mockReviews } from './mock/reviews';
import { mockAddresses } from './mock/addresses';
import { mockClaims } from './mock/orders';
import { mockMembers } from './mock/members';
import { mockEvents, mockNotices } from './mock/support';
import { buildMockConfig } from './test-fixtures';

const testConfig = buildMockConfig();
const returnDetails = {
  returnMethod: 'pickup' as const,
  returnAddress: {
    recipientName: '목 회원',
    phone: '010-0000-0000',
    postalCode: '00000',
    address1: '서울시',
    address2: '마포구',
  },
};

describe('목 API 시나리오', () => {
  it('공지 목은 Figma pagination 10페이지에 맞춰 100건을 제공합니다', () => {
    expect(mockNotices).toHaveLength(100);
  });

  it('ntc-001은 Figma 상세 샘플의 본문 이미지 영역과 첨부 행 데이터를 제공합니다', () => {
    expect(mockNotices.find((notice) => notice.id === 'ntc-001')).toMatchObject({
      body: '공지 내용이 들어갑니다. 공지 본문은 관리자가 작성한 내용으로 서버에서 받아 보여 줍니다.\n\n공지 내용이 들어갑니다.',
      bodyImage: { src: null, alt: '공지 본문 이미지' },
      attachments: [{ id: 'ntc-001-attachment-1', fileName: '파일명.pdf', sizeBytes: 0 }],
    });
  });

  it('clm-001은 신청 사유 설명을 제공하고 다른 claim 데이터는 기존 선택 필드로 유지합니다', async () => {
    const claims = await createMockApi(testConfig).claims.listByMember('mem-001');
    expect(claims.find((claim) => claim.id === 'clm-001')).toMatchObject({
      reason: '사이즈 교환',
      description: '착용 전 사이즈 확인 중 교환을 요청했습니다.',
    });
    expect(mockClaims.find((claim) => claim.id === 'clm-002')).toMatchObject({
      type: 'cancel',
      description: '출고 전 주문 취소를 요청했습니다.',
    });
  });

  it('buyer mock member lookup exposes only the fixed demo member fixture', async () => {
    const api = createMockApi(testConfig);
    expect(await api.members.getCurrent()).toMatchObject({ id: 'mem-001' });
    expect(await api.members.getCurrent()).not.toHaveProperty('adminMemo');
    expect(await api.members.list()).toEqual([await api.members.getCurrent()]);
    expect((await api.members.adminList()).length).toBeGreaterThan(1);
    const addresses = await api.addresses.list();
    expect(addresses).toHaveLength(2);
    expect(addresses.every((address) => !('memberId' in address))).toBe(true);
  });

  it('buyer mock scopes private order, quote, point and coupon data to the active mock session', async () => {
    const secondMember = mockMembers.find((member) => member.id === 'mem-003');
    if (!secondMember) throw new Error('두 번째 회원 fixture가 필요합니다.');
    const api = createMockApi(testConfig, { getCurrentMember: async () => secondMember });

    expect(await api.members.getCurrent()).toMatchObject({ id: 'mem-003' });
    expect(await api.members.list()).toEqual([await api.members.getCurrent()]);
    expect(await api.members.list()).not.toContainEqual(expect.objectContaining({ id: 'mem-001' }));
    expect(await api.addresses.list()).toEqual([]);
    expect(await api.orders.listByMember('mem-003')).toEqual([]);
    expect(await api.quotes.listByMember('mem-003')).toEqual([]);
    expect(await api.points.list()).toEqual([]);
    const memberCoupons = await api.coupons.historyList();
    expect(memberCoupons).not.toContainEqual(expect.objectContaining({ id: 'cpn-001' }));
    expect(memberCoupons.every((coupon) => !('adminCouponId' in coupon))).toBe(true);
    await expect(api.orders.getById('ord-001')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(api.orders.listByMember('mem-001')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(api.quotes.listByMember('mem-001')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not fall back to demo-member private data without an active mock session', async () => {
    const api = createMockApi(testConfig, { getCurrentMember: async () => null });
    await expect(api.members.getCurrent()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(api.orders.getById('ord-001')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(api.points.list()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(api.coupons.historyList()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('buyer order list and detail expose the same status and tracking fields', async () => {
    const api = createMockApi(testConfig);
    await api.orders.updateAdmin('ord-001', {
      status: 'shipping',
      trackingCarrier: '한진택배',
      trackingNumber: '1234567890',
    });
    const [listedOrder] = await api.orders.listByMember('mem-001');
    const detailedOrder = await api.orders.getById('ord-001');
    expect(listedOrder).toMatchObject({
      id: detailedOrder.id,
      status: detailedOrder.status,
      trackingCarrier: detailedOrder.trackingCarrier,
      trackingNumber: detailedOrder.trackingNumber,
    });
  });

  it('취소 요청과 주문 취소를 하나의 원자적 mutation으로 처리하고 중단 후 재시도할 수 있습니다', async () => {
    const api = createMockApi(testConfig);
    const controller = new AbortController();
    controller.abort();
    await expect(
      api.claims.completeOrderCancellation('ord-002', 'clm-002', '고객 요청', {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(await api.orders.getById('ord-002')).toMatchObject({ status: 'shipping' });
    expect((await api.claims.adminList()).find((claim) => claim.id === 'clm-002')).toMatchObject({
      status: 'requested',
    });

    await expect(
      api.claims.completeOrderCancellation('ord-002', 'clm-002', '고객 요청'),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(api.claims.updateAdmin('clm-002', { status: 'completed' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await api.orders.updateAdmin('ord-002', { status: 'preparing' });
    await api.claims.completeOrderCancellation('ord-002', 'clm-002', '고객 요청');
    const savedOrder = await api.orders.adminGetById('ord-002');
    const savedClaim = (await api.claims.adminList()).find((claim) => claim.id === 'clm-002');
    expect(savedOrder).toMatchObject({ status: 'canceled', adminMemo: '고객 요청' });
    expect(savedClaim).toMatchObject({ status: 'completed', adminMemo: '고객 요청' });
    const historyLength = savedOrder.statusHistory.length;
    await api.claims.completeOrderCancellation('ord-002', 'clm-002', '고객 요청');
    expect((await api.orders.adminGetById('ord-002')).statusHistory).toHaveLength(historyLength);
    expect(await api.orders.getById('ord-002')).not.toHaveProperty('adminMemo');

    const processingApi = createMockApi(testConfig);
    await processingApi.orders.updateAdmin('ord-002', { status: 'preparing' });
    await processingApi.claims.updateAdmin('clm-002', { status: 'processing' });
    await expect(
      processingApi.claims.completeOrderCancellation('ord-002', 'clm-002', '다시 요청'),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await processingApi.orders.adminGetById('ord-002')).status).toBe('preparing');
  });

  it('주문 취소 재시도는 SKU 재고·포인트·쿠폰을 한 번만 복원합니다', async () => {
    const api = createMockApi(testConfig);
    const product = (await api.products.adminList()).find((item) => item.id === 'prd-1001');
    const coupon = (await api.coupons.adminList()).find((item) => item.id === 'coupon-demo-001');
    if (!product || !coupon) throw new Error('취소 복원 테스트 fixture가 필요합니다.');
    await api.products.saveAdmin({
      ...product,
      skus: [
        {
          id: 'sku-cancel-restore',
          optionLabels: ['색상: 백색'],
          productCode: 'SKU-CANCEL',
          priceDelta: 0,
          stockCount: 5,
          salesStatus: 'active',
          imageId: null,
        },
      ],
    });
    await api.coupons.saveAdmin({ ...coupon, minimumOrderAmount: 0 });
    const optionId = createCartOptionId([{ optionId: 'color', choiceId: 'white' }]);
    const receipt = await api.orders.create({
      lines: [{ productId: 'prd-1001', quantity: 1, optionId }],
      shippingAddress: mockAddresses[0]!,
      deliveryRequest: '',
      paymentMethod: 'creditCard',
      couponId: 'cpn-001',
      pointsToUse: 500,
    });
    const createdOrder = (await api.orders.adminList()).find(
      (order) => order.orderNumber === receipt.orderNumber,
    );
    if (!createdOrder) throw new Error('취소 복원 테스트 주문이 필요합니다.');
    const submittedClaim = await api.claims.submit({
      orderId: createdOrder.id,
      type: 'cancel',
      reason: '주문 취소',
      description: '고객 요청',
      items: [{ productId: 'prd-1001', skuId: 'sku-cancel-restore', quantity: 1 }],
    });
    expect(createdOrder.usedCouponId).toBe('cpn-001');
    expect(await api.orders.getById(createdOrder.id)).not.toHaveProperty('usedCouponId');
    expect(
      (await api.products.adminList()).find((item) => item.id === 'prd-1001')?.skus?.[0]
        ?.stockCount,
    ).toBe(4);
    expect(
      (await api.members.adminList()).find((member) => member.id === 'mem-001')?.pointBalance,
    ).toBe(2700);
    expect((await api.coupons.adminList()).find((item) => item.id === coupon.id)?.usedCount).toBe(
      1,
    );
    expect((await api.coupons.historyList()).find((item) => item.id === 'cpn-001')?.isUsed).toBe(
      true,
    );

    const completed = await api.claims.completeOrderCancellation(
      createdOrder.id,
      submittedClaim.id,
      '재고 복원 취소',
    );
    expect(completed.order).toMatchObject({ status: 'canceled', pointUsed: 500 });
    expect(completed.claim).toMatchObject({ status: 'completed', adminMemo: '재고 복원 취소' });
    expect(
      (await api.products.adminList()).find((item) => item.id === 'prd-1001')?.skus?.[0]
        ?.stockCount,
    ).toBe(5);
    expect(
      (await api.members.adminList()).find((member) => member.id === 'mem-001')?.pointBalance,
    ).toBe(3200);
    expect(
      (await api.points.adminList()).filter(
        (point) => point.description === '주문 취소 적립금 복원',
      ),
    ).toHaveLength(1);
    expect((await api.coupons.adminList()).find((item) => item.id === coupon.id)?.usedCount).toBe(
      0,
    );
    expect((await api.coupons.historyList()).find((item) => item.id === 'cpn-001')?.isUsed).toBe(
      false,
    );
    const historyLength = (await api.orders.adminGetById(createdOrder.id)).statusHistory.length;

    await api.claims.completeOrderCancellation(createdOrder.id, submittedClaim.id, '재시도 사유');
    expect(
      (await api.products.adminList()).find((item) => item.id === 'prd-1001')?.skus?.[0]
        ?.stockCount,
    ).toBe(5);
    expect(
      (await api.members.adminList()).find((member) => member.id === 'mem-001')?.pointBalance,
    ).toBe(3200);
    expect(
      (await api.points.adminList()).filter(
        (point) => point.description === '주문 취소 적립금 복원',
      ),
    ).toHaveLength(1);
    expect((await api.coupons.adminList()).find((item) => item.id === coupon.id)?.usedCount).toBe(
      0,
    );
    expect((await api.orders.adminGetById(createdOrder.id)).statusHistory).toHaveLength(
      historyLength,
    );
  });

  it('normal: 목 상품을 돌려주고 금액 미표시 상품도 포함합니다', async () => {
    const productPage = await createMockApi(testConfig).products.list();
    expect(productPage.totalCount).toBeGreaterThan(0);
    expect(productPage.items.some((product) => !product.priceVisible)).toBe(true);
    expect(
      productPage.items
        .filter((product) => !product.priceVisible)
        .every((product) => product.price === null && product.listPrice === null),
    ).toBe(true);
  });

  it('관리자 상품 저장은 buyer 목록·상세에 공개 상태와 가격을 반영합니다', async () => {
    const api = createMockApi(testConfig);
    const [adminProduct] = await api.products.adminList();
    expect(adminProduct).toBeDefined();
    if (!adminProduct) return;

    const savedProduct = await api.products.saveAdmin({
      ...adminProduct,
      name: '관리자 저장 상품',
      priceVisible: false,
      stockCount: 12,
      salesStatus: 'active',
      isVisible: true,
      detailDescription: '**서식 설명**',
      detailDescriptionFormat: 'rich-v1',
      skus: [
        {
          id: 'sku-test',
          optionLabels: ['색상: 백색'],
          productCode: 'SKU-TEST',
          priceDelta: 500,
          stockCount: 4,
          salesStatus: 'active',
          imageId: null,
        },
      ],
    });
    const buyerProduct = await api.products.getById(savedProduct.id);

    expect(savedProduct).toMatchObject({
      name: '관리자 저장 상품',
      stockCount: 12,
      skus: [{ productCode: 'SKU-TEST', priceDelta: 500, stockCount: 4 }],
    });
    expect(buyerProduct).toMatchObject({
      name: '관리자 저장 상품',
      price: null,
      listPrice: null,
      detailDescription: '**서식 설명**',
      detailDescriptionFormat: 'rich-v1',
    });

    await api.products.saveAdmin({ ...savedProduct, isVisible: false });
    await expect(api.products.getById(savedProduct.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect((await api.products.adminList()).some((product) => product.id === savedProduct.id)).toBe(
      true,
    );
  });

  it('재고 자동 품절 설정을 관리자 목 API에 저장하고 buyer 전체 품절 상태에 반영합니다', async () => {
    const api = createMockApi(testConfig);
    const product = (await api.products.adminList()).find((item) => item.id === 'prd-1001');
    if (!product) throw new Error('SKU 테스트 상품이 필요합니다.');
    const allOutOfStockSkus = [
      {
        id: 'sku-empty',
        optionLabels: ['사이즈: 대형'],
        productCode: 'SKU-EMPTY',
        priceDelta: 0,
        stockCount: 0,
        salesStatus: 'active' as const,
        imageId: null,
      },
    ];

    const automatic = await api.products.saveAdmin({
      ...product,
      stockStatus: 'inStock',
      autoSoldOut: true,
      skus: allOutOfStockSkus,
    });
    expect(automatic.autoSoldOut).toBe(true);
    await expect(api.products.getById(automatic.id)).resolves.toMatchObject({
      stockStatus: 'soldOut',
      skus: [{ isAvailable: false }],
    });

    const manual = await api.products.saveAdmin({ ...automatic, autoSoldOut: false });
    expect(manual.autoSoldOut).toBe(false);
    await expect(api.products.getById(manual.id)).resolves.toMatchObject({
      stockStatus: 'inStock',
      skus: [{ isAvailable: false }],
    });
  });

  it('마지막 SKU 주문 후 자동 품절 설정이 켜진 상품만 전체 품절 처리합니다', async () => {
    for (const autoSoldOut of [true, false]) {
      const api = createMockApi(testConfig);
      const product = (await api.products.adminList()).find((item) => item.id === 'prd-1001');
      if (!product) throw new Error('SKU 주문 테스트 상품이 필요합니다.');
      const saved = await api.products.saveAdmin({
        ...product,
        stockStatus: 'inStock',
        salesStatus: 'active',
        autoSoldOut,
        options: [
          {
            id: 'size',
            label: '사이즈',
            required: true,
            choices: [{ id: 'one', label: '원사이즈', priceDelta: 0 }],
          },
        ],
        skus: [
          {
            id: 'sku-last-one',
            optionLabels: ['사이즈: 원사이즈'],
            productCode: 'SKU-LAST-ONE',
            priceDelta: 0,
            stockCount: 1,
            salesStatus: 'active',
            imageId: null,
          },
        ],
      });
      const optionId = createCartOptionId([{ optionId: 'size', choiceId: 'one' }]);

      await api.orders.create({
        lines: [{ productId: saved.id, quantity: 1, optionId }],
        shippingAddress: mockAddresses[0]!,
        deliveryRequest: '',
        paymentMethod: 'creditCard',
        couponId: null,
        pointsToUse: 0,
      });

      const updatedProduct = (await api.products.adminList()).find((item) => item.id === saved.id);
      expect(updatedProduct?.skus?.[0]?.stockCount).toBe(0);
      expect(updatedProduct?.stockStatus).toBe(autoSoldOut ? 'soldOut' : 'inStock');
      await expect(api.products.getById(saved.id)).resolves.toMatchObject({
        stockStatus: autoSoldOut ? 'soldOut' : 'inStock',
        skus: [{ isAvailable: false }],
      });
    }
  });

  it('SKU 추가금·이미지·판매 가능 재고를 buyer 상품, cart 합계와 주문 검증에 반영합니다', async () => {
    const api = createMockApi(testConfig);
    const product = (await api.products.adminList()).find((item) => item.id === 'prd-1001');
    if (!product) throw new Error('SKU 테스트 상품이 필요합니다.');
    const image = product.images[0];
    const saved = await api.products.saveAdmin({
      ...product,
      options: [
        {
          id: 'size',
          label: '사이즈',
          required: true,
          choices: [{ id: 'large', label: '대형', priceDelta: 100 }],
        },
      ],
      skus: [
        {
          id: 'sku-large',
          optionLabels: ['사이즈: 대형'],
          productCode: 'SKU-LARGE',
          priceDelta: 8000,
          stockCount: 2,
          salesStatus: 'active',
          imageId: image?.id ?? null,
        },
      ],
    });
    const buyerProduct = await api.products.getById(saved.id);
    expect(buyerProduct.skus).toEqual([
      {
        id: 'sku-large',
        optionLabels: ['사이즈: 대형'],
        priceDelta: 8000,
        isAvailable: true,
        imageUrl: image?.url ?? null,
      },
    ]);
    expect(buyerProduct.skus?.[0]).not.toHaveProperty('stockCount');
    expect(buyerProduct.skus?.[0]).not.toHaveProperty('salesStatus');
    const optionId = createCartOptionId([{ optionId: 'size', choiceId: 'large' }]);
    const cartItem = {
      id: 'sku-cart-line',
      productId: saved.id,
      quantity: 2,
      optionId,
      optionLabel: '사이즈: 대형',
      product: buyerProduct,
    };
    expect(calculateCartTotals([cartItem]).productTotal).toBe(
      ((buyerProduct.price ?? 0) + 8000) * 2,
    );
    expect(groupCartItems([cartItem]).orderableItems).toHaveLength(1);
    const receipt = await api.orders.create({
      lines: [{ productId: saved.id, quantity: 2, optionId }],
      shippingAddress: mockAddresses[0]!,
      deliveryRequest: '',
      paymentMethod: 'creditCard',
      couponId: null,
      pointsToUse: 0,
    });
    expect(receipt.productTotal).toBe(((buyerProduct.price ?? 0) + 8000) * 2);
    expect((await api.products.getById(saved.id)).skus?.[0]?.isAvailable).toBe(false);
    expect(
      (await api.products.adminList()).find((item) => item.id === saved.id)?.skus?.[0]?.stockCount,
    ).toBe(0);
    await expect(
      api.orders.create({
        lines: [{ productId: saved.id, quantity: 3, optionId }],
        shippingAddress: mockAddresses[0]!,
        deliveryRequest: '',
        paymentMethod: 'creditCard',
        couponId: null,
        pointsToUse: 0,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await api.products.saveAdmin({
      ...saved,
      skus: [{ ...saved.skus![0]!, salesStatus: 'paused' }],
    });
    await expect(
      api.orders.create({
        lines: [{ productId: saved.id, quantity: 1, optionId }],
        shippingAddress: mockAddresses[0]!,
        deliveryRequest: '',
        paymentMethod: 'creditCard',
        couponId: null,
        pointsToUse: 0,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('주문 idempotency key는 재시도 결과를 재사용하고 payload 충돌을 거절합니다', async () => {
    const api = createMockApi(testConfig);
    const product = (await api.products.adminList()).find((item) => item.id === 'prd-1001');
    if (!product) throw new Error('idempotency 테스트 상품이 필요합니다.');
    await api.products.saveAdmin({
      ...product,
      options: [
        {
          id: 'size',
          label: '사이즈',
          required: true,
          choices: [{ id: 'large', label: '대형', priceDelta: 0 }],
        },
      ],
      skus: [
        {
          id: 'sku-idempotency',
          optionLabels: ['사이즈: 대형'],
          productCode: 'SKU-IDEMPOTENCY',
          priceDelta: 0,
          stockCount: 9,
          salesStatus: 'active',
          imageId: null,
        },
      ],
    });
    const coupon = (await api.coupons.adminList()).find((item) => item.id === 'coupon-demo-001');
    if (!coupon) throw new Error('idempotency 테스트 쿠폰이 필요합니다.');
    await api.coupons.saveAdmin({ ...coupon, minimumOrderAmount: 1000 });
    const optionId = createCartOptionId([{ optionId: 'size', choiceId: 'large' }]);
    const input = {
      lines: [{ productId: 'prd-1001', quantity: 1, optionId }],
      shippingAddress: mockAddresses[0]!,
      deliveryRequest: '',
      paymentMethod: 'creditCard' as const,
      couponId: 'cpn-001',
      pointsToUse: 500,
      idempotencyKey: 'checkout-attempt-1',
    };

    const [firstReceipt, concurrentRetryReceipt] = await Promise.all([
      api.orders.create(input),
      api.orders.create(input),
    ]);
    const retryReceipt = await api.orders.create(input);
    expect(retryReceipt).toEqual(firstReceipt);
    expect(concurrentRetryReceipt).toEqual(firstReceipt);
    expect(firstReceipt.pointsUsed).toBe(500);
    expect(
      (await api.members.adminList()).find((member) => member.id === 'mem-001')?.pointBalance,
    ).toBe(2700);
    expect(
      (await api.points.adminList()).filter((point) => point.description === '주문 적립금 사용'),
    ).toHaveLength(1);
    expect(
      (await api.coupons.adminList()).find((coupon) => coupon.id === 'coupon-demo-001')?.usedCount,
    ).toBe(1);
    expect(
      (await api.products.adminList()).find((item) => item.id === 'prd-1001')?.skus?.[0]
        ?.stockCount,
    ).toBe(8);
    expect(
      (await api.orders.listByMember('mem-001')).filter(
        (order) => order.orderNumber === firstReceipt.orderNumber,
      ),
    ).toHaveLength(1);
    const buyerOrder = (await api.orders.listByMember('mem-001')).find(
      (order) => order.orderNumber === firstReceipt.orderNumber,
    );
    const adminOrder = (await api.orders.adminList()).find(
      (order) => order.orderNumber === firstReceipt.orderNumber,
    );
    expect(buyerOrder?.lines[0]).toMatchObject({
      productId: 'prd-1001',
      optionId,
      skuId: 'sku-idempotency',
      optionLabel: '사이즈: 대형',
    });
    expect(adminOrder).toMatchObject({
      orderNumber: firstReceipt.orderNumber,
      status: 'paymentPending',
      statusHistory: [{ status: 'paymentPending' }],
    });
    expect(await api.orders.adminGetById(adminOrder!.id)).toEqual(adminOrder);
    expect(await api.orders.getById(buyerOrder!.id)).toEqual(buyerOrder);
    expect(buyerOrder).not.toHaveProperty('memberId');
    expect(buyerOrder!.shippingAddress).not.toHaveProperty('memberId');

    await expect(api.orders.create({ ...input, pointsToUse: 1 })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    const distinctReceipt = await api.orders.create({
      ...input,
      idempotencyKey: 'checkout-attempt-2',
      couponId: null,
    });
    expect(distinctReceipt.orderNumber).not.toBe(firstReceipt.orderNumber);
    expect(
      (await api.members.adminList()).find((member) => member.id === 'mem-001')?.pointBalance,
    ).toBe(2200);
    expect(
      (await api.points.adminList()).filter((point) => point.description === '주문 적립금 사용'),
    ).toHaveLength(2);
    expect(
      (await api.products.adminList()).find((item) => item.id === 'prd-1001')?.skus?.[0]
        ?.stockCount,
    ).toBe(7);
  });

  it('동일한 주문 idempotency key도 회원별로 분리하고 생성 주문을 각 회원 조회에 저장합니다', async () => {
    const firstMember = mockMembers.find((member) => member.id === 'mem-001');
    const secondMember = mockMembers.find((member) => member.id === 'mem-002');
    if (!firstMember || !secondMember)
      throw new Error('주문 소유권 테스트 회원 fixture가 필요합니다.');
    let activeMember = firstMember;
    const api = createMockApi(testConfig, { getCurrentMember: async () => activeMember });
    const input = {
      lines: [
        {
          productId: 'prd-1001',
          quantity: 1,
          optionId: createCartOptionId([{ optionId: 'color', choiceId: 'white' }]),
        },
      ],
      shippingAddress: mockAddresses[0]!,
      deliveryRequest: '',
      paymentMethod: 'creditCard' as const,
      couponId: null,
      pointsToUse: 0,
      idempotencyKey: 'shared-key',
    };

    const firstReceipt = await api.orders.create(input);
    activeMember = secondMember;
    const secondReceipt = await api.orders.create(input);
    expect(secondReceipt.orderNumber).not.toBe(firstReceipt.orderNumber);
    expect(await api.orders.listByMember(secondMember.id)).toHaveLength(1);
    expect((await api.orders.listByMember(secondMember.id))[0]?.orderNumber).toBe(
      secondReceipt.orderNumber,
    );
    expect(
      (await api.orders.adminList()).filter(
        (order) =>
          order.orderNumber === firstReceipt.orderNumber ||
          order.orderNumber === secondReceipt.orderNumber,
      ),
    ).toHaveLength(2);
    expect(await api.orders.create(input)).toEqual(secondReceipt);
    expect(await api.orders.listByMember(secondMember.id)).toHaveLength(1);
    activeMember = firstMember;
    const firstMemberOrders = await api.orders.listByMember(firstMember.id);
    expect(firstMemberOrders).toHaveLength(3);
    expect(firstMemberOrders.some((order) => order.orderNumber === firstReceipt.orderNumber)).toBe(
      true,
    );
  });

  it('잔액 부족 시 checkout 포인트·원장·재고를 모두 변경하지 않습니다', async () => {
    const api = createMockApi(testConfig);
    await api.points.adjustAdmin({
      memberId: 'mem-001',
      amount: -3200,
      reason: '잔액 부족 테스트',
      expiresAt: null,
    });
    const beforeStock = (await api.products.adminList()).find(
      (product) => product.id === 'prd-1001',
    )?.skus?.[0]?.stockCount;
    const beforeLedgerCount = (await api.points.adminList()).length;
    await expect(
      api.orders.create({
        lines: [{ productId: 'prd-1001', quantity: 1, optionId: null }],
        shippingAddress: mockAddresses[0]!,
        deliveryRequest: '',
        paymentMethod: 'creditCard',
        couponId: null,
        pointsToUse: 1,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(
      (await api.members.adminList()).find((member) => member.id === 'mem-001')?.pointBalance,
    ).toBe(0);
    expect(await api.points.adminList()).toHaveLength(beforeLedgerCount);
    expect(
      (await api.products.adminList()).find((product) => product.id === 'prd-1001')?.skus?.[0]
        ?.stockCount,
    ).toBe(beforeStock);
  });

  it('관리자 카테고리 삭제는 하위 분류·상품 참조를 보호합니다', async () => {
    const api = createMockApi(testConfig);
    await expect(api.categories.delete('cat-ppe')).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(api.categories.delete('cat-head')).rejects.toMatchObject({ code: 'VALIDATION' });

    const createdCategory = await api.categories.save({
      slug: 'admin-test-category',
      name: '관리자 테스트 분류',
      parentId: null,
      description: null,
      iconKey: null,
    });
    await api.categories.delete(createdCategory.id);
    await expect(api.categories.delete(createdCategory.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('숨김 가격은 범위 필터에서 빠지고, 가격 정렬에서도 별도 가격처럼 정렬되지 않습니다', async () => {
    const mockApi = createMockApi(testConfig);
    const priceFilteredPage = await mockApi.products.list({ minPrice: 1, maxPrice: 200000 });
    expect(priceFilteredPage.items.every((product) => product.priceVisible)).toBe(true);
    const priceSortedPage = await mockApi.products.list({ sortBy: 'priceAsc', pageSize: 100 });
    expect(priceSortedPage.items.at(-1)?.priceVisible).toBe(false);
  });

  it('키워드, 하위 카테고리, 브랜드·인증, 품절 제외, 정렬과 페이지 조건을 적용합니다', async () => {
    const mockApi = createMockApi(testConfig);
    const categoryPage = await mockApi.products.list({ categoryId: 'cat-ppe', pageSize: 100 });
    expect(categoryPage.items.map((product) => product.id)).toEqual(
      expect.arrayContaining(['prd-1001', 'prd-1002', 'prd-1003', 'prd-1004']),
    );
    // 개인보호장비 하위 카테고리 상품만 포함합니다(소방·표지 상품 제외).
    expect(categoryPage.items.map((product) => product.id)).not.toContain('prd-1005');
    expect(categoryPage.items.map((product) => product.id)).not.toContain('prd-1006');

    const brandPage = await mockApi.products.list({ brand: ['워크핏'], pageSize: 100 });
    expect(brandPage.items.map((product) => product.id)).toContain('prd-1002');
    expect(brandPage.items.every((product) => product.brand === '워크핏')).toBe(true);
    const certifiedPage = await mockApi.products.list({ certification: ['KCs 안전인증'] });
    expect(certifiedPage.items.map((product) => product.id)).toContain('prd-1002');

    const searchedPage = await mockApi.products.list({ keyword: '파이어킵' });
    expect(searchedPage.items.map((product) => product.id)).toEqual(['prd-2028', 'prd-1005']);

    const availablePage = await mockApi.products.list({ excludeSoldOut: true });
    expect(availablePage.items.every((product) => product.stockStatus === 'inStock')).toBe(true);
    const ascendingPage = await mockApi.products.list({ sortBy: 'priceAsc' });
    expect(ascendingPage.items[0]?.price).toBe(0);

    const secondPage = await mockApi.products.list({ page: 2, pageSize: 2 });
    expect(secondPage.items.map((product) => product.id)).toEqual(['prd-1003', 'prd-1004']);
    expect(secondPage).toMatchObject({ page: 2, pageSize: 2, totalCount: mockProducts.length });
  });

  it('평점순은 평점이 없는 상품을 뒤에 두고, 모든 정렬은 품절 상품을 페이지 분할 전에 뒤로 보냅니다', async () => {
    const mockApi = createMockApi(testConfig);
    const sortOrders = ['recommended', 'priceAsc', 'priceDesc', 'newest', 'ratingDesc'] as const;

    for (const sortBy of sortOrders) {
      const fullPage = await mockApi.products.list({ sortBy, pageSize: 100 });
      const firstPage = await mockApi.products.list({ sortBy, page: 1, pageSize: 5 });
      const secondPage = await mockApi.products.list({ sortBy, page: 2, pageSize: 5 });
      const pagedItems = [...firstPage.items, ...secondPage.items];
      const firstSoldOutIndex = fullPage.items.findIndex(
        (product) => product.stockStatus === 'soldOut',
      );

      expect(pagedItems).toEqual(fullPage.items.slice(0, 10));
      expect(firstSoldOutIndex).toBeGreaterThanOrEqual(0);
      expect(
        fullPage.items
          .slice(0, firstSoldOutIndex)
          .every((product) => product.stockStatus === 'inStock'),
      ).toBe(true);
      expect(
        fullPage.items
          .slice(firstSoldOutIndex)
          .every((product) => product.stockStatus === 'soldOut'),
      ).toBe(true);
    }

    const ratingPage = await mockApi.products.list({ sortBy: 'ratingDesc', pageSize: 100 });
    for (const stockStatus of ['inStock', 'soldOut'] as const) {
      const stockGroup = ratingPage.items.filter((product) => product.stockStatus === stockStatus);
      const ratedProducts = stockGroup.filter((product) => product.rating !== null);
      const unratedProducts = stockGroup.filter((product) => product.rating === null);
      expect(ratedProducts.map((product) => product.rating)).toEqual(
        [...ratedProducts.map((product) => product.rating)].sort(
          (leftRating, rightRating) => (rightRating ?? 0) - (leftRating ?? 0),
        ),
      );
      expect(stockGroup.slice(ratedProducts.length)).toEqual(unratedProducts);
    }
  });

  it('홈 콘텐츠는 공개 가격 projection이 적용된 featured 상품을 반환합니다', async () => {
    const homeContent = await createMockApi(testConfig).home.getContent();
    expect(homeContent.heroSlides.length).toBeGreaterThan(0);
    expect(homeContent.promoBanners).toHaveLength(3);
    expect(
      homeContent.featuredProducts.every(
        (product) => product.priceVisible || product.price === null,
      ),
    ).toBe(true);
  });

  it('홈 히어로는 데스크톱 세로 문구를, 상위 카테고리는 카테고리 바 소개를 함께 반환합니다', async () => {
    const mockApi = createMockApi(testConfig);
    const homeContent = await mockApi.home.getContent();
    expect(homeContent.heroSlides.every((slide) => Array.isArray(slide.tagline))).toBe(true);
    const categories = await mockApi.categories.list();
    const topLevelCategories = categories.filter((category) => category.parentId === null);
    expect(topLevelCategories.every((category) => category.description !== null)).toBe(true);
    expect(homeContent.heroSlides.every((slide) => slide.ctaLabel.trim().length > 0)).toBe(true);
    expect(homeContent.ctaBand).not.toBeNull();
  });

  it('사업자 정보는 푸터에 필요한 항목을 모두 반환하고, error 시나리오에서는 실패합니다', async () => {
    const companyInfo = await createMockApi(testConfig).company.getInfo();
    expect(
      Object.values(companyInfo).every(
        (fieldValue) => fieldValue === null || fieldValue.trim().length > 0,
      ),
    ).toBe(true);
    expect(companyInfo.customerCenterTel).toMatch(/^[0-9+]+$/);
    expect(companyInfo.email).toBe('info@example.com');
    expect(companyInfo.quoteEmail).toBe('quote@example.com');
    await expect(
      createMockApi({ ...testConfig, mockScenario: 'error' }).company.getInfo(),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('검색 자동완성은 이름과 브랜드에서 최대 5개를 찾습니다', async () => {
    const suggestions = await createMockApi(testConfig).products.suggest('안전');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it('필터 개수는 카테고리·검색어 범위에서 세고, 검색 카테고리 개수는 상위 카테고리로 모읍니다', async () => {
    const mockApi = createMockApi(testConfig);
    const categoryFacets = await mockApi.products.facets({ categoryId: 'cat-ppe' });
    const categoryPage = await mockApi.products.list({ categoryId: 'cat-ppe', pageSize: 100 });
    expect(categoryFacets.totalCount).toBe(categoryPage.totalCount);
    const brandCountSum = categoryFacets.brands.reduce(
      (countSum, facet) => countSum + facet.count,
      0,
    );
    expect(brandCountSum).toBe(categoryPage.totalCount);

    const searchFacets = await mockApi.products.facets({ keyword: '안전모' });
    expect(searchFacets.categories).toEqual([{ value: 'cat-ppe', count: searchFacets.totalCount }]);
  });

  it('카테고리를 넘겨도 categories와 keywordTotalCount는 검색어 범위 전체 기준 그대로입니다', async () => {
    const mockApi = createMockApi(testConfig);
    const keywordFacets = await mockApi.products.facets({ keyword: '안전' });
    const narrowedFacets = await mockApi.products.facets({
      keyword: '안전',
      categoryId: 'cat-ppe',
    });
    expect(narrowedFacets.categories).toEqual(keywordFacets.categories);
    expect(narrowedFacets.categories.length).toBeGreaterThan(1);
    expect(narrowedFacets.keywordTotalCount).toBe(keywordFacets.keywordTotalCount);
    // totalCount만 카테고리 범위로 좁혀집니다.
    expect(narrowedFacets.totalCount).toBeLessThan(narrowedFacets.keywordTotalCount);

    const keywordPage = await mockApi.products.list({ keyword: '안전', pageSize: 100 });
    expect(keywordFacets.keywordTotalCount).toBe(keywordPage.totalCount);
    const allFacets = await mockApi.products.facets();
    expect(allFacets.keywordTotalCount).toBe(mockProducts.length);
  });

  it('관련 상품은 기준 상품을 빼고 같은 상위 카테고리를 먼저, 개수 제한을 지켜 돌려줍니다', async () => {
    const mockApi = createMockApi(testConfig);
    const relatedProducts = await mockApi.products.listRelated('prd-1001', { limit: 4 });
    expect(relatedProducts).toHaveLength(4);
    expect(relatedProducts.map((product) => product.id)).not.toContain('prd-1001');
    expect(relatedProducts[0]?.categoryId).toMatch(/^cat-(head|eye|foot|mask|ear|fall|hand)$/);
    expect(relatedProducts.every((product) => product.priceVisible || product.price === null)).toBe(
      true,
    );
    expect(await mockApi.products.listRelated('none')).toEqual([]);
  });

  it('추천 상품은 개수 제한을 지키고 금액 비공개 상품의 가격을 숨깁니다', async () => {
    const recommendedProducts = await createMockApi(testConfig).products.listRecommended({
      limit: 10,
    });
    expect(recommendedProducts).toHaveLength(10);
    expect(
      recommendedProducts.every((product) => product.priceVisible || product.price === null),
    ).toBe(true);
    await expect(
      createMockApi({ ...testConfig, mockScenario: 'error' }).products.listRecommended(),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('목 상품의 평점·리뷰 수는 목 리뷰와 일치합니다(소수 첫째 자리 반올림)', () => {
    for (const product of mockProducts) {
      const productReviews = mockReviews.filter((review) => review.productId === product.id);
      expect(product.reviewCount, product.id).toBe(productReviews.length);
      if (productReviews.length === 0) {
        expect(product.rating, product.id).toBeNull();
        continue;
      }
      const ratingSum = productReviews.reduce((sum, review) => sum + review.rating, 0);
      expect(product.rating, product.id).toBe(
        Math.round((ratingSum / productReviews.length) * 10) / 10,
      );
    }
  });

  it('리뷰는 상품별 최신순으로 페이지를 나눠 돌려줍니다', async () => {
    const mockApi = createMockApi(testConfig);
    const reviewPage = await mockApi.products.listReviews('prd-1001', { pageSize: 2 });
    expect(reviewPage.totalCount).toBe(3);
    expect(reviewPage.items).toHaveLength(2);
    expect(reviewPage.items[0]!.createdAt >= reviewPage.items[1]!.createdAt).toBe(true);
    expect((await mockApi.products.listReviews('prd-1003')).items).toEqual([]);
  });

  it('리뷰 요약은 상품 리뷰에서 별점별 개수를 계산합니다', async () => {
    const summary = await createMockApi(testConfig).products.getReviewSummary('prd-1001');
    expect(summary).toMatchObject({
      productId: 'prd-1001',
      totalCount: 3,
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 },
      photoReviewCount: 0,
      averageRating: 4.7,
    });
    expect(await createMockApi(testConfig).products.getReviewSummary('prd-1003')).toMatchObject({
      totalCount: 0,
      averageRating: null,
    });
  });

  it('이벤트는 목 목록과 상세를 제공하고 없는 상세 ID는 NOT_FOUND입니다', async () => {
    const mockApi = createMockApi(testConfig);
    expect(await mockApi.events.list()).toHaveLength(mockEvents.length);
    expect(await mockApi.events.getById('event-safety-week')).toMatchObject({
      id: 'event-safety-week',
      status: 'ongoing',
    });
    await expect(mockApi.events.getById('event-missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      createMockApi({ ...testConfig, mockScenario: 'error' }).events.list(),
    ).rejects.toMatchObject({ code: 'NETWORK' });
    expect(await createMockApi({ ...testConfig, mockScenario: 'empty' }).events.list()).toEqual([]);
  });

  it('추천 검색어를 돌려줍니다', async () => {
    const keywords = await createMockApi(testConfig).search.recommendedKeywords();
    expect(keywords.length).toBeGreaterThan(0);
  });

  it('empty: 빈 목록을 돌려줍니다', async () => {
    const productPage = await createMockApi({
      ...testConfig,
      mockScenario: 'empty',
    }).products.list();
    expect(productPage.items).toEqual([]);
  });

  it('error: NETWORK 오류를 냅니다', async () => {
    await expect(
      createMockApi({ ...testConfig, mockScenario: 'error' }).notices.list(),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('응답은 복사본이라 바꿔도 다음 응답에 영향이 없습니다', async () => {
    const mockApi = createMockApi(testConfig);
    const firstPage = await mockApi.products.list();
    firstPage.items[0]!.name = '변경';
    expect((await mockApi.products.list()).items[0]?.name).not.toBe('변경');
  });

  it('없는 상품은 NOT_FOUND입니다', async () => {
    await expect(createMockApi(testConfig).products.getById('none')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('₩0의 표시 가격 상품은 주문할 수 있고 숨김 가격·품절 상품은 거절합니다', async () => {
    const mockApi = createMockApi(testConfig);
    const address = mockAddresses[0]!;
    const zeroPriceReceipt = await mockApi.orders.create({
      lines: [{ productId: 'prd-1004', quantity: 1, optionId: null }],
      shippingAddress: address,
      deliveryRequest: '',
      paymentMethod: 'creditCard',
      couponId: null,
      pointsToUse: 0,
    });
    expect(zeroPriceReceipt.productTotal).toBe(0);
    expect(zeroPriceReceipt.shippingFee).toBe(0);
    expect(zeroPriceReceipt.paymentTotal).toBe(0);

    const hiddenPriceProduct = mockProducts.find((product) => !product.priceVisible);
    expect(hiddenPriceProduct).toBeDefined();
    await expect(
      mockApi.orders.create({
        lines: [{ productId: hiddenPriceProduct!.id, quantity: 1, optionId: null }],
        shippingAddress: address,
        deliveryRequest: '',
        paymentMethod: 'creditCard',
        couponId: null,
        pointsToUse: 0,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      mockApi.orders.create({
        lines: [{ productId: 'prd-1005', quantity: 1, optionId: 'mount:wall' }],
        shippingAddress: address,
        deliveryRequest: '',
        paymentMethod: 'creditCard',
        couponId: null,
        pointsToUse: 0,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('AbortSignal로 취소하면 AbortError로 끝납니다', async () => {
    const abortController = new AbortController();
    const pendingList = createMockApi({ ...testConfig, mockLatencyMs: 1000 }).products.list(
      {},
      { signal: abortController.signal },
    );
    abortController.abort();
    await expect(pendingList).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('운영에서 허용 플래그 없이 만들면 거부합니다', () => {
    expect(() => createMockApi({ ...testConfig, isProduction: true })).toThrow(ApiConfigError);
  });
});

describe('목 브랜드 API', () => {
  it('목록은 노출 브랜드만 돌려주고, 상품 수는 브랜드 이름 필터의 전체 개수와 같습니다', async () => {
    const mockApi = createMockApi(testConfig);
    const brandList = await mockApi.brands.list();
    const hiddenBrandIds = mockBrands
      .filter((brandRecord) => !brandRecord.isVisible)
      .map((brandRecord) => brandRecord.id);

    expect(hiddenBrandIds.length).toBeGreaterThan(0);
    expect(brandList.length).toBe(mockBrands.length - hiddenBrandIds.length);
    expect(brandList.some((brandSummary) => hiddenBrandIds.includes(brandSummary.id))).toBe(false);
    expect(brandList[0]).not.toHaveProperty('isVisible');
    for (const brandSummary of brandList) {
      const brandProductPage = await mockApi.products.list({ brand: [brandSummary.name] });
      expect(brandSummary.productCount, brandSummary.name).toBe(brandProductPage.totalCount);
    }
  });

  it('목 상품의 모든 브랜드는 노출 브랜드로 등록되어 있습니다', () => {
    const visibleBrandNames = new Set(
      mockBrands
        .filter((brandRecord) => brandRecord.isVisible)
        .map((brandRecord) => brandRecord.name),
    );
    for (const product of mockProducts) {
      expect(visibleBrandNames.has(product.brand), product.brand).toBe(true);
    }
  });

  it('상세는 노출 브랜드만 돌려주고, 비노출·없는 브랜드는 NOT_FOUND입니다', async () => {
    const mockApi = createMockApi(testConfig);
    const safeguardBrand = await mockApi.brands.getById('brd-safeguard');
    expect(safeguardBrand.coverImageUrl).toBe('/assets/web/about-warehouse.png');

    const workfitBrand = await mockApi.brands.getById('brd-workfit');
    expect(workfitBrand).toMatchObject({ id: 'brd-workfit', name: '워크핏' });
    expect(workfitBrand).not.toHaveProperty('isFeatured');

    const hiddenBrand = mockBrands.find((brandRecord) => !brandRecord.isVisible);
    if (!hiddenBrand) throw new Error('비노출 목 브랜드가 필요합니다.');
    await expect(mockApi.brands.getById(hiddenBrand.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(mockApi.brands.getById('brd-missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('이달의 브랜드는 지정된 노출 브랜드를 돌려주고, empty 시나리오는 null입니다', async () => {
    const featuredBrand = await createMockApi(testConfig).brands.getFeatured();
    const featuredRecord = mockBrands.find(
      (brandRecord) => brandRecord.isVisible && brandRecord.isFeatured,
    );
    expect(featuredBrand?.id).toBe(featuredRecord?.id);
    expect(featuredBrand?.productCount).toBeGreaterThan(0);

    const emptyApi = createMockApi({ ...testConfig, mockScenario: 'empty' });
    await expect(emptyApi.brands.getFeatured()).resolves.toBeNull();
    await expect(emptyApi.brands.list()).resolves.toEqual([]);
    await expect(emptyApi.brands.getById('brd-workfit')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('error 시나리오에서는 목록·상세·이달의 브랜드 모두 NETWORK 오류입니다', async () => {
    const errorApi = createMockApi({ ...testConfig, mockScenario: 'error' });
    await expect(errorApi.brands.list()).rejects.toMatchObject({ code: 'NETWORK' });
    await expect(errorApi.brands.getById('brd-workfit')).rejects.toMatchObject({
      code: 'NETWORK',
    });
    await expect(errorApi.brands.getFeatured()).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('AbortSignal 취소를 목록·상세·이달의 브랜드 조회까지 전달합니다', async () => {
    const abortController = new AbortController();
    const mockApi = createMockApi({ ...testConfig, mockLatencyMs: 1000 });
    const pendingBrands = mockApi.brands.list({ signal: abortController.signal });
    abortController.abort();

    await expect(pendingBrands).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('응답은 복사본이라 바꿔도 목 원본에 영향이 없습니다', async () => {
    const mockApi = createMockApi(testConfig);
    const firstBrand = await mockApi.brands.getById('brd-safeguard');
    firstBrand.name = '변경됨';
    if (firstBrand.story) firstBrand.story.title = '변경됨';
    const secondBrand = await mockApi.brands.getById('brd-safeguard');
    expect(secondBrand.name).toBe('세이프가드');
    expect(secondBrand.story?.title).not.toBe('변경됨');
  });

  it('관리자 브랜드를 생성·수정하고 대표 노출 및 상품 연결 삭제 제약을 지킵니다', async () => {
    const mockApi = createMockApi(testConfig);
    const original = await mockApi.brands.getById('brd-safeguard');
    const { productCount: _productCount, ...originalFields } = original;
    const created = await mockApi.brands.saveAdmin({
      ...originalFields,
      id: undefined,
      name: '새 안전 브랜드',
      isVisible: true,
      isFeatured: false,
      sortOrder: 20,
    });
    expect(created.id).toMatch(/^brd-admin-/);
    expect((await mockApi.brands.adminList()).some((brand) => brand.id === created.id)).toBe(true);
    await expect(
      mockApi.brands.saveAdmin({ ...created, isVisible: false, isFeatured: true }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });

    await mockApi.brands.saveAdmin({ ...created, isFeatured: true });
    await expect(mockApi.brands.deleteAdmin(created.id)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await mockApi.brands.saveAdmin({ ...created, isFeatured: false });
    await mockApi.brands.deleteAdmin(created.id);
    await expect(mockApi.brands.adminList()).resolves.not.toContainEqual(
      expect.objectContaining({ id: created.id }),
    );
    await expect(mockApi.brands.deleteAdmin('brd-safeguard')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });
});

describe('관리자 홈 편성·이벤트 목 API', () => {
  it('저장한 홈 배너와 추천 상품을 공개 홈 응답에서 다시 조회합니다', async () => {
    const api = createMockApi(testConfig);
    const draft = await api.home.getAdminContent();
    const product = (await api.products.adminList())[0];
    const hero = draft.heroSlides[0];
    if (!product || !hero) throw new Error('홈 편성 목 데이터가 필요합니다.');
    const nextDraft = {
      ...draft,
      heroSlides: [{ ...hero, eyebrow: '운영 문구' }],
      featuredProductIds: [product.id],
    };
    await api.home.saveAdminContent(nextDraft);
    const publicHome = await api.home.getContent();
    expect(publicHome.heroSlides).toHaveLength(1);
    expect(publicHome.heroSlides[0]?.eyebrow).toBe('운영 문구');
    expect(publicHome.featuredProducts.map((item) => item.id)).toEqual([product.id]);
  });

  it('이벤트를 등록·수정·숨김·삭제하고 공개 조회를 동기화합니다', async () => {
    const api = createMockApi(testConfig);
    const input = {
      title: '관리 이벤트',
      subtitle: '운영 이벤트',
      status: 'upcoming' as const,
      startAt: '2026-11-01T00:00:00+09:00',
      endAt: '2026-11-30T23:59:59+09:00',
      eyebrow: 'EVENT',
      heroTitle: ['새 이벤트'],
      heroDescription: '상세 설명',
      body: '본문',
      sections: [{ heading: '내용', body: '세부 내용' }],
      searchKeyword: '운영',
      isVisible: true,
      sortOrder: 0,
    };
    const created = await api.events.saveAdmin(input);
    expect((await api.events.getById(created.id)).title).toBe('관리 이벤트');
    await api.events.saveAdmin({ ...created, isVisible: false });
    await expect(api.events.getById(created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await api.events.deleteAdmin(created.id);
    await expect(api.events.adminList()).resolves.not.toContainEqual(
      expect.objectContaining({ id: created.id }),
    );
    await expect(
      api.events.saveAdmin({ ...input, endAt: '2026-10-01T00:00:00+09:00' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });
});

describe('관리자 주문·클레임·견적 목 API', () => {
  it('buyer quote submission appears in Admin and the owning member projection only', async () => {
    const api = createMockApi(testConfig);
    const attachmentWithPayload = {
      id: 'att-web',
      fileName: 'spec.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      dataUrl: 'data:application/pdf;base64,AA==',
    };
    const submitted = await api.quotes.submit({
      title: '대량 구매 견적 문의',
      companyName: '이음 테스트',
      contactName: '김담당',
      inquiryBody: '연락처: 010-0000-1111\n상세: 납품 문의',
      requestedItems: [{ name: '안전모', quantity: 12, option: '색상: 흰색' }],
      attachments: [attachmentWithPayload],
    });
    expect(submitted).toMatchObject({
      status: 'received',
      memberId: 'mem-001',
      title: '대량 구매 견적 문의',
    });
    expect(submitted).toMatchObject({
      inquiryBody: expect.stringContaining('납품 문의'),
      requestedItems: [{ name: '안전모', quantity: 12, option: '색상: 흰색' }],
      attachments: [
        { id: 'att-web', fileName: 'spec.pdf', mimeType: 'application/pdf', sizeBytes: 10 },
      ],
    });
    expect(submitted).not.toHaveProperty('internalMemo');
    expect(submitted.attachments?.[0]).not.toHaveProperty('dataUrl');
    const adminQuote = (await api.quotes.adminList()).find((quote) => quote.id === submitted.id);
    expect(adminQuote).toMatchObject({
      inquiryBody: expect.stringContaining('010-0000-1111'),
      requestedItems: [{ name: '안전모', quantity: 12, option: '색상: 흰색' }],
      attachments: [expect.objectContaining({ fileName: 'spec.pdf' })],
    });
    expect(adminQuote?.attachments[0]).not.toHaveProperty('dataUrl');
    await api.quotes.updateAdmin(submitted.id, {
      status: 'quoteSent',
      publicMessage: '해당 조건으로 진행 가능합니다.',
      quoteAmount: 145000,
      expiresAt: '2026-11-30',
      internalMemo: '발주 전 수량 재확인',
    });
    const buyerSubmittedQuote = (await api.quotes.listByMember('mem-001')).find(
      (quote) => quote.id === submitted.id,
    );
    expect(buyerSubmittedQuote).toMatchObject({
      status: 'quoteSent',
      publicMessage: '해당 조건으로 진행 가능합니다.',
      quoteAmount: 145000,
      expiresAt: '2026-11-30',
    });
    expect(buyerSubmittedQuote).not.toHaveProperty('internalMemo');
    expect(await api.quotes.listByMember('mem-001')).toContainEqual(
      expect.objectContaining({ id: submitted.id }),
    );
    await expect(api.quotes.listByMember('mem-002')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('buyer claim submission checks session ownership, validates order quantities, and appears in both inboxes', async () => {
    const api = createMockApi(testConfig);
    await api.claims.updateAdmin('clm-002', { status: 'rejected' });
    const submitted = await api.claims.submit({
      orderId: 'ord-002',
      type: 'return',
      reason: '상품 불량·파손',
      description: '포장 훼손',
      items: [{ productId: 'prd-1002', quantity: 1 }],
      returnMethod: 'pickup',
      returnAddress: {
        recipientName: '목 회원',
        phone: '010-0000-0000',
        postalCode: '00000',
        address1: '서울시',
        address2: '마포구',
      },
      attachments: [{ fileName: 'damage.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 }],
    });
    expect(submitted).toMatchObject({
      orderId: 'ord-002',
      type: 'return',
      status: 'requested',
      items: [{ productId: 'prd-1002', quantity: 1 }],
      returnMethod: 'pickup',
      returnAddress: {
        recipientName: '목 회원',
        phone: '010-0000-0000',
        postalCode: '00000',
        address1: '서울시',
        address2: '마포구',
      },
      attachments: [{ fileName: 'damage.jpg', mimeType: 'image/jpeg', sizeBytes: 2048 }],
    });
    expect(submitted).not.toHaveProperty('adminMemo');
    expect(submitted).not.toHaveProperty('statusHistory');
    expect((await api.claims.adminList()).some((claim) => claim.id === submitted.id)).toBe(true);
    expect(
      (await api.claims.listByMember('mem-001')).some((claim) => claim.id === submitted.id),
    ).toBe(true);
    await expect(
      api.claims.submit({
        orderId: 'ord-002',
        type: 'exchange',
        reason: '사이즈 변경',
        description: '같은 주문 중복 신청',
        items: [{ productId: 'prd-1002', quantity: 1 }],
        ...returnDetails,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message:
        '해당 주문에 처리 중인 취소·반품·교환 신청이 있습니다. 기존 신청 처리 후 다시 요청해 주세요.',
    });
    await api.claims.updateAdmin(submitted.id, { status: 'completed' });
    await expect(
      api.claims.submit({
        orderId: 'ord-002',
        type: 'return',
        reason: '상품 불량·파손',
        description: '수량 초과',
        items: [{ productId: 'prd-1002', quantity: 3 }],
        ...returnDetails,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    const otherMemberApi = createMockApi(testConfig, {
      getCurrentMember: async () => mockMembers.find((member) => member.id === 'mem-002') ?? null,
    });
    await expect(
      otherMemberApi.claims.submit({
        orderId: 'ord-002',
        type: 'return',
        reason: '상품 불량·파손',
        description: '타 회원 주문',
        items: [{ productId: 'prd-1002', quantity: 1 }],
        ...returnDetails,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('non-cancel claims require return details while cancellation can omit them', async () => {
    const api = createMockApi(testConfig);
    const product = (await api.products.adminList()).find((item) => item.id === 'prd-1004');
    if (!product) throw new Error('클레임 테스트 상품이 필요합니다.');
    const receipt = await api.orders.create({
      lines: [{ productId: product.id, quantity: 1, optionId: null }],
      shippingAddress: mockAddresses[0]!,
      deliveryRequest: '',
      paymentMethod: 'creditCard',
      couponId: null,
      pointsToUse: 0,
    });
    const order = (await api.orders.adminList()).find(
      (item) => item.orderNumber === receipt.orderNumber,
    );
    if (!order) throw new Error('새 주문이 관리자 목록에 없습니다.');

    await expect(
      api.claims.submit({
        orderId: order.id,
        type: 'return',
        reason: '상품 불량',
        description: '파손 확인',
        items: [{ productId: product.id, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    const cancelClaim = await api.claims.submit({
      orderId: order.id,
      type: 'cancel',
      reason: '주문 변경',
      description: '잘못 주문했습니다.',
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(cancelClaim).not.toHaveProperty('returnMethod');
    expect(cancelClaim).not.toHaveProperty('returnAddress');
  });

  it('accepts only the order states supported by each claim type', async () => {
    const cases = [
      { status: 'paymentPending', type: 'cancel', isEligible: true },
      { status: 'paid', type: 'cancel', isEligible: true },
      { status: 'preparing', type: 'cancel', isEligible: true },
      { status: 'shipping', type: 'cancel', isEligible: false },
      { status: 'delivered', type: 'cancel', isEligible: false },
      { status: 'paymentPending', type: 'return', isEligible: false },
      { status: 'paid', type: 'return', isEligible: false },
      { status: 'preparing', type: 'return', isEligible: false },
      { status: 'shipping', type: 'return', isEligible: true },
      { status: 'delivered', type: 'return', isEligible: true },
    ] as const;

    for (const claimCase of cases) {
      const api = createMockApi(testConfig);
      const product = (await api.products.adminList()).find((item) => item.id === 'prd-1004');
      if (!product) throw new Error('클레임 상태 테스트 상품이 필요합니다.');
      const receipt = await api.orders.create({
        lines: [{ productId: product.id, quantity: 1, optionId: null }],
        shippingAddress: mockAddresses[0]!,
        deliveryRequest: '',
        paymentMethod: 'creditCard',
        couponId: null,
        pointsToUse: 0,
      });
      const order = (await api.orders.adminList()).find(
        (item) => item.orderNumber === receipt.orderNumber,
      );
      if (!order) throw new Error('신규 주문이 관리자 목록에 없습니다.');
      await api.orders.updateAdmin(order.id, {
        status: claimCase.status,
        ...(claimCase.status === 'shipping'
          ? { trackingCarrier: '테스트 택배', trackingNumber: '1234567890' }
          : {}),
      });

      const submitClaim = () =>
        api.claims.submit({
          orderId: order.id,
          type: claimCase.type,
          reason: claimCase.type === 'cancel' ? '주문 변경' : '상품 불량',
          description: '상태 허용 범위 확인',
          items: [{ productId: product.id, quantity: 1 }],
          ...(claimCase.type === 'cancel' ? {} : returnDetails),
        });

      if (claimCase.isEligible) {
        expect(await submitClaim()).toMatchObject({ type: claimCase.type, orderId: order.id });
      } else {
        await expect(submitClaim()).rejects.toMatchObject({ code: 'VALIDATION' });
      }
    }
  });

  it('클레임 수량은 주문에 저장된 SKU 스냅샷 범위에서만 신청할 수 있습니다', async () => {
    const api = createMockApi(testConfig);
    const product = (await api.products.adminList()).find((item) => item.id === 'prd-1001');
    if (!product) throw new Error('SKU 클레임 테스트 상품이 필요합니다.');
    await api.products.saveAdmin({
      ...product,
      options: [
        {
          id: 'size',
          label: '사이즈',
          required: true,
          choices: [{ id: 'large', label: '대형', priceDelta: 0 }],
        },
      ],
      skus: [
        {
          id: 'sku-claim',
          optionLabels: ['사이즈: 대형'],
          productCode: 'SKU-CLAIM',
          priceDelta: 0,
          stockCount: 5,
          salesStatus: 'active',
          imageId: null,
        },
      ],
    });
    const optionId = createCartOptionId([{ optionId: 'size', choiceId: 'large' }]);
    const receipt = await api.orders.create({
      lines: [{ productId: product.id, quantity: 3, optionId }],
      shippingAddress: mockAddresses[0]!,
      deliveryRequest: '',
      paymentMethod: 'creditCard',
      couponId: null,
      pointsToUse: 0,
    });
    const createdOrder = (await api.orders.adminList()).find(
      (order) => order.orderNumber === receipt.orderNumber,
    );
    if (!createdOrder) throw new Error('새 주문이 Admin 조회에 저장되지 않았습니다.');
    await api.orders.updateAdmin(createdOrder.id, { status: 'delivered' });
    await api.claims.updateAdmin('clm-001', { status: 'completed' });

    await expect(
      api.claims.submit({
        orderId: createdOrder.id,
        type: 'return',
        reason: '상품 불량',
        description: '수량 초과',
        items: [{ productId: product.id, skuId: 'sku-claim', quantity: 4 }],
        ...returnDetails,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      api.claims.submit({
        orderId: createdOrder.id,
        type: 'return',
        reason: '상품 불량',
        description: '다른 SKU',
        items: [{ productId: product.id, skuId: 'sku-other', quantity: 1 }],
        ...returnDetails,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      api.claims.submit({
        orderId: createdOrder.id,
        type: 'return',
        reason: '상품 불량',
        description: '수량 내 신청',
        items: [{ productId: product.id, skuId: 'sku-claim', quantity: 2 }],
        ...returnDetails,
      }),
    ).resolves.toMatchObject({
      orderId: createdOrder.id,
      items: [{ skuId: 'sku-claim', optionLabel: '사이즈: 대형', quantity: 2 }],
    });
    const firstReturn = (await api.claims.adminList()).find(
      (claim) => claim.orderId === createdOrder.id,
    );
    if (!firstReturn) throw new Error('반품 신청 스냅샷이 저장되지 않았습니다.');
    await api.claims.updateAdmin(firstReturn.id, { status: 'completed' });
    await expect(
      api.claims.submit({
        orderId: createdOrder.id,
        type: 'return',
        reason: '상품 불량',
        description: '완료 수량 재신청',
        items: [{ productId: product.id, skuId: 'sku-claim', quantity: 2 }],
        ...returnDetails,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    const remainingReturn = await api.claims.submit({
      orderId: createdOrder.id,
      type: 'return',
      reason: '상품 불량',
      description: '잔여 수량 신청',
      items: [{ productId: product.id, skuId: 'sku-claim', quantity: 1 }],
      ...returnDetails,
    });
    await api.claims.updateAdmin(remainingReturn.id, { status: 'completed' });
    await expect(
      api.claims.submit({
        orderId: createdOrder.id,
        type: 'return',
        reason: '상품 불량',
        description: '전체 반품 완료 후 재신청',
        items: [{ productId: product.id, skuId: 'sku-claim', quantity: 1 }],
        ...returnDetails,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('송장·상태·메모를 저장하고 주문 이력을 유지하면서 구매자 응답에는 관리자 필드를 숨깁니다', async () => {
    const api = createMockApi(testConfig);
    const order = (await api.orders.adminList())[0];
    if (!order) throw new Error('관리자 주문 목 데이터가 필요합니다.');
    await expect(api.orders.updateAdmin(order.id, { status: 'shipping' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    const updated = await api.orders.updateAdmin(order.id, {
      status: 'shipping',
      trackingCarrier: '택배사',
      trackingNumber: '1234567890',
      adminMemo: '포장 확인',
    });
    expect(updated.statusHistory.at(-1)?.status).toBe('shipping');
    expect(updated.adminMemo).toBe('포장 확인');
    const buyerOrder = await api.orders.getById(order.id);
    expect(buyerOrder.status).toBe('shipping');
    expect(buyerOrder).toMatchObject({ trackingCarrier: '택배사', trackingNumber: '1234567890' });
    expect(buyerOrder).not.toHaveProperty('adminMemo');
  });

  it('클레임 처리 상태와 견적서 공개 답변·내부 메모·첨부를 구분해 저장합니다', async () => {
    const api = createMockApi(testConfig);
    const claim = (await api.claims.adminList())[0];
    const quote = (await api.quotes.adminList())[0];
    if (!claim || !quote) throw new Error('클레임·견적 문의 목 데이터가 필요합니다.');
    await api.claims.updateAdmin(claim.id, { status: 'completed', adminMemo: '환불 확인' });
    const updatedClaim = (await api.claims.adminList()).find((item) => item.id === claim.id);
    expect(updatedClaim?.statusHistory.at(-1)?.status).toBe('completed');
    const attachment = {
      id: 'att-1',
      fileName: '견적.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 20,
      dataUrl: 'data:application/pdf;base64,AA==',
    };
    await api.quotes.updateAdmin(quote.id, {
      status: 'quoteSent',
      quoteAmount: 125000,
      expiresAt: '2026-11-30',
      publicMessage: '고객에게 안내할 내용',
      internalMemo: '담당자 확인 필요',
      attachments: [attachment],
    });
    const updatedQuote = (await api.quotes.adminList()).find((item) => item.id === quote.id);
    expect(updatedQuote).toMatchObject({
      status: 'quoteSent',
      quoteAmount: 125000,
      publicMessage: '고객에게 안내할 내용',
      internalMemo: '담당자 확인 필요',
      attachments: [
        { id: 'att-1', fileName: '견적.pdf', mimeType: 'application/pdf', sizeBytes: 20 },
      ],
    });
    expect(updatedQuote?.attachments[0]).not.toHaveProperty('dataUrl');
    expect(updatedQuote?.attachments[0]).not.toHaveProperty('dataUrl');
    const buyerQuote = (await api.quotes.listByMember(quote.memberId ?? '')).find(
      (item) => item.id === quote.id,
    );
    expect(buyerQuote).toMatchObject({
      status: 'quoteSent',
      publicMessage: '고객에게 안내할 내용',
      quoteAmount: 125000,
      expiresAt: '2026-11-30',
    });
    expect(buyerQuote).not.toHaveProperty('internalMemo');
    expect(buyerQuote).toHaveProperty('attachments');
    expect(buyerQuote).toHaveProperty('inquiryBody');
    expect(buyerQuote?.attachments?.[0]).not.toHaveProperty('dataUrl');
    expect(buyerQuote).not.toHaveProperty('internalMemo');
    expect(await api.quotes.listByMember('mem-001')).toEqual(
      expect.arrayContaining([expect.objectContaining({ memberId: 'mem-001' })]),
    );
    expect(
      (await api.quotes.listByMember('mem-001')).every((item) => item.memberId === 'mem-001'),
    ).toBe(true);
    expect(
      (await api.quotes.listByMember('mem-001')).some(
        (item) => item.memberId === 'mem-002' || item.memberId === null,
      ),
    ).toBe(false);
  });
});

describe('운영 쿠폰 목 API', () => {
  it('운영 쿠폰을 생성·수정·삭제하고 개인 보유 쿠폰 목록과 분리합니다', async () => {
    const api = createMockApi(testConfig);
    const input = {
      name: '운영 할인',
      code: 'EUM-OPS-10',
      benefitType: 'rate' as const,
      benefitValue: 10,
      maxDiscountAmount: 5000,
      minimumOrderAmount: 10000,
      target: 'all' as const,
      issueMethod: 'code' as const,
      productScope: 'all' as const,
      issueLimit: null,
      allowStacking: false,
      validityMode: 'period' as const,
      validityDays: null,
      startsAt: '2026-10-18',
      endsAt: '2026-12-31',
      status: 'active' as const,
      notice: '운영 테스트',
    };
    const created = await api.coupons.saveAdmin(input);
    expect(created).toMatchObject({ name: '운영 할인', issuedCount: 0, usedCount: 0 });
    await api.coupons.saveAdmin({ ...input, id: created.id, status: 'paused' });
    await expect(api.coupons.adminList()).resolves.toContainEqual(
      expect.objectContaining({ id: created.id, status: 'paused' }),
    );
    await expect(api.coupons.saveAdmin({ ...input, code: 'eum-ops-10' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await api.coupons.deleteAdmin(created.id);
    await expect(api.coupons.adminList()).resolves.not.toContainEqual(
      expect.objectContaining({ id: created.id }),
    );
    const recreated = await api.coupons.saveAdmin({ ...input, code: 'EUM-OPS-10-RECREATED' });
    expect(recreated.id).not.toBe(created.id);
    await expect(api.coupons.historyList()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'cpn-001' })]),
    );
  });

  it('자동·다운로드·코드 쿠폰을 구매자에게 각 방식으로 발급하고 중복 발급을 막습니다', async () => {
    const api = createMockApi(testConfig);
    const base = {
      name: '획득 테스트 쿠폰',
      benefitType: 'amount' as const,
      benefitValue: 1000,
      maxDiscountAmount: 1000,
      minimumOrderAmount: 0,
      target: 'all' as const,
      productScope: 'all' as const,
      issueLimit: 5,
      allowStacking: false,
      validityMode: 'period' as const,
      validityDays: null,
      startsAt: '2026-10-01',
      endsAt: '2026-12-31',
      status: 'active' as const,
      notice: '',
    };
    const automatic = await api.coupons.saveAdmin({
      ...base,
      code: 'AUTO-NEW',
      issueMethod: 'automatic',
    });
    const product = (await api.products.adminList()).find((item) => item.id === 'prd-1001');
    if (!product) throw new Error('쿠폰 테스트 상품이 필요합니다.');
    await api.products.saveAdmin({ ...product, options: [], skus: [] });
    const acquiredAutomatic = (await api.coupons.historyList()).find(
      (coupon) => coupon.name === automatic.name,
    );
    expect(acquiredAutomatic).toBeDefined();
    expect(acquiredAutomatic).not.toHaveProperty('adminCouponId');
    expect(
      (await api.coupons.adminList()).find((coupon) => coupon.id === automatic.id)?.issuedCount,
    ).toBe(1);
    const automaticReceipt = await api.orders.create({
      lines: [{ productId: 'prd-1001', quantity: 1, optionId: null }],
      shippingAddress: mockAddresses[0]!,
      deliveryRequest: '',
      paymentMethod: 'creditCard',
      couponId: acquiredAutomatic!.id,
      pointsToUse: 0,
    });
    expect(automaticReceipt.discountTotal).toBe(1000);
    expect(
      (await api.coupons.adminList()).find((coupon) => coupon.id === automatic.id)?.usedCount,
    ).toBe(1);

    const download = await api.coupons.saveAdmin({
      ...base,
      code: 'DOWNLOAD-NEW',
      issueMethod: 'download',
    });
    expect(
      (await api.coupons.availableList()).find((offer) => offer.id === download.id)?.isAcquired,
    ).toBe(false);
    const acquiredDownload = await api.coupons.acquire(download.id);
    expect(await api.coupons.acquire(download.id)).toMatchObject({ id: acquiredDownload.id });
    expect(
      (await api.coupons.adminList()).find((coupon) => coupon.id === download.id)?.issuedCount,
    ).toBe(1);

    const code = await api.coupons.saveAdmin({ ...base, code: 'CODE-NEW', issueMethod: 'code' });
    const acquiredCode = await api.coupons.redeemCode(code.code.toLowerCase());
    expect(acquiredCode.name).toBe(code.name);
    await expect(api.coupons.redeemCode(code.code)).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(api.coupons.redeemCode('UNKNOWN')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const expiredCode = await api.coupons.saveAdmin({
      ...base,
      code: 'EXPIRED-CODE',
      issueMethod: 'code',
      endsAt: '2020-01-01',
    });
    await expect(api.coupons.redeemCode(expiredCode.code)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('초기 보유 쿠폰의 발급·사용 건수를 운영 카탈로그와 일치시킵니다', async () => {
    const api = createMockApi(testConfig);
    const adminCoupons = await api.coupons.adminList();
    const buyerCoupons = await api.coupons.historyList();
    for (const adminCoupon of adminCoupons) {
      const issuedCount = buyerCoupons.filter((coupon) => coupon.name === adminCoupon.name).length;
      const usedCount = buyerCoupons.filter(
        (coupon) => coupon.name === adminCoupon.name && coupon.isUsed,
      ).length;
      expect(adminCoupon.issuedCount).toBeGreaterThanOrEqual(issuedCount);
      expect(adminCoupon.usedCount).toBeGreaterThanOrEqual(usedCount);
    }
  });

  it('Admin 카탈로그 변경은 이미 보유한 buyer 쿠폰과 checkout 할인에 반영됩니다', async () => {
    const api = createMockApi(testConfig);
    const product = (await api.products.adminList()).find((item) => item.id === 'prd-1001');
    if (!product) throw new Error('쿠폰 테스트 상품이 필요합니다.');
    await api.products.saveAdmin({ ...product, options: [] });
    const catalog = (await api.coupons.adminList()).find(
      (coupon) => coupon.id === 'coupon-demo-001',
    );
    if (!catalog) throw new Error('운영 쿠폰 카탈로그 데이터가 필요합니다.');
    await api.coupons.saveAdmin({
      ...catalog,
      name: '수정된 회원 쿠폰',
      benefitType: 'rate',
      benefitValue: 50,
      maxDiscountAmount: 4000,
      minimumOrderAmount: 1000,
    });
    const [buyerCoupon] = await api.coupons.historyList();
    expect(buyerCoupon).toMatchObject({
      id: 'cpn-001',
      name: '수정된 회원 쿠폰',
      discountValue: 50,
    });
    expect(buyerCoupon).not.toHaveProperty('adminCouponId');
    const receipt = await api.orders.create({
      lines: [{ productId: 'prd-1001', quantity: 1, optionId: null }],
      shippingAddress: mockAddresses[0]!,
      deliveryRequest: '',
      paymentMethod: 'creditCard',
      couponId: 'cpn-001',
      pointsToUse: 0,
    });
    expect(receipt).toMatchObject({ productTotal: 18000, discountTotal: 4000 });
    expect(await api.coupons.list()).not.toContainEqual(expect.objectContaining({ id: 'cpn-001' }));
    expect(
      (await api.coupons.adminList()).find((coupon) => coupon.id === catalog.id)?.usedCount,
    ).toBe(1);
    await expect(api.coupons.deleteAdmin(catalog.id)).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('paused·타겟 제한·기간 밖인 카탈로그 쿠폰은 buyer에게 발급된 쿠폰으로 보여도 사용을 거절합니다', async () => {
    const api = createMockApi(testConfig);
    const product = (await api.products.adminList()).find((item) => item.id === 'prd-1001');
    if (!product) throw new Error('쿠폰 테스트 상품이 필요합니다.');
    await api.products.saveAdmin({ ...product, options: [] });
    const catalog = (await api.coupons.adminList()).find(
      (coupon) => coupon.id === 'coupon-demo-001',
    );
    if (!catalog) throw new Error('운영 쿠폰 카탈로그 데이터가 필요합니다.');
    for (const update of [
      { status: 'paused' as const },
      { status: 'active' as const, target: 'personal' as const },
      { status: 'active' as const, target: 'all' as const, productScope: 'products' as const },
      {
        status: 'active' as const,
        target: 'all' as const,
        productScope: 'all' as const,
        endsAt: '2020-01-01',
      },
    ]) {
      await api.coupons.saveAdmin({ ...catalog, ...update });
      expect(await api.coupons.list()).not.toContainEqual(
        expect.objectContaining({ id: 'cpn-001' }),
      );
      await expect(
        api.orders.create({
          lines: [{ productId: 'prd-1001', quantity: 1, optionId: null }],
          shippingAddress: mockAddresses[0]!,
          deliveryRequest: '',
          paymentMethod: 'creditCard',
          couponId: 'cpn-001',
          pointsToUse: 0,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    }
  });

  it('배송 정책 저장은 checkout 옵션과 주문 배송비 계산에 반영됩니다', async () => {
    const api = createMockApi(testConfig);
    const current = await api.settings.getAdmin();
    await api.settings.saveAdmin({
      ...current,
      baseShippingFee: 4500,
      freeShippingEnabled: false,
    });
    expect(await api.settings.getAdmin()).toMatchObject({
      baseShippingFee: 4500,
      freeShippingEnabled: false,
    });
    expect(await api.checkout.getOptions()).toMatchObject({
      shippingFee: 4500,
      freeShippingThreshold: 0,
    });
    await expect(api.settings.saveAdmin({ ...current, baseShippingFee: -1 })).rejects.toMatchObject(
      { code: 'VALIDATION' },
    );
  });
});

describe('운영 적립금 목 API', () => {
  it('회원 잔액과 적립금 원장을 갱신하며 음수 잔액과 알 수 없는 회원은 거부합니다', async () => {
    const api = createMockApi(testConfig);
    const member = (await api.members.adminList()).find((item) => item.id === 'mem-001');
    if (!member) throw new Error('적립금 테스트 회원이 필요합니다.');
    const point = await api.points.adjustAdmin({
      memberId: member.id,
      amount: 250,
      reason: 'CS 보상',
      expiresAt: '2027-01-01',
    });
    expect(point).toMatchObject({ memberId: member.id, amount: 250, reason: 'CS 보상' });
    expect(
      (await api.members.adminList()).find((item) => item.id === member.id)?.pointBalance,
    ).toBe(member.pointBalance + 250);
    expect(await api.points.list()).toContainEqual(
      expect.objectContaining({ id: point.id, amount: 250 }),
    );
    await expect(
      api.points.adjustAdmin({
        memberId: member.id,
        amount: -999999,
        reason: '초과 차감',
        expiresAt: null,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      api.points.adjustAdmin({ memberId: 'missing', amount: 1, reason: '사유', expiresAt: null }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('공지·FAQ 운영 목 API', () => {
  it('공지와 FAQ CRUD, 비노출 상태를 같은 mock API의 공개 목록에 반영합니다', async () => {
    const api = createMockApi(testConfig);
    const notice = await api.notices.saveAdmin({
      title: '운영 공지',
      body: '공지 본문',
      isPinned: true,
      publishedAt: '2026-10-18T00:00:00.000Z',
      isVisible: true,
      sortOrder: 0,
    });
    const publicNotice = (await api.notices.list())[0];
    expect(publicNotice).toMatchObject({ id: notice.id, title: '운영 공지' });
    expect(publicNotice).not.toHaveProperty('isVisible');
    expect(publicNotice).not.toHaveProperty('sortOrder');
    await api.notices.saveAdmin({ ...notice, isVisible: false });
    expect(await api.notices.list()).not.toContainEqual(expect.objectContaining({ id: notice.id }));
    expect((await api.notices.adminList()).find((item) => item.id === notice.id)?.isVisible).toBe(
      false,
    );
    await api.notices.deleteAdmin(notice.id);
    expect(await api.notices.adminList()).not.toContainEqual(
      expect.objectContaining({ id: notice.id }),
    );
    const faq = await api.faqs.saveAdmin({
      category: '배송',
      question: '배송 기간은?',
      answer: '2~3일입니다.',
      isVisible: true,
      sortOrder: 0,
    });
    const publicFaq = (await api.faqs.list())[0];
    expect(publicFaq).toMatchObject({ id: faq.id, question: '배송 기간은?' });
    expect(publicFaq).not.toHaveProperty('isVisible');
    expect(publicFaq).not.toHaveProperty('sortOrder');
    await api.faqs.saveAdmin({ ...faq, isVisible: false });
    expect(await api.faqs.list()).not.toContainEqual(expect.objectContaining({ id: faq.id }));
    await api.faqs.deleteAdmin(faq.id);
    expect(await api.faqs.list()).not.toContainEqual(expect.objectContaining({ id: faq.id }));
  });
});

describe('1:1 문의·리뷰 공개 답변 분리', () => {
  it('1:1 문의 답변은 회원 목록에 반영하고 내부 메모·이력은 제외합니다', async () => {
    const api = createMockApi(testConfig);
    const inquiry = (await api.inquiries.adminList()).find((item) => item.id === 'inq-002');
    if (!inquiry) throw new Error('운영 문의 테스트 데이터가 필요합니다.');

    await api.inquiries.updateAdmin(inquiry.id, {
      status: 'answered',
      answer: '재고 확인 후 출고 일정을 안내드립니다.',
      adminMemo: '창고에 출고 일정을 확인함',
    });

    const buyerInquiry = (await api.inquiries.listByMember(inquiry.memberId)).find(
      (item) => item.id === inquiry.id,
    );
    expect(buyerInquiry).toMatchObject({
      status: 'answered',
      answer: '재고 확인 후 출고 일정을 안내드립니다.',
    });
    expect(buyerInquiry).not.toHaveProperty('adminMemo');
    expect(buyerInquiry).not.toHaveProperty('statusHistory');
    const adminInquiry = (await api.inquiries.adminList()).find((item) => item.id === inquiry.id);
    expect(adminInquiry?.statusHistory.length).toBeGreaterThan(inquiry.statusHistory.length);
  });

  it('리뷰 공개 답변은 웹 목록에 반영하고 내부 메모를 감추며 비노출 리뷰를 요약에서 제외합니다', async () => {
    const api = createMockApi(testConfig);
    const review = (await api.products.adminListReviews()).find(
      (item) => item.productId === 'prd-1001',
    );
    if (!review) throw new Error('상품 리뷰 테스트 데이터가 필요합니다.');

    await api.products.updateReviewAdmin(review.id, {
      adminReply: '구매해 주셔서 감사합니다.',
      adminMemo: '추가 문의가 오면 배송팀에 전달',
    });
    const publicReview = (await api.products.listReviews(review.productId)).items.find(
      (item) => item.id === review.id,
    );
    expect(publicReview?.adminReply).toBe('구매해 주셔서 감사합니다.');
    expect(publicReview).not.toHaveProperty('adminMemo');
    expect(publicReview).not.toHaveProperty('isVisible');

    const beforeHide = await api.products.getReviewSummary(review.productId);
    await api.products.updateReviewAdmin(review.id, { isVisible: false });
    expect((await api.products.listReviews(review.productId)).items).not.toContainEqual(
      expect.objectContaining({ id: review.id }),
    );
    expect((await api.products.getReviewSummary(review.productId)).totalCount).toBe(
      beforeHide.totalCount - 1,
    );
    expect(
      (await api.products.adminListReviews()).find((item) => item.id === review.id)?.adminMemo,
    ).toBe('추가 문의가 오면 배송팀에 전달');
  });
});

describe('상품 문의 운영 목 API', () => {
  it('답변과 처리 상태를 Web 상품 상세에 보여 주고 메모·이력은 감춥니다', async () => {
    const api = createMockApi(testConfig);
    const question = (await api.products.adminListQuestions()).find((item) => item.id === 'pq-001');
    if (!question) throw new Error('상품 문의 테스트 데이터가 필요합니다.');
    await api.products.updateQuestionAdmin(question.id, {
      status: 'answered',
      answer: '30켤레 혼합 주문은 영업일 기준 5일 정도 소요됩니다.',
      adminMemo: '물류팀 확인 완료',
    });
    const publicQuestion = (await api.products.listQuestions(question.productId)).find(
      (item) => item.id === question.id,
    );
    expect(publicQuestion).toMatchObject({
      status: 'answered',
      answer: '30켤레 혼합 주문은 영업일 기준 5일 정도 소요됩니다.',
    });
    expect(publicQuestion).not.toHaveProperty('adminMemo');
    expect(publicQuestion).not.toHaveProperty('statusHistory');
    expect(await api.products.listQuestions('prd-1002')).toHaveLength(0);
    expect(
      (await api.products.adminListQuestions()).find((item) => item.id === question.id)?.adminMemo,
    ).toBe('물류팀 확인 완료');
    await expect(
      api.products.updateQuestionAdmin(question.id, {
        status: 'answered',
        answer: 'x'.repeat(5001),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('회사 정보·법률 문서 운영 목 API', () => {
  it('회사 변경과 공개 정책 버전이 같은 mock API의 Web 조회 응답에 반영됩니다', async () => {
    const api = createMockApi(testConfig);
    const company = await api.company.getAdminInfo();
    await api.company.saveAdminInfo({ ...company, customerCenterPhone: '02-555-0100' });
    expect(await api.company.getInfo()).toMatchObject({ customerCenterPhone: '02-555-0100' });

    const document = {
      id: 'terms' as const,
      title: '이용약관',
      version: '2.1',
      effectiveAt: '2026-11-01',
      body: '운영 문서 본문\nHTML <script>는 텍스트로 표시합니다.',
      isPublished: true,
    };
    await api.legalDocuments.saveAdmin(document);
    await expect(api.legalDocuments.getPublished('terms')).resolves.toEqual(document);
    await api.legalDocuments.saveAdmin({ ...document, isPublished: false });
    await expect(api.legalDocuments.getPublished('terms')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
