import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { queryKeys } from '@eum/api/query-keys';
import type { AdminSupplierInput } from '@eum/api/shop-api';
import type { AdminSupplier, SupplierOrderChannel } from '@eum/api/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';

const supplierQueryKey = queryKeys.suppliers.adminList;
const emptyDraft: AdminSupplierInput = {
  companyName: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  orderChannel: 'email',
  orderEmail: '',
  orderFax: null,
  address: '',
  memo: '',
};

export function AdminSuppliersPage() {
  const queryClient = useQueryClient();
  const suppliersQuery = useQuery({
    queryKey: supplierQueryKey,
    queryFn: async ({ signal }) => (await getShopApi()).suppliers.adminList({ signal }),
  });
  const [createDraft, setCreateDraft] = useState<AdminSupplierInput>(emptyDraft);
  const [editDraft, setEditDraft] = useState<AdminSupplierInput | null>(null);
  const [message, setMessage] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (suppliersQuery.isPending) return <AdminLoading label="발주처를 불러오고 있습니다." />;
  if (suppliersQuery.isError)
    return (
      <AdminError
        title="발주처를 불러오지 못했습니다"
        onRetry={() => void suppliersQuery.refetch()}
      />
    );

  const suppliers = suppliersQuery.data;
  const updateCreateDraft = (field: keyof AdminSupplierInput, value: string) =>
    setCreateDraft((current) => ({ ...current, [field]: value }));
  const updateEditDraft = (field: keyof AdminSupplierInput, value: string) =>
    setEditDraft((current) => (current ? { ...current, [field]: value } : current));
  const closeEditModal = () => {
    if (isUpdating) return;
    setEditDraft(null);
    setEditMessage('');
  };
  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    setMessage('');
    try {
      await (await getShopApi()).suppliers.saveAdmin(createDraft);
      setCreateDraft(emptyDraft);
      await queryClient.invalidateQueries({ queryKey: supplierQueryKey });
      setMessage('발주처 정보를 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '발주처 정보를 저장하지 못했습니다.');
    } finally {
      setIsCreating(false);
    }
  };
  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editDraft || isUpdating) return;
    setIsUpdating(true);
    setEditMessage('');
    try {
      await (await getShopApi()).suppliers.saveAdmin(editDraft);
      await queryClient.invalidateQueries({ queryKey: supplierQueryKey });
      setEditDraft(null);
      setMessage('발주처 정보를 수정했습니다.');
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : '발주처 정보를 수정하지 못했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };
  const edit = (supplier: AdminSupplier) => {
    setMessage('');
    setEditMessage('');
    setEditDraft({ ...supplier });
  };
  const remove = async (supplier: AdminSupplier) => {
    setMessage('');
    try {
      await (await getShopApi()).suppliers.deleteAdmin(supplier.id);
      await queryClient.invalidateQueries({ queryKey: supplierQueryKey });
      setMessage('발주처를 삭제했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '발주처를 삭제하지 못했습니다.');
    }
  };
  const field = (
    draft: AdminSupplierInput,
    updateDraft: (field: keyof AdminSupplierInput, value: string) => void,
    label: string,
    key: keyof AdminSupplierInput,
    type = 'text',
    required = false,
    disabled = false,
  ) => (
    <label className="grid gap-4 text-label-s" key={key}>
      {label}
      <input
        type={type}
        required={required}
        disabled={disabled}
        value={String(draft[key] ?? '')}
        onChange={(event) => updateDraft(key, event.target.value)}
        className="h-40 w-full rounded-6 border border-line-control px-12"
      />
    </label>
  );
  const renderSupplierFields = (
    draft: AdminSupplierInput,
    updateDraft: (field: keyof AdminSupplierInput, value: string) => void,
    disabled = false,
  ) => (
    <div className="grid gap-12 md:grid-cols-2">
      {field(draft, updateDraft, '회사명', 'companyName', 'text', true, disabled)}
      {field(draft, updateDraft, '담당자 이름', 'contactName', 'text', true, disabled)}
      {field(draft, updateDraft, '담당자 전화번호', 'contactPhone', 'tel', true, disabled)}
      {field(draft, updateDraft, '담당자 이메일', 'contactEmail', 'email', true, disabled)}
      <label className="grid gap-4 text-label-s">
        주문 정보 수신 방식
        <div className="relative">
          <select
            data-custom-chevron="true"
            disabled={disabled}
            value={draft.orderChannel}
            onChange={(event) => {
              const orderChannel: SupplierOrderChannel =
                event.target.value === 'fax' ? 'fax' : 'email';
              updateDraft('orderChannel', orderChannel);
            }}
            className="h-40 w-full appearance-none rounded-6 border border-line-control px-12 pr-40 focus-ring"
          >
            <option value="email">이메일</option>
            <option value="fax">팩스</option>
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-32 -translate-y-1/2 text-text-3"
          />
        </div>
      </label>
      {draft.orderChannel === 'email'
        ? field(draft, updateDraft, '주문 수신 이메일', 'orderEmail', 'email', true, disabled)
        : field(draft, updateDraft, '주문 수신 팩스 번호', 'orderFax', 'tel', true, disabled)}
      {field(draft, updateDraft, '주소', 'address', 'text', false, disabled)}
      {field(draft, updateDraft, '메모', 'memo', 'text', false, disabled)}
    </div>
  );

  return (
    <div className="grid gap-16">
      <AdminPageHeader
        title="발주 관리"
        description="상품 발주처와 주문 정보 수신 방식을 관리합니다."
      />
      <AdminPanel title="발주처 등록">
        <form onSubmit={handleCreate} className="grid gap-12 p-16">
          {renderSupplierFields(createDraft, updateCreateDraft)}
          <div className="flex gap-8">
            <Button type="submit" disabled={isCreating}>
              {isCreating ? '저장 중' : '저장'}
            </Button>
          </div>
          {message ? (
            <p role="status" className="text-caption text-text-2">
              {message}
            </p>
          ) : null}
          <p className="text-caption text-text-3">
            수신 방식 변경은 이후 주문부터 서버가 적용해야 합니다. 주문 발송은 서버 연동이
            필요합니다.
          </p>
        </form>
      </AdminPanel>
      <AdminPanel title={`등록된 발주처 (${suppliers.length})`}>
        {suppliers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-s">
              <thead>
                <tr className="border-b border-line text-text-3">
                  <th className="p-12">회사명</th>
                  <th className="p-12">담당자</th>
                  <th className="p-12">연락처</th>
                  <th className="p-12">주문 수신</th>
                  <th className="p-12">관리</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-line">
                    <td className="p-12">
                      {supplier.companyName}
                      <small className="block text-caption text-text-3">{supplier.address}</small>
                    </td>
                    <td className="p-12">
                      {supplier.contactName}
                      <small className="block text-caption text-text-3">
                        {supplier.contactEmail}
                      </small>
                    </td>
                    <td className="p-12">{supplier.contactPhone}</td>
                    <td className="p-12">
                      {supplier.orderChannel === 'email' ? supplier.orderEmail : supplier.orderFax}
                      <small className="block text-caption text-text-3">
                        {supplier.orderChannel === 'email' ? '이메일' : '팩스'}
                      </small>
                    </td>
                    <td className="p-12">
                      <div className="flex gap-6">
                        <Button
                          type="button"
                          variant="secondary"
                          size="s"
                          onClick={() => edit(supplier)}
                        >
                          수정
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="s"
                          onClick={() => void remove(supplier)}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmpty
            title="등록된 발주처가 없습니다"
            description="위에서 발주처를 등록해 주세요."
          />
        )}
      </AdminPanel>
      <Modal
        isOpen={editDraft !== null}
        onClose={closeEditModal}
        title="발주처 수정"
        className="max-h-[calc(100dvh-32px)] max-w-720 overflow-y-auto"
        actions={
          <>
            <Button variant="secondary" disabled={isUpdating} onClick={closeEditModal}>
              취소
            </Button>
            <Button
              type="submit"
              form="supplier-edit-form"
              disabled={isUpdating || editDraft === null}
            >
              {isUpdating ? '저장 중' : '변경 사항 저장'}
            </Button>
          </>
        }
      >
        {editDraft ? (
          <form id="supplier-edit-form" onSubmit={handleUpdate}>
            <div className="mt-16 text-body-s">
              {renderSupplierFields(editDraft, updateEditDraft, isUpdating)}
              <p className="mt-12 text-caption text-text-3">
                수신 방식 변경은 이후 주문부터 서버가 적용해야 합니다. 주문 발송은 서버 연동이
                필요합니다.
              </p>
              {editMessage ? (
                <p role="alert" className="mt-12 text-caption text-danger">
                  {editMessage}
                </p>
              ) : null}
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
