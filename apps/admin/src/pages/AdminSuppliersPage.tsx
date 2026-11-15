import { Button } from '@eum/ui/components/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { AdminSupplier, SupplierOrderChannel } from '@eum/api/types';
import type { AdminSupplierInput } from '@eum/api/shop-api';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';

const supplierQueryKey = ['admin', 'suppliers'] as const;
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
  const [draft, setDraft] = useState<AdminSupplierInput>(emptyDraft);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  if (suppliersQuery.isPending) return <AdminLoading label="발주처를 불러오고 있습니다." />;
  if (suppliersQuery.isError)
    return (
      <AdminError
        title="발주처를 불러오지 못했습니다"
        onRetry={() => void suppliersQuery.refetch()}
      />
    );
  const suppliers = suppliersQuery.data;
  const update = (field: keyof AdminSupplierInput, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      await (await getShopApi()).suppliers.saveAdmin(draft);
      setDraft(emptyDraft);
      await queryClient.invalidateQueries({ queryKey: supplierQueryKey });
      setMessage('발주처 정보를 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '발주처 정보를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };
  const edit = (supplier: AdminSupplier) => setDraft({ ...supplier });
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
  const field = (label: string, key: keyof AdminSupplierInput, type = 'text', required = false) => (
    <label className="grid gap-4 text-label-s" key={key}>
      {label}
      <input
        type={type}
        required={required}
        value={String(draft[key] ?? '')}
        onChange={(event) => update(key, event.target.value)}
        className="h-40 rounded-6 border border-line-control px-12"
      />
    </label>
  );
  return (
    <div className="grid gap-16">
      <AdminPageHeader
        title="발주 관리"
        description="상품 발주처와 주문 정보 수신 방식을 관리합니다."
      />
      <AdminPanel title={draft.id ? '발주처 수정' : '발주처 등록'}>
        <form onSubmit={handleSave} className="grid gap-12 p-16">
          <div className="grid gap-12 md:grid-cols-2">
            {field('회사명', 'companyName', 'text', true)}
            {field('담당자 이름', 'contactName', 'text', true)}
            {field('담당자 전화번호', 'contactPhone', 'tel', true)}
            {field('담당자 이메일', 'contactEmail', 'email', true)}
            <label className="grid gap-4 text-label-s">
              주문 정보 수신 방식
              <select
                value={draft.orderChannel}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    orderChannel: event.target.value as SupplierOrderChannel,
                  }))
                }
                className="h-40 rounded-6 border border-line-control px-12"
              >
                <option value="email">이메일</option>
                <option value="fax">팩스</option>
              </select>
            </label>
            {draft.orderChannel === 'email'
              ? field('주문 수신 이메일', 'orderEmail', 'email', true)
              : field('주문 수신 팩스 번호', 'orderFax', 'tel', true)}
            {field('주소', 'address')}
            {field('메모', 'memo')}
          </div>
          <div className="flex gap-8">
            <Button type="submit" disabled={saving}>
              {saving ? '저장 중' : '저장'}
            </Button>
            {draft.id ? (
              <Button type="button" variant="secondary" onClick={() => setDraft(emptyDraft)}>
                취소
              </Button>
            ) : null}
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
    </div>
  );
}
