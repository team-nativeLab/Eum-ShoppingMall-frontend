import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { Icon } from '@eum/ui/components/Icon';
import { EyeOff, Info } from 'lucide-react';
import type { Product } from '@eum/api/types';

export interface PriceVisibilityConfirmDialogProps {
  isOpen: boolean;
  selectedProducts: Pick<Product, 'id' | 'name' | 'thumbnailUrl'>[];
  onCancel: () => void;
  onConfirm: () => void;
}

/** 선택한 상품의 금액 미표시 상태를 관리자 화면에서 미리보기 전에 확인합니다. */
export function PriceVisibilityConfirmDialog({
  isOpen,
  selectedProducts,
  onCancel,
  onConfirm,
}: PriceVisibilityConfirmDialogProps) {
  const selectedCount = selectedProducts.length;
  if (!isOpen || selectedCount === 0) return null;

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={`선택한 상품 ${selectedCount.toLocaleString('ko-KR')}개의 금액을 미표시 상태로 미리 볼까요?`}
      actions={
        <>
          <Button variant="secondary" size="s" onClick={onCancel}>
            취소
          </Button>
          <Button size="s" onClick={onConfirm}>
            금액 미표시 미리보기
          </Button>
        </>
      }
    >
      <div className="mt-16 max-h-128 overflow-y-auto rounded-8 bg-surface p-12">
        {selectedProducts.map((product) => (
          <div key={product.id} className="flex items-center gap-8 py-4">
            <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-6 bg-surface-2">
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
          <span>
            실제 설정에 저장하면 구매자 화면에 ‘구매 불가’ 안내가 표시되고 바로 구매가 제한됩니다.
            장바구니에서는 주문할 수 없는 상품으로 분류됩니다.
          </span>
        </li>
      </ul>
      <div className="mt-12 rounded-8 bg-surface px-12 py-10 text-caption text-text-2">
        <span className="inline-flex items-start gap-8">
          <Icon icon={Info} size={16} className="mt-1 shrink-0" />
          <span>
            이번 동작은 현재 관리자 세션에서만 금액 미표시 상태를 미리 봅니다. 실제 설정은 저장되지
            않고 구매자 화면·장바구니·주문에 반영되지 않으며, 새로고침 또는 로그아웃하면
            초기화됩니다.
          </span>
        </span>
      </div>
    </Modal>
  );
}
