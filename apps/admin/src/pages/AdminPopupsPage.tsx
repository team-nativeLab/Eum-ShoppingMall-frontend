import { queryKeys } from '@eum/api/query-keys';
import type { AdminPopup } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { TextField } from '@eum/ui/components/TextField';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AdminEmpty, AdminError, AdminLoading, AdminPageHeader } from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';

interface PopupDraft {
  id?: string;
  title: string;
  imageUrl: string;
  body: string;
  sortOrder: string;
  isVisible: boolean;
}

const EMPTY_POPUPS: AdminPopup[] = [];

function createEmptyDraft(): PopupDraft {
  return { title: '', imageUrl: '', body: '', sortOrder: '0', isVisible: true };
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('이미지를 읽지 못했습니다.')),
    );
    reader.addEventListener('error', () => reject(new Error('이미지를 읽지 못했습니다.')));
    reader.readAsDataURL(file);
  });
}

function isAllowedPopupImageSource(imageUrl: string): boolean {
  return /^(https?:\/\/|\/(?!\/)|data:image\/(?:jpeg|png|webp);base64,)/i.test(imageUrl);
}

function PopupPreview({ draft }: { draft: PopupDraft }) {
  return (
    <section aria-label="웹 팝업 미리보기" className="min-w-0 rounded-8 border border-line p-16">
      <h3 className="mb-8 text-label-s text-text-2">웹 팝업 미리보기</h3>
      <div className="flex min-h-240 min-w-0 items-center justify-center rounded-8 bg-dim p-16">
        <article className="w-full max-w-320 min-w-0 overflow-hidden rounded-12 bg-bg shadow-2">
          {draft.imageUrl ? (
            <img
              src={draft.imageUrl}
              alt="팝업 이미지 미리보기"
              className="aspect-16/9 w-full object-cover"
            />
          ) : (
            <div className="flex aspect-16/9 items-center justify-center bg-surface text-caption text-text-3">
              사진을 등록해 주세요
            </div>
          )}
          <div className="p-16">
            <h4 className="text-title">{draft.title || '팝업 제목'}</h4>
            <p className="mt-8 min-h-40 text-body-s whitespace-pre-wrap text-text-2">
              {draft.body || '팝업 내용이 여기에 표시됩니다.'}
            </p>
            <div className="mt-16 flex justify-end border-t border-line pt-12">
              <span className="text-caption text-text-3">닫기</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

/** 팝업 목 데이터의 등록·수정과 웹 표시 미리보기를 제공합니다. */
export function AdminPopupsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [draft, setDraft] = useState<PopupDraft>(createEmptyDraft);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminPopup | null>(null);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedImageFileName, setSelectedImageFileName] = useState('');
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const imageSelectionTokenRef = useRef(0);
  const popupsQuery = useQuery({
    queryKey: queryKeys.popups.adminList,
    queryFn: async ({ signal }) => (await getShopApi()).popups.adminList({ signal }),
  });
  const popups = popupsQuery.data ?? EMPTY_POPUPS;
  const filteredPopups = useMemo(
    () =>
      popups.filter((popup) => {
        const matchesSearch = `${popup.title} ${popup.body}`
          .toLocaleLowerCase('ko-KR')
          .includes(search.trim().toLocaleLowerCase('ko-KR'));
        const matchesVisibility =
          visibilityFilter === 'all' || popup.isVisible === (visibilityFilter === 'visible');
        return matchesSearch && matchesVisibility;
      }),
    [popups, search, visibilityFilter],
  );

  const openCreate = () => {
    imageSelectionTokenRef.current += 1;
    setDraft(createEmptyDraft());
    setSelectedImageFileName('');
    setMessage('');
    setIsEditorOpen(true);
  };

  const openEdit = (popup: AdminPopup) => {
    imageSelectionTokenRef.current += 1;
    setDraft({
      id: popup.id,
      title: popup.title,
      imageUrl: popup.imageUrl ?? '',
      body: popup.body,
      sortOrder: String(popup.sortOrder),
      isVisible: popup.isVisible,
    });
    setSelectedImageFileName('');
    setMessage('');
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    if (isSaving) return;
    imageSelectionTokenRef.current += 1;
    setIsEditorOpen(false);
    setDraft(createEmptyDraft());
    setSelectedImageFileName('');
    setMessage('');
  };

  const handleImageFile = async (changeEvent: ChangeEvent<HTMLInputElement>) => {
    const requestToken = ++imageSelectionTokenRef.current;
    const [file] = changeEvent.target.files ?? [];
    changeEvent.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      if (requestToken !== imageSelectionTokenRef.current) return;
      setSelectedImageFileName('');
      setMessage('PNG, JPG, WebP 이미지 파일을 선택해 주세요.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      if (requestToken !== imageSelectionTokenRef.current) return;
      setSelectedImageFileName('');
      setMessage('이미지는 2MB 이하로 선택해 주세요.');
      return;
    }
    setSelectedImageFileName(file.name);
    try {
      const imageUrl = await readImageFile(file);
      if (requestToken !== imageSelectionTokenRef.current) return;
      setDraft((currentDraft) => ({ ...currentDraft, imageUrl }));
      setMessage('');
    } catch {
      if (requestToken !== imageSelectionTokenRef.current) return;
      setSelectedImageFileName('');
      setMessage('이미지를 읽지 못했습니다. 다시 선택해 주세요.');
    }
  };

  const handleSave = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (isSaving) return;
    const title = draft.title.trim();
    const body = draft.body.trim();
    const sortOrder = Number(draft.sortOrder);
    if (!title || !body) {
      setMessage('팝업 제목과 내용을 입력해 주세요.');
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setMessage('정렬 순서는 0 이상의 정수로 입력해 주세요.');
      return;
    }
    if (draft.imageUrl && !isAllowedPopupImageSource(draft.imageUrl)) {
      setMessage('이미지 URL은 http(s) 주소 또는 사이트 내 경로를 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      await (
        await getShopApi()
      ).popups.saveAdmin({
        ...(draft.id ? { id: draft.id } : {}),
        title,
        imageUrl: draft.imageUrl.trim() || null,
        body,
        sortOrder,
        isVisible: draft.isVisible,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.popups.adminList });
      setIsEditorOpen(false);
      setDraft(createEmptyDraft());
      setMessage('팝업을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '팝업을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await (await getShopApi()).popups.deleteAdmin(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.popups.adminList });
      setMessage('팝업을 삭제했습니다.');
      setDeleteTarget(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '팝업을 삭제하지 못했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (popupsQuery.isPending) return <AdminLoading label="팝업을 불러오고 있습니다." />;
  if (popupsQuery.isError) {
    return (
      <AdminError title="팝업을 불러오지 못했습니다" onRetry={() => void popupsQuery.refetch()} />
    );
  }

  return (
    <section aria-label="팝업 관리">
      <AdminPageHeader
        title="팝업 관리"
        description={`총 ${popups.length.toLocaleString('ko-KR')}건`}
        action={<Button onClick={openCreate}>새로 등록</Button>}
      />
      <div className="mb-16 flex flex-wrap items-end gap-12">
        <label className="min-w-240 flex-1">
          <span className="sr-only">팝업 검색</span>
          <input
            type="search"
            value={search}
            onChange={(changeEvent) => setSearch(changeEvent.target.value)}
            placeholder="팝업 제목·내용 검색"
            className="h-40 w-full rounded-8 border border-line-control bg-bg px-12 text-body-s"
          />
        </label>
        <label className="grid min-w-128 gap-4 text-caption text-text-2">
          노출 상태
          <select
            value={visibilityFilter}
            onChange={(changeEvent) =>
              setVisibilityFilter(changeEvent.target.value as typeof visibilityFilter)
            }
            className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
          >
            <option value="all">전체</option>
            <option value="visible">노출</option>
            <option value="hidden">숨김</option>
          </select>
        </label>
      </div>
      {message ? (
        <p role="status" className="mb-12 text-body-s text-info">
          {message}
        </p>
      ) : null}
      {filteredPopups.length === 0 ? (
        <div className="rounded-12 border border-line bg-bg">
          <AdminEmpty
            title={popups.length === 0 ? '등록된 팝업이 없습니다' : '검색 결과가 없습니다'}
            description={popups.length === 0 ? '새 팝업을 등록해 주세요.' : undefined}
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-12 border border-line bg-bg">
          <table className="w-full min-w-720 border-collapse text-left text-body-s">
            <thead className="bg-surface text-label-s">
              <tr>
                <th className="px-12 py-12">사진</th>
                <th className="px-12 py-12">제목·내용</th>
                <th className="px-12 py-12">정렬</th>
                <th className="px-12 py-12">노출</th>
                <th className="px-12 py-12">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredPopups.map((popup) => (
                <tr key={popup.id} className="border-t border-line">
                  <td className="w-112 px-12 py-12">
                    {popup.imageUrl ? (
                      <img
                        src={popup.imageUrl}
                        alt=""
                        className="aspect-16/9 w-80 rounded-4 object-cover"
                      />
                    ) : (
                      <span className="text-caption text-text-3">사진 없음</span>
                    )}
                  </td>
                  <td className="max-w-480 px-12 py-12">
                    <p className="font-medium">{popup.title}</p>
                    <p className="mt-4 truncate text-caption text-text-3">{popup.body}</p>
                  </td>
                  <td className="px-12 py-12 tabular-nums">{popup.sortOrder}</td>
                  <td className="px-12 py-12">{popup.isVisible ? '노출' : '숨김'}</td>
                  <td className="px-12 py-12">
                    <div className="flex gap-8">
                      <Button size="s" variant="secondary" onClick={() => openEdit(popup)}>
                        수정
                      </Button>
                      <Button size="s" variant="ghost" onClick={() => setDeleteTarget(popup)}>
                        삭제
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        title={`팝업 ${draft.id ? '수정' : '등록'}`}
        className="max-w-960"
        actions={
          <>
            <Button variant="secondary" onClick={closeEditor} disabled={isSaving}>
              취소
            </Button>
            <Button type="submit" form="popup-editor-form" disabled={isSaving}>
              {isSaving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      >
        <form
          id="popup-editor-form"
          noValidate
          onSubmit={(submitEvent) => void handleSave(submitEvent)}
          className="mt-20 grid min-w-0 gap-20 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]"
        >
          <div className="grid min-w-0 content-start gap-16">
            <TextField
              label="제목"
              value={draft.title}
              onChange={(changeEvent) => setDraft({ ...draft, title: changeEvent.target.value })}
              inputClassName="h-44 px-12"
              required
            />
            <label className="grid gap-6 text-label-s">
              사진 URL
              <input
                type="text"
                inputMode="url"
                value={draft.imageUrl.startsWith('data:') ? '' : draft.imageUrl}
                onChange={(changeEvent) => {
                  imageSelectionTokenRef.current += 1;
                  setDraft({ ...draft, imageUrl: changeEvent.target.value });
                  setSelectedImageFileName('');
                }}
                placeholder="https://…"
                className="h-40 w-full min-w-0 rounded-8 border border-line-control bg-bg px-12 text-body-s"
              />
            </label>
            <div className="grid min-w-0 gap-6">
              <span className="text-caption text-text-2">
                사진 파일 (PNG, JPG, WebP · 2MB 이하)
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-8">
                <Button
                  type="button"
                  variant="secondary"
                  size="s"
                  aria-controls="popup-image-file"
                  onClick={() => imageFileInputRef.current?.click()}
                >
                  파일 선택
                </Button>
                <span
                  role="status"
                  aria-live="polite"
                  className="min-w-0 flex-1 truncate text-caption text-text-2"
                >
                  {selectedImageFileName ||
                    (draft.imageUrl.startsWith('data:')
                      ? '등록된 이미지 파일'
                      : '선택된 파일 없음')}
                </span>
                <input
                  ref={imageFileInputRef}
                  id="popup-image-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="팝업 이미지 파일"
                  onChange={(changeEvent) => void handleImageFile(changeEvent)}
                  className="sr-only"
                  tabIndex={-1}
                />
              </div>
            </div>
            {draft.imageUrl.startsWith('data:') ? (
              <div className="flex min-w-0 items-center justify-between gap-12 rounded-8 bg-surface px-12 py-8">
                <span className="text-caption text-text-2">사진 파일이 선택되었습니다.</span>
                <Button
                  size="s"
                  variant="ghost"
                  onClick={() => {
                    imageSelectionTokenRef.current += 1;
                    setDraft({ ...draft, imageUrl: '' });
                    setSelectedImageFileName('');
                  }}
                >
                  사진 제거
                </Button>
              </div>
            ) : null}
            <label className="grid gap-6 text-label-s">
              내용
              <textarea
                value={draft.body}
                rows={5}
                onChange={(changeEvent) => setDraft({ ...draft, body: changeEvent.target.value })}
                className="resize-y rounded-8 border border-line-control bg-bg px-12 py-10 text-body-s"
              />
            </label>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,120px)] items-end gap-12">
              <label className="flex min-h-40 min-w-0 items-center gap-8 text-body-s">
                <input
                  type="checkbox"
                  checked={draft.isVisible}
                  onChange={(changeEvent) =>
                    setDraft({ ...draft, isVisible: changeEvent.target.checked })
                  }
                />
                웹에 노출
              </label>
              <label className="grid min-w-0 gap-4 text-caption text-text-2">
                정렬 순서
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.sortOrder}
                  onChange={(changeEvent) =>
                    setDraft({ ...draft, sortOrder: changeEvent.target.value })
                  }
                  className="h-40 w-full min-w-0 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
            </div>
            {message ? (
              <p role="alert" className="text-body-s text-danger">
                {message}
              </p>
            ) : null}
          </div>
          <PopupPreview draft={draft} />
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        title="팝업을 삭제할까요?"
        description={deleteTarget?.title}
        tone="danger"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              취소
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? '삭제 중…' : '삭제'}
            </Button>
          </>
        }
      />
    </section>
  );
}
