'use client';

import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { TextField } from '@eum/ui/components/TextField';
import { useState, type FormEvent } from 'react';

export function PasswordChangeDemoModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmationError, setConfirmationError] = useState('');

  function closeModal() {
    setNewPassword('');
    setConfirmation('');
    setMessage('');
    setNewPasswordError('');
    setConfirmationError('');
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextNewPasswordError =
      newPassword.length < 8 ? '새 비밀번호는 8자 이상 입력해 주세요.' : '';
    const nextConfirmationError =
      newPassword !== confirmation ? '새 비밀번호와 확인 내용이 일치하지 않습니다.' : '';
    setNewPasswordError(nextNewPasswordError);
    setConfirmationError(nextConfirmationError);
    if (nextNewPasswordError || nextConfirmationError) return;

    setNewPassword('');
    setConfirmation('');
    setMessage('데모 입력을 확인했습니다. 실제 인증이나 비밀번호 변경은 진행되지 않았습니다.');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="비밀번호 변경"
      description="데모 화면입니다. 입력한 비밀번호는 저장하지 않으며 실제 변경은 진행되지 않습니다."
      actions={
        message ? (
          <Button onClick={closeModal}>확인</Button>
        ) : (
          <Button type="submit" form="password-change-demo-form">
            데모 확인
          </Button>
        )
      }
    >
      {message ? (
        <p role="status" className="mt-20 rounded-8 bg-info-tint p-12 text-body-s text-info">
          {message}
        </p>
      ) : (
        <form id="password-change-demo-form" onSubmit={handleSubmit} className="mt-20 space-y-12">
          <TextField
            label="새 비밀번호"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setNewPasswordError('');
              setConfirmationError('');
            }}
            errorMessage={newPasswordError || undefined}
            helperText={!newPasswordError ? '8자 이상 입력해 주세요.' : undefined}
            required
          />
          <TextField
            label="새 비밀번호 확인"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setConfirmationError('');
            }}
            errorMessage={confirmationError || undefined}
            required
          />
        </form>
      )}
    </Modal>
  );
}
