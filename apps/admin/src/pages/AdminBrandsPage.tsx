import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { Switch } from '@eum/ui/components/Switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AdminEmpty, AdminError, AdminLoading, AdminPageHeader } from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { AdminBrand } from '@eum/api/types';

export function AdminBrandsPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminBrand | null>(null);
  const [message, setMessage] = useState('');
  const brandsQuery = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: async ({ signal }) => (await getShopApi()).brands.adminList({ signal }),
  });
  const brands = useMemo(() => brandsQuery.data ?? [], [brandsQuery.data]);
  const filteredBrands = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('ko-KR');
    return brands
      .filter((brand) =>
        `${brand.name} ${brand.englishName ?? ''}`
          .toLocaleLowerCase('ko-KR')
          .includes(normalizedKeyword),
      )
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  }, [brands, keyword]);

  const saveBrand = async (brand: AdminBrand, changes: Partial<AdminBrand>) => {
    if (changes.isVisible === false && brand.isFeatured) {
      setMessage('대표 브랜드 지정을 해제한 뒤 숨길 수 있습니다.');
      return;
    }
    setMessage('');
    try {
      await (await getShopApi()).brands.saveAdmin({ ...brand, ...changes });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }),
        queryClient.invalidateQueries({ queryKey: ['brands'] }),
      ]);
      setMessage(`${brand.name} 브랜드를 목 API에 저장했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '브랜드를 저장하지 못했습니다.');
    }
  };

  if (brandsQuery.isPending) return <AdminLoading label="브랜드를 불러오는 중입니다." />;
  if (brandsQuery.isError)
    return (
      <AdminError title="브랜드를 불러오지 못했습니다" onRetry={() => brandsQuery.refetch()} />
    );

  return (
    <section aria-label="브랜드 관리">
      <AdminPageHeader
        title="브랜드 관리"
        description={`브랜드 ${brands.length}개 · 노출 ${brands.filter((brand) => brand.isVisible).length}개`}
        action={
          <Link to="/brands/new" className={buttonClassName()}>
            브랜드 등록
          </Link>
        }
      />
      {message ? (
        <p role="status" className="mb-12 text-body-s text-text-2">
          {message}
        </p>
      ) : null}
      <label className="mb-16 grid max-w-480 gap-6 text-label-s">
        브랜드 검색
        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
          placeholder="브랜드명 또는 영문명"
        />
      </label>
      {filteredBrands.length === 0 ? (
        <AdminEmpty
          title={brands.length === 0 ? '등록된 브랜드가 없습니다' : '검색 결과가 없습니다'}
          description={
            brands.length === 0
              ? '새 브랜드를 등록하면 이곳에서 관리할 수 있습니다.'
              : '검색어를 바꾸어 다시 확인해 주세요.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-12 border border-line bg-bg">
          <table className="w-full min-w-760 border-collapse text-left text-body-s">
            <thead className="bg-surface text-label-s text-text-2">
              <tr>
                <th scope="col" className="px-16 py-12">
                  브랜드
                </th>
                <th scope="col" className="px-12 py-12">
                  주요 분야
                </th>
                <th scope="col" className="px-12 py-12 text-right">
                  연결 상품
                </th>
                <th scope="col" className="px-12 py-12">
                  정렬
                </th>
                <th scope="col" className="px-12 py-12">
                  노출
                </th>
                <th scope="col" className="px-12 py-12">
                  대표
                </th>
                <th scope="col" className="px-12 py-12 text-right">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBrands.map((brand) => (
                <tr key={brand.id} className="border-t border-line">
                  <td className="px-16 py-12">
                    <div className="flex items-center gap-10">
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt={`${brand.name} 로고`}
                          className="size-40 rounded-6 border border-line object-contain"
                        />
                      ) : null}
                      <div>
                        <Link to={`/brands/${brand.id}`} className="font-medium hover:underline">
                          {brand.name}
                        </Link>
                        <p className="text-caption text-text-3">
                          {brand.englishName ?? '영문명 없음'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-12 py-12">{brand.mainField ?? '—'}</td>
                  <td className="px-12 py-12 text-right">{brand.productCount}</td>
                  <td className="px-12 py-12">
                    <label className="sr-only" htmlFor={`brand-sort-${brand.id}`}>
                      {brand.name} 정렬 순서
                    </label>
                    <input
                      id={`brand-sort-${brand.id}`}
                      type="number"
                      defaultValue={brand.sortOrder ?? 0}
                      onBlur={(event) => {
                        const sortOrder = Number(event.currentTarget.value);
                        if (Number.isFinite(sortOrder) && sortOrder !== (brand.sortOrder ?? 0)) {
                          void saveBrand(brand, { sortOrder });
                        }
                      }}
                      className="h-32 w-72 rounded-6 border border-line-control px-6"
                    />
                  </td>
                  <td className="px-12 py-12">
                    <Switch
                      label={`${brand.name} 노출`}
                      isChecked={brand.isVisible}
                      onCheckedChange={(isVisible) => void saveBrand(brand, { isVisible })}
                      onText="노출"
                      offText="숨김"
                    />
                  </td>
                  <td className="px-12 py-12">
                    <Switch
                      label={`${brand.name} 대표 브랜드`}
                      isChecked={brand.isFeatured}
                      onCheckedChange={(isFeatured) => void saveBrand(brand, { isFeatured })}
                      onText="대표"
                      offText="일반"
                    />
                  </td>
                  <td className="px-12 py-12 text-right">
                    <Link
                      to={`/brands/${brand.id}`}
                      className="mr-8 rounded-6 border border-line-control px-8 py-6 text-caption focus-ring"
                    >
                      수정
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="s"
                      onClick={() => setDeleteTarget(brand)}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="브랜드 삭제"
        description={
          deleteTarget
            ? `${deleteTarget.name} 브랜드를 삭제할까요? 상품에서 사용 중인 브랜드는 삭제할 수 없습니다.`
            : undefined
        }
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await (await getShopApi()).brands.deleteAdmin(deleteTarget.id);
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }),
                    queryClient.invalidateQueries({ queryKey: ['brands'] }),
                  ]);
                  setMessage(`${deleteTarget.name} 브랜드를 목 API에서 삭제했습니다.`);
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : '브랜드를 삭제하지 못했습니다.',
                  );
                }
                setDeleteTarget(null);
              }}
            >
              삭제
            </Button>
          </>
        }
      />
    </section>
  );
}
