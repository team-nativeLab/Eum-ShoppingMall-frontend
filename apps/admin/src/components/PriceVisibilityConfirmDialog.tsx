import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { Icon } from '@eum/ui/components/Icon';
import { EyeOff, Heart, Info, ShoppingCart } from 'lucide-react';
import type { Product } from '@eum/api/types';

export interface PriceVisibilityConfirmDialogProps {
  isOpen: boolean;
  selectedProducts: Pick<Product, 'id' | 'name' | 'thumbnailUrl'>[];
  persistenceTargetLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 선택한 상품의 금액 미표시 상태를 저장하기 전에 확인합니다. */
export function PriceVisibilityConfirmDialog({
  isOpen,
  selectedProducts,
  persistenceTargetLabel,
  onCancel,
  onConfirm,
}: PriceVisibilityConfirmDialogProps) {
  const selectedCount = selectedProducts.length;
  if (!isOpen || selectedCount === 0) return null;

  return (
    <Modal
      isOpen
      onClose={onCancel}
      className="max-w-480"
      title={`선택한 상품 ${selectedCount.toLocaleString('ko-KR')}개의 금액을 숨길까요?`}
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
        {selectedProducts.map((product) => (
          <div key={product.id} className="flex items-center gap-8 py-4">
            <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-6 bg-surface-2">
              {product.thumbnailUrl ? (
                <img src={product.thumbnailUrl} alt="" className="size-full object-cover" />
              ) : null}
            </div>
            <span className="truncate text-body-s">{product.name}</span>
          </div>
        ))}
      </div>
      <ul className="mt-12 flex flex-col gap-8 text-body-s text-text-2">
        <li className="flex items-start gap-8">
          <Icon icon={EyeOff} size={16} className="mt-2 shrink-0" />
          <span>사용자 화면에 가격 대신 '구매 불가'로 표시됩니다.</span>
        </li>
        <li className="flex items-start gap-8">
          <Icon icon={Heart} size={16} className="mt-2 shrink-0" />
          <span>보기·찜·장바구니 담기만 가능하고, 바로 구매는 할 수 없습니다.</span>
        </li>
        <li className="flex items-start gap-8">
          <Icon icon={ShoppingCart} size={16} className="mt-2 shrink-0" />
          <span>
            이미 장바구니에 담긴 상품은 '주문할 수 없는 상품'으로 분류되어 주문에서 제외됩니다.
          </span>
        </li>
      </ul>
      <div className="mt-12 rounded-8 bg-surface px-12 py-10 text-caption text-text-2">
        <span className="inline-flex items-start gap-8">
          <Icon icon={Info} size={16} className="mt-1 shrink-0" />
          <span>
            가격 값은 그대로 유지되며, 이 설정은 {persistenceTargetLabel}에 저장됩니다. 다시 금액을
            표시하면 바로 구매할 수 있습니다.
          </span>
        </span>
      </div>
    </Modal>
  );
}
