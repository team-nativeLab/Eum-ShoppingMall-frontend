import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface AdminBrandPreview {
  id: string;
  name: string;
  englishName: string;
  mainField: string;
  linkedProductCount: number;
  isExposed: boolean;
  createdAt: string;
  shortIntroduction: string;
  storyTitle: string;
  storyBody: string;
  originCountry: string;
  certification: string;
  hasLogo: boolean;
  hasCover: boolean;
}

export type AdminBrandDraft = Omit<AdminBrandPreview, 'id' | 'createdAt' | 'linkedProductCount'> & {
  id?: string;
};

export interface AdminBrandMediaPreview {
  logoFile: File | null;
  coverFile: File | null;
  logoUrl: string | null;
  coverUrl: string | null;
}

export interface AdminBrandMediaFiles {
  logoFile: File | null;
  coverFile: File | null;
}

interface AdminBrandPreviewValue {
  brands: readonly AdminBrandPreview[];
  monthlyBrandId: string | null;
  getBrandMedia: (brandId: string) => AdminBrandMediaPreview | undefined;
  saveBrand: (draft: AdminBrandDraft, files: AdminBrandMediaFiles) => string;
  setBrandExposure: (id: string, isExposed: boolean) => void;
  setMonthlyBrand: (id: string | null) => void;
  deleteBrand: (id: string) => void;
}

const INITIAL_BRANDS: AdminBrandPreview[] = [
  {
    id: 'brand-demo-001',
    name: '한결안전',
    englishName: 'HANGYEOL SAFETY',
    mainField: '안전용품',
    linkedProductCount: 12,
    isExposed: true,
    createdAt: '2026-09-14',
    shortIntroduction: '현장의 안전을 생각하는 보호 장비 브랜드입니다.',
    storyTitle: '안전을 만드는 기술',
    storyBody: '현장 작업자의 하루를 지키는 안전 장비를 만듭니다.',
    originCountry: '대한민국',
    certification: 'KC 인증',
    hasLogo: true,
    hasCover: true,
  },
  {
    id: 'brand-demo-002',
    name: '워크메이트',
    englishName: 'WORKMATE',
    mainField: '작업복',
    linkedProductCount: 0,
    isExposed: true,
    createdAt: '2026-08-22',
    shortIntroduction: '튼튼하고 편안한 작업복을 소개합니다.',
    storyTitle: '',
    storyBody: '',
    originCountry: '대한민국',
    certification: '',
    hasLogo: true,
    hasCover: false,
  },
  {
    id: 'brand-demo-003',
    name: '가드플러스',
    englishName: 'GUARD PLUS',
    mainField: '보호구',
    linkedProductCount: 0,
    isExposed: false,
    createdAt: '2026-07-03',
    shortIntroduction: '',
    storyTitle: '',
    storyBody: '',
    originCountry: '',
    certification: '',
    hasLogo: false,
    hasCover: false,
  },
];

const AdminBrandPreviewContext = createContext<AdminBrandPreviewValue | null>(null);

/** 관리자 라우트 안에서만 유지되는 브랜드 합성 미리보기입니다. 네트워크와 저장소를 사용하지 않습니다. */
export function AdminBrandPreviewProvider({
  children,
  initialBrands = INITIAL_BRANDS,
  initialMonthlyBrandId = 'brand-demo-001',
}: {
  children: ReactNode;
  initialBrands?: AdminBrandPreview[];
  initialMonthlyBrandId?: string | null;
}) {
  const [brands, setBrands] = useState<AdminBrandPreview[]>(initialBrands);
  const [monthlyBrandId, setMonthlyBrandId] = useState<string | null>(initialMonthlyBrandId);
  const [brandMedia, setBrandMedia] = useState<ReadonlyMap<string, AdminBrandMediaPreview>>(
    () => new Map(),
  );

  const saveBrand = useCallback(
    (draft: AdminBrandDraft, files: AdminBrandMediaFiles) => {
      const id = draft.id ?? `brand-preview-${crypto.randomUUID()}`;
      const nextMedia: AdminBrandMediaPreview = {
        ...files,
        logoUrl: files.logoFile ? URL.createObjectURL(files.logoFile) : null,
        coverUrl: files.coverFile ? URL.createObjectURL(files.coverFile) : null,
      };
      setBrands((previousBrands) => {
        const existing = previousBrands.find((brand) => brand.id === id);
        const nextBrand: AdminBrandPreview = {
          ...draft,
          id,
          createdAt: existing?.createdAt ?? new Date().toISOString().slice(0, 10),
          linkedProductCount: existing?.linkedProductCount ?? 0,
        };
        return existing
          ? previousBrands.map((brand) => (brand.id === id ? nextBrand : brand))
          : [...previousBrands, nextBrand];
      });
      setBrandMedia(new Map(brandMedia).set(id, nextMedia));
      return id;
    },
    [brandMedia],
  );

  const setBrandExposure = useCallback((id: string, isExposed: boolean) => {
    setBrands((previousBrands) =>
      previousBrands.map((brand) => (brand.id === id ? { ...brand, isExposed } : brand)),
    );
  }, []);

  const deleteBrand = useCallback(
    (id: string) => {
      setBrands((previousBrands) => previousBrands.filter((brand) => brand.id !== id));
      setMonthlyBrandId((previousId) => (previousId === id ? null : previousId));
      const nextMediaById = new Map(brandMedia);
      nextMediaById.delete(id);
      setBrandMedia(nextMediaById);
    },
    [brandMedia],
  );

  const getBrandMedia = useCallback((id: string) => brandMedia.get(id), [brandMedia]);

  const contextValue = useMemo(
    () => ({
      brands,
      monthlyBrandId,
      getBrandMedia,
      saveBrand,
      setBrandExposure,
      setMonthlyBrand: setMonthlyBrandId,
      deleteBrand,
    }),
    [brands, deleteBrand, getBrandMedia, monthlyBrandId, saveBrand, setBrandExposure],
  );

  const mediaRef = useRef(brandMedia);
  useEffect(() => {
    for (const previousMedia of mediaRef.current.values()) {
      const logoRetained = [...brandMedia.values()].some(
        (media) => media.logoUrl === previousMedia.logoUrl,
      );
      const coverRetained = [...brandMedia.values()].some(
        (media) => media.coverUrl === previousMedia.coverUrl,
      );
      if (previousMedia.logoUrl && !logoRetained) URL.revokeObjectURL(previousMedia.logoUrl);
      if (previousMedia.coverUrl && !coverRetained) URL.revokeObjectURL(previousMedia.coverUrl);
    }
    mediaRef.current = brandMedia;
  }, [brandMedia]);
  useEffect(
    () => () => {
      for (const media of mediaRef.current.values()) {
        if (media.logoUrl) URL.revokeObjectURL(media.logoUrl);
        if (media.coverUrl) URL.revokeObjectURL(media.coverUrl);
      }
    },
    [],
  );

  return (
    <AdminBrandPreviewContext.Provider value={contextValue}>
      {children}
    </AdminBrandPreviewContext.Provider>
  );
}

export function useAdminBrandPreview() {
  const value = useContext(AdminBrandPreviewContext);
  if (!value) {
    throw new Error('useAdminBrandPreview must be used within AdminBrandPreviewProvider');
  }
  return value;
}
