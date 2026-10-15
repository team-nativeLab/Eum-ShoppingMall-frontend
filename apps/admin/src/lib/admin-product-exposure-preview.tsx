import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '@eum/api/types';

type ExposureProduct = Pick<Product, 'id'>;

export interface ProductExposureSnapshot {
  product: ExposureProduct;
  isExposed: boolean;
}

interface AdminProductExposurePreviewValue {
  previewValues: ReadonlyMap<string, boolean>;
  getPreviewValue: (product: ExposureProduct) => boolean;
  capturePreviewValues: (products: readonly ExposureProduct[]) => ProductExposureSnapshot[];
  restorePreviewValues: (snapshots: readonly ProductExposureSnapshot[]) => void;
  setPreviewValue: (products: readonly ExposureProduct[], isExposed: boolean) => void;
}

const AdminProductExposurePreviewContext = createContext<AdminProductExposurePreviewValue | null>(
  null,
);

/** 상품 노출 여부를 금액 표시와 분리해 관리자 라우트에서만 미리봅니다. */
export function AdminProductExposurePreviewProvider({ children }: { children: ReactNode }) {
  const [previewValues, setPreviewValues] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const getPreviewValue = useCallback(
    (product: ExposureProduct) => {
      return previewValues.get(product.id) ?? true;
    },
    [previewValues],
  );

  const setPreviewValue = useCallback(
    (products: readonly ExposureProduct[], isExposed: boolean) => {
      if (products.length === 0) return;
      setPreviewValues((previousValues) => {
        const nextValues = new Map(previousValues);
        for (const product of products) {
          if (isExposed) nextValues.delete(product.id);
          else nextValues.set(product.id, false);
        }
        return nextValues;
      });
    },
    [],
  );

  const capturePreviewValues = useCallback(
    (products: readonly ExposureProduct[]) =>
      products.map((product) => ({ product, isExposed: getPreviewValue(product) })),
    [getPreviewValue],
  );

  const restorePreviewValues = useCallback((snapshots: readonly ProductExposureSnapshot[]) => {
    setPreviewValues((previousValues) => {
      const nextValues = new Map(previousValues);
      for (const { product, isExposed } of snapshots) {
        if (isExposed) nextValues.delete(product.id);
        else nextValues.set(product.id, false);
      }
      return nextValues;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      previewValues,
      getPreviewValue,
      capturePreviewValues,
      restorePreviewValues,
      setPreviewValue,
    }),
    [capturePreviewValues, getPreviewValue, previewValues, restorePreviewValues, setPreviewValue],
  );

  return (
    <AdminProductExposurePreviewContext.Provider value={contextValue}>
      {children}
    </AdminProductExposurePreviewContext.Provider>
  );
}

export function useAdminProductExposurePreview() {
  const value = useContext(AdminProductExposurePreviewContext);
  if (!value) {
    throw new Error(
      'useAdminProductExposurePreview must be used within AdminProductExposurePreviewProvider',
    );
  }
  return value;
}
