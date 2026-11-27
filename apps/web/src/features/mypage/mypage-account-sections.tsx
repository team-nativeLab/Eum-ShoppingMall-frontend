'use client';
import type { Address } from '@eum/api/types';
import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Modal } from '@eum/ui/components/Modal';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { TextField } from '@eum/ui/components/TextField';
import { ChevronDown, LockKeyhole, MapPin, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getWebApiConfig } from '@/lib/api-config';
import { type MyPageData } from './mypage-data';
import { profileEditGrant } from './mypage-profile-edit-grant';
import { shouldShowPresentationRows } from './mypage-utils';
import { DividerTitle, NoticeResult, type LocalNotice } from './mypage-ui';
import { PasswordChangeDemoModal } from './password-change-demo-modal';
import { ADDRESS_LAYOUT_SAMPLE_KEYS, ADDRESS_LAYOUT_SAMPLE } from './mypage-presentation-fixtures';

export function ProfileView({
  member,
  editable = false,
}: {
  member: NonNullable<MyPageData['member']>;
  editable?: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [notice, setNotice] = useState<LocalNotice>(null);
  if (!editable)
    return (
      <div className="mx-auto max-w-480 rounded-12 border border-line p-20 lg:p-40">
        <div className="mx-auto flex size-48 items-center justify-center rounded-capsule bg-surface">
          <LockKeyhole size={24} aria-hidden="true" />
        </div>
        <h2 className="mt-12 text-center text-h3">비밀번호를 다시 입력해 주세요</h2>
        <p className="mt-8 text-center text-body-s text-text-2">
          데모 화면 확인 단계입니다. 실제 본인 확인은 진행되지 않습니다.
        </p>
        <form
          className="mt-24 space-y-16"
          onSubmit={(event) => {
            event.preventDefault();
            if (!password.trim()) {
              setReauthError('비밀번호를 입력해 주세요.');
              return;
            }
            setPassword('');
            setReauthError('');
            profileEditGrant.current = true;
            router.push('/mypage/profile/edit');
          }}
        >
          <TextField label="이메일" type="email" value={member.email} disabled />
          <TextField
            label="비밀번호"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          <Button type="submit" isFullWidth>
            확인
          </Button>
          {reauthError ? (
            <p role="status" className="text-body-s text-text-2">
              {reauthError}
            </p>
          ) : null}
        </form>
        {!reauthError ? (
          <p className="mt-16 text-center text-caption text-text-3">
            이 화면에서는 실제 계정 인증을 하지 않습니다.
          </p>
        ) : null}
      </div>
    );
  return (
    <div className="space-y-24">
      <p className="rounded-8 bg-info-tint p-12 text-body-s text-info">
        데모 화면입니다. 입력한 변경 내용은 현재 화면에만 반영되며 서버에는 저장되지 않습니다.
      </p>
      <section>
        <DividerTitle>기본 정보</DividerTitle>
        <ProfileRow label="이메일">
          <TextField label="이메일" isLabelHidden type="email" value={member.email} disabled />
        </ProfileRow>
        <ProfileRow label="이름">
          <TextField
            label="이름"
            isLabelHidden
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </ProfileRow>
        <ProfileRow label="휴대폰 번호">
          <div className="flex gap-8">
            <TextField
              label="휴대폰 번호"
              isLabelHidden
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Button variant="secondary" onClick={() => setIsPhoneModalOpen(true)}>
              변경
            </Button>
          </div>
        </ProfileRow>
        <ProfileRow label="비밀번호">
          <Button variant="secondary" onClick={() => setIsPasswordModalOpen(true)}>
            비밀번호 변경
          </Button>
        </ProfileRow>
      </section>
      <section>
        <DividerTitle>수신 동의</DividerTitle>
        <div className="flex flex-wrap items-center gap-16 border-b border-line py-14">
          <span className="w-112 shrink-0 text-label-s">마케팅 정보</span>
          <Checkbox checked={smsOptIn} onChange={(event) => setSmsOptIn(event.target.checked)}>
            SMS 수신 동의
          </Checkbox>
          <Checkbox checked={emailOptIn} onChange={(event) => setEmailOptIn(event.target.checked)}>
            이메일 수신 동의
          </Checkbox>
        </div>
        <p className="mt-4 text-caption text-text-3">
          주문·배송 알림은 수신 동의와 관계없이 발송됩니다.
        </p>
      </section>
      <div className="flex flex-wrap justify-center gap-8">
        <Button variant="secondary" size="l" onClick={() => router.push('/mypage/profile')}>
          취소
        </Button>
        <Button
          size="l"
          onClick={() =>
            setNotice({
              tone: 'info',
              message: '변경 내용은 현재 화면에만 반영되며 서버에는 저장되지 않습니다.',
            })
          }
        >
          저장
        </Button>
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="s" onClick={() => router.push('/mypage/withdrawal')}>
          회원 탈퇴
        </Button>
      </div>
      <NoticeResult notice={notice} />
      <PasswordChangeDemoModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
      <PhoneChangeDemoModal isOpen={isPhoneModalOpen} onClose={() => setIsPhoneModalOpen(false)} />
    </div>
  );
}

function PhoneChangeDemoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [phoneInput, setPhoneInput] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function closeModal() {
    setPhoneInput('');
    setMessage('');
    setError('');
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      setError('휴대폰 번호 형식을 확인해 주세요.');
      return;
    }
    setPhoneInput('');
    setError('');
    setMessage('데모 입력을 확인했습니다. 실제 문자 인증이나 번호 변경은 진행되지 않았습니다.');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="휴대폰 번호 변경"
      description="데모 전용 화면입니다. 실제 문자를 보내거나 번호를 인증·변경하지 않습니다."
      actions={
        message ? (
          <Button onClick={closeModal}>확인</Button>
        ) : (
          <Button type="submit" form="phone-change-demo-form">
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
        <form id="phone-change-demo-form" onSubmit={handleSubmit} className="mt-20 space-y-12">
          <TextField
            label="새 휴대폰 번호"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phoneInput}
            onChange={(event) => setPhoneInput(event.target.value)}
            errorMessage={error || undefined}
            required
          />
        </form>
      )}
    </Modal>
  );
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-8 border-b border-line-strong py-20 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center lg:grid-cols-[150px_minmax(0,1fr)]">
      <h3 className="text-label-m">{label}</h3>
      <div className="max-w-420 min-w-0">{children}</div>
    </div>
  );
}

