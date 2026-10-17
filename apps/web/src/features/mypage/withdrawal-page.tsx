'use client';

import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { PageContainer } from '@/components/page-container';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMemberSession } from '@/features/auth/member-session';
import { MyPageShell } from './mypage-shell';

const WITHDRAWAL_REASONS = [
  '서비스 이용이 불편함',
  '필요한 상품이 없음',
  '구매 빈도가 낮음',
  '기타',
] as const;

export function WithdrawalPage() {
  const router = useRouter();
  const { member, status: memberStatus, refreshMember, clearMember } = useMemberSession();
  const [reason, setReason] = useState<(typeof WITHDRAWAL_REASONS)[number] | ''>('');
  const [detail, setDetail] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  function handleReasonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) {
      setError('탈퇴 사유를 선택해 주세요.');
      return;
    }
    setError('');
    setStep(2);
  }

  async function completeDemo() {
    setIsConfirmOpen(false);
    setReason('');
    setDetail('');
    try {
      await clearMember();
    } catch {
      // 세션 컨텍스트는 실패 시에도 회원 상태·캐시를 정리하므로 데모 로그아웃을 계속합니다.
    } finally {
      router.replace('/login');
    }
  }

  return (
    <MyPageShell activeSection="profile" title="회원 탈퇴">
      {memberStatus === 'loading' ? (
        <p role="status" className="py-56 text-center text-body-s text-text-3">
          회원 정보를 확인하는 중입니다.
        </p>
      ) : null}
      {memberStatus === 'error' ? (
        <section className="py-40 text-center">
          <p role="alert" className="text-body-s">
            회원 정보를 확인하지 못했습니다.
          </p>
          <Button
            className="mt-12"
            variant="secondary"
            size="s"
            onClick={() => void refreshMember()}
          >
            다시 시도
          </Button>
        </section>
      ) : null}
      {memberStatus === 'ready' && !member ? (
        <section className="py-40 text-center">
          <p className="text-body-s text-text-2">로그인 후 회원 탈퇴 안내를 확인할 수 있습니다.</p>
          <Link
            href="/login?redirect=%2Fmypage%2Fwithdrawal"
            className="mt-16 inline-flex min-h-44 items-center rounded-8 bg-text-1 px-16 text-label-m text-inverse focus-ring"
          >
            로그인
          </Link>
        </section>
      ) : null}
      {memberStatus === 'ready' && member ? (
        <PageContainer className="px-0">
          {step === 1 || step === 2 ? (
            <header className="mb-24">
              <p className="text-caption text-text-3">회원 정보</p>
              <h1 className="mt-8 text-h1">회원 탈퇴</h1>
              <p className="mt-8 text-body-s text-text-2">
                현재는 화면 흐름 확인을 위한 목 데모입니다.
              </p>
            </header>
          ) : null}
          <NoticeInline tone="warning" className="mb-20">
            실제 회원 탈퇴나 계정 삭제는 진행되지 않습니다. 데모 완료 시 목 로그인 세션만
            종료합니다. 입력한 사유는 저장하지 않습니다.
          </NoticeInline>
          {step === 1 ? (
            <form onSubmit={handleReasonSubmit} className="space-y-20">
              <fieldset className="space-y-12">
                <legend className="text-h3">탈퇴 사유를 선택해 주세요.</legend>
                {WITHDRAWAL_REASONS.map((item) => (
                  <label
                    key={item}
                    className="flex min-h-48 cursor-pointer items-center gap-12 rounded-8 border border-line px-16 focus-within:ring-2 focus-within:ring-text-1"
                  >
                    <input
                      type="radio"
                      name="withdrawal-reason"
                      value={item}
                      checked={reason === item}
                      onChange={() => setReason(item)}
                      className="size-16 accent-text-1"
                    />
                    <span className="text-body-s">{item}</span>
                  </label>
                ))}
              </fieldset>
              {reason === '기타' ? (
                <label className="block text-body-s">
                  상세 사유 (선택)
                  <textarea
                    value={detail}
                    onChange={(event) => setDetail(event.target.value)}
                    maxLength={300}
                    rows={4}
                    className="mt-8 w-full rounded-8 border border-line-strong p-12 focus-ring"
                  />
                </label>
              ) : null}
              {error ? (
                <p role="alert" className="text-body-s text-danger">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-center gap-8">
                <Link
                  href="/mypage/profile"
                  className="inline-flex min-h-48 items-center rounded-8 border border-line-strong px-20 text-label-m focus-ring"
                >
                  취소
                </Link>
                <Button type="submit" size="l">
                  다음
                </Button>
              </div>
            </form>
          ) : null}
          {step === 2 ? (
            <section
              className="rounded-12 border border-line p-20 lg:p-32"
              aria-labelledby="withdrawal-review-heading"
            >
              <h2 id="withdrawal-review-heading" className="text-h3">
                탈퇴 안내를 확인해 주세요.
              </h2>
              <ul className="mt-16 list-disc space-y-8 pl-20 text-body-s text-text-2">
                <li>실제 서비스에서는 보유 혜택과 주문 진행 상태를 확인해야 합니다.</li>
                <li>회원 계정과 데이터는 삭제되지 않고, 데모 완료 시 목 세션만 종료합니다.</li>
                <li>아래 확인 버튼은 목 세션을 종료한 뒤 로그인 화면으로 이동합니다.</li>
              </ul>
              <div className="mt-20 rounded-8 bg-surface p-16 text-body-s">
                <span className="text-text-3">선택 사유</span>
                <p className="mt-4">
                  {reason}
                  {reason === '기타' && detail ? ` · ${detail}` : ''}
                </p>
              </div>
              <div className="mt-24 flex flex-wrap justify-center gap-8">
                <Button variant="secondary" size="l" onClick={() => setStep(1)}>
                  이전
                </Button>
                <Button size="l" variant="danger" onClick={() => setIsConfirmOpen(true)}>
                  데모 탈퇴 흐름 확인
                </Button>
              </div>
            </section>
          ) : null}
          <Modal
            isOpen={isConfirmOpen}
            onClose={() => setIsConfirmOpen(false)}
            tone="danger"
            title="데모 흐름을 완료할까요?"
            description="실제 회원 탈퇴나 계정 삭제는 진행되지 않습니다. 목 세션을 종료하고 로그인 화면으로 이동합니다."
            actions={
              <>
                <Button variant="secondary" onClick={() => setIsConfirmOpen(false)}>
                  취소
                </Button>
                <Button variant="danger" onClick={() => void completeDemo()}>
                  확인
                </Button>
              </>
            }
          />
        </PageContainer>
      ) : null}
    </MyPageShell>
  );
}
