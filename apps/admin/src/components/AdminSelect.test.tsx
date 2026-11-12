import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AdminSelect } from './AdminUI';

function ControlledStatusSelect({ onChange }: { onChange: (nextStatus: string) => void }) {
  const [status, setStatus] = useState('active');

  return (
    <label>
      진행 상태
      <AdminSelect
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
          onChange(event.target.value);
        }}
      >
        <option value="active">진행중</option>
        <option value="ended">종료</option>
      </AdminSelect>
    </label>
  );
}

describe('AdminSelect', () => {
  it('select 속성을 그대로 전달하고 label·combobox 역할로 조회된다', () => {
    render(
      <>
        <label htmlFor="status-select">처리 상태</label>
        <AdminSelect
          id="status-select"
          name="status"
          defaultValue="ended"
          aria-describedby="status-help"
        >
          <option value="active">진행중</option>
          <option value="ended">종료</option>
        </AdminSelect>
      </>,
    );

    const statusSelect = screen.getByLabelText('처리 상태');
    expect(statusSelect).toBe(screen.getByRole('combobox', { name: '처리 상태' }));
    expect(statusSelect).toHaveAttribute('name', 'status');
    expect(statusSelect).toHaveAttribute('aria-describedby', 'status-help');
    expect(statusSelect).toHaveValue('ended');
  });

  it('aria-label로도 조회되고 감싼 label과 암묵 연결된다', () => {
    render(
      <>
        <label>
          상위 카테고리
          <AdminSelect aria-label="상위 카테고리 선택">
            <option value="">최상위 카테고리</option>
          </AdminSelect>
        </label>
        <label>
          취소 사유
          <AdminSelect>
            <option value="">사유를 선택해 주세요</option>
          </AdminSelect>
        </label>
      </>,
    );

    expect(screen.getByLabelText('상위 카테고리 선택')).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText(/취소 사유/)).toBeInstanceOf(HTMLSelectElement);
  });

  it('wrapperClassName은 래퍼에, className은 select에 적용한다', () => {
    render(
      <AdminSelect
        aria-label="카테고리 필터"
        wrapperClassName="w-160"
        className="h-40 rounded-8 px-12"
      >
        <option value="">카테고리 전체</option>
      </AdminSelect>,
    );

    const categorySelect = screen.getByRole('combobox', { name: '카테고리 필터' });
    const selectWrapper = categorySelect.parentElement;
    expect(selectWrapper).toHaveClass('relative', 'inline-block', 'w-160');
    expect(selectWrapper).not.toHaveClass('h-40');
    expect(categorySelect).toHaveClass('w-full', 'appearance-none', 'pr-32', 'h-40', 'px-12');
    expect(categorySelect).not.toHaveClass('w-160');
  });

  it('제어 컴포넌트에서 selectOptions로 값을 바꾸면 onChange가 호출된다', async () => {
    const handleStatusChange = vi.fn();
    render(<ControlledStatusSelect onChange={handleStatusChange} />);

    const statusSelect = screen.getByLabelText('진행 상태');
    await userEvent.selectOptions(statusSelect, '종료');

    expect(handleStatusChange).toHaveBeenCalledWith('ended');
    expect(statusSelect).toHaveValue('ended');
  });

  it('비활성 상태는 선택을 막고 화살표를 흐리게 표시한다', async () => {
    render(
      <AdminSelect aria-label="견적 유형" disabled>
        <option>유형 정보 없음</option>
      </AdminSelect>,
    );

    const typeSelect = screen.getByRole('combobox', { name: '견적 유형' });
    expect(typeSelect).toBeDisabled();
    expect(typeSelect.parentElement?.querySelector('svg')).toHaveClass('text-text-disabled');
  });

  it('활성 상태의 화살표는 장식용이며 클릭을 가로채지 않고 웹 드롭다운과 같은 12px 간격으로 띄운다', () => {
    render(
      <AdminSelect aria-label="정렬 기준">
        <option value="recent">최근 주문순</option>
      </AdminSelect>,
    );

    const sortSelect = screen.getByRole('combobox', { name: '정렬 기준' });
    const arrowIcon = sortSelect.parentElement?.querySelector('svg');
    expect(arrowIcon).toHaveAttribute('aria-hidden', 'true');
    expect(arrowIcon).toHaveClass('pointer-events-none', 'right-12', 'text-text-1');
    expect(arrowIcon).not.toHaveClass('text-text-disabled');
  });
});