interface LocalAddress extends Address {
  deliveryNote: string;
}

interface AddressFormState {
  label: string;
  recipientName: string;
  phone: string;
  postalCode: string;
  address1: string;
  address2: string;
  deliveryNote: string;
  isDefault: boolean;
}

const EMPTY_ADDRESS_FORM: AddressFormState = {
  label: '',
  recipientName: '',
  phone: '',
  postalCode: '',
  address1: '',
  address2: '',
  deliveryNote: '',
  isDefault: false,
};

export function AddressesView({
  addresses: initialAddresses,
  addAddressActionRef,
}: {
  addresses: Address[];
  addAddressActionRef: { current: (() => void) | null };
}) {
  const [addresses, setAddresses] = useState<LocalAddress[]>(() =>
    initialAddresses.map((address) => ({ ...address, deliveryNote: '' })),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormState>(EMPTY_ADDRESS_FORM);
  const [pendingDelete, setPendingDelete] = useState<LocalAddress | null>(null);
  const [notice, setNotice] = useState<LocalNotice>(null);
  const isPresentationMode = shouldShowPresentationRows(getWebApiConfig().mode);
  const openNew = useCallback(() => {
    if (addresses.length >= 7) {
      setNotice({ tone: 'warning', message: '배송지는 최대 7개까지 등록할 수 있습니다.' });
      return;
    }
    setEditingAddressId(null);
    setForm(EMPTY_ADDRESS_FORM);
    setIsModalOpen(true);
  }, [addresses.length]);
  useEffect(() => {
    addAddressActionRef.current = openNew;
    return () => {
      if (addAddressActionRef.current === openNew) addAddressActionRef.current = null;
    };
  }, [addAddressActionRef, openNew]);
  const openEdit = (address: LocalAddress) => {
    setEditingAddressId(address.id);
    setForm({ ...address, isDefault: address.isDefault });
    setIsModalOpen(true);
  };
  const save = () => {
    if (
      !form.label.trim() ||
      !form.recipientName.trim() ||
      !form.phone.trim() ||
      !form.postalCode.trim() ||
      !form.address1.trim()
    )
      return;
    setAddresses((previous) => {
      const normalized = form.isDefault
        ? previous.map((address) => ({ ...address, isDefault: false }))
        : previous;
      const next: LocalAddress = {
        id: editingAddressId ?? `local-${Date.now()}`,
        label: form.label.trim(),
        recipientName: form.recipientName.trim(),
        phone: form.phone.trim(),
        postalCode: form.postalCode.trim(),
        address1: form.address1.trim(),
        address2: form.address2.trim(),
        deliveryNote: form.deliveryNote,
        isDefault: form.isDefault || normalized.length === 0,
      };
      return editingAddressId
        ? normalized.map((address) => (address.id === editingAddressId ? next : address))
        : [...normalized, next];
    });
    setNotice({
      tone: 'info',
      message: '배송지 변경은 현재 화면에만 반영되며 서버에는 저장되지 않습니다.',
    });
    setIsModalOpen(false);
  };
  const remove = () => {
    if (!pendingDelete || pendingDelete.isDefault) return;
    setAddresses((previous) => previous.filter((address) => address.id !== pendingDelete.id));
    setPendingDelete(null);
    setNotice({
      tone: 'info',
      message: '배송지 삭제는 현재 화면에만 반영되며 서버에는 저장되지 않습니다.',
    });
  };
  const updateForm = (key: keyof AddressFormState, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const isFormReady = Boolean(
    form.label.trim() &&
    form.recipientName.trim() &&
    form.phone.trim() &&
    form.postalCode.trim() &&
    form.address1.trim(),
  );
  const addressRows = [
    ...addresses.map((address) => ({ kind: 'address' as const, address })),
    ...(isPresentationMode
      ? ADDRESS_LAYOUT_SAMPLE_KEYS.map((key) => ({ kind: 'sample' as const, key }))
      : []),
  ];
  return (
    <div>
      {!addresses.length ? (
        <EmptyState
          icon={MapPin}
          title="등록된 배송지가 없습니다."
          description="배송지를 추가하면 주문 시 빠르게 선택할 수 있습니다."
        />
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(220px,2fr)_minmax(120px,1fr)_112px] gap-12 border-y border-line bg-surface px-16 py-12 text-label-s text-text-2 lg:grid">
            <span>배송지명</span>
            <span>받는 분</span>
            <span>주소</span>
            <span>연락처</span>
            <span className="text-center">관리</span>
          </div>
          <ul className="divide-y divide-line">
            {addressRows.map((row) =>
              row.kind === 'address' ? (
                <li
                  key={row.address.id}
                  className="grid gap-10 py-16 lg:grid-cols-[minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(220px,2fr)_minmax(120px,1fr)_112px] lg:items-center lg:px-16"
                >
                  <div className="flex flex-wrap items-center gap-8">
                    <span className="text-label-m">{row.address.label}</span>
                    {row.address.isDefault ? <Badge tone="dark">기본 배송지</Badge> : null}
                  </div>
                  <p className="text-body-s">{row.address.recipientName}</p>
                  <p className="text-body-s">
                    {row.address.postalCode} {row.address.address1} {row.address.address2}
                  </p>
                  <p className="text-body-s">{row.address.phone}</p>
                  <div className="flex flex-wrap gap-8 lg:justify-center">
                    <Button size="s" variant="secondary" onClick={() => openEdit(row.address)}>
                      수정
                    </Button>
                    {!row.address.isDefault ? (
                      <Button
                        size="s"
                        variant="secondary"
                        onClick={() => setPendingDelete(row.address)}
                      >
                        삭제
                      </Button>
                    ) : null}
                  </div>
                </li>
              ) : (
                <li
                  key={row.key}
                  className="grid gap-10 py-16 text-text-2 lg:grid-cols-[minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(220px,2fr)_minmax(120px,1fr)_112px] lg:items-center lg:px-16"
                >
                  <span className="text-label-m">{ADDRESS_LAYOUT_SAMPLE.label}</span>
                  <p className="text-body-s">{ADDRESS_LAYOUT_SAMPLE.recipientName}</p>
                  <p className="text-body-s">{ADDRESS_LAYOUT_SAMPLE.postalAddress}</p>
                  <p className="text-body-s">{ADDRESS_LAYOUT_SAMPLE.phone}</p>
                  <div className="flex flex-wrap gap-8 lg:justify-center">
                    <Button size="s" variant="secondary" disabled>
                      수정
                    </Button>
                    <Button size="s" variant="secondary" disabled>
                      삭제
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        </>
      )}
      <p className="mt-12 text-caption text-text-3">
        배송지와 요청사항 변경은 현재 화면에만 임시 보관됩니다. 배송지는 최대 7개까지 등록할 수
        있으며, 기본 배송지는 삭제할 수 없습니다.
      </p>
      {addresses.length >= 7 ? (
        <NoticeInline className="mt-8" tone="warning">
          새 배송지를 등록하려면 기존 배송지를 삭제해 주세요.
        </NoticeInline>
      ) : null}
      <NoticeResult notice={notice} />
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddressId ? '배송지 수정' : '배송지 추가'}
        className="relative max-w-640"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              취소
            </Button>
            <Button onClick={save} disabled={!isFormReady}>
              저장
            </Button>
          </>
        }
      >
        <button
          type="button"
          aria-label="배송지 모달 닫기"
          onClick={() => setIsModalOpen(false)}
          className="absolute top-20 right-20 rounded-4 p-4 text-text-2 focus-ring hover:text-text-1"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="mt-20 grid gap-12 sm:grid-cols-2">
          <TextField
            label="배송지명"
            name="label"
            value={form.label}
            placeholder="예: 본사, 현장"
            onChange={(event) => updateForm('label', event.target.value)}
          />
          <TextField
            label="받는 분"
            name="recipientName"
            value={form.recipientName}
            onChange={(event) => updateForm('recipientName', event.target.value)}
          />
          <TextField
            label="휴대폰 번호"
            name="phone"
            value={form.phone}
            onChange={(event) => updateForm('phone', event.target.value)}
            className="sm:col-span-2"
          />
          <div className="flex items-end gap-8 sm:col-span-2">
            <TextField
              label="우편번호"
              name="postalCode"
              value={form.postalCode}
              onChange={(event) => updateForm('postalCode', event.target.value)}
            />
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() =>
                setNotice({
                  tone: 'info',
                  message: '주소 검색은 연결되어 있지 않습니다. 주소를 직접 입력해 주세요.',
                })
              }
            >
              주소 검색
            </Button>
          </div>
          <TextField
            label="주소"
            name="address1"
            value={form.address1}
            onChange={(event) => updateForm('address1', event.target.value)}
            className="sm:col-span-2"
          />
          <TextField
            label="상세 주소"
            name="address2"
            value={form.address2}
            onChange={(event) => updateForm('address2', event.target.value)}
            className="sm:col-span-2"
          />
          <label className="rounded-8 focus-within:ring-1 focus-within:ring-text-1 sm:col-span-2">
            <span className="mb-8 block text-label-m">배송 요청사항</span>
            <div className="relative w-full">
              <select
                value={form.deliveryNote}
                onChange={(event) => updateForm('deliveryNote', event.target.value)}
                className="h-48 w-full appearance-none rounded-8 border border-line-strong bg-bg pr-40 pl-14 text-body-m focus-ring"
              >
                <option value="">선택해 주세요</option>
                <option value="배송 전 연락 바랍니다">배송 전 연락 바랍니다</option>
                <option value="문 앞에 놓아 주세요">문 앞에 놓아 주세요</option>
              </select>
              <ChevronDown
                size={20}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
              />
            </div>
          </label>
          <Checkbox
            checked={form.isDefault}
            onChange={(event) => updateForm('isDefault', event.target.checked)}
            className="sm:col-span-2"
          >
            기본 배송지로 설정
          </Checkbox>
        </div>
      </Modal>
      <Modal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="배송지를 삭제하시겠습니까?"
        tone="danger"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              취소
            </Button>
            <Button variant="danger" onClick={remove}>
              삭제
            </Button>
          </>
        }
      >
        {pendingDelete ? (
          <p className="mt-12 text-body-s text-text-2">
            {pendingDelete.label} · {pendingDelete.address1}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
