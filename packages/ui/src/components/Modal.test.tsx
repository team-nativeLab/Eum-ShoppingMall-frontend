import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

// 모달 테스트용 렌더 함수
function renderModal(isOpen: boolean, handleClose = vi.fn()) {
  const renderResult = render(
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="저장하지 않고 나갈까요?"
      description="변경한 내용이 저장되지 않습니다."
      actions={<button type="button">나가기</button>}
    />,
  );
  return { ...renderResult, handleClose };
}

describe('Modal', () => {
  it('열리면 제목·설명이 dialog 이름·설명으로 연결됩니다', () => {
    renderModal(true);
    const dialog = screen.getByRole('dialog', { name: '저장하지 않고 나갈까요?' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription('변경한 내용이 저장되지 않습니다.');
  });

  it('Esc(cancel 이벤트)로 onClose를 부릅니다', () => {
    const { handleClose } = renderModal(true);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('브라우저가 dialog를 닫으면(close 이벤트) onClose를 부릅니다', () => {
    const { handleClose } = renderModal(true);
    fireEvent(screen.getByRole('dialog'), new Event('close'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('isOpen이 false가 되면 닫히고 onClose를 다시 부르지 않습니다', () => {
    const { handleClose, rerender } = renderModal(true);
    rerender(
      <Modal
        isOpen={false}
        onClose={handleClose}
        title="저장하지 않고 나갈까요?"
        actions={<button type="button">나가기</button>}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
  });
});

describe('Modal 닫기 계약', () => {
  it('부모가 닫기를 거부하면(isOpen 유지) 다시 열린 상태로 맞춥니다', () => {
    const refuseClose = vi.fn();
    render(
      <Modal
        isOpen
        onClose={refuseClose}
        title="편집 중"
        actions={<button type="button">확인</button>}
      />,
    );
    const dialog = screen.getByRole<HTMLDialogElement>('dialog', { name: '편집 중' });
    // jsdom에는 dialog.close()가 없어 브라우저가 닫는 동작(open 제거 + close 이벤트)을 직접 재현합니다.
    act(() => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    });
    expect(refuseClose).toHaveBeenCalledTimes(1);
    expect(dialog).toHaveAttribute('open');
  });
});
