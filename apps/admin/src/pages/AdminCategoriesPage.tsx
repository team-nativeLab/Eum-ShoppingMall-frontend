import { ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Category } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { AdminEmpty, AdminError, AdminLoading, AdminPageHeader } from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';

interface CategoryTreeNode {
  category: Category;
  children: CategoryTreeNode[];
}

/** 카테고리 조회 API 결과를 이름을 바꾸지 않고 계층 구조로 구성합니다. */
function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const childrenByParentId = new Map<string, Category[]>();

  for (const category of categories) {
    if (category.parentId && categoryById.has(category.parentId)) {
      const siblings = childrenByParentId.get(category.parentId) ?? [];
      siblings.push(category);
      childrenByParentId.set(category.parentId, siblings);
    }
  }

  const visitedCategoryIds = new Set<string>();
  const createTreeNode = (category: Category): CategoryTreeNode => {
    visitedCategoryIds.add(category.id);
    return {
      category,
      children: (childrenByParentId.get(category.id) ?? [])
        .filter((child) => !visitedCategoryIds.has(child.id))
        .map(createTreeNode),
    };
  };

  const rootCategories = categories.filter(
    (category) => !category.parentId || !categoryById.has(category.parentId),
  );
  const tree = rootCategories.map(createTreeNode);

  // 연결이 끊긴 데이터도 목록에서 숨기지 않고 별도 루트로 보여 줍니다.
  for (const category of categories) {
    if (!visitedCategoryIds.has(category.id)) tree.push(createTreeNode(category));
  }

  return tree;
}

interface CategoryTreeRowsProps {
  nodes: CategoryTreeNode[];
  selectedCategoryId: string;
  expandedCategoryIds: ReadonlySet<string>;
  onSelect: (categoryId: string) => void;
  onToggle: (categoryId: string) => void;
  depth?: number;
}

