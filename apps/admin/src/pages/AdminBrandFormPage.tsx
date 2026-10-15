import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { Switch } from '@eum/ui/components/Switch';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AdminEmpty, AdminNotice, AdminPageHeader, AdminPanel } from '@/components/AdminUI';
import {
  useAdminBrandPreview,
  type AdminBrandDraft,
  type AdminBrandPreview,
} from '@/lib/admin-brand-preview';

type FormErrorKey = 'name' | 'logo' | 'cover' | 'introduction' | 'story';
type FormErrors = Partial<Record<FormErrorKey, string>>;

function emptyDraft(): AdminBrandDraft {
  return {
    name: '',
    englishName: '',
    mainField: '',
    isExposed: true,
    shortIntroduction: '',
    storyTitle: '',
    storyBody: '',
    originCountry: '',
    certification: '',
    hasLogo: false,
    hasCover: false,
  };
}

function fromBrand(brand: AdminBrandPreview): AdminBrandDraft {
  const { id, ...draft } = brand;
  return { ...draft, id };
}

export function AdminBrandFormPage() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { brands, getBrandMedia, monthlyBrandId, saveBrand, setMonthlyBrand } =
    useAdminBrandPreview();
  const brand = brands.find((item) => item.id === brandId);
  const savedMedia = brand ? getBrandMedia(brand.id) : undefined;
  const editing = Boolean(brandId);
  const [draft, setDraft] = useState<AdminBrandDraft>(() =>
    brand ? fromBrand(brand) : emptyDraft(),
  );
  const [logoFile, setLogoFile] = useState<File | null>(() => savedMedia?.logoFile ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(() => savedMedia?.coverFile ?? null);
  const [pendingLogoUrl, setPendingLogoUrl] = useState('');
  const [pendingCoverUrl, setPendingCoverUrl] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [monthlyExposureBlockOpen, setMonthlyExposureBlockOpen] = useState(false);
  const [monthlyCandidate, setMonthlyCandidate] = useState<string | null>(monthlyBrandId);
  const [previewOpen, setPreviewOpen] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const introInput = useRef<HTMLInputElement>(null);
  const storyTitleInput = useRef<HTMLInputElement>(null);

  const logoUrl = draft.hasLogo ? pendingLogoUrl || savedMedia?.logoUrl || '' : '';
  const coverUrl = draft.hasCover ? pendingCoverUrl || savedMedia?.coverUrl || '' : '';

  useEffect(() => {
    if (!pendingLogoUrl) return;
    return () => URL.revokeObjectURL(pendingLogoUrl);
  }, [pendingLogoUrl]);

  useEffect(() => {
    if (!pendingCoverUrl) return;
    return () => URL.revokeObjectURL(pendingCoverUrl);
  }, [pendingCoverUrl]);

  if (editing && !brand)
    return (
      <AdminEmpty
        title="브랜드를 찾을 수 없습니다"
        description="브랜드 목록에서 다시 선택해 주세요."
      />
    );

  const selectedMonthlyBrand = brands.find((item) => item.id === monthlyBrandId);
  const completeness = [
    draft.hasLogo,
    Boolean(draft.shortIntroduction),
    draft.hasCover,
    Boolean(draft.storyTitle && draft.storyBody),
  ].filter(Boolean).length;
  const update = <K extends keyof AdminBrandDraft>(key: K, value: AdminBrandDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    const errorKey: FormErrorKey | null =
      key === 'name'
        ? 'name'
        : key === 'shortIntroduction'
          ? 'introduction'
          : key === 'hasLogo'
            ? 'logo'
            : key === 'hasCover'
              ? 'cover'
              : key === 'storyTitle' || key === 'storyBody'
                ? 'story'
                : null;
    if (errorKey) setErrors((previous) => ({ ...previous, [errorKey]: undefined }));
  };
  const handleExposureChange = (isExposed: boolean) => {
    if (!isExposed && brand?.id === monthlyBrandId) {
      setMonthlyExposureBlockOpen(true);
      return;
    }
    update('isExposed', isExposed);
  };
  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/svg+xml'].includes(file.type)) {
      setErrors((previous) => ({
        ...previous,
        logo: '로고는 SVG 또는 PNG 파일만 등록할 수 있습니다.',
      }));
      event.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((previous) => ({ ...previous, logo: '로고 파일은 2MB 이하로 등록해 주세요.' }));
      event.target.value = '';
      return;
    }
    setLogoFile(file);
    setPendingLogoUrl(URL.createObjectURL(file));
    update('hasLogo', true);
  };
  const handleCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((previous) => ({
        ...previous,
        cover: '커버는 JPG, PNG, WebP 파일만 등록할 수 있습니다.',
      }));
      event.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((previous) => ({ ...previous, cover: '커버 파일은 10MB 이하로 등록해 주세요.' }));
      event.target.value = '';
      return;
    }
    setCoverFile(file);
    setPendingCoverUrl(URL.createObjectURL(file));
    update('hasCover', true);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!draft.name.trim()) nextErrors.name = '브랜드명을 입력해 주세요.';
    else if (
      brands.some(
        (item) =>
          item.id !== draft.id &&
          item.name.toLocaleLowerCase('ko-KR') === draft.name.trim().toLocaleLowerCase('ko-KR'),
      )
    )
      nextErrors.name = '이미 등록된 브랜드입니다.';
    if (!draft.hasLogo) nextErrors.logo = '로고를 등록해 주세요.';
    if (!draft.shortIntroduction.trim()) nextErrors.introduction = '브랜드 소개를 입력해 주세요.';
    if (Boolean(draft.storyTitle.trim()) !== Boolean(draft.storyBody.trim()))
      nextErrors.story = '스토리 제목과 내용을 함께 입력해 주세요.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.name) nameInput.current?.focus();
      else if (nextErrors.logo) logoInput.current?.focus();
      else if (nextErrors.introduction) introInput.current?.focus();
      else if (nextErrors.story) storyTitleInput.current?.focus();
      return;
    }
    // File references stay in the Admin preview provider; no upload or API mutation occurs.
    saveBrand(
      {
        ...draft,
        name: draft.name.trim(),
        shortIntroduction: draft.shortIntroduction.trim(),
      },
      { logoFile, coverFile },
    );
    navigate('/brands');
  };

  return (
    <section aria-label={editing ? '브랜드 수정' : '브랜드 등록'}>
      <AdminPageHeader
        title={editing ? '브랜드 수정' : '브랜드 등록'}
        description="관리자 화면에서만 입력 내용을 미리봅니다."
        action={
          <Link
            to="/brands"
            className="rounded-8 border border-line-strong px-12 py-8 text-body-s focus-ring"
          >
            브랜드 목록
          </Link>
        }
      />
      <AdminNotice className="mb-16">
        브랜드 정보와 선택한 파일은 메모리 안에서만 유지됩니다. 실제 업로드·저장이나 쇼핑몰 반영은
        하지 않습니다.
      </AdminNotice>
      <form onSubmit={submit} noValidate>
        <div className="grid items-start gap-16 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
          <div className="grid gap-16">
            <AdminPanel title="브랜드 기본 정보">
              <div className="grid gap-16 px-20 py-16">
                <label className="grid gap-6 text-label-s">
                  브랜드명{' '}
                  <span aria-hidden="true" className="text-danger">
                    *
                  </span>
                  <input
                    ref={nameInput}
                    value={draft.name}
                    maxLength={30}
                    aria-invalid={Boolean(errors.name)}
                    onChange={(event) => update('name', event.target.value)}
                    className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s aria-invalid:border-danger"
                  />
                  {errors.name ? (
                    <span role="alert" className="text-caption text-danger">
                      {errors.name}
                    </span>
                  ) : null}
                  <span className="text-right text-caption text-text-3">
                    {draft.name.length}/30
                  </span>
                </label>
                <label className="grid gap-6 text-label-s">
                  영문명
                  <input
                    value={draft.englishName}
                    maxLength={40}
                    onChange={(event) => update('englishName', event.target.value)}
                    className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                  />
                  <span className="text-right text-caption text-text-3">
                    {draft.englishName.length}/40
                  </span>
                </label>
                <fieldset className="grid gap-8">
                  <legend className="text-label-s">
                    브랜드 로고 <span className="text-danger">*</span>
                  </legend>
                  <div className="flex flex-wrap items-center gap-16 rounded-8 border border-line p-12">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="선택한 브랜드 로고 미리보기"
                        className="size-80 rounded-8 border border-line object-contain"
                      />
                    ) : draft.hasLogo ? (
                      <span className="grid size-80 place-items-center rounded-8 bg-surface text-title">
                        {draft.name.slice(0, 1)}
                      </span>
                    ) : (
                      <span className="grid size-80 place-items-center rounded-8 bg-surface text-caption text-text-3">
                        로고 없음
                      </span>
                    )}
                    <div className="grid gap-6">
                      <label htmlFor="brand-logo">로고 파일 선택</label>
                      <input
                        id="brand-logo"
                        ref={logoInput}
                        type="file"
                        accept="image/svg+xml,image/png"
                        aria-invalid={Boolean(errors.logo)}
                        aria-describedby="logo-help"
                        onChange={handleLogo}
                        className="max-w-full text-body-s file:mr-8 file:rounded-6 file:border-0 file:bg-surface file:px-10 file:py-6"
                      />
                      <p id="logo-help" className="text-caption text-text-3">
                        SVG, PNG · 2MB 이하 · 480px 이상 권장
                      </p>
                      {logoFile ? (
                        <span className="text-caption text-text-2">{logoFile.name}</span>
                      ) : null}
                      {errors.logo ? (
                        <span role="alert" className="text-caption text-danger">
                          {errors.logo}
                        </span>
                      ) : null}
                      {draft.hasLogo ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="s"
                          onClick={() => {
                            setLogoFile(null);
                            setPendingLogoUrl('');
                            update('hasLogo', false);
                          }}
                        >
                          로고 제거
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </fieldset>
                <label className="grid gap-6 text-label-s">
                  브랜드 한 줄 소개 <span className="text-danger">*</span>
                  <input
                    ref={introInput}
                    value={draft.shortIntroduction}
                    maxLength={60}
                    aria-invalid={Boolean(errors.introduction)}
                    onChange={(event) => update('shortIntroduction', event.target.value)}
                    className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s aria-invalid:border-danger"
                  />
                  {errors.introduction ? (
                    <span role="alert" className="text-caption text-danger">
                      {errors.introduction}
                    </span>
                  ) : null}
                  <span className="text-right text-caption text-text-3">
                    {draft.shortIntroduction.length}/60
                  </span>
                </label>
                <fieldset className="grid gap-12 rounded-8 border border-line p-12">
                  <legend className="px-4 text-label-s">브랜드 스토리</legend>
                  <label className="grid gap-6 text-label-s">
                    스토리 제목
                    <input
                      ref={storyTitleInput}
                      value={draft.storyTitle}
                      maxLength={40}
                      aria-invalid={Boolean(errors.story)}
                      aria-describedby={errors.story ? 'story-error' : undefined}
                      onChange={(event) => update('storyTitle', event.target.value)}
                      className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                    />
                    <span className="text-right text-caption text-text-3">
                      {draft.storyTitle.length}/40
                    </span>
                  </label>
                  <label className="grid gap-6 text-label-s">
                    스토리 내용
                    <textarea
                      value={draft.storyBody}
                      maxLength={1000}
                      rows={5}
                      aria-invalid={Boolean(errors.story)}
                      aria-describedby={errors.story ? 'story-error' : undefined}
                      onChange={(event) => update('storyBody', event.target.value)}
                      className="resize-y rounded-8 border border-line-control bg-bg px-12 py-10 text-body-s"
                    />
                    <span className="text-right text-caption text-text-3">
                      {draft.storyBody.length}/1000
                    </span>
                  </label>
                  {errors.story ? (
                    <p id="story-error" role="alert" className="text-caption text-danger">
                      {errors.story}
                    </p>
                  ) : null}
                </fieldset>
              </div>
            </AdminPanel>
            <AdminPanel title="브랜드 추가 정보" description="선택 항목입니다.">
              <div className="grid grid-cols-2 gap-12 px-20 py-16">
                <label className="grid gap-6 text-label-s">
                  주요 분야
                  <select
                    value={draft.mainField}
                    onChange={(event) => update('mainField', event.target.value)}
                    className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                  >
                    <option value="">선택해 주세요</option>
                    <option>안전용품</option>
                    <option>작업복</option>
                    <option>보호구</option>
                    <option>공구</option>
                  </select>
                </label>
                <label className="grid gap-6 text-label-s">
                  원산지
                  <input
                    value={draft.originCountry}
                    maxLength={20}
                    onChange={(event) => update('originCountry', event.target.value)}
                    className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                  />
                </label>
                <label className="col-span-2 grid gap-6 text-label-s">
                  인증 정보
                  <input
                    value={draft.certification}
                    maxLength={30}
                    onChange={(event) => update('certification', event.target.value)}
                    className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
                  />
                </label>
              </div>
            </AdminPanel>
          </div>
          <aside className="grid gap-16">
            <AdminPanel
              title="브랜드 커버 이미지"
              description="선택 · JPG, PNG, WebP · 10MB 이하 · 1920×1080 권장"
            >
              <div className="grid gap-12 p-20">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="선택한 브랜드 커버 이미지 미리보기"
                    className="aspect-video w-full rounded-8 border border-line object-cover"
                  />
                ) : draft.hasCover ? (
                  <div className="grid aspect-video place-items-center rounded-8 bg-surface text-body-s text-text-3">
                    등록된 커버 이미지
                  </div>
                ) : (
                  <div className="grid aspect-video place-items-center rounded-8 bg-surface text-body-s text-text-3">
                    커버 이미지 미리보기
                  </div>
                )}
                <label htmlFor="brand-cover" className="text-label-s">
                  커버 이미지 파일
                </label>
                <input
                  id="brand-cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-describedby="cover-help"
                  onChange={handleCover}
                  className="max-w-full text-body-s file:mr-8 file:rounded-6 file:border-0 file:bg-surface file:px-10 file:py-6"
                />
                <p id="cover-help" className="text-caption text-text-3">
                  {errors.cover ?? coverFile?.name ?? '최대 10MB · 16:9 비율 권장'}
                </p>
                {errors.cover ? (
                  <p role="alert" className="text-caption text-danger">
                    {errors.cover}
                  </p>
                ) : null}
                {draft.hasCover ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="s"
                    onClick={() => {
                      setCoverFile(null);
                      setPendingCoverUrl('');
                      update('hasCover', false);
                    }}
                  >
                    커버 제거
                  </Button>
                ) : null}
              </div>
            </AdminPanel>
            <AdminPanel title="노출·이달의 브랜드">
              <div className="grid gap-16 p-20">
                <div className="flex items-center justify-between gap-12">
                  <div>
                    <p className="text-label-s">브랜드 노출</p>
                    <p className="mt-4 text-caption text-text-3">관리자 미리보기만 변경됩니다.</p>
                  </div>
                  <Switch
                    label="브랜드 노출"
                    isChecked={draft.isExposed}
                    onCheckedChange={handleExposureChange}
                    onText="노출"
                    offText="숨김"
                  />
                </div>
                <div className="border-t border-line pt-12">
                  <p className="text-label-s">이달의 브랜드</p>
                  <p className="mt-6 text-body-s">
                    {selectedMonthlyBrand
                      ? `현재: ${selectedMonthlyBrand.name}`
                      : '아직 지정되지 않았습니다.'}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="s"
                    className="mt-10"
                    onClick={() => {
                      setMonthlyCandidate(monthlyBrandId);
                      setMonthlyOpen(true);
                    }}
                  >
                    브랜드 변경
                  </Button>
                </div>
                <div className="border-t border-line pt-12">
                  <div className="flex justify-between gap-8">
                    <p className="text-label-s">정보 완성도</p>
                    <p className="text-label-s">{completeness}/4</p>
                  </div>
                  <ul className="mt-10 grid gap-6 text-body-s text-text-2">
                    <li>{draft.hasLogo ? '✓' : '○'} 로고</li>
                    <li>{draft.shortIntroduction ? '✓' : '○'} 한 줄 소개</li>
                    <li>{draft.hasCover ? '✓' : '○'} 커버 이미지</li>
                    <li>{draft.storyTitle && draft.storyBody ? '✓' : '○'} 브랜드 스토리</li>
                  </ul>
                </div>
                <div className="border-t border-line pt-12">
                  <Button
                    type="button"
                    variant="secondary"
                    size="s"
                    onClick={() => setPreviewOpen(true)}
                  >
                    브랜드 미리보기
                  </Button>
                </div>
                {editing ? (
                  <AdminNotice
                    action={
                      <Link
                        to="/products"
                        className={buttonClassName({ variant: 'secondary', size: 's' })}
                      >
                        상품 보기
                      </Link>
                    }
                  >
                    연결 상품 {brand?.linkedProductCount ?? 0}개 · 수정 내용은 합성 미리보기에만
                    반영됩니다.
                  </AdminNotice>
                ) : null}
              </div>
            </AdminPanel>
            <AdminPanel title="목록 카드 미리보기">
              <div className="m-16 rounded-8 border border-line p-12">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${draft.name || '브랜드'} 로고`}
                    className="size-48 rounded-6 border border-line object-contain"
                  />
                ) : (
                  <span className="grid size-48 place-items-center rounded-6 bg-surface text-label-m">
                    {draft.name.slice(0, 1) || '브'}
                  </span>
                )}
                <p className="mt-10 font-medium">{draft.name || '브랜드명'}</p>
                <p className="mt-4 text-caption text-text-3">
                  {draft.englishName || '영문 브랜드명'}
                </p>
                <p className="mt-8 text-body-s text-text-2">
                  {draft.shortIntroduction || '한 줄 소개가 여기에 표시됩니다.'}
                </p>
              </div>
            </AdminPanel>
          </aside>
        </div>
        <div className="mt-16 flex justify-end gap-8">
          <Link
            to="/brands"
            className="rounded-8 border border-line-strong px-16 py-12 text-label-m focus-ring"
          >
            취소
          </Link>
          <Button type="submit">{editing ? '수정 내용 미리보기' : '브랜드 등록 미리보기'}</Button>
        </div>
      </form>
      <Modal
        isOpen={monthlyOpen}
        onClose={() => setMonthlyOpen(false)}
        title="이달의 브랜드 지정"
        description="관리자 화면에서만 선택 내용을 미리봅니다."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setMonthlyOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                setMonthlyBrand(monthlyCandidate);
                setMonthlyOpen(false);
              }}
            >
              지정하기
            </Button>
          </>
        }
      >
        <div className="mt-16 grid gap-8">
          <label className="flex items-center gap-8 rounded-8 border border-line px-12 py-10 text-body-s">
            <input
              type="radio"
              name="form-monthly-brand"
              checked={monthlyCandidate === null}
              onChange={() => setMonthlyCandidate(null)}
            />
            미지정
          </label>
          {brands.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-8 rounded-8 border border-line px-12 py-10 text-body-s has-[:disabled]:text-text-disabled"
            >
              <input
                type="radio"
                name="form-monthly-brand"
                disabled={!item.isExposed}
                checked={monthlyCandidate === item.id}
                onChange={() => setMonthlyCandidate(item.id)}
              />
              {item.name}
              {item.id === monthlyBrandId ? ' · 현재 지정' : ''}
              {!item.isExposed ? ' · 숨김 상태' : ''}
            </label>
          ))}
        </div>
      </Modal>
      <Modal
        isOpen={monthlyExposureBlockOpen}
        onClose={() => setMonthlyExposureBlockOpen(false)}
        title="이달의 브랜드입니다"
        description="다른 브랜드를 먼저 지정해 주세요."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMonthlyExposureBlockOpen(false)}
            >
              닫기
            </Button>
            <Button
              type="button"
              onClick={() => {
                setMonthlyExposureBlockOpen(false);
                setMonthlyCandidate(monthlyBrandId);
                setMonthlyOpen(true);
              }}
            >
              이달의 브랜드 변경
            </Button>
          </>
        }
      />
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={draft.name || '브랜드 미리보기'}
        actions={
          <Button type="button" onClick={() => setPreviewOpen(false)}>
            닫기
          </Button>
        }
      >
        <div className="mt-16 grid gap-10 text-body-s">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="선택한 브랜드 로고 미리보기"
              className="size-80 rounded-8 border border-line object-contain"
            />
          ) : null}
          <p className="font-medium">{draft.englishName}</p>
          <p>{draft.shortIntroduction || '한 줄 소개가 입력되지 않았습니다.'}</p>
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="선택한 브랜드 커버 이미지 미리보기"
              className="aspect-video w-full rounded-8 object-cover"
            />
          ) : null}
          <p className="font-medium">{draft.storyTitle}</p>
          <p className="whitespace-pre-wrap text-text-2">{draft.storyBody}</p>
          <AdminNotice>
            현재 관리자 화면에서만 입력값을 미리보며 쇼핑몰 사용자 화면에는 표시되지 않습니다.
          </AdminNotice>
        </div>
      </Modal>
    </section>
  );
}
