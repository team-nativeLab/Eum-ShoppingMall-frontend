import {
  BriefcaseMedical,
  Cctv,
  FireExtinguisher,
  HardHat,
  LayoutGrid,
  Leaf,
  Package,
  Shirt,
  TrafficCone,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';
import type { Category } from '@eum/api/types';
import { Icon } from '@eum/ui/components/Icon';

// 서버 카테고리의 iconKey → Lucide 아이콘. 모르는 키이거나 키가 없으면 Package를 씁니다.
const CATEGORY_ICONS_BY_KEY: Readonly<Record<string, LucideIcon>> = {
  'hard-hat': HardHat,
  shirt: Shirt,
  'traffic-cone': TrafficCone,
  'fire-extinguisher': FireExtinguisher,
  'briefcase-medical': BriefcaseMedical,
  cctv: Cctv,
  leaf: Leaf,
  package: Package,
};

/** 카테고리 아이콘 키를 아이콘 컴포넌트로 바꿉니다. */
function getCategoryIcon(iconKey: string | null): LucideIcon {
  return (iconKey !== null ? CATEGORY_ICONS_BY_KEY[iconKey] : undefined) ?? Package;
}

// 카테고리 바 끝의 "전체보기" 바로가기(서버 카테고리가 아닌 고정 탐색 항목)
const VIEW_ALL_ITEM = { label: '전체보기', description: '더 다양한 제품', href: '/search' };

interface CategoryShortcut {
  key: string;
  label: string;
  description: string | null;
  href: string;
  icon: LucideIcon;
}

/** 상위 카테고리를 아이콘이 붙은 바로가기 목록으로 바꾸고 끝에 전체보기를 붙입니다. */
function toCategoryShortcuts(categories: Category[]): CategoryShortcut[] {
  const topLevelShortcuts = categories
    .filter((category) => category.parentId === null)
    .map((category) => ({
      key: category.id,
      label: category.name,
      description: category.description,
      href: '/category/' + encodeURIComponent(category.slug),
      icon: getCategoryIcon(category.iconKey),
    }));
  return [...topLevelShortcuts, { key: 'all', ...VIEW_ALL_ITEM, icon: LayoutGrid }];
}

/**
 * 모바일 타일 안에서 "/"·"·" 뒤에서 줄을 바꿀 수 있게 줄바꿈 후보(<wbr>)를 넣습니다.
 * 단어 중간 줄바꿈은 break-keep으로 막습니다.
 */
function renderWrappableLabel(label: string) {
  return label.split(/(?<=[/·])/).map((labelPart, partIndex) => (
    <Fragment key={labelPart + partIndex}>
      {partIndex > 0 ? <wbr /> : null}
      {labelPart}
    </Fragment>
  ));
}

/**
 * Figma HF/Web/CategoryBar(데스크톱). 카테고리 이름·소개·이동 경로는 카테고리 API에서 받습니다.
 * hover·키보드 포커스 시 연회색 타일을 보여 주고, 그 타일 양옆 구분선은 숨깁니다.
 */
export function CategoryBar({ categories }: { categories: Category[] }) {
  const categoryShortcuts = toCategoryShortcuts(categories);
  return (
    <nav
      aria-label="상품 카테고리"
      className="relative z-10 -mt-64 hidden h-132 rounded-12 bg-bg p-12 shadow-2 lg:block"
    >
      <ul className="flex h-full items-center">
        {categoryShortcuts.map((shortcut, shortcutIndex) => (
          <li
            key={shortcut.key}
            className={
              shortcutIndex > 0
                ? 'group/cell relative h-full min-w-0 flex-1 before:absolute before:top-1/2 before:left-0 before:h-40 before:w-1 before:-translate-y-1/2 before:bg-line has-[a:focus-visible]:before:invisible has-[a:hover]:before:invisible [&:has(+li_a:hover)]:before:invisible'
                : 'group/cell relative h-full min-w-0 flex-1'
            }
          >
            <Link
              href={shortcut.href}
              className="relative flex h-full min-w-0 flex-col items-center rounded-8 px-4 pt-16 text-center focus-ring hover:bg-surface focus-visible:bg-surface"
            >
              {/* Figma CategoryBar 아이콘은 32px라 Icon 크기 단계(최대 28) 대신 Lucide를 직접 씁니다. */}
              <shortcut.icon size={32} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
              <span className="mt-8 max-w-full truncate text-label-m">{shortcut.label}</span>
              {shortcut.description ? (
                <span className="mt-2 max-w-full truncate text-caption text-text-3">
                  {shortcut.description}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** W-01m 모바일 홈의 3열 카테고리 타일. 라벨은 두 줄까지 줄바꿈됩니다. */
export function MobileCategoryGrid({ categories }: { categories: Category[] }) {
  const categoryShortcuts = toCategoryShortcuts(categories);
  return (
    <nav aria-label="상품 카테고리" className="px-20 pt-24 lg:hidden">
      <ul className="grid grid-cols-3 gap-8">
        {categoryShortcuts.map((shortcut) => (
          <li key={shortcut.key} className="flex h-96 items-center justify-center">
            <Link
              href={shortcut.href}
              className="flex h-84 w-76 flex-col items-center justify-center gap-6 rounded-12 border border-line bg-bg px-4 py-8 text-center focus-ring hover:bg-surface"
            >
              <Icon icon={shortcut.icon} size={24} className="shrink-0" />
              <span className="w-68 text-caption-medium break-keep">
                {renderWrappableLabel(shortcut.label)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
