import { ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Category } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
} from '@/components/AdminUI';
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
  return api.categories.list({ signal });
}

/** 카테고리 목록·상세를 탐색하는 읽기 전용 관리자 화면입니다. */
export function AdminCategoriesPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<ReadonlySet<string> | null>(null);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<ReadonlySet<string>>(new Set());
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<string, { name: string; description: string }>
  >({});
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
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

  const categories = [
    ...categoryQuery.data
      .filter((category) => !hiddenCategoryIds.has(category.id))
      .map((category) => ({ ...category, ...categoryDrafts[category.id] })),
    ...localCategories,
  ];
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

  return (
    <section aria-label="카테고리 관리">
      <AdminPageHeader
        title="카테고리 관리"
        action={
          <Button
            onClick={() => {
              setIsCreatingCategory(true);
              setNewCategoryName('');
              setNewCategoryDescription('');
            }}
          >
            1차 카테고리 추가
          </Button>
        }
      />

      <AdminNotice tone="warning" className="mb-16">
        추가·수정·삭제는 이 화면에서만 임시로 반영됩니다. 서버에는 저장되지 않습니다.
      </AdminNotice>

      {previewMessage ? (
        <p role="status" className="mb-16 text-body-s text-warning">
          {previewMessage}
        </p>
      ) : null}

      {isCreatingCategory ? (
        <section
          className="mb-16 rounded-12 border border-line bg-bg p-20"
          aria-label="임시 카테고리 추가"
        >
          <h2 className="text-title">1차 카테고리 추가 미리보기</h2>
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
          </div>
          <div className="mt-16 flex justify-end gap-8">
            <Button variant="secondary" onClick={() => setIsCreatingCategory(false)}>
              취소
            </Button>
            <Button
              disabled={!newCategoryName.trim()}
              onClick={() => {
                const localId = `preview-category-${Date.now()}`;
                const localCategory: Category = {
                  id: localId,
                  slug: localId,
                  name: newCategoryName.trim(),
                  parentId: null,
                  description: newCategoryDescription.trim() || null,
                  iconKey: null,
                };
                setLocalCategories((previous) => [...previous, localCategory]);
                setSelectedCategoryId(localId);
                setIsCreatingCategory(false);
                setPreviewMessage(
                  '카테고리가 목록에 임시 추가되었습니다. 새로고침하면 사라집니다.',
                );
              }}
            >
              임시 추가
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
            <div className="mb-16 flex flex-col gap-2">
              <h2 className="text-title">카테고리 {categories.length}개</h2>
              <p className="text-caption text-text-3">
                카테고리별 상품 수 집계 API가 제공되지 않습니다.
              </p>
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
                  <div className="flex min-h-40 items-center gap-8 text-body-s text-text-3">
                    <span
                      className="inline-flex h-20 w-36 items-center rounded-capsule bg-surface-2 p-2"
                      aria-hidden="true"
                    >
                      <span className="size-16 rounded-capsule bg-text-disabled" />
                    </span>
                    노출 상태 정보 없음
                  </div>
                </div>
              </div>

              <div className="mt-24 flex items-center justify-between border-t border-line pt-16">
                <Button
                  type="button"
                  variant="danger"
                  size="s"
                  onClick={() => {
                    if (activeCategory.id.startsWith('preview-category-')) {
                      setLocalCategories((previous) =>
                        previous.filter((category) => category.id !== activeCategory.id),
                      );
                    } else {
                      setHiddenCategoryIds((previous) => new Set([...previous, activeCategory.id]));
                    }
                    setSelectedCategoryId(null);
                    setPreviewMessage(
                      '선택한 카테고리를 현재 화면에서만 숨겼습니다. 서버 데이터는 변경되지 않았습니다.',
                    );
                  }}
                >
                  삭제
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    setPreviewMessage(
                      '변경 사항을 이 화면에 임시 반영했습니다. 서버에는 저장되지 않았습니다.',
                    )
                  }
                >
                  임시 저장
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
