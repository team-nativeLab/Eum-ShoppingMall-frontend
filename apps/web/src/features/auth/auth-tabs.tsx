import { cx } from '@eum/ui/lib/cx';
import type { Ref } from 'react';

export type AuthTabValue = 'login' | 'signup';

/**
 * 로그인·회원가입 전환 탭. 선택 박스는 버튼 뒤의 인디케이터를 transform으로만 옮겨서,
 * 모드가 바뀌어도 탭 DOM이 다시 그려지지 않습니다.
 * role="tab"만 씁니다(화살표 키 이동·tabpanel·aria-controls는 아직 구현하지 않음).
 * tabRefs는 본문 링크로 전환한 뒤 해당 탭에 포커스를 옮기려고 호출 쪽이 받습니다.
 */
export function AuthTabs({
  value,
  onChange,
  tabRefs,
}: {
  value: AuthTabValue;
  onChange: (next: AuthTabValue) => void;
  tabRefs?: { login?: Ref<HTMLButtonElement>; signup?: Ref<HTMLButtonElement> };
}) {
  const isSignup = value === 'signup';

  const selectTab = (nextValue: AuthTabValue) => {
    // 이미 선택된 탭을 다시 눌러도 전환을 일으키지 않습니다.
    if (nextValue !== value) onChange(nextValue);
  };

  return (
    // 인디케이터 위치(left 4px, 칸 폭 (W-8)/2)는 열 사이 간격이 0일 때만 맞으므로 그리드에 gap을 주지 않습니다.
    <div
      role="tablist"
      aria-label="계정"
      className="relative grid grid-cols-2 rounded-8 bg-surface p-4"
    >
      {/* 인디케이터는 버튼보다 앞에 둬서 버튼 글자가 위에 보이게 합니다. 칸 폭은 (전체 - 좌우 4px씩) / 2 입니다. */}
      <span
        aria-hidden="true"
        className={cx(
          'absolute top-4 bottom-4 left-4 w-[calc(50%-calc(var(--spacing)*4))] rounded-6 bg-bg transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none',
          isSignup && 'translate-x-full',
        )}
      />
      <button
        ref={tabRefs?.login}
        type="button"
        role="tab"
        aria-selected={!isSignup}
        onClick={() => selectTab('login')}
        className={tabClassName(!isSignup)}
      >
        로그인
      </button>
      <button
        ref={tabRefs?.signup}
        type="button"
        role="tab"
        aria-selected={isSignup}
        onClick={() => selectTab('signup')}
        className={tabClassName(isSignup)}
      >
        회원가입
      </button>
    </div>
  );
}

function tabClassName(isSelected: boolean) {
  return cx(
    'relative z-10 rounded-6 px-12 py-8 text-label-m focus-ring transition-colors',
    isSelected ? 'text-text-1' : 'text-text-2',
  );
}
