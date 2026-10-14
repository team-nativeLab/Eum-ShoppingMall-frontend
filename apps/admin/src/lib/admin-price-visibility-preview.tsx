import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '@eum/api/types';

type PriceVisibilityProduct = Pick<Product, 'id' | 'priceVisible'>;

export interface PriceVisibilityPreviewSnapshot {
  product: PriceVisibilityProduct;
  isVisible: boolean;
}

interface AdminPriceVisibilityPreviewValue {
  previewValues: ReadonlyMap<string, boolean>;
  hasPreviewChanges: boolean;
  getPreviewValue: (product: PriceVisibilityProduct) => boolean;
  capturePreviewValues: (
    products: readonly PriceVisibilityProduct[],
  ) => PriceVisibilityPreviewSnapshot[];
  restorePreviewValues: (snapshots: readonly PriceVisibilityPreviewSnapshot[]) => void;
  setPreviewValue: (products: readonly PriceVisibilityProduct[], isVisible: boolean) => void;
}

const AdminPriceVisibilityPreviewContext = createContext<AdminPriceVisibilityPreviewValue | null>(
  null,
);

/** 관리자 라우트 안에서만 유지되는 상품 금액 표시 미리보기 상태입니다. */
export function AdminPriceVisibilityPreviewProvider({ children }: { children: ReactNode }) {
  const [previewValues, setPreviewValues] = useState<ReadonlyMap<string, boolean>>(() => new Map());

  const getPreviewValue = useCallback(
    (product: PriceVisibilityProduct) => previewValues.get(product.id) ?? product.priceVisible,
    [previewValues],
  );

  const setPreviewValue = useCallback(
    (products: readonly PriceVisibilityProduct[], isVisible: boolean) => {
      if (products.length === 0) return;
      setPreviewValues((previousValues) => {
        let nextValues: Map<string, boolean> | null = null;

        for (const product of products) {
          const currentValues = nextValues ?? previousValues;
          const hasOverride = currentValues.has(product.id);
          const nextOverride = isVisible === product.priceVisible ? undefined : isVisible;
          const isUnchanged =
            nextOverride === undefined
              ? !hasOverride
              : currentValues.get(product.id) === nextOverride;
          if (isUnchanged) continue;

          nextValues ??= new Map(previousValues);
          if (nextOverride === undefined) {
            nextValues.delete(product.id);
          } else {
            nextValues.set(product.id, nextOverride);
          }
        }

        return nextValues ?? previousValues;
      });
    },
    [],
  );

  const capturePreviewValues = useCallback(
    (products: readonly PriceVisibilityProduct[]) =>
      products.map((product) => ({ product, isVisible: getPreviewValue(product) })),
    [getPreviewValue],
  );

  const restorePreviewValues = useCallback(
    (snapshots: readonly PriceVisibilityPreviewSnapshot[]) => {
      setPreviewValues((previousValues) => {
        let nextValues: Map<string, boolean> | null = null;
        for (const { product, isVisible } of snapshots) {
          const currentValues = nextValues ?? previousValues;
          const hasOverride = currentValues.has(product.id);
          const nextOverride = isVisible === product.priceVisible ? undefined : isVisible;
          const isUnchanged =
            nextOverride === undefined
              ? !hasOverride
              : currentValues.get(product.id) === nextOverride;
          if (isUnchanged) continue;

          nextValues ??= new Map(previousValues);
          if (nextOverride === undefined) nextValues.delete(product.id);
          else nextValues.set(product.id, nextOverride);
        }
        return nextValues ?? previousValues;
      });
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      previewValues,
      hasPreviewChanges: previewValues.size > 0,
      getPreviewValue,
      capturePreviewValues,
      restorePreviewValues,
      setPreviewValue,
    }),
    [capturePreviewValues, getPreviewValue, previewValues, restorePreviewValues, setPreviewValue],
  );

  return (
    <AdminPriceVisibilityPreviewContext.Provider value={contextValue}>
      {children}
    </AdminPriceVisibilityPreviewContext.Provider>
  );
}

/** 금액 표시 미리보기를 사용하며 상태 저장소 밖의 실행을 막습니다. */
export function useAdminPriceVisibilityPreview() {
  const previewContext = useContext(AdminPriceVisibilityPreviewContext);
  if (!previewContext) {
    throw new Error(
      'useAdminPriceVisibilityPreview must be used within AdminPriceVisibilityPreviewProvider',
    );
  }
  return previewContext;
}
