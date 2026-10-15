import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { Pagination } from '@eum/ui/components/Pagination';
import { Switch } from '@eum/ui/components/Switch';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  AdminEmpty,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTabs,
  formatAdminDate,
} from '@/components/AdminUI';
import { useAdminBrandPreview, type AdminBrandPreview } from '@/lib/admin-brand-preview';

type BrandTab = 'all' | 'exposed' | 'hidden';
type ContentFilter = 'all' | 'complete' | 'incomplete';

function contentCount(brand: AdminBrandPreview) {
  return [
    brand.hasLogo,
    Boolean(brand.shortIntroduction),
    brand.hasCover,
    Boolean(brand.storyTitle && brand.storyBody),
  ].filter(Boolean).length;
}

export function AdminBrandsPage() {
  const { brands, deleteBrand, getBrandMedia, monthlyBrandId, setBrandExposure, setMonthlyBrand } =
    useAdminBrandPreview();
  const monthlyBrand = brands.find((brand) => brand.id === monthlyBrandId) ?? null;
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<BrandTab>('all');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [page, setPage] = useState(1);
  const [monthlyDialogOpen, setMonthlyDialogOpen] = useState(false);
  const [monthlyCandidate, setMonthlyCandidate] = useState<string | null>(monthlyBrandId);
  const [monthlySearch, setMonthlySearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminBrandPreview | null>(null);
  const [exposureBlockTarget, setExposureBlockTarget] = useState<AdminBrandPreview | null>(null);
  const [undoAction, setUndoAction] = useState<{
    brandId: string;
    wasExposed: boolean;
    appliedExposure: boolean;
  } | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!undoAction) return;
    const timeoutId = window.setTimeout(() => setUndoAction(null), 7000);
    return () => window.clearTimeout(timeoutId);
  }, [undoAction]);

  const filteredBrands = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('ko-KR');
    return brands.filter((brand) => {
      const matchesKeyword =
        !normalizedKeyword ||
        brand.name.toLocaleLowerCase('ko-KR').includes(normalizedKeyword) ||
        brand.englishName.toLocaleLowerCase('ko-KR').includes(normalizedKeyword);
      const matchesTab = tab === 'all' || (tab === 'exposed' ? brand.isExposed : !brand.isExposed);
      const completeness = contentCount(brand);
      const matchesContent =
        contentFilter === 'all' ||
        (contentFilter === 'complete' ? completeness === 4 : completeness < 4);
      return matchesKeyword && matchesTab && matchesContent;
    });
  }, [brands, contentFilter, keyword, tab]);
  const monthlyOptions = brands.filter((brand) => {
    const matchesKeyword = `${brand.name} ${brand.englishName}`
      .toLocaleLowerCase('ko-KR')
      .includes(monthlySearch.toLocaleLowerCase('ko-KR').trim());
    return matchesKeyword;
  });
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageBrands = filteredBrands.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const exposedCount = brands.filter((brand) => brand.isExposed).length;
  const hiddenCount = brands.length - exposedCount;

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setKeyword(searchText.trim());
    setPage(1);
  };
  const handleReset = () => {
    setSearchText('');
    setKeyword('');
    setTab('all');
    setContentFilter('all');
    setPage(1);
  };
  const openMonthlyDialog = () => {
    setMonthlyCandidate(monthlyBrandId);
    setMonthlyDialogOpen(true);
  };
  const handleExposureChange = (brand: AdminBrandPreview, nextValue: boolean) => {
    if (!nextValue && monthlyBrandId === brand.id) {
      setExposureBlockTarget(brand);
      return;
    }
    setBrandExposure(brand.id, nextValue);
    setUndoAction({
      brandId: brand.id,
      wasExposed: brand.isExposed,
      appliedExposure: nextValue,
    });
    setAnnouncement(`${brand.name} 브랜드를 ${nextValue ? '노출' : '숨김'} 미리보기했습니다.`);
  };
  const deleteBlock = deleteTarget
    ? deleteTarget.linkedProductCount > 0
      ? 'products'
      : monthlyBrandId === deleteTarget.id
        ? 'monthly'
        : null
    : null;

  return (
    <section aria-label="브랜드 관리">
      <AdminPageHeader
        title="브랜드 관리"
        description={`브랜드 ${brands.length.toLocaleString('ko-KR')}개 · 노출 ${exposedCount.toLocaleString('ko-KR')}개 · 숨김 ${hiddenCount.toLocaleString('ko-KR')}개`}
        action={
          <Link to="/brands/new" className={buttonClassName()}>
            브랜드 등록
          </Link>
        }
      />
      <AdminNotice className="mb-16">
        브랜드 정보와 노출 상태는 이 관리자 화면의 합성 미리보기입니다. 저장소나 쇼핑몰에는 반영되지
        않으며 새로고침하면 초기 예시로 돌아갑니다.
      </AdminNotice>

      <AdminPanel
        title="이달의 브랜드"
        description="관리자 화면에서 선택한 브랜드 미리보기입니다. 실제 쇼핑몰에는 반영되지 않습니다."
        action={
          <Button type="button" variant="secondary" size="s" onClick={openMonthlyDialog}>
            {monthlyBrand ? '브랜드 변경' : '브랜드 지정'}
          </Button>
        }
        className="mb-16"
      >
        <div className="flex min-h-80 items-center gap-16 px-20 py-16">
          {monthlyBrand ? (
            <>
              <span className="grid size-56 shrink-0 place-items-center rounded-8 bg-surface text-label-m">
                {monthlyBrand.name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{monthlyBrand.name}</p>
                <p className="mt-4 text-caption text-text-3">
                  {monthlyBrand.englishName || '영문명 미입력'}
                </p>
              </div>
              <span className="ml-auto rounded-6 bg-surface px-8 py-4 text-caption text-text-2">
                현재 미리보기
              </span>
            </>
          ) : (
            <p className="text-body-s text-text-3">이달의 브랜드가 지정되지 않았습니다.</p>
          )}
        </div>
      </AdminPanel>

      <AdminTabs
        label="브랜드 노출 필터"
        options={[
          { value: 'all', label: '전체', count: brands.length },
          { value: 'exposed', label: '노출', count: exposedCount },
          { value: 'hidden', label: '숨김', count: hiddenCount },
        ]}
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab);
          setPage(1);
        }}
      />
      {undoAction ? (
        <AdminNotice
          className="mt-12"
          action={
            <Button
              type="button"
              variant="secondary"
              size="s"
              onClick={() => {
                const brand = brands.find((item) => item.id === undoAction.brandId);
                if (brand?.isExposed === undoAction.appliedExposure) {
                  setBrandExposure(undoAction.brandId, undoAction.wasExposed);
                  setAnnouncement(`${brand.name} 노출 상태를 되돌렸습니다.`);
                } else {
                  setAnnouncement('브랜드 상태가 바뀌어 노출 변경을 되돌리지 않았습니다.');
                }
                setUndoAction(null);
              }}
            >
              되돌리기
            </Button>
          }
        >
          브랜드 노출 상태를 이 화면에서만 변경했습니다.
        </AdminNotice>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <form
        onSubmit={handleSearch}
        className="mt-16 flex items-center gap-8 rounded-12 border border-line bg-bg p-12"
      >
        <label className="flex h-40 min-w-240 flex-1 items-center rounded-8 border border-line-control px-12 focus-within:ring-2 focus-within:ring-text-1">
          <span className="sr-only">브랜드명 검색</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="브랜드명 · 영문명 검색"
            className="w-full min-w-0 border-0 bg-transparent text-body-s outline-none placeholder:text-text-3"
          />
        </label>
        <label className="relative block w-160 shrink-0">
          <span className="sr-only">콘텐츠 완성도 필터</span>
          <select
            value={contentFilter}
            onChange={(event) => {
              setContentFilter(event.target.value as ContentFilter);
              setPage(1);
            }}
            className="h-40 w-full rounded-8 border border-line-control bg-bg px-12 text-body-s focus-ring"
          >
            <option value="all">콘텐츠 전체</option>
            <option value="complete">완성</option>
            <option value="incomplete">미완성</option>
          </select>
        </label>
        <Button type="button" variant="ghost" size="s" onClick={handleReset}>
          초기화
        </Button>
        <Button type="submit" size="s">
          검색
        </Button>
      </form>

      <section
        aria-label="브랜드 목록"
        className="mt-16 overflow-hidden rounded-12 border border-line bg-bg"
      >
        <div className="flex h-48 items-center justify-between border-b border-line px-20">
          <p className="text-body-s text-text-2">
            검색 결과 {filteredBrands.length.toLocaleString('ko-KR')}개
          </p>
          <p className="text-caption text-text-3">페이지당 10개</p>
        </div>
        {brands.length === 0 ? (
          <div className="grid justify-items-center gap-12 px-24 py-32 text-center">
            <AdminEmpty
              title="등록된 브랜드가 없습니다"
              description="브랜드를 등록하면 이곳에서 정보를 관리할 수 있습니다."
            />
            <Link to="/brands/new" className={buttonClassName()}>
              브랜드 등록
            </Link>
          </div>
        ) : pageBrands.length === 0 ? (
          <div className="grid justify-items-center gap-12 px-24 py-32 text-center">
            <AdminEmpty
              title="검색 결과가 없습니다"
              description="검색어나 필터 조건을 확인해 주세요."
            />
            <Button type="button" variant="secondary" size="s" onClick={handleReset}>
              검색 조건 초기화
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-960 border-collapse text-left text-body-s">
              <thead className="bg-surface text-label-s text-text-2">
                <tr>
                  <th scope="col" className="px-16 py-12 font-medium">
                    브랜드명
                  </th>
                  <th scope="col" className="px-12 py-12 font-medium">
                    주요 분야
                  </th>
                  <th scope="col" className="px-12 py-12 text-right font-medium">
                    연결 상품
                  </th>
                  <th scope="col" className="px-12 py-12 text-center font-medium">
                    정보 입력
                  </th>
                  <th scope="col" className="px-12 py-12 font-medium">
                    노출 상태
                  </th>
                  <th scope="col" className="px-12 py-12 font-medium">
                    등록일
                  </th>
                  <th scope="col" className="px-12 py-12 text-right font-medium">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageBrands.map((brand) => (
                  <tr key={brand.id} className="border-t border-line hover:bg-bg-subtle">
                    <td className="px-16 py-12">
                      <div className="flex items-center gap-12">
                        {getBrandMedia(brand.id)?.logoUrl ? (
                          <img
                            src={getBrandMedia(brand.id)?.logoUrl ?? undefined}
                            alt={`${brand.name} 로고`}
                            className="size-48 shrink-0 rounded-6 border border-line object-contain"
                          />
                        ) : (
                          <span className="grid size-48 shrink-0 place-items-center rounded-6 bg-surface text-label-m">
                            {brand.hasLogo ? brand.name.slice(0, 1) : '—'}
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link
                            to={`/brands/${brand.id}`}
                            className="font-medium focus-ring hover:underline"
                          >
                            {brand.name}
                          </Link>
                          <span className="mt-2 block text-caption text-text-3">
                            {brand.englishName || '영문명 미입력'}
                          </span>
                          {monthlyBrandId === brand.id ? (
                            <span className="mt-4 inline-flex rounded-4 bg-info-tint px-6 py-2 text-caption text-info">
                              이달의 브랜드
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-12 py-12 text-text-2">{brand.mainField || '미입력'}</td>
                    <td className="px-12 py-12 text-right">
                      {brand.linkedProductCount.toLocaleString('ko-KR')}
                    </td>
                    <td className="px-12 py-12 text-center">{contentCount(brand)}/4</td>
                    <td className="px-12 py-12">
                      <Switch
                        label={`${brand.name} 브랜드 노출`}
                        isChecked={brand.isExposed}
                        onCheckedChange={(nextValue) => handleExposureChange(brand, nextValue)}
                        onText="노출"
                        offText="숨김"
                      />
                    </td>
                    <td className="px-12 py-12 whitespace-nowrap text-text-3">
                      {formatAdminDate(brand.createdAt)}
                    </td>
                    <td className="px-12 py-12">
                      <div className="flex justify-end gap-6">
                        <Link
                          to={`/brands/${brand.id}`}
                          className="rounded-6 border border-line-control px-8 py-6 text-caption focus-ring hover:bg-surface"
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {brands.length > 0 ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          className="mt-20 flex justify-center"
        />
      ) : null}

      <Modal
        isOpen={monthlyDialogOpen}
        onClose={() => setMonthlyDialogOpen(false)}
        title="이달의 브랜드 지정"
        description="관리자 화면에서만 선택 내용을 미리봅니다. 쇼핑몰에는 반영되지 않습니다."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setMonthlyDialogOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                setMonthlyBrand(monthlyCandidate);
                setMonthlyDialogOpen(false);
              }}
            >
              지정하기
            </Button>
          </>
        }
      >
        <div className="mt-16 grid gap-12">
          <label className="grid gap-6 text-label-s">
            브랜드 검색
            <input
              value={monthlySearch}
              onChange={(event) => setMonthlySearch(event.target.value)}
              className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
            />
          </label>
          <label className="flex items-center gap-8 rounded-8 border border-line px-12 py-10 text-body-s">
            <input
              type="radio"
              name="monthly-brand"
              checked={monthlyCandidate === null}
              onChange={() => setMonthlyCandidate(null)}
            />
            미지정
          </label>
          {monthlyOptions.length === 0 ? (
            <AdminEmpty title="검색 결과가 없습니다" className="min-h-80" />
          ) : null}
          <div className="max-h-240 overflow-y-auto">
            {monthlyOptions.map((brand) => (
              <label
                key={brand.id}
                className="flex items-center justify-between gap-12 border-b border-line px-12 py-10 text-body-s has-[:disabled]:text-text-disabled"
              >
                <span className="flex min-w-0 items-center gap-8">
                  <input
                    type="radio"
                    name="monthly-brand"
                    disabled={!brand.isExposed}
                    checked={monthlyCandidate === brand.id}
                    onChange={() => setMonthlyCandidate(brand.id)}
                  />
                  <span className="truncate">{brand.name}</span>
                  {!brand.isExposed ? <span className="text-caption">숨김 상태</span> : null}
                </span>
                {brand.id === monthlyBrandId ? (
                  <span className="shrink-0 text-caption text-info">현재 지정</span>
                ) : null}
              </label>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={exposureBlockTarget !== null}
        onClose={() => setExposureBlockTarget(null)}
        title="이달의 브랜드입니다"
        description="다른 브랜드를 먼저 지정해 주세요."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setExposureBlockTarget(null)}>
              닫기
            </Button>
            <Button
              type="button"
              onClick={() => {
                setExposureBlockTarget(null);
                openMonthlyDialog();
              }}
            >
              이달의 브랜드 변경
            </Button>
          </>
        }
      />

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={
          deleteBlock === 'products'
            ? '삭제할 수 없습니다'
            : deleteBlock === 'monthly'
              ? '이달의 브랜드입니다'
              : '브랜드를 삭제할까요?'
        }
        tone={deleteBlock ? 'confirm' : 'danger'}
        actions={
          deleteBlock === 'products' ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                닫기
              </Button>
              <Link
                to="/products"
                className={buttonClassName()}
                onClick={() => setDeleteTarget(null)}
              >
                상품 보기
              </Link>
            </>
          ) : deleteBlock === 'monthly' ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                닫기
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  openMonthlyDialog();
                }}
              >
                이달의 브랜드 변경
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                취소
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  if (!deleteTarget) return;
                  deleteBrand(deleteTarget.id);
                  setAnnouncement(`${deleteTarget.name} 브랜드를 미리보기 목록에서 삭제했습니다.`);
                  setDeleteTarget(null);
                }}
              >
                삭제
              </Button>
            </>
          )
        }
      >
        <p className="mt-12 text-body-s text-text-2">
          {deleteBlock === 'products'
            ? `${deleteTarget?.linkedProductCount ?? 0}개 상품과 연결되어 있어 삭제할 수 없습니다. 연결 상품에서 브랜드를 변경하거나 숨겨 주세요.`
            : deleteBlock === 'monthly'
              ? '다른 브랜드를 이달의 브랜드로 지정한 뒤 삭제해 주세요.'
              : '삭제한 브랜드는 이 관리자 미리보기에서 사라집니다. 이 작업은 실제 쇼핑몰에 반영되지 않습니다.'}
        </p>
      </Modal>
    </section>
  );
}
