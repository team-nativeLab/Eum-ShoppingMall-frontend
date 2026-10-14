import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { Icon } from '@eum/ui/components/Icon';
import { EyeOff, Heart, Info, ShoppingCart } from 'lucide-react';
import type { Product } from '@eum/api/types';

export interface PriceVisibilityConfirmDialogProps {
  isOpen: boolean;
  selectedProducts: Pick<Product, 'id' | 'name' | 'thumbnailUrl'>[];
  onCancel: () => void;
  onConfirm: () => void;
}

/** 가격을 숨기기 전 영향 범위를 설명하는 독립 확인 모달입니다. 현재 목록에서 호출하지 않습니다. */
export function PriceVisibilityConfirmDialog({
  isOpen,
  selectedProducts,
  onCancel,
  onConfirm,
}: PriceVisibilityConfirmDialogProps) {
  const selectedCount = selectedProducts.length;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={'선택한 상품 ' + selectedCount.toLocaleString('ko-KR') + '개의 금액을 숨길까요?'}
      actions={
        <>
          <Button variant="secondary" size="s" onClick={onCancel}>
            취소
          </Button>
          <Button size="s" onClick={onConfirm}>
            금액 숨기기
          </Button>
        </>
      }
    >
      <div className="mt-16 max-h-128 overflow-y-auto rounded-8 bg-surface p-12">
        {selectedProducts.length ? (
          selectedProducts.map((product) => (
            <div key={product.id} className="flex items-center gap-8 py-4">
              <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-6 bg-surface-2">
                {product.thumbnailUrl ? (
                  <img src={product.thumbnailUrl} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <span className="truncate text-body-s">{product.name}</span>
            </div>
          ))
        ) : (
          <p className="text-body-s text-text-3">전환할 상품이 선택되지 않았습니다.</p>
        )}
      </div>
      <ul className="mt-12 flex flex-col gap-8 text-body-s text-text-2">
        <li className="flex items-start gap-8">
          <Icon icon={EyeOff} size={16} className="mt-2 shrink-0" />
          <span>구매자 화면에서 가격 대신 ‘구매 불가’로 표시됩니다.</span>
        </li>
        <li className="flex items-start gap-8">
          <Icon icon={Heart} size={16} className="mt-2 shrink-0" />
          <span>상품 보기와 찜 기능은 그대로 사용할 수 있습니다.</span>
        </li>
        <li className="flex items-start gap-8">
          <Icon icon={ShoppingCart} size={16} className="mt-2 shrink-0" />
          <span>장바구니에는 담을 수 있지만 주문할 수 없습니다.</span>
        </li>
      </ul>
      <div className="mt-12 rounded-8 bg-surface px-12 py-10 text-caption text-text-2">
        <span className="inline-flex items-start gap-8">
          <Icon icon={Info} size={16} className="mt-1 shrink-0" />
          상품의 실제 가격은 유지됩니다. 이 모달은 확인 UI만 제공합니다.
        </span>
      </div>
    </Modal>
  );
}
