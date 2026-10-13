'use client';

import { CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

export interface ModalProps {
  isOpen: boolean;
  /**
   * Esc·닫기 동작에서 부릅니다.
   * 확인 모달이라 배경 클릭으로는 닫지 않습니다(실수로 닫히는 것 방지, 키보드 동등 동작은 Esc).
   */
  onClose: () => void;
  title: string;
  description?: ReactNode;
  /** 위험 동작 확인(Figma Type=Danger: 제목 앞 경고 아이콘) */
  tone?: 'confirm' | 'danger';
  /** 하단 버튼 영역(오른쪽 정렬) */
  actions: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * 확인 모달(Figma HF/Admin/Modal, w440 · p24 · r12 · sh-3).
 * 네이티브 <dialog>의 showModal()을 써서 포커스 가두기·Esc 닫기·배경 비활성화를 브라우저에 맡깁니다.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  tone = 'confirm',
  actions,
  children,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // 브라우저가 dialog를 닫은 횟수. 부모가 닫기를 거부(isOpen 유지)하면 effect가 다시 열도록 의존성으로 씁니다.
  const [browserCloseCount, setBrowserCloseCount] = useState(0);

  // isOpen 값을 실제 dialog 열림 상태와 맞추는 effect(외부 DOM API 동기화)
  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) return;
    if (isOpen && !dialogElement.open) {
      if (typeof dialogElement.showModal === 'function') {
        dialogElement.showModal();
      } else {
        dialogElement.setAttribute('open', '');
      }
    } else if (!isOpen && dialogElement.open) {
      if (typeof dialogElement.close === 'function') {
        dialogElement.close();
      } else {
        dialogElement.removeAttribute('open');
      }
    }
  }, [isOpen, browserCloseCount]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => {
        // 닫기 계약: dialog는 항상 isOpen을 따릅니다.
        // - form method="dialog" 제출 등 브라우저가 직접 닫으면 onClose로 부모에게 알립니다.
        // - 부모가 isOpen을 false로 바꾸면 그대로 닫히고, 바꾸지 않으면(닫기 거부) effect가 다시 엽니다.
        // - isOpen=false로 effect가 닫은 경우에는 onClose를 부르지 않습니다.
        if (!isOpen) return;
        onClose();
        setBrowserCloseCount((previousCount) => previousCount + 1);
      }}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault();
        onClose();
      }}
      className={cx(
        'm-auto w-[calc(100%-32px)] max-w-440 rounded-12 bg-bg p-24 text-text-1 shadow-3 backdrop:bg-dim',
        className,
      )}
    >
      <div className="flex items-center gap-8">
        {tone === 'danger' ? (
          <Icon icon={CircleAlert} size={20} className="shrink-0 text-danger" />
        ) : null}
        <h2 id={titleId} className="text-h3">
          {title}
        </h2>
      </div>
      {description ? (
        <div id={descriptionId} className="mt-8 text-body-m text-text-2">
          {description}
        </div>
      ) : null}
      {children}
      <div className="mt-24 flex items-center justify-end gap-8">{actions}</div>
    </dialog>
  );
}
