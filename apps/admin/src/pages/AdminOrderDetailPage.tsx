import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
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
import type { AdminOrder, Order, OrderStatus } from '@eum/api/types';
import type { AdminOrderUpdate } from '@eum/api/shop-api';

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'paymentPending', label: '결제대기' },
  { value: 'paid', label: '결제완료' },
  { value: 'preparing', label: '배송준비' },
  { value: 'shipping', label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'canceled', label: '취소·반품' },
];

function toAdminOrder(order: Order): AdminOrder {
  return {
    ...order,
    memberId: order.memberId ?? '',
    trackingCarrier: '',
    trackingNumber: '',
    adminMemo: '',
    statusHistory: [{ status: order.status, occurredAt: order.orderedAt, note: '' }],
  };
}

/** 주문 기본 정보와 읽기 전용 처리 영역을 표시합니다. */
export function AdminOrderDetailPage() {
  const { orderId } = useParams();
  const queryClient = useQueryClient();
  const [mutationMessage, setMutationMessage] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancelPreviewMessage, setCancelPreviewMessage] = useState('');
  const [cancelError, setCancelError] = useState('');
  const orderQuery = useQuery({
    queryKey: ['admin', 'orders', 'detail', orderId],
    enabled: Boolean(orderId),
    queryFn: async ({ signal }) => {
      if (!orderId) throw new Error('주문 번호가 없습니다.');
      const orders = (await getShopApi()).orders;
      return typeof orders.adminGetById === 'function'
        ? orders.adminGetById(orderId, { signal })
        : toAdminOrder(await orders.getById(orderId, { signal }));
    },
  });
  const memberQuery = useQuery({
    queryKey: ['admin', 'members', 'for-order', orderQuery.data?.memberId],
    enabled: Boolean(orderQuery.data?.memberId),
    queryFn: async ({ signal }) => {
      const memberId = orderQuery.data?.memberId;
      if (!memberId) return undefined;
      const members = await (await getShopApi()).members.adminList({ signal });
      return members.find((member) => member.id === memberId);
    },
  });
  const claimsQuery = useQuery({
    queryKey: ['admin', 'orders', 'claims', orderQuery.data?.memberId],
    enabled: Boolean(orderQuery.data?.memberId),
    queryFn: async ({ signal }) => {
      const memberId = orderQuery.data?.memberId;
      if (!memberId) return [];
      const claims = (await getShopApi()).claims;
      return typeof claims.adminList === 'function'
        ? claims.adminList({ signal })
        : claims.listByMember(memberId, { signal });
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

  const order: AdminOrder = orderQuery.data;
  const previewStatus = order.status;
  const totalQuantity = order.lines.reduce((total, line) => total + line.quantity, 0);
  const cancelRequest = claimsQuery.data?.find(
    (claim) =>
      claim.orderId === order.id && claim.type === 'cancel' && claim.status === 'requested',
  );
  const saveOrder = async (update: AdminOrderUpdate) => {
    setMutationMessage('');
    try {
      await (await getShopApi()).orders.updateAdmin(order.id, update);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders', 'detail', order.id] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
      setMutationMessage('주문 처리 내용을 목 API에 저장했습니다.');
    } catch (error) {
      setMutationMessage(
        error instanceof Error ? error.message : '주문 처리를 저장하지 못했습니다.',
      );
      throw error;
    }
  };
  const closeCancelConfirm = () => {
    setIsCancelConfirmOpen(false);
    setCancelReason('');
    setCancelError('');
  };

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
        결제 취소·환불 및 택배사 전송은 이 화면에서 지원하지 않습니다.
      </AdminNotice>
      {mutationMessage ? (
        <p role="status" className="mb-12 text-body-s text-text-2">
          {mutationMessage}
        </p>
      ) : null}
      {cancelRequest ? (
        <AdminPanel
          title="취소 요청"
          className="mb-16"
          action={
            <span className="rounded-6 bg-warning-tint px-8 py-4 text-caption text-warning">
              요청 접수
            </span>
          }
        >
          <dl className="grid grid-cols-[140px_1fr] gap-10 p-20 text-body-s">
            <dt className="text-text-3">요청 사유</dt>
            <dd>{cancelRequest.reason}</dd>
            <dt className="text-text-3">환불 예정 금액</dt>
            <dd>{formatAdminCurrency(order.paymentTotal)}</dd>
            <dt className="text-text-3">환불 수단</dt>
            <dd>원 결제 수단 (세부 정보 미제공)</dd>
          </dl>
          <div className="border-t border-line px-20 py-12">
            <Button
              size="s"
              variant="secondary"
              onClick={() => {
                setCancelError('');
                setIsCancelConfirmOpen(true);
              }}
            >
              취소 요청 처리
            </Button>
          </div>
        </AdminPanel>
      ) : null}
      {claimsQuery.isError ? (
        <AdminNotice className="mb-16" tone="warning">
          취소 요청 정보를 불러오지 못했습니다. 일반 주문 취소 상태와 취소 요청을 구분할 수
          없습니다.{' '}
          <button type="button" className="underline" onClick={() => void claimsQuery.refetch()}>
            다시 시도
          </button>
        </AdminNotice>
      ) : null}
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
                          {line.optionLabel ? (
                            <span className="mt-2 block text-caption text-text-3">
                              옵션 {line.optionLabel}
                              {line.skuId ? ` · SKU ${line.skuId}` : ''}
                            </span>
                          ) : null}
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
            initialCarrier={order.trackingCarrier ?? ''}
            initialTrackingNumber={order.trackingNumber ?? ''}
            initialMemo={order.adminMemo}
            onSave={saveOrder}
          />
        </aside>
      </div>
      <Modal
        isOpen={isCancelConfirmOpen}
        onClose={closeCancelConfirm}
        title="주문을 취소할까요?"
        description="취소하면 결제 금액이 환불되고 고객에게 취소 안내가 발송됩니다. 되돌릴 수 없습니다."
        actions={
          <>
            <Button variant="secondary" onClick={closeCancelConfirm}>
              취소
            </Button>
            <Button
              disabled={!cancelReason}
              onClick={async () => {
                try {
                  if (!cancelRequest)
                    throw new Error(
                      '처리할 취소 요청을 찾을 수 없습니다. 새로고침 후 다시 확인해 주세요.',
                    );
                  const api = await getShopApi();
                  await api.claims.completeOrderCancellation(
                    order.id,
                    cancelRequest.id,
                    cancelReason,
                  );
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: ['admin', 'orders', 'detail', order.id],
                    }),
                    queryClient.invalidateQueries({ queryKey: ['admin', 'orders', 'list'] }),
                    queryClient.invalidateQueries({
                      queryKey: ['admin', 'orders', 'claims', order.memberId],
                    }),
                    queryClient.invalidateQueries({ queryKey: ['orders'] }),
                    queryClient.invalidateQueries({ queryKey: ['claims'] }),
                  ]);
                  setCancelPreviewMessage(
                    '취소 처리 상태를 목 API에 저장했습니다. 환불은 처리되지 않았습니다.',
                  );
                  closeCancelConfirm();
                } catch (error) {
                  setCancelError(
                    error instanceof Error
                      ? error.message
                      : '취소 처리 저장에 실패했습니다. 다시 시도해 주세요.',
                  );
                }
              }}
            >
              취소 처리 저장
            </Button>
          </>
        }
      >
        <div className="mt-16 grid gap-12 text-body-s">
          <AdminNotice tone="warning">
            요청을 확인하면 실제 처리에서는 주문 취소와 결제 취소·환불이 진행될 수 있습니다. 이
            데모는 해당 작업을 수행하지 않습니다.
          </AdminNotice>
          {cancelError ? (
            <p role="alert" className="mt-12 text-body-s text-danger">
              {cancelError}
            </p>
          ) : null}
          <dl className="grid grid-cols-[1fr_auto] gap-x-12 gap-y-10 rounded-8 bg-surface px-12 py-12 text-body-s">
            <dt className="text-text-3">환불 금액</dt>
            <dd className="text-right font-medium">{formatAdminCurrency(order.paymentTotal)}</dd>
            <dt className="text-text-3">환불 수단</dt>
            <dd className="text-right">결제 수단과 동일</dd>
          </dl>
          <label className="grid gap-6">
            취소 사유 <span className="text-danger">*</span>
            <select
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              className="h-40 rounded-8 border border-line-control bg-bg px-12"
            >
              <option value="">사유를 선택해 주세요</option>
              <option value="요청 내용 확인">요청 내용 확인</option>
              <option value="고객 연락 확인">고객 연락 확인</option>
            </select>
          </label>
        </div>
      </Modal>
      {cancelPreviewMessage ? (
        <p role="status" className="mt-12 text-caption text-warning">
          {cancelPreviewMessage}
        </p>
      ) : null}
    </section>
  );
}

function OrderProcessingPanel({
  initialStatus,
  initialCarrier,
  initialTrackingNumber,
  initialMemo,
  onSave,
}: {
  initialStatus: OrderStatus;
  initialCarrier: string;
  initialTrackingNumber: string;
  initialMemo: string;
  onSave: (update: AdminOrderUpdate) => Promise<void>;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [carrier, setCarrier] = useState(initialCarrier);
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);
  const [memo, setMemo] = useState(initialMemo);
  const [message, setMessage] = useState('');

  const save = async (nextStatus = status) => {
    try {
      await onSave({
        status: nextStatus,
        trackingCarrier: carrier,
        trackingNumber,
        adminMemo: memo,
      });
      setStatus(nextStatus);
      setMessage('상태·송장·메모를 목 API에 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
    }
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
          <Button variant="secondary" size="s" onClick={() => void save('canceled')}>
            취소 상태 저장
          </Button>
          <Button size="s" onClick={() => void save()}>
            처리 내용 저장
          </Button>
        </div>
      </div>
    </AdminPanel>
  );
}
