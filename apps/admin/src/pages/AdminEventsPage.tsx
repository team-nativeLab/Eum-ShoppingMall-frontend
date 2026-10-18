import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { AdminShopEvent } from '@eum/api/types';
import type { AdminShopEventInput } from '@eum/api/shop-api';

const eventQueryKey = ['admin', 'events'];
const EMPTY_EVENT: AdminShopEventInput = {
  title: '',
  subtitle: '',
  status: 'upcoming',
  startAt: '',
  endAt: '',
  eyebrow: '',
  heroTitle: [''],
  heroDescription: '',
  body: '',
  sections: [],
  searchKeyword: '',
  isVisible: true,
  sortOrder: 0,
};

function dateInputValue(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function AdminEventsPage() {
  const { eventId } = useParams();
  const location = useLocation();
  const isNew = location.pathname.endsWith('/new');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = Boolean(eventId && !isNew);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminShopEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const eventsQuery = useQuery({
    queryKey: eventQueryKey,
    queryFn: async ({ signal }) => (await getShopApi()).events.adminList({ signal }),
  });
  const event = eventsQuery.data?.find((item) => item.id === eventId);
  const draft: AdminShopEventInput = event ?? EMPTY_EVENT;

  if (eventsQuery.isPending) return <AdminLoading label="이벤트를 불러오는 중입니다." />;
  if (eventsQuery.isError)
    return (
      <AdminError title="이벤트를 불러오지 못했습니다" onRetry={() => eventsQuery.refetch()} />
    );
  if (editing && !event)
    return (
      <AdminEmpty
        title="이벤트를 찾을 수 없습니다"
        description="이벤트 목록에서 다시 선택해 주세요."
      />
    );

  const saveEvent = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (saving) return;
    const form = new FormData(formEvent.currentTarget);
    const startDate = String(form.get('startAt') ?? '');
    const endDate = String(form.get('endAt') ?? '');
    const title = String(form.get('title') ?? '').trim();
    const subtitle = String(form.get('subtitle') ?? '').trim();
    if (!title || !startDate || !endDate || new Date(endDate) < new Date(startDate)) {
      setMessage('이벤트명과 시작일·종료일을 올바르게 입력해 주세요.');
      return;
    }
    const nextEvent: AdminShopEventInput = {
      ...draft,
      ...(event ? { id: event.id } : {}),
      title,
      subtitle,
      startAt: `${startDate}T00:00:00+09:00`,
      endAt: `${endDate}T23:59:59+09:00`,
      eyebrow: String(form.get('eyebrow') ?? '').trim(),
      heroTitle: String(form.get('heroTitle') ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      heroDescription: String(form.get('heroDescription') ?? '').trim(),
      body: String(form.get('body') ?? '').trim(),
      searchKeyword: String(form.get('searchKeyword') ?? '').trim(),
      sections: String(form.get('sections') ?? '')
        .split('\n')
        .map((line) => {
          const [heading = '', ...bodyParts] = line.split('|');
          return { heading: heading.trim(), body: bodyParts.join('|').trim() };
        })
        .filter((section) => section.heading && section.body),
      status: String(form.get('status') ?? draft.status) as AdminShopEventInput['status'],
      sortOrder: Number(form.get('sortOrder') ?? draft.sortOrder) || 0,
      isVisible: form.get('isVisible') === 'on',
    };
    setSaving(true);
    setMessage('');
    try {
      await (await getShopApi()).events.saveAdmin(nextEvent);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: eventQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['home', 'content'] }),
      ]);
      setMessage('이벤트를 프론트엔드 목 API에 저장했습니다.');
      navigate('/events');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '이벤트를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  {
    const status = (eventsQuery.data ?? []).filter(
      (item) => statusFilter === 'all' || item.status === statusFilter,
    );
    return (
      <section aria-label={editing || eventId === 'new' ? '이벤트 편집' : '이벤트 관리'}>
        <AdminPageHeader
          title={editing ? '이벤트 수정' : isNew ? '이벤트 등록' : '이벤트 관리'}
          description="진행·예정·종료 상태와 Web 이벤트 목록·상세 콘텐츠를 운영합니다."
          action={
            editing || isNew ? (
              <Link to="/events" className={buttonClassName({ variant: 'secondary' })}>
                목록
              </Link>
            ) : (
              <Link to="/events/new" className={buttonClassName()}>
                이벤트 등록
              </Link>
            )
          }
        />
        {message ? (
          <p role="status" className="mb-12 text-body-s text-text-2">
            {message}
          </p>
        ) : null}
        {editing || isNew ? (
          <form key={eventId ?? 'new-event'} onSubmit={saveEvent}>
            <div className="grid gap-16 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
              <div className="grid gap-16">
                <AdminPanel title="이벤트 기본 정보" bodyClassName="grid gap-10 px-20 py-16">
                  <label className="grid gap-4 text-label-s">
                    이벤트명 *
                    <input
                      name="title"
                      required
                      defaultValue={draft.title}
                      className="h-40 rounded-8 border border-line-control px-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    부제
                    <input
                      name="subtitle"
                      defaultValue={draft.subtitle}
                      className="h-40 rounded-8 border border-line-control px-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    상단 영문 문구
                    <input
                      name="eyebrow"
                      defaultValue={draft.eyebrow}
                      className="h-40 rounded-8 border border-line-control px-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    상세 제목 (줄바꿈으로 분리)
                    <textarea
                      name="heroTitle"
                      rows={2}
                      defaultValue={draft.heroTitle.join('\n')}
                      className="rounded-8 border border-line-control p-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    상세 설명
                    <textarea
                      name="heroDescription"
                      rows={3}
                      defaultValue={draft.heroDescription}
                      className="rounded-8 border border-line-control p-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    상세 본문
                    <textarea
                      name="body"
                      rows={6}
                      defaultValue={draft.body}
                      className="rounded-8 border border-line-control p-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    상세 섹션 (한 줄에 제목 | 본문)
                    <textarea
                      name="sections"
                      rows={5}
                      defaultValue={draft.sections
                        .map((section) => `${section.heading} | ${section.body}`)
                        .join('\n')}
                      className="rounded-8 border border-line-control p-12"
                    />
                  </label>
                </AdminPanel>
              </div>
              <div className="grid gap-16">
                <AdminPanel title="기간·노출 설정" bodyClassName="grid gap-12 px-20 py-16">
                  <label className="grid gap-4 text-label-s">
                    시작일 *
                    <input
                      name="startAt"
                      type="date"
                      required
                      defaultValue={dateInputValue(draft.startAt)}
                      className="h-40 rounded-8 border border-line-control px-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    종료일 *
                    <input
                      name="endAt"
                      type="date"
                      required
                      defaultValue={dateInputValue(draft.endAt)}
                      className="h-40 rounded-8 border border-line-control px-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    목록 검색 키워드
                    <input
                      name="searchKeyword"
                      defaultValue={draft.searchKeyword}
                      className="h-40 rounded-8 border border-line-control px-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    정렬 순서
                    <input
                      name="sortOrder"
                      type="number"
                      defaultValue={draft.sortOrder}
                      className="h-40 rounded-8 border border-line-control px-12"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    진행 상태
                    <select
                      name="status"
                      defaultValue={draft.status}
                      className="h-40 rounded-8 border border-line-control px-12"
                    >
                      <option value="upcoming">예정</option>
                      <option value="ongoing">진행중</option>
                      <option value="ended">종료</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-8 border-t border-line pt-12 text-label-s">
                    <input name="isVisible" type="checkbox" defaultChecked={draft.isVisible} />
                    웹에 노출
                  </label>
                </AdminPanel>
                <div className="flex justify-end gap-8">
                  <Link to="/events" className={buttonClassName({ variant: 'secondary' })}>
                    취소
                  </Link>
                  <Button type="submit" disabled={saving}>
                    {saving ? '저장 중…' : '저장'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <>
            <div className="mb-12 flex items-center justify-between">
              <label className="text-label-s">
                상태 필터{' '}
                <select
                  value={statusFilter}
                  onChange={(change) => setStatusFilter(change.target.value)}
                  className="ml-8 h-36 rounded-6 border border-line-control px-8"
                >
                  <option value="all">전체</option>
                  <option value="ongoing">진행중</option>
                  <option value="upcoming">예정</option>
                  <option value="ended">종료</option>
                </select>
              </label>
              <p className="text-caption text-text-3">{status.length}개</p>
            </div>
            {status.length === 0 ? (
              <AdminEmpty title="등록된 이벤트가 없습니다" />
            ) : (
              <div className="overflow-x-auto rounded-12 border border-line bg-bg">
                <table className="w-full min-w-800 border-collapse text-left text-body-s">
                  <thead className="bg-surface text-label-s">
                    <tr>
                      <th className="px-12 py-10">이벤트명</th>
                      <th className="px-12 py-10">기간</th>
                      <th className="px-12 py-10">상태</th>
                      <th className="px-12 py-10">노출</th>
                      <th className="px-12 py-10">정렬</th>
                      <th className="px-12 py-10 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.map((item) => (
                      <tr key={item.id} className="border-t border-line">
                        <td className="px-12 py-12">
                          <Link to={`/events/${item.id}`} className="font-medium hover:underline">
                            {item.title}
                          </Link>
                          <p className="text-caption text-text-3">{item.subtitle}</p>
                        </td>
                        <td className="px-12 py-12">
                          {dateInputValue(item.startAt)} – {dateInputValue(item.endAt)}
                        </td>
                        <td className="px-12 py-12">
                          {item.status === 'ongoing'
                            ? '진행중'
                            : item.status === 'upcoming'
                              ? '예정'
                              : '종료'}
                        </td>
                        <td className="px-12 py-12">{item.isVisible ? '노출' : '숨김'}</td>
                        <td className="px-12 py-12">{item.sortOrder}</td>
                        <td className="px-12 py-12 text-right">
                          <Link
                            to={`/events/${item.id}`}
                            className="rounded-6 border border-line-control px-8 py-6 text-caption focus-ring"
                          >
                            수정
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="s"
                            onClick={() => setDeleteTarget(item)}
                          >
                            삭제
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title="이벤트 삭제"
          description={
            deleteTarget ? `${deleteTarget.title} 이벤트를 목 API에서 삭제할까요?` : undefined
          }
          actions={
            <>
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                취소
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (!deleteTarget) return;
                  try {
                    await (await getShopApi()).events.deleteAdmin(deleteTarget.id);
                    await Promise.all([
                      queryClient.invalidateQueries({ queryKey: eventQueryKey }),
                      queryClient.invalidateQueries({ queryKey: ['events'] }),
                    ]);
                    setMessage(`${deleteTarget.title} 이벤트를 목 API에서 삭제했습니다.`);
                  } catch (error) {
                    setMessage(
                      error instanceof Error ? error.message : '이벤트를 삭제하지 못했습니다.',
                    );
                  }
                  setDeleteTarget(null);
                }}
              >
                삭제
              </Button>
            </>
          }
        />
      </section>
    );
  }
}
