export interface AdminQuoteDraft {
  amount: string;
  expiresAt: string;
  notice: string;
  attachments: File[];
}

/** 브라우저 현지 달력 날짜(한국어 Admin 화면은 Asia/Seoul 환경 사용)를 ISO 날짜 키로 만듭니다. */
export function getBrowserLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 관리자 목 쿠폰 코드는 브라우저 암호학적 난수로 생성합니다. */
export function generateAdminCouponCode(cryptoProvider: Crypto = globalThis.crypto): string {
  if (!cryptoProvider?.getRandomValues) {
    throw new Error('안전한 쿠폰 코드 생성기를 사용할 수 없습니다.');
  }
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(12));
  return `EUM${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** 코드 충돌 응답에 한해 새 코드를 생성해 제한 횟수만 재시도합니다. */
export async function saveWithGeneratedCouponCode<TResult>(
  save: (code: string) => Promise<TResult>,
  createCode: () => string = generateAdminCouponCode,
): Promise<TResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await save(createCode());
    } catch (error) {
      const apiError = error as { code?: unknown; message?: unknown };
      const isCodeCollision =
        apiError.code === 'VALIDATION' &&
        typeof apiError.message === 'string' &&
        apiError.message.includes('이미 사용 중인 쿠폰 코드');
      if (!isCodeCollision || attempt === 2) throw error;
    }
  }
  throw new Error('쿠폰 코드를 생성하지 못했습니다.');
}

export interface AdminCouponDraft {
  name: string;
  benefitType: 'rate' | 'amount';
  benefitValue: string;
  maxDiscountAmount: string;
  minimumOrderAmount: string;
  startsAt: string;
  endsAt: string;
  notice: string;
  issueMethod?: 'automatic' | 'download' | 'code';
  target?: 'all' | 'business' | 'personal';
  productScope?: 'all' | 'category' | 'products';
  issueLimit?: string;
  allowStacking?: boolean;
  validityMode?: 'period' | 'issueDays';
  validityDays?: string;
  issueLimitEnabled?: boolean;
}

export interface AdminSettingsDraft {
  [field: string]: string;
}

export function validateAdminSettingsDraft(draft: AdminSettingsDraft): string[] {
  const errors: string[] = [];
  for (const [field, value] of Object.entries(draft)) {
    const amount = Number(value);
    if (!value.trim() || !Number.isFinite(amount) || amount < 0) {
      errors.push(`${field}: 0 이상 숫자로 입력해 주세요.`);
      continue;
    }
    if (field.toLocaleLowerCase('ko-KR').includes('rate') && amount > 100) {
      errors.push(`${field}: 할인율은 100% 이하여야 합니다.`);
    }
  }
  return errors;
}

export function validateAdminQuoteDraft(draft: AdminQuoteDraft, today: string): string[] {
  const errors: string[] = [];
  const amount = Number(draft.amount);
  if (!draft.amount.trim() || !Number.isFinite(amount) || amount < 1 || amount > 1_000_000_000) {
    errors.push('견적 금액은 1원 이상 10억원 이하로 입력해 주세요.');
  }
  if (!draft.expiresAt || draft.expiresAt < today) {
    errors.push('유효기간은 오늘 이후 날짜로 선택해 주세요.');
  }
  if (!draft.notice.trim()) errors.push('고객 안내 내용을 입력해 주세요.');
  if (draft.notice.length > 1000) errors.push('안내 내용은 1,000자 이내로 입력해 주세요.');
  if (draft.attachments.length === 0) errors.push('견적서 파일을 선택해 주세요.');
  if (draft.attachments.length > 1) errors.push('견적서 PDF 파일은 1개만 첨부할 수 있습니다.');
  if (
    draft.attachments.some(
      (file) =>
        file.type !== 'application/pdf' || !file.name.toLocaleLowerCase('ko-KR').endsWith('.pdf'),
    )
  ) {
    errors.push('PDF 형식 파일 1개만 첨부할 수 있습니다.');
  }
  if (draft.attachments.some((file) => file.size > 20 * 1024 * 1024)) {
    errors.push('파일당 20MB 이하로 첨부해 주세요.');
  }
  return errors;
}

export function validateAdminCouponDraft(
  draft: AdminCouponDraft,
  today = getBrowserLocalDateKey(),
): string[] {
  const errors: string[] = [];
  const benefitValue = Number(draft.benefitValue);
  const maxDiscountAmount = Number(draft.maxDiscountAmount);
  const minimumOrderAmount = Number(draft.minimumOrderAmount);
  if (!draft.name.trim()) errors.push('쿠폰명을 입력해 주세요.');
  if (
    !draft.benefitValue.trim() ||
    !Number.isFinite(benefitValue) ||
    benefitValue <= 0 ||
    (draft.benefitType === 'rate' && benefitValue > 100)
  ) {
    errors.push(
      draft.benefitType === 'rate'
        ? '할인율은 0보다 크고 100% 이하여야 합니다.'
        : '할인 금액은 0원보다 커야 합니다.',
    );
  }
  if (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount < 0) {
    errors.push('최대 할인 금액은 0원 이상으로 입력해 주세요.');
  }
  if (!Number.isFinite(minimumOrderAmount) || minimumOrderAmount < 0) {
    errors.push('최소 주문 금액은 0원 이상으로 입력해 주세요.');
  }
  if (draft.validityMode === 'issueDays') {
    if (
      !draft.validityDays?.trim() ||
      !Number.isInteger(Number(draft.validityDays)) ||
      Number(draft.validityDays) < 1
    ) {
      errors.push('발급 후 사용 기간은 1일 이상으로 입력해 주세요.');
    }
  } else if (!draft.startsAt || !draft.endsAt || draft.endsAt < draft.startsAt) {
    errors.push('종료일은 시작일 이후 날짜로 선택해 주세요.');
  } else if (draft.endsAt < today) {
    errors.push('종료일은 오늘 또는 이후 날짜로 선택해 주세요.');
  }
  if (draft.notice.length > 1000) errors.push('쿠폰 안내는 1,000자 이내로 입력해 주세요.');
  if (
    draft.issueLimitEnabled &&
    (!draft.issueLimit?.trim() ||
      !Number.isInteger(Number(draft.issueLimit)) ||
      Number(draft.issueLimit) < 1)
  ) {
    errors.push('발급 수량 제한은 1개 이상 정수로 입력해 주세요.');
  }
  return errors;
}

export interface AdminTrackingRow {
  orderId: string;
  carrier: string;
  trackingNumber: string;
}

export interface AdminTrackingValidation {
  validRows: AdminTrackingRow[];
  errors: string[];
}

export const ADMIN_TRACKING_MAX_CHARACTERS = 10_000;
export const ADMIN_TRACKING_MAX_ROWS = 100;
export const ADMIN_TRACKING_INPUT_LIMIT_ERROR =
  '입력 내용이 너무 깁니다. 100행 이하로 줄여 다시 입력해 주세요.';

/** 송장 입력은 선택 주문 범위에서만 검증하며 파일/서버 반영을 수행하지 않습니다. */
export function validateAdminTrackingRows(
  text: string,
  selectedOrderIds: readonly string[],
): AdminTrackingValidation {
  if (text.length > ADMIN_TRACKING_MAX_CHARACTERS) {
    return { validRows: [], errors: [ADMIN_TRACKING_INPUT_LIMIT_ERROR] };
  }
  let rowCount = text ? 1 : 0;
  for (const character of text) {
    if (character === '\n') rowCount += 1;
  }
  if (text.endsWith('\n')) rowCount -= 1;
  if (rowCount > ADMIN_TRACKING_MAX_ROWS) {
    return { validRows: [], errors: [ADMIN_TRACKING_INPUT_LIMIT_ERROR] };
  }
  const lines = text.split(/\r?\n/);
  const errors: string[] = [];
  const validRows: AdminTrackingRow[] = [];
  const seenOrderIds = new Set<string>();
  const selected = new Set(selectedOrderIds);
  lines.forEach((line, index) => {
    if (!line.trim()) {
      if (index < lines.length - 1) errors.push(`${index + 1}행: 입력값이 비어 있습니다.`);
      return;
    }
    const [orderId = '', carrier = '', trackingNumber = '', ...extra] = line
      .split(',')
      .map((value) => value.trim());
    if (!orderId || !carrier || !trackingNumber || extra.length) {
      errors.push(`${index + 1}행: 주문 ID, 택배사, 송장번호를 쉼표로 구분해 입력해 주세요.`);
      return;
    }
    if (!selected.has(orderId)) {
      errors.push(`${index + 1}행: 선택된 주문이 아닙니다.`);
      return;
    }
    if (seenOrderIds.has(orderId)) {
      errors.push(`${index + 1}행: 같은 주문이 중복되었습니다.`);
      return;
    }
    seenOrderIds.add(orderId);
    validRows.push({ orderId, carrier, trackingNumber });
  });
  if (validRows.length < selectedOrderIds.length && validRows.length > 0) {
    errors.push('일부 주문만 유효합니다. 오류 행을 확인해 주세요.');
  }
  return { validRows, errors };
}