/** API가 반환한 카테고리 트리를 계층 선택 목록으로 표시합니다. */
function CategoryTreeRows({
  nodes,
  selectedCategoryId,
  expandedCategoryIds,
  onSelect,
  onToggle,
  depth = 0,
}: CategoryTreeRowsProps) {
  return (
    <ul className="flex flex-col gap-2">
      {nodes.map(({ category, children }) => {
        const hasChildren = children.length > 0;
        const isExpanded = expandedCategoryIds.has(category.id);
        const isSelected = category.id === selectedCategoryId;

        return (
          <li key={category.id}>
            <div
              className={`flex h-40 items-center gap-4 rounded-8 pr-8 ${
                isSelected ? 'bg-surface' : 'hover:bg-bg-subtle'
              }`}
              style={{ paddingLeft: 8 + depth * 24 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={`${category.name} 하위 카테고리 ${isExpanded ? '접기' : '펼치기'}`}
                  aria-expanded={isExpanded}
                  className="flex size-24 shrink-0 items-center justify-center rounded-4 text-text-2 focus-ring"
                  onClick={() => onToggle(category.id)}
                >
                  {isExpanded ? (
                    <ChevronDown size={16} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={16} aria-hidden="true" />
                  )}
                </button>
              ) : (
                <span className="size-24 shrink-0" aria-hidden="true" />
              )}
              <button
                type="button"
                aria-pressed={isSelected}
                className="flex min-w-0 flex-1 items-center justify-between gap-12 text-left focus-ring"
                onClick={() => onSelect(category.id)}
              >
                <span className={`truncate text-body-s ${depth === 0 ? 'font-medium' : ''}`}>
                  {category.name}
                </span>
                <span className="shrink-0 text-caption text-text-3" aria-label="상품 수 정보 없음">
                  —
                </span>
              </button>
            </div>
            {hasChildren && isExpanded ? (
              <div className="mt-2">
                <CategoryTreeRows
                  nodes={children}
                  selectedCategoryId={selectedCategoryId}
                  expandedCategoryIds={expandedCategoryIds}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Admin 카테고리 트리와 서버가 제공하는 카테고리 상세를 조회합니다. */
async function loadCategories(signal: AbortSignal): Promise<Category[]> {
  const api = await getShopApi();
  return api.categories.adminList({ signal });
}

/** 카테고리 목록·상세를 탐색하는 읽기 전용 관리자 화면입니다. */
export function AdminCategoriesPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<ReadonlySet<string> | null>(null);
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<string, { name: string; description: string }>
  >({});
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [filterDrafts, setFilterDrafts] = useState<Record<string, string>>({});
  const [sortDrafts, setSortDrafts] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();
  const categoryQuery = useQuery({
    queryKey: ['admin', 'categories', 'list'],
    queryFn: ({ signal }) => loadCategories(signal),
  });

  if (categoryQuery.isPending) {
    return <AdminLoading label="카테고리 목록을 불러오고 있습니다." />;
  }

  if (categoryQuery.isError) {
    return <AdminError onRetry={() => void categoryQuery.refetch()} />;
  }

  const categories = categoryQuery.data.map((category) => ({
    ...category,
    ...categoryDrafts[category.id],
  }));
  const categoryTree = buildCategoryTree(categories);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const initialSelection = categories.find((category) => category.parentId) ?? categories[0];
  const activeCategory = isCreatingCategory
    ? undefined
    : (categories.find((category) => category.id === selectedCategoryId) ?? initialSelection);
  const defaultExpandedIds = new Set(
    activeCategory?.parentId
      ? [activeCategory.parentId]
      : categoryTree[0]
        ? [categoryTree[0].category.id]
        : [],
  );
  const effectiveExpandedIds = expandedCategoryIds ?? defaultExpandedIds;
  const parentCategory = activeCategory?.parentId
    ? categoryById.get(activeCategory.parentId)
    : undefined;

  const handleToggleCategory = (categoryId: string) => {
    const nextExpandedIds = new Set(effectiveExpandedIds);
    if (nextExpandedIds.has(categoryId)) nextExpandedIds.delete(categoryId);
    else nextExpandedIds.add(categoryId);
    setExpandedCategoryIds(nextExpandedIds);
  };

  const beginCategoryCreation = (parentCategoryId: string | null) => {
    setIsCreatingCategory(true);
    setNewCategoryName('');
    setNewCategoryDescription('');
    setNewCategoryParentId(parentCategoryId);
  };

  return (
    <section aria-label="카테고리 관리">
      <AdminPageHeader
        title="카테고리 관리"
        action={<Button onClick={() => beginCategoryCreation(null)}>1차 카테고리 추가</Button>}
      />

      {previewMessage ? (
        <p role="status" className="mb-16 text-body-s text-warning">
          {previewMessage}
        </p>
      ) : null}

      {isCreatingCategory ? (
        <section
          className="mb-16 rounded-12 border border-line bg-bg p-20"
          aria-label="카테고리 추가"
        >
          <h2 className="text-title">
            {newCategoryParentId ? '하위 카테고리 추가' : '1차 카테고리 추가'}
          </h2>
          <div className="mt-16 grid grid-cols-2 gap-16">
            <label className="grid gap-8 text-label-m">
              카테고리명
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                className="h-48 rounded-8 border border-line-control bg-bg px-14 text-body-s"
              />
            </label>
            <label className="grid gap-8 text-label-m">
              부제
              <input
                value={newCategoryDescription}
                onChange={(event) => setNewCategoryDescription(event.target.value)}
                className="h-48 rounded-8 border border-line-control bg-bg px-14 text-body-s"
              />
            </label>
            <label className="grid gap-8 text-label-m">
              상위 카테고리
              <select
                aria-label="상위 카테고리 선택"
                value={newCategoryParentId ?? ''}
                onChange={(event) => setNewCategoryParentId(event.target.value || null)}
                className="h-48 rounded-8 border border-line-control bg-bg px-14 text-body-s"
              >
                <option value="">최상위 카테고리</option>
                {categories
                  .filter((category) => category.parentId === null)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="mt-16 flex justify-end gap-8">
            <Button variant="secondary" onClick={() => setIsCreatingCategory(false)}>
              취소
            </Button>
            <Button
              disabled={!newCategoryName.trim()}
              onClick={async () => {
                const slug =
                  newCategoryName
                    .trim()
                    .toLocaleLowerCase('ko-KR')
                    .replace(/[^\p{L}\p{N}]+/gu, '-')
                    .replace(/^-|-$/g, '') || `category-${Date.now()}`;
                try {
                  const api = await getShopApi();
                  const createdCategory = await api.categories.save({
                    slug,
                    name: newCategoryName.trim(),
                    parentId: newCategoryParentId,
                    description: newCategoryDescription.trim() || null,
                    iconKey: null,
                    isVisible: true,
                    sortOrder: categories.length,
                    filterAttributes: [],
                  });
                  await queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
                  await queryClient.invalidateQueries({ queryKey: ['categories'] });
                  await queryClient.invalidateQueries({ queryKey: ['products'] });
                  setSelectedCategoryId(createdCategory.id);
                  setIsCreatingCategory(false);
                  setPreviewMessage('카테고리를 목 API에 저장했습니다.');
                } catch (createError) {
                  setPreviewMessage(
                    createError instanceof Error
                      ? createError.message
                      : '카테고리를 저장하지 못했습니다.',
                  );
                }
              }}
            >
              저장
            </Button>
          </div>
        </section>
      ) : null}

      {categories.length === 0 && !isCreatingCategory ? (
        <AdminEmpty
          title="등록된 카테고리가 없습니다"
          description="카테고리 생성 API가 연결되면 이곳에 목록이 표시됩니다."
          className="rounded-12 border border-line bg-bg"
        />
      ) : categories.length > 0 ? (
        <div className="grid items-start gap-16 xl:grid-cols-[minmax(320px,368px)_minmax(0,1fr)]">
          <section className="rounded-12 border border-line bg-bg p-20" aria-label="카테고리 목록">
            <div className="mb-16 flex items-start justify-between gap-12">
              <div className="flex min-w-0 flex-col gap-4">
                <h2 className="text-title">카테고리 {categories.length}개</h2>
                <p className="text-caption text-text-3">
                  카테고리별 상품 수 집계 API가 제공되지 않습니다.
                </p>
              </div>
              <Button
                variant="secondary"
                size="s"
                disabled={!activeCategory}
                onClick={() => beginCategoryCreation(activeCategory?.id ?? null)}
              >
                하위 추가
              </Button>
            </div>
            <CategoryTreeRows
              nodes={categoryTree}
              selectedCategoryId={activeCategory?.id ?? ''}
              expandedCategoryIds={effectiveExpandedIds}
              onSelect={setSelectedCategoryId}
              onToggle={handleToggleCategory}
            />
          </section>

          {activeCategory ? (
            <section
              className="rounded-12 border border-line bg-bg p-24"
              aria-label="카테고리 상세"
            >
              <div className="mb-20 flex items-start justify-between gap-16">
                <div className="min-w-0">
                  <h2 className="text-h3">‘{activeCategory.name}’ 상세</h2>
                  <p className="mt-4 truncate text-caption text-text-3">
                    {parentCategory ? `${parentCategory.name} > ` : ''}
                    {activeCategory.name}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-16">
                <label className="flex min-w-0 flex-col gap-8 text-label-m">
                  카테고리명
                  <input
                    value={categoryDrafts[activeCategory.id]?.name ?? activeCategory.name}
                    onChange={(event) =>
                      setCategoryDrafts((previous) => ({
                        ...previous,
                        [activeCategory.id]: {
                          name: event.target.value,
                          description:
                            previous[activeCategory.id]?.description ??
                            activeCategory.description ??
                            '',
                        },
                      }))
                    }
                    className="h-48 min-w-0 rounded-8 border border-line-control bg-bg px-14 text-body-s"
                  />
                </label>
                <ReadOnlyField
                  label="상위 카테고리"
                  value={
                    parentCategory?.name ??
                    (activeCategory.parentId ? '상위 카테고리 정보 없음' : '최상위 카테고리')
                  }
                />
              </div>
              <div className="mt-16">
                <label className="flex min-w-0 flex-col gap-8 text-label-m">
                  부제
                  <input
                    value={
                      categoryDrafts[activeCategory.id]?.description ??
                      activeCategory.description ??
                      ''
                    }
                    onChange={(event) =>
                      setCategoryDrafts((previous) => ({
                        ...previous,
                        [activeCategory.id]: {
                          name: previous[activeCategory.id]?.name ?? activeCategory.name,
                          description: event.target.value,
                        },
                      }))
                    }
                    className="h-48 min-w-0 rounded-8 border border-line-control bg-bg px-14 text-body-s"
                  />
                  <span className="text-caption text-text-3">현재 화면에서만 편집됩니다.</span>
                </label>
              </div>

              <div className="mt-20 grid grid-cols-[120px_minmax(0,1fr)] items-start gap-24">
                <div>
                  <p className="mb-8 text-label-m">아이콘</p>
                  <div className="flex size-120 items-center justify-center rounded-8 bg-gradient-to-br from-surface to-surface-2 p-8 text-center text-caption text-text-3">
                    {activeCategory.iconKey ?? '아이콘 정보 없음'}
                  </div>
                </div>
                <div>
                  <p className="mb-8 text-label-m">노출</p>
                  <label className="flex min-h-40 items-center gap-8 text-body-s">
                    <input
                      type="checkbox"
                      checked={activeCategory.isVisible !== false}
                      onChange={async (event) => {
                        try {
                          const api = await getShopApi();
                          await api.categories.save({
                            ...activeCategory,
                            isVisible: event.target.checked,
                          });
                          await queryClient.invalidateQueries({
                            queryKey: ['admin', 'categories'],
                          });
                          await queryClient.invalidateQueries({ queryKey: ['categories'] });
                          setPreviewMessage('카테고리 노출 상태를 목 API에 저장했습니다.');
                        } catch (updateError) {
                          setPreviewMessage(
                            updateError instanceof Error
                              ? updateError.message
                              : '노출 상태를 저장하지 못했습니다.',
                          );
                        }
                      }}
                    />
                    웹 노출
                  </label>
                </div>
              </div>

              <div className="mt-16 grid grid-cols-2 gap-16">
                <label className="grid gap-8 text-label-m">
                  정렬 순서
                  <input
                    type="number"
                    min="0"
                    value={sortDrafts[activeCategory.id] ?? activeCategory.sortOrder ?? 0}
                    onChange={(event) =>
                      setSortDrafts((previous) => ({
                        ...previous,
                        [activeCategory.id]: Number(event.target.value) || 0,
                      }))
                    }
                    className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                  />
                </label>
                <label className="grid gap-8 text-label-m">
                  필터 속성 (속성명:값1,값2; 구분)
                  <input
                    value={
                      filterDrafts[activeCategory.id] ??
                      activeCategory.filterAttributes
                        ?.map((attribute) => `${attribute.name}:${attribute.values.join(',')}`)
                        .join('; ') ??
                      ''
                    }
                    onChange={(event) =>
                      setFilterDrafts((previous) => ({
                        ...previous,
                        [activeCategory.id]: event.target.value,
                      }))
                    }
                    className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                    placeholder="인증:KCs,자율안전"
                  />
                </label>
              </div>

              <div className="mt-24 flex items-center justify-between border-t border-line pt-16">
                <Button
                  type="button"
                  variant="danger"
                  size="s"
                  onClick={async () => {
                    try {
                      const api = await getShopApi();
                      await api.categories.delete(activeCategory.id);
                      await queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
                      await queryClient.invalidateQueries({ queryKey: ['categories'] });
                      await queryClient.invalidateQueries({ queryKey: ['products'] });
                      setSelectedCategoryId(null);
                      setPreviewMessage(
                        '카테고리를 삭제했습니다. 연결된 하위 분류나 상품이 있으면 삭제되지 않습니다.',
                      );
                    } catch (deleteError) {
                      setPreviewMessage(
                        deleteError instanceof Error
                          ? deleteError.message
                          : '카테고리를 삭제하지 못했습니다.',
                      );
                    }
                  }}
                >
                  삭제
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const filterAttributes = (filterDrafts[activeCategory.id] ?? '')
                      .split(';')
                      .map((part, index) => {
                        const [namePart, valuesPart = ''] = part.split(':');
                        return {
                          id: `filter-${index + 1}`,
                          name: namePart?.trim() ?? '',
                          values: valuesPart
                            .split(',')
                            .map((value) => value.trim())
                            .filter(Boolean),
                        };
                      })
                      .filter((attribute) => attribute.name && attribute.values.length > 0);
                    try {
                      const api = await getShopApi();
                      await api.categories.save({
                        ...activeCategory,
                        name: categoryDrafts[activeCategory.id]?.name ?? activeCategory.name,
                        description:
                          categoryDrafts[activeCategory.id]?.description ??
                          activeCategory.description,
                        sortOrder: sortDrafts[activeCategory.id] ?? activeCategory.sortOrder ?? 0,
                        filterAttributes,
                      });
                      await queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
                      await queryClient.invalidateQueries({ queryKey: ['categories'] });
                      await queryClient.invalidateQueries({ queryKey: ['products'] });
                      setCategoryDrafts((previous) => {
                        const next = { ...previous };
                        delete next[activeCategory.id];
                        return next;
                      });
                      setFilterDrafts((previous) => {
                        const next = { ...previous };
                        delete next[activeCategory.id];
                        return next;
                      });
                      setSortDrafts((previous) => {
                        const next = { ...previous };
                        delete next[activeCategory.id];
                        return next;
                      });
                      setPreviewMessage('카테고리 변경 사항을 목 API에 저장했습니다.');
                    } catch (saveError) {
                      setPreviewMessage(
                        saveError instanceof Error
                          ? saveError.message
                          : '카테고리를 저장하지 못했습니다.',
                      );
                    }
                  }}
                >
                  저장
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  helper?: string;
}

/** 서버 응답을 수정 가능한 폼처럼 오해하지 않도록 읽기 전용 필드로 보여 줍니다. */
function ReadOnlyField({ label, value, helper }: ReadOnlyFieldProps) {
  const fieldId = `category-${label.replaceAll(' ', '-')}`;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <label htmlFor={fieldId} className="text-label-m">
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        value={value}
        readOnly
        aria-readonly="true"
        className="h-48 min-w-0 rounded-8 border border-line-control bg-bg px-14 text-body-s text-text-1"
      />
      {helper ? <p className="text-caption text-text-3">{helper}</p> : null}
    </div>
  );
}
