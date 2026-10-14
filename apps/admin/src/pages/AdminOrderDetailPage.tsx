import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Button } from '@eum/ui/components/Button';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
  formatAdminCurrency,
  formatAdminDateTime,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { OrderStatus } from '@eum/api/types';

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'paymentPending', label: '결제대기' },
  { value: 'paid', label: '결제완료' },
  { value: 'preparing', label: '배송준비' },
  { value: 'shipping', label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'canceled', label: '취소·반품' },
];

/** 주문 기본 정보와 읽기 전용 처리 영역을 표시합니다. */
export function AdminOrderDetailPage() {
  const { orderId } = useParams();
  const [previewStatusByOrder, setPreviewStatusByOrder] = useState<
    Partial<Record<string, OrderStatus>>
  >({});
  const orderQuery = useQuery({
    queryKey: ['admin', 'orders', 'detail', orderId],
    enabled: Boolean(orderId),
    queryFn: async ({ signal }) => {
      if (!orderId) throw new Error('주문 번호가 없습니다.');
      return (await getShopApi()).orders.getById(orderId, { signal });
    },
  });
  const memberQuery = useQuery({
    queryKey: ['admin', 'members', 'for-order', orderQuery.data?.memberId],
    enabled: Boolean(orderQuery.data?.memberId),
    queryFn: async ({ signal }) => {
      const memberId = orderQuery.data?.memberId;
      if (!memberId) return undefined;
      const members = await (await getShopApi()).members.list({ signal });
      return members.find((member) => member.id === memberId);
    },
  });

  if (orderQuery.isPending) return <AdminLoading label="주문 상세 정보를 불러오고 있습니다." />;
  if (orderQuery.isError) {
    return (
      <AdminError
        title="주문 정보를 불러오지 못했습니다"
        description="주문 번호를 확인한 뒤 다시 시도해 주세요."
        onRetry={() => void orderQuery.refetch()}
      />
    );
  }

  const order = orderQuery.data;
  const previewStatus = previewStatusByOrder[order.id] ?? order.status;
  const totalQuantity = order.lines.reduce((total, line) => total + line.quantity, 0);

  return (
    <section aria-label="주문 상세">
      <AdminPageHeader
        title={`주문 ${order.orderNumber}`}
        description={`주문일시 ${formatAdminDateTime(order.orderedAt)}`}
        action={
          <Link
            to="/orders"
            className="inline-flex h-36 items-center rounded-8 border border-line-strong px-12 text-body-s focus-ring hover:bg-surface"
          >
            주문 목록
          </Link>
        }
      />
      <div className="mb-16 flex items-center gap-8">
        <span className="text-body-s text-text-2">현재 주문 상태</span>
        <AdminStatusBadge status={previewStatus} kind="order" />
      </div>
      <AdminNotice className="mb-16" tone="warning">
        주문 상태·배송 정보·메모는 이 화면에서만 미리보기로 반영됩니다. 서버에는 저장되거나 주문
        취소가 처리되지 않습니다.
      </AdminNotice>
      {memberQuery.isError ? (
        <AdminNotice tone="error" className="mb-16">
          주문자 회원 정보를 불러오지 못했습니다.{' '}
          <button
            type="button"
            className="ml-4 underline"
            onClick={() => void memberQuery.refetch()}
          >
            다시 시도
          </button>
        </AdminNotice>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1.85fr)_minmax(300px,1fr)] items-start gap-16">
        <div className="grid gap-16">
          <AdminPanel title={`주문 상품 (${totalQuantity})`} bodyClassName="overflow-hidden">
            {order.lines.length === 0 ? (
              <AdminEmpty title="주문 상품 정보가 없습니다" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-500 border-collapse text-left text-body-s">
                  <thead className="bg-surface text-caption text-text-2">
                    <tr>
                      <th scope="col" className="px-20 py-10 font-normal">
                        상품
                      </th>
                      <th scope="col" className="px-12 py-10 text-right font-normal">
                        수량
                      </th>
                      <th scope="col" className="px-20 py-10 text-right font-normal">
                        금액
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line, index) => (
                      <tr key={`${line.productId}-${index}`} className="border-t border-line">
                        <td className="px-20 py-12">
                          <span className="font-medium">{line.productName}</span>
                          <span className="mt-2 block text-caption text-text-3">
                            상품 코드 {line.productId}
                          </span>
                        </td>
                        <td className="px-12 py-12 text-right">
                          {line.quantity.toLocaleString('ko-KR')}
                        </td>
                        <td className="px-20 py-12 text-right whitespace-nowrap">
                          {formatAdminCurrency(line.unitPrice * line.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>

          <AdminPanel title="배송지·주문자">
            <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-16 gap-y-12 px-20 py-16 text-body-s">
              <dt className="text-text-3">주문자</dt>
              <dd>
                {memberQuery.data
                  ? `${memberQuery.data.name} · ${memberQuery.data.phone}`
                  : memberQuery.isPending
                    ? '회원 정보 조회 중'
                    : memberQuery.isError
                      ? '조회 실패'
                      : '회원 정보 미제공'}
              </dd>
              <dt className="text-text-3">이메일</dt>
              <dd className="break-all">
                {memberQuery.data?.email ??
                  (memberQuery.isPending
                    ? '회원 정보 조회 중'
                    : memberQuery.isError
                      ? '조회 실패'
                      : '회원 정보 미제공')}
              </dd>
              <dt className="text-text-3">받는 분</dt>
              <dd>
                {order.shippingAddress.recipientName} · {order.shippingAddress.phone}
              </dd>
              <dt className="text-text-3">주소</dt>
              <dd>
                ({order.shippingAddress.postalCode}) {order.shippingAddress.address1}
                {order.shippingAddress.address2 ? ` ${order.shippingAddress.address2}` : ''}
              </dd>
            </dl>
          </AdminPanel>

          <AdminPanel title="변경 이력">
            <AdminEmpty
              title="처리 이력 데이터가 없습니다"
              description="주문 상태 변경 이력은 현재 API에서 제공하지 않습니다."
              className="min-h-120"
            />
          </AdminPanel>
        </div>

        <aside className="grid gap-16">
          <AdminPanel title="결제 정보">
            <dl className="grid grid-cols-[1fr_auto] gap-x-12 gap-y-10 px-20 py-16 text-body-s">
              <dt className="text-text-3">상품금액</dt>
              <dd className="text-right">{formatAdminCurrency(order.productTotal)}</dd>
              <dt className="text-text-3">배송비</dt>
              <dd className="text-right">{formatAdminCurrency(order.shippingFee)}</dd>
              <dt className="text-text-3">할인</dt>
              <dd className="text-right">−{formatAdminCurrency(order.discountTotal)}</dd>
              <dt className="text-text-3">사용 포인트</dt>
              <dd className="text-right">−{formatAdminCurrency(order.pointUsed)}</dd>
              <dt className="mt-4 border-t border-line pt-12 font-semibold">결제금액</dt>
              <dd className="mt-4 border-t border-line pt-12 text-right font-semibold">
                {formatAdminCurrency(order.paymentTotal)}
              </dd>
              <dt className="mt-4 text-text-3">결제수단</dt>
              <dd className="mt-4 text-right text-text-3">미제공</dd>
            </dl>
          </AdminPanel>

          <OrderProcessingPanel
            key={order.id}
            initialStatus={previewStatus}
            onPreviewStatus={(status) =>
              setPreviewStatusByOrder((previous) => ({ ...previous, [order.id]: status }))
            }
          />
        </aside>
      </div>
    </section>
  );
}

function OrderProcessingPanel({
  initialStatus,
  onPreviewStatus,
}: {
  initialStatus: OrderStatus;
  onPreviewStatus: (status: OrderStatus) => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [message, setMessage] = useState('');

  const applyPreview = (nextStatus = status) => {
    setStatus(nextStatus);
    onPreviewStatus(nextStatus);
    setMessage('입력한 값과 상태가 화면에만 임시 반영되었습니다. 서버에는 저장되지 않았습니다.');
  };

  return (
    <AdminPanel title="처리">
      <div className="grid gap-12 px-20 py-16">
        <label className="grid gap-6 text-label-s">
          주문 상태
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as OrderStatus)}
            className="h-40 w-full rounded-8 border border-line-control bg-bg px-12 text-body-s"
          >
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-6 text-label-s">
          택배사
          <input
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
            placeholder="택배사"
            className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
          />
        </label>
        <label className="grid gap-6 text-label-s">
          송장번호
          <input
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            placeholder="송장번호"
            className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
          />
        </label>
        <label className="grid gap-6 text-label-s">
          관리자 메모
          <textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="메모를 입력해 주세요"
            rows={3}
            className="resize-y rounded-8 border border-line-control bg-bg px-12 py-10 text-body-s"
          />
        </label>
        {message ? (
          <p role="status" className="text-caption text-warning">
            {message}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-8">
          <Button variant="secondary" size="s" onClick={() => applyPreview('canceled')}>
            취소 상태 미리보기
          </Button>
          <Button size="s" onClick={() => applyPreview()}>
            화면에 임시 반영
          </Button>
        </div>
      </div>
    </AdminPanel>
  );
}
