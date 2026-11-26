import type { ReactNode, Ref } from 'react';
import { PageContainer } from '@/components/page-container';
import { AuthTabs, type AuthTabValue } from './auth-tabs';

/**
 * 로그인·회원가입 공용 프레임: 제목·부제, 선택적 탭, 본문 슬롯 순서입니다.
 * 탭이 있는 화면에서는 모드가 바뀌어도 이 프레임과 탭 DOM을 그대로 두고 제목·본문만 바꿉니다.
 * 세로 간격은 두 화면 모두 gap-24로 고정합니다(회원가입 기존 값과 같고, 로그인도 같은 값에 맞춤).
 */
export function AuthFrame({
  title,
  description,
  tab,
  children,
}: {
  title: string;
  description: string;
  tab?: {
    value: AuthTabValue;
    onChange: (next: AuthTabValue) => void;
    tabRefs?: { login?: Ref<HTMLButtonElement>; signup?: Ref<HTMLButtonElement> };
  };
  children: ReactNode;
}) {
  return (
    <PageContainer className="py-40 lg:pt-96 lg:pb-120">
      <section className="mx-auto flex w-full max-w-480 flex-col gap-24">
        <header className="flex flex-col items-start gap-8">
          <h1 className="text-h1">{title}</h1>
          <p className="text-body-s text-text-2">{description}</p>
        </header>
        {tab ? <AuthTabs value={tab.value} onChange={tab.onChange} tabRefs={tab.tabRefs} /> : null}
        {children}
      </section>
    </PageContainer>
  );
}
