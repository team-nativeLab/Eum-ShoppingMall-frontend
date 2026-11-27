'use client';
import type { ClaimType } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useLocalCollections } from '@/features/products/local-collections-context';
import { useMemberSession } from '@/features/auth/member-session';
import { MyPageShell, type MyPageSection } from './mypage-shell';
import { getCollectionProductIds, useMyPageData, type MyPageData } from './mypage-data';
import { profileEditGrant } from './mypage-profile-edit-grant';
import { PageErrorState, PageLoadingState } from './mypage-ui';
import { AddressesView, ProfileView } from './mypage-account-sections';
import { ClaimsView, ClaimFormView } from './mypage-claim-sections';
import { ProductCollectionView } from './mypage-collection-section';
import { CouponsView, PointsView } from './mypage-benefit-sections';
import {
  DashboardSummary,
  DashboardView,
  OrderDetailView,
  OrdersView,
} from './mypage-order-sections';

export function MyPageScreen({
  section,
  itemId,
  preferredClaimType,
}: {
  section: MyPageSection;
  itemId?: string;
  preferredClaimType?: ClaimType;
}) {
  const router = useRouter();
  const [profileEditAuthorization, setProfileEditAuthorization] = useState(() => ({
    section,
    isAuthorized: section === 'profile-edit' && profileEditGrant.current,
  }));
  const isProfileEditAuthorized =
    profileEditAuthorization.section === section
      ? profileEditAuthorization.isAuthorized
      : section === 'profile-edit' && profileEditGrant.current;

  if (profileEditAuthorization.section !== section) {
    setProfileEditAuthorization({ section, isAuthorized: isProfileEditAuthorized });
  }

  useEffect(() => {
    if (section !== 'profile-edit') return;
    if (!isProfileEditAuthorized) {
      router.replace('/mypage/profile');
      return;
    }
    profileEditGrant.current = false;
  }, [isProfileEditAuthorized, router, section]);

  return (
    <MyPageContent
      section={section}
      itemId={itemId}
      preferredClaimType={preferredClaimType}
      isProfileEditAuthorized={isProfileEditAuthorized}
    />
  );
}

function MyPageContent({
  section,
  itemId,
  preferredClaimType,
  isProfileEditAuthorized,
}: {
  section: MyPageSection;
  itemId?: string;
  preferredClaimType?: ClaimType;
  isProfileEditAuthorized: boolean;
}) {
  const addAddressActionRef = useRef<(() => void) | null>(null);
  const { member, status: memberStatus, refreshMember } = useMemberSession();
  const { wishlistIds, recentIds } = useLocalCollections();
  const query = useMyPageData(
    getCollectionProductIds(section, wishlistIds, recentIds),
    section,
    member?.id ?? null,
  );

  if (section === 'profile-edit' && !isProfileEditAuthorized) {
    return <PageLoadingState />;
  }

  const dashboardTop =
    section === 'dashboard' && query.data?.member ? (
      <DashboardSummary
        member={query.data.member}
        coupons={query.data.coupons}
        wishlistCount={wishlistIds.length}
        recentCount={recentIds.length}
      />
    ) : undefined;

  function renderSectionContent(data: MyPageData) {
    if (section === 'wishlist' || section === 'recent') {
      return (
        <ProductCollectionView
          mode={section}
          products={data.products}
          unavailableProductIds={data.unavailableProductIds}
        />
      );
    }

    if (!data.member) {
      return (
        <div role="alert" className="rounded-12 border border-line p-20 text-body-s text-text-2">
          회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      );
    }

    const memberData = { ...data, member: data.member };
    switch (section) {
      case 'dashboard':
        return <DashboardView data={memberData} />;
      case 'orders':
        return <OrdersView orders={data.orders} />;
      case 'order-detail':
        return <OrderDetailView order={data.orders.find((order) => order.id === itemId)} />;
      case 'claims':
        return <ClaimsView claims={data.claims} orders={data.orders} />;
      case 'claim-new':
        return (
          <ClaimFormView
            key={itemId ?? 'claim-form-default'}
            orders={data.orders}
            addresses={data.addresses}
            preferredOrderId={itemId}
            preferredClaimType={preferredClaimType}
            memberId={memberData.member.id}
          />
        );
      case 'coupons':
        return (
          <CouponsView
            coupons={data.coupons}
            offers={data.couponOffers}
            memberId={memberData.member.id}
          />
        );
      case 'points':
        return <PointsView memberBalance={memberData.member.pointBalance} points={data.points} />;
      case 'profile':
        return <ProfileView member={memberData.member} />;
      case 'profile-edit':
        return <ProfileView member={memberData.member} editable />;
      case 'addresses':
        return (
          <AddressesView addresses={data.addresses} addAddressActionRef={addAddressActionRef} />
        );
    }
  }

  return (
    <MyPageShell
      activeSection={section}
      title={SECTION_TITLE[section]}
      dashboardTop={dashboardTop}
      titleAction={
        section === 'addresses' ? (
          <Button
            size="m"
            leadingIcon={<Plus size={18} aria-hidden="true" />}
            className="shrink-0"
            onClick={() => addAddressActionRef.current?.()}
          >
            배송지 추가
          </Button>
        ) : undefined
      }
    >
      {memberStatus === 'loading' ? (
        <PageLoadingState />
      ) : memberStatus === 'error' ? (
        <PageErrorState onRetry={() => void refreshMember()} />
      ) : !member ? (
        <div
          role="status"
          className="rounded-12 border border-line bg-bg-subtle px-20 py-32 text-center"
        >
          <p className="text-body-s text-text-2">로그인 후 회원 정보를 확인할 수 있습니다.</p>
          <Link
            href="/login?redirect=%2Fmypage"
            className="mt-16 inline-flex min-h-44 items-center justify-center rounded-8 bg-text-1 px-16 text-label-m text-inverse focus-ring"
          >
            로그인
          </Link>
        </div>
      ) : query.isPending ? (
        <PageLoadingState />
      ) : query.isError ? (
        <PageErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.loadWarnings.length ? (
            <NoticeInline tone="warning" role="status" className="mb-16">
              <div className="flex flex-wrap items-center justify-between gap-8">
                <span>{query.data.loadWarnings.join(' ')}</span>
                <Button size="s" variant="secondary" onClick={() => void query.refetch()}>
                  다시 불러오기
                </Button>
              </div>
            </NoticeInline>
          ) : null}
          {renderSectionContent(query.data)}
        </>
      )}
    </MyPageShell>
  );
}

const SECTION_TITLE: Record<MyPageSection, string> = {
  dashboard: '마이페이지',
  orders: '주문/배송 조회',
  'order-detail': '주문 상세',
  claims: '취소/반품 내역',
  'claim-new': '취소/반품/교환 신청',
  wishlist: '찜한 상품',
  recent: '최근 본 상품',
  coupons: '쿠폰',
  points: '적립금',
  profile: '내 정보 관리',
  'profile-edit': '내 정보 수정',
  addresses: '배송지 관리',
};
