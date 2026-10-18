import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '@eum/ui/components/Button';
import { AdminError, AdminLoading, AdminNotice, AdminPageHeader } from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { AdminLegalDocument, CompanyInfo, LegalDocumentId } from '@eum/api/types';

const DOCUMENT_OPTIONS: { id: LegalDocumentId; title: string; route: string }[] = [
  { id: 'terms', title: '이용약관', route: '/terms' },
  { id: 'privacy', title: '개인정보처리방침', route: '/privacy' },
  { id: 'guide', title: '이용안내', route: '/guide' },
  { id: 'shipping', title: '배송·교환·반품 정책', route: '/shipping-policy' },
];

const EMPTY_LEGAL: AdminLegalDocument = {
  id: 'terms',
  title: '이용약관',
  version: '',
  effectiveAt: '',
  body: '',
  isPublished: false,
};

/** 회사 정보와 Web 공개 문서를 관리합니다. */
export function AdminCompanyPoliciesPage() {
  const queryClient = useQueryClient();
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [legalDraft, setLegalDraft] = useState<{
    documentId: LegalDocumentId;
    value: AdminLegalDocument;
  } | null>(null);
  const [documentId, setDocumentId] = useState<LegalDocumentId>('terms');
  const [message, setMessage] = useState('');
  const companyQuery = useQuery({
    queryKey: ['admin', 'company-info'],
    queryFn: async ({ signal }) => (await getShopApi()).company.getAdminInfo({ signal }),
  });
  const legalQuery = useQuery({
    queryKey: ['admin', 'legal-documents'],
    queryFn: async ({ signal }) => (await getShopApi()).legalDocuments.adminList({ signal }),
  });

  const companyValue = company ?? companyQuery.data;
  const savedLegal = legalQuery.data?.find((item) => item.id === documentId);
  const option = DOCUMENT_OPTIONS.find((item) => item.id === documentId);
  const legal =
    legalDraft?.documentId === documentId
      ? legalDraft.value
      : (savedLegal ?? { ...EMPTY_LEGAL, id: documentId, title: option?.title ?? '' });
  const updateLegal = (value: AdminLegalDocument) => setLegalDraft({ documentId, value });

  if (companyQuery.isPending || legalQuery.isPending || !companyValue)
    return <AdminLoading label="회사·정책 정보를 불러오고 있습니다." />;
  if (companyQuery.isError || legalQuery.isError)
    return (
      <AdminError
        title="회사·정책 정보를 불러오지 못했습니다"
        onRetry={() => {
          void companyQuery.refetch();
          void legalQuery.refetch();
        }}
      />
    );

  const saveCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    try {
      await (await getShopApi()).company.saveAdminInfo(companyValue);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'company-info'] }),
        queryClient.invalidateQueries({ queryKey: ['company', 'info'] }),
      ]);
      setMessage(
        '회사·고객센터 정보를 목 API에 저장했습니다. 같은 mock API 인스턴스를 사용하는 Web 푸터·문의 연락처에서 다시 조회됩니다.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '회사 정보를 저장하지 못했습니다.');
    }
  };
  const saveLegal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    try {
      await (await getShopApi()).legalDocuments.saveAdmin(legal);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'legal-documents'] }),
        queryClient.invalidateQueries({ queryKey: ['legal-document', documentId] }),
      ]);
      setMessage(
        '정책 문서를 목 API에 저장했습니다. 공개 상태면 Web 문서 페이지가 같은 mock API 인스턴스에서 다시 조회합니다.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '정책 문서를 저장하지 못했습니다.');
    }
  };

  const companyFields: { key: keyof CompanyInfo; label: string; type?: string }[] = [
    { key: 'companyName', label: '상호' },
    { key: 'representative', label: '대표자' },
    { key: 'businessRegistrationNumber', label: '사업자등록번호' },
    { key: 'mailOrderSalesNumber', label: '통신판매업 신고번호' },
    { key: 'address', label: '사업장 주소' },
    { key: 'email', label: '대표 이메일', type: 'email' },
    { key: 'quoteEmail', label: '견적 문의 이메일', type: 'email' },
    { key: 'privacyOfficer', label: '개인정보 보호책임자' },
    { key: 'customerCenterPhone', label: '고객센터 표시 번호' },
    { key: 'customerCenterTel', label: '전화 링크 번호' },
    { key: 'customerCenterHours', label: '고객센터 운영 시간' },
  ];

  return (
    <section aria-label="회사 및 정책 관리">
      <AdminPageHeader
        title="회사·정책 정보"
        description="회사 연락처와 Web에 공개할 약관·정책 문서를 관리합니다."
      />
      <AdminNotice tone="warning" className="mb-16">
        정책 본문은 일반 텍스트로 표시하며 HTML로 해석하지 않습니다. 게시 전 법률 검토를 별도로
        진행해 주세요.
      </AdminNotice>
      {message ? (
        <p role="status" className="mb-16 text-body-s text-info">
          {message}
        </p>
      ) : null}
      <div className="grid gap-20">
        <form
          onSubmit={(event) => void saveCompany(event)}
          className="rounded-12 border border-line bg-bg p-20"
        >
          <h2 className="text-h3">회사·고객센터 정보</h2>
          <div className="mt-16 grid gap-12 md:grid-cols-2">
            {companyFields.map(({ key, label, type }) => (
              <label key={key} className="grid gap-6 text-label-s">
                {label}
                <input
                  type={type ?? 'text'}
                  value={String(companyValue[key] ?? '')}
                  onChange={(event) => setCompany({ ...companyValue, [key]: event.target.value })}
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
            ))}
          </div>
          <Button type="submit" className="mt-16">
            회사 정보 저장
          </Button>
        </form>
        <form
          onSubmit={(event) => void saveLegal(event)}
          className="rounded-12 border border-line bg-bg p-20"
        >
          <h2 className="text-h3">약관·정책 문서</h2>
          <div className="mt-16 grid gap-12 md:grid-cols-2">
            <label className="grid gap-6 text-label-s">
              문서 종류
              <select
                value={documentId}
                onChange={(event) => setDocumentId(event.target.value as LegalDocumentId)}
                className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
              >
                {DOCUMENT_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {item.route}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-6 text-label-s">
              문서 제목
              <input
                value={legal.title}
                onChange={(event) => updateLegal({ ...legal, title: event.target.value })}
                required
                maxLength={120}
                className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
              />
            </label>
            <label className="grid gap-6 text-label-s">
              버전
              <input
                value={legal.version}
                onChange={(event) => updateLegal({ ...legal, version: event.target.value })}
                required
                maxLength={40}
                placeholder="예: 1.0"
                className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
              />
            </label>
            <label className="grid gap-6 text-label-s">
              시행일
              <input
                type="date"
                value={legal.effectiveAt.slice(0, 10)}
                onChange={(event) => updateLegal({ ...legal, effectiveAt: event.target.value })}
                required
                className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
              />
            </label>
          </div>
          <label className="mt-12 grid gap-6 text-label-s">
            문서 본문
            <textarea
              value={legal.body}
              onChange={(event) => updateLegal({ ...legal, body: event.target.value })}
              required
              maxLength={50000}
              className="min-h-240 rounded-8 border border-line-control p-12 text-body-s"
            />
          </label>
          <label className="mt-12 flex items-center gap-8 text-body-s">
            <input
              type="checkbox"
              checked={legal.isPublished}
              onChange={(event) => updateLegal({ ...legal, isPublished: event.target.checked })}
            />
            Web에 공개
          </label>
          <Button type="submit" className="mt-16">
            정책 문서 저장
          </Button>
        </form>
      </div>
    </section>
  );
}
