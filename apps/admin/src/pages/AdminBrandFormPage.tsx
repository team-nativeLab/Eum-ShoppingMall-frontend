import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Switch } from '@eum/ui/components/Switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { AdminBrandInput } from '@eum/api/shop-api';

const brandQueryKey = ['admin', 'brands'];

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

export function AdminBrandFormPage() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mediaDraft, setMediaDraft] = useState<{
    brandKey: string;
    logoUrl: string;
    coverImageUrl: string;
    isVisible: boolean;
    isFeatured: boolean;
  } | null>(null);
  const brandsQuery = useQuery({
    queryKey: brandQueryKey,
    queryFn: async ({ signal }) => (await getShopApi()).brands.adminList({ signal }),
  });
  const brand = brandsQuery.data?.find((item) => item.id === brandId);
  const isNew = !brandId || brandId === 'new';
  const brandKey = brand?.id ?? 'new';
  const activeMediaDraft =
    mediaDraft?.brandKey === brandKey
      ? mediaDraft
      : {
          brandKey,
          logoUrl: brand?.logoUrl ?? '',
          coverImageUrl: brand?.coverImageUrl ?? '',
          isVisible: brand?.isVisible ?? true,
          isFeatured: brand?.isFeatured ?? false,
        };
  const { logoUrl, coverImageUrl, isVisible, isFeatured } = activeMediaDraft;
  const updateMediaDraft = (changes: Partial<typeof activeMediaDraft>) =>
    setMediaDraft({ ...activeMediaDraft, ...changes });
  const setLogoUrl = (value: string) => updateMediaDraft({ logoUrl: value });
  const setCoverImageUrl = (value: string) => updateMediaDraft({ coverImageUrl: value });
  const setIsVisible = (value: boolean) => updateMediaDraft({ isVisible: value });
  const setIsFeatured = (value: boolean) => updateMediaDraft({ isFeatured: value });
  if (brandsQuery.isPending) return <AdminLoading label="브랜드 정보를 불러오는 중입니다." />;
  if (brandsQuery.isError)
    return (
      <AdminError title="브랜드 정보를 불러오지 못했습니다" onRetry={() => brandsQuery.refetch()} />
    );
  if (!isNew && !brand)
    return (
      <AdminEmpty
        title="브랜드를 찾을 수 없습니다"
        description="브랜드 목록에서 다시 선택해 주세요."
      />
    );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const name = value('name');
    const tagline = value('tagline');
    const storyTitle = value('storyTitle');
    const storyBody = value('storyBody');
    const duplicate = brandsQuery.data.some(
      (item) =>
        item.id !== brand?.id &&
        item.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'),
    );
    if (!name || !tagline || duplicate || Boolean(storyTitle) !== Boolean(storyBody)) {
      setMessage(
        !name
          ? '브랜드명을 입력해 주세요.'
          : !tagline
            ? '한 줄 소개를 입력해 주세요.'
            : duplicate
              ? '이미 등록된 브랜드명입니다.'
              : '스토리 제목과 내용을 함께 입력해 주세요.',
      );
      return;
    }
    if (brand && brand.productCount > 0 && name !== brand.name) {
      setMessage('상품에 연결된 브랜드명은 변경할 수 없습니다. 상품 연결을 먼저 정리해 주세요.');
      return;
    }
    if (!logoUrl) {
      setMessage('브랜드 로고 URL을 입력하거나 이미지 파일을 선택해 주세요.');
      return;
    }
    const input: AdminBrandInput = {
      ...(brand ?? {
        name,
        englishName: null,
        logoUrl: null,
        tagline: null,
        productCount: 0,
        coverImageUrl: null,
        mainField: null,
        originCountry: null,
        certification: null,
        story: null,
        isVisible: true,
        isFeatured: false,
      }),
      ...(brand ? { id: brand.id } : {}),
      name,
      englishName: value('englishName') || null,
      logoUrl,
      tagline: tagline || null,
      coverImageUrl: coverImageUrl || null,
      mainField: value('mainField') || null,
      originCountry: value('originCountry') || null,
      certification: value('certification') || null,
      story: storyTitle ? { title: storyTitle, body: storyBody } : null,
      isVisible,
      isFeatured,
      sortOrder: Number(value('sortOrder')) || 0,
    };
    setIsSaving(true);
    setMessage('');
    try {
      await (await getShopApi()).brands.saveAdmin(input);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: brandQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['brands'] }),
      ]);
      setMessage('프론트엔드 목 API에 저장했습니다. 실제 서버 데이터는 변경되지 않았습니다.');
      navigate('/brands');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '브랜드를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageFile = async (
    event: ChangeEvent<HTMLInputElement>,
    updateUrl: (url: string) => void,
    maxBytes: number,
    allowedTypes: readonly string[],
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type) || file.size > maxBytes) {
      setMessage(
        `이미지 형식 또는 크기를 확인해 주세요. 최대 ${Math.floor(maxBytes / 1024 / 1024)}MB입니다.`,
      );
      event.target.value = '';
      return;
    }
    try {
      updateUrl(await readImageFile(file));
      setMessage(`${file.name} 이미지를 목 API에 저장할 준비가 되었습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '이미지를 읽지 못했습니다.');
    }
  };

  return (
    <section aria-label={isNew ? '브랜드 등록' : '브랜드 수정'}>
      <AdminPageHeader
        title={isNew ? '브랜드 등록' : '브랜드 수정'}
        description="브랜드 디렉터리와 브랜드 상세에 표시할 정보를 관리합니다."
        action={
          <Link to="/brands" className={buttonClassName({ variant: 'secondary' })}>
            목록
          </Link>
        }
      />
      <AdminNotice className="mb-16">
        브랜드 이미지 선택값은 목 데이터에 보관됩니다. 실제 이미지 서버 업로드는 지원하지 않습니다.
      </AdminNotice>
      <form onSubmit={submit}>
        <div className="grid items-start gap-16 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
          <div className="grid gap-16">
            <AdminPanel title="브랜드 기본 정보" bodyClassName="grid gap-16 px-20 py-16">
              <label className="grid gap-6 text-label-s">
                브랜드명 *
                <input
                  name="name"
                  required
                  maxLength={60}
                  defaultValue={brand?.name ?? ''}
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
              <label className="grid gap-6 text-label-s">
                영문명
                <input
                  name="englishName"
                  maxLength={80}
                  defaultValue={brand?.englishName ?? ''}
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
              <label className="grid gap-6 text-label-s">
                한 줄 소개 *
                <input
                  name="tagline"
                  required
                  maxLength={120}
                  defaultValue={brand?.tagline ?? ''}
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
              <label className="grid gap-6 text-label-s">
                주요 분야
                <input
                  name="mainField"
                  defaultValue={brand?.mainField ?? ''}
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
              <label className="grid gap-6 text-label-s">
                브랜드 로고 URL
                <input
                  type="url"
                  value={logoUrl.startsWith('data:') ? '' : logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="https://…"
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
              <label htmlFor="brand-logo-file" className="grid gap-6 text-label-s">
                로고 파일 선택 (SVG, PNG · 2MB 이하)
                <input
                  id="brand-logo-file"
                  type="file"
                  accept="image/svg+xml,image/png"
                  onChange={(event) =>
                    void handleImageFile(event, setLogoUrl, 2 * 1024 * 1024, [
                      'image/svg+xml',
                      'image/png',
                    ])
                  }
                  className="text-body-s"
                />
              </label>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="브랜드 로고 미리보기"
                  className="size-80 rounded-8 border border-line object-contain"
                />
              ) : null}
              <label className="grid gap-6 text-label-s">
                커버 이미지 URL
                <input
                  type="url"
                  value={coverImageUrl.startsWith('data:') ? '' : coverImageUrl}
                  onChange={(event) => setCoverImageUrl(event.target.value)}
                  placeholder="https://…"
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
              <label htmlFor="brand-cover-file" className="grid gap-6 text-label-s">
                커버 파일 선택 (JPG, PNG, WebP · 10MB 이하)
                <input
                  id="brand-cover-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    void handleImageFile(event, setCoverImageUrl, 10 * 1024 * 1024, [
                      'image/jpeg',
                      'image/png',
                      'image/webp',
                    ])
                  }
                  className="text-body-s"
                />
              </label>
              <label className="grid gap-6 text-label-s">
                원산지
                <input
                  name="originCountry"
                  defaultValue={brand?.originCountry ?? ''}
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
              <label className="grid gap-6 text-label-s">
                주요 인증
                <input
                  name="certification"
                  defaultValue={brand?.certification ?? ''}
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
            </AdminPanel>
            <AdminPanel title="브랜드 스토리" bodyClassName="grid gap-12 px-20 py-16">
              <label className="grid gap-6 text-label-s">
                스토리 제목
                <input
                  name="storyTitle"
                  maxLength={100}
                  defaultValue={brand?.story?.title ?? ''}
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
              <label className="grid gap-6 text-label-s">
                스토리 본문
                <textarea
                  name="storyBody"
                  rows={6}
                  maxLength={3000}
                  defaultValue={brand?.story?.body ?? ''}
                  className="rounded-8 border border-line-control bg-bg p-12 text-body-s"
                />
              </label>
            </AdminPanel>
          </div>
          <div className="grid gap-16">
            <AdminPanel title="게시 설정" bodyClassName="grid gap-16 px-20 py-16">
              <label className="grid gap-6 text-label-s">
                정렬 순서
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={brand?.sortOrder ?? 0}
                  className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                />
              </label>
              <div className="flex items-center justify-between gap-12 border-t border-line pt-16 text-label-m">
                <span>웹 노출</span>
                <Switch label="웹 노출" isChecked={isVisible} onCheckedChange={setIsVisible} />
              </div>
              <div className="flex items-center justify-between gap-12 border-t border-line pt-16 text-label-m">
                <span>대표 브랜드</span>
                <Switch
                  label="대표 브랜드 지정"
                  isChecked={isFeatured}
                  onCheckedChange={setIsFeatured}
                />
              </div>
            </AdminPanel>
            {message ? (
              <p role="status" className="text-body-s text-text-2">
                {message}
              </p>
            ) : null}
            <div className="flex justify-end gap-8">
              <Link to="/brands" className={buttonClassName({ variant: 'secondary' })}>
                취소
              </Link>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? '저장 중…' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
