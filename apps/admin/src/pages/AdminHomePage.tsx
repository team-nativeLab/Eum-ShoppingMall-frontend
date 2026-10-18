import { Button } from '@eum/ui/components/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SetStateAction } from 'react';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { AdminHomeContentInput, AdminProduct } from '@eum/api/types';

const homeQueryKey = ['admin', 'home-content'];

function moveItem<T>(items: T[], index: number, offset: -1 | 1): T[] {
  const destination = index + offset;
  if (destination < 0 || destination >= items.length) return items;
  const reordered = [...items];
  [reordered[index], reordered[destination]] = [reordered[destination]!, reordered[index]!];
  return reordered;
}

export function AdminHomePage() {
  const queryClient = useQueryClient();
  const contentQuery = useQuery({
    queryKey: homeQueryKey,
    queryFn: async ({ signal }) => (await getShopApi()).home.getAdminContent({ signal }),
  });
  const productsQuery = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: async ({ signal }) => (await getShopApi()).products.adminList({ signal }),
  });
  const [draftState, setDraftState] = useState<AdminHomeContentInput | null>(null);
  const draft = draftState ?? contentQuery.data ?? null;
  const setDraft = (action: SetStateAction<AdminHomeContentInput | null>) => {
    setDraftState((current) => {
      const base = current ?? contentQuery.data ?? null;
      return typeof action === 'function' ? action(base) : action;
    });
  };
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  if (contentQuery.isPending || productsQuery.isPending)
    return <AdminLoading label="홈 편성을 불러오는 중입니다." />;
  if (contentQuery.isError || productsQuery.isError)
    return (
      <AdminError
        title="홈 편성을 불러오지 못했습니다"
        onRetry={() => {
          void contentQuery.refetch();
          void productsQuery.refetch();
        }}
      />
    );
  if (!draft) return <AdminEmpty title="홈 편성 데이터를 사용할 수 없습니다" />;
  const products = productsQuery.data;
  const updateHero = (
    index: number,
    update: (
      value: AdminHomeContentInput['heroSlides'][number],
    ) => AdminHomeContentInput['heroSlides'][number],
  ) =>
    setDraft(
      (current) =>
        current && {
          ...current,
          heroSlides: current.heroSlides.map((item, itemIndex) =>
            itemIndex === index ? update(item) : item,
          ),
        },
    );
  const updatePromo = (
    index: number,
    update: (
      value: AdminHomeContentInput['promoBanners'][number],
    ) => AdminHomeContentInput['promoBanners'][number],
  ) =>
    setDraft(
      (current) =>
        current && {
          ...current,
          promoBanners: current.promoBanners.map((item, itemIndex) =>
            itemIndex === index ? update(item) : item,
          ),
        },
    );
  const updateBenefit = (
    index: number,
    update: (
      value: AdminHomeContentInput['serviceBenefits'][number],
    ) => AdminHomeContentInput['serviceBenefits'][number],
  ) =>
    setDraft(
      (current) =>
        current && {
          ...current,
          serviceBenefits: current.serviceBenefits.map((item, itemIndex) =>
            itemIndex === index ? update(item) : item,
          ),
        },
    );
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const saved = await (await getShopApi()).home.saveAdminContent(draft);
      setDraft(saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: homeQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['home', 'content'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
      setMessage('홈 편성을 프론트엔드 목 API에 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '홈 편성을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };
  const updateSelectedProduct = (product: AdminProduct, checked: boolean) => {
    setDraft(
      (current) =>
        current && {
          ...current,
          featuredProductIds: checked
            ? [...new Set([...current.featuredProductIds, product.id])]
            : current.featuredProductIds.filter((id) => id !== product.id),
        },
    );
  };
  const addHero = () =>
    setDraft(
      (current) =>
        current && {
          ...current,
          heroSlides: [
            ...current.heroSlides,
            {
              id: `hero-${Date.now()}`,
              eyebrow: '',
              title: [''],
              description: '',
              tagline: [],
              imageUrl: '',
              destination: '/',
              ctaLabel: '',
            },
          ],
        },
    );
  const addPromo = () =>
    setDraft(
      (current) =>
        current && {
          ...current,
          promoBanners: [
            ...current.promoBanners,
            {
              id: `promo-${Date.now()}`,
              title: [''],
              description: '',
              imageUrl: '',
              tone: 'dark',
              destination: '/',
            },
          ],
        },
    );
  const addBenefit = () =>
    setDraft(
      (current) =>
        current && {
          ...current,
          serviceBenefits: [
            ...current.serviceBenefits,
            { id: `benefit-${Date.now()}`, title: '', description: '' },
          ],
        },
    );

  return (
    <section aria-label="홈 편성 관리">
      <AdminPageHeader
        title="홈 편성"
        description="홈 배너, 추천 상품, 이벤트 진입 CTA와 배송 혜택을 편집합니다."
        action={
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? '저장 중…' : '변경 사항 저장'}
          </Button>
        }
      />
      {message ? (
        <p role="status" className="mb-12 text-body-s text-text-2">
          {message}
        </p>
      ) : null}
      <nav
        aria-label="홈 편성 섹션 바로가기"
        className="mb-16 flex flex-wrap gap-8 rounded-8 border border-line bg-bg p-12"
      >
        {[
          ['home-hero', '히어로 슬라이드'],
          ['home-promotions', '프로모션 카드'],
          ['home-benefits', '배송·서비스 혜택'],
          ['home-products', '추천 상품'],
          ['home-cta', '맞춤 주문 CTA'],
        ].map(([sectionId, label]) => (
          <a
            key={sectionId}
            href={`#${sectionId}`}
            className="rounded-6 border border-line-control px-10 py-6 text-caption text-text-2 focus-ring hover:bg-surface"
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="grid gap-16">
        <AdminPanel
          id="home-hero"
          title={`히어로 슬라이드 (${draft.heroSlides.length})`}
          action={
            <Button type="button" variant="secondary" size="s" onClick={addHero}>
              슬라이드 추가
            </Button>
          }
        >
          <div className="grid gap-12 p-16">
            {draft.heroSlides.map((slide, index) => (
              <fieldset key={slide.id} className="grid gap-10 rounded-8 border border-line p-12">
                <legend className="px-4 text-label-m">히어로 {index + 1}</legend>
                <div className="flex gap-6">
                  <Button
                    type="button"
                    variant="secondary"
                    size="s"
                    disabled={index === 0}
                    onClick={() =>
                      setDraft(
                        (current) =>
                          current && {
                            ...current,
                            heroSlides: moveItem(current.heroSlides, index, -1),
                          },
                      )
                    }
                  >
                    위로
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="s"
                    disabled={index === draft.heroSlides.length - 1}
                    onClick={() =>
                      setDraft(
                        (current) =>
                          current && {
                            ...current,
                            heroSlides: moveItem(current.heroSlides, index, 1),
                          },
                      )
                    }
                  >
                    아래로
                  </Button>
                </div>
                <label className="grid gap-4 text-label-s">
                  상단 문구
                  <input
                    value={slide.eyebrow}
                    onChange={(event) =>
                      updateHero(index, (value) => ({ ...value, eyebrow: event.target.value }))
                    }
                    className="h-36 rounded-6 border border-line-control px-8"
                  />
                </label>
                <label className="grid gap-4 text-label-s">
                  제목 (줄바꿈으로 분리)
                  <textarea
                    value={slide.title.join('\n')}
                    onChange={(event) =>
                      updateHero(index, (value) => ({
                        ...value,
                        title: event.target.value.split('\n'),
                      }))
                    }
                    rows={2}
                    className="rounded-6 border border-line-control p-8"
                  />
                </label>
                <label className="grid gap-4 text-label-s">
                  설명
                  <textarea
                    value={slide.description}
                    onChange={(event) =>
                      updateHero(index, (value) => ({ ...value, description: event.target.value }))
                    }
                    rows={2}
                    className="rounded-6 border border-line-control p-8"
                  />
                </label>
                <label className="grid gap-4 text-label-s">
                  이미지 URL
                  <input
                    type="url"
                    value={slide.imageUrl}
                    onChange={(event) =>
                      updateHero(index, (value) => ({ ...value, imageUrl: event.target.value }))
                    }
                    className="h-36 rounded-6 border border-line-control px-8"
                  />
                </label>
                <div className="grid gap-8 sm:grid-cols-3">
                  <label className="grid gap-4 text-label-s">
                    이동 경로
                    <input
                      value={slide.destination}
                      onChange={(event) =>
                        updateHero(index, (value) => ({
                          ...value,
                          destination: event.target.value,
                        }))
                      }
                      className="h-36 rounded-6 border border-line-control px-8"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    버튼 문구
                    <input
                      value={slide.ctaLabel}
                      onChange={(event) =>
                        updateHero(index, (value) => ({ ...value, ctaLabel: event.target.value }))
                      }
                      className="h-36 rounded-6 border border-line-control px-8"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    세로 태그라인
                    <input
                      value={slide.tagline.join(' / ')}
                      onChange={(event) =>
                        updateHero(index, (value) => ({
                          ...value,
                          tagline: event.target.value
                            .split('/')
                            .map((part) => part.trim())
                            .filter(Boolean),
                        }))
                      }
                      className="h-36 rounded-6 border border-line-control px-8"
                    />
                  </label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="s"
                  onClick={() =>
                    setDraft(
                      (current) =>
                        current && {
                          ...current,
                          heroSlides: current.heroSlides.filter((item) => item.id !== slide.id),
                        },
                    )
                  }
                >
                  슬라이드 제거
                </Button>
              </fieldset>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel
          id="home-promotions"
          title={`프로모션 카드 (${draft.promoBanners.length})`}
          action={
            <Button type="button" variant="secondary" size="s" onClick={addPromo}>
              카드 추가
            </Button>
          }
        >
          <div className="grid gap-12 p-16">
            {draft.promoBanners.map((banner, index) => (
              <fieldset key={banner.id} className="grid gap-8 rounded-8 border border-line p-12">
                <legend className="px-4 text-label-m">프로모션 {index + 1}</legend>
                <div className="flex gap-6">
                  <Button
                    type="button"
                    variant="secondary"
                    size="s"
                    disabled={index === 0}
                    onClick={() =>
                      setDraft(
                        (current) =>
                          current && {
                            ...current,
                            promoBanners: moveItem(current.promoBanners, index, -1),
                          },
                      )
                    }
                  >
                    위로
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="s"
                    disabled={index === draft.promoBanners.length - 1}
                    onClick={() =>
                      setDraft(
                        (current) =>
                          current && {
                            ...current,
                            promoBanners: moveItem(current.promoBanners, index, 1),
                          },
                      )
                    }
                  >
                    아래로
                  </Button>
                </div>
                <label className="grid gap-4 text-label-s">
                  제목 (줄바꿈으로 분리)
                  <textarea
                    value={banner.title.join('\n')}
                    onChange={(event) =>
                      updatePromo(index, (value) => ({
                        ...value,
                        title: event.target.value.split('\n'),
                      }))
                    }
                    rows={2}
                    className="rounded-6 border border-line-control p-8"
                  />
                </label>
                <label className="grid gap-4 text-label-s">
                  설명
                  <textarea
                    value={banner.description}
                    onChange={(event) =>
                      updatePromo(index, (value) => ({ ...value, description: event.target.value }))
                    }
                    rows={2}
                    className="rounded-6 border border-line-control p-8"
                  />
                </label>
                <div className="grid gap-8 sm:grid-cols-3">
                  <label className="grid gap-4 text-label-s">
                    이미지 URL
                    <input
                      type="url"
                      value={banner.imageUrl}
                      onChange={(event) =>
                        updatePromo(index, (value) => ({ ...value, imageUrl: event.target.value }))
                      }
                      className="h-36 rounded-6 border border-line-control px-8"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    이동 경로
                    <input
                      value={banner.destination}
                      onChange={(event) =>
                        updatePromo(index, (value) => ({
                          ...value,
                          destination: event.target.value,
                        }))
                      }
                      className="h-36 rounded-6 border border-line-control px-8"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    톤
                    <select
                      value={banner.tone}
                      onChange={(event) =>
                        updatePromo(index, (value) => ({
                          ...value,
                          tone: event.target.value as typeof value.tone,
                        }))
                      }
                      className="h-36 rounded-6 border border-line-control px-8"
                    >
                      <option value="dark">어두움</option>
                      <option value="light">밝음</option>
                    </select>
                  </label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="s"
                  onClick={() =>
                    setDraft(
                      (current) =>
                        current && {
                          ...current,
                          promoBanners: current.promoBanners.filter(
                            (item) => item.id !== banner.id,
                          ),
                        },
                    )
                  }
                >
                  카드 제거
                </Button>
              </fieldset>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel
          id="home-benefits"
          title={`배송·서비스 혜택 (${draft.serviceBenefits.length})`}
          action={
            <Button type="button" variant="secondary" size="s" onClick={addBenefit}>
              혜택 추가
            </Button>
          }
        >
          <div className="grid gap-10 p-16">
            {draft.serviceBenefits.map((benefit, index) => (
              <div key={benefit.id} className="grid gap-8 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
                <label className="grid gap-4 text-label-s">
                  혜택 제목
                  <input
                    value={benefit.title}
                    onChange={(event) =>
                      updateBenefit(index, (value) => ({ ...value, title: event.target.value }))
                    }
                    className="h-36 rounded-6 border border-line-control px-8"
                  />
                </label>
                <label className="grid gap-4 text-label-s">
                  혜택 설명
                  <input
                    value={benefit.description}
                    onChange={(event) =>
                      updateBenefit(index, (value) => ({
                        ...value,
                        description: event.target.value,
                      }))
                    }
                    className="h-36 rounded-6 border border-line-control px-8"
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="s"
                  disabled={index === 0}
                  onClick={() =>
                    setDraft(
                      (current) =>
                        current && {
                          ...current,
                          serviceBenefits: moveItem(current.serviceBenefits, index, -1),
                        },
                    )
                  }
                >
                  위로
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="s"
                  disabled={index === draft.serviceBenefits.length - 1}
                  onClick={() =>
                    setDraft(
                      (current) =>
                        current && {
                          ...current,
                          serviceBenefits: moveItem(current.serviceBenefits, index, 1),
                        },
                    )
                  }
                >
                  아래로
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="s"
                  onClick={() =>
                    setDraft(
                      (current) =>
                        current && {
                          ...current,
                          serviceBenefits: current.serviceBenefits.filter(
                            (item) => item.id !== benefit.id,
                          ),
                        },
                    )
                  }
                >
                  삭제
                </Button>
              </div>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel
          id="home-products"
          title="홈 추천 상품"
          description="웹 홈의 베스트셀러 영역에서 표시할 상품을 선택합니다."
        >
          <div className="grid gap-8 p-16 md:grid-cols-2">
            {products
              .filter((product) => product.isVisible !== false)
              .map((product) => (
                <label
                  key={product.id}
                  className="flex items-center gap-8 rounded-8 border border-line px-12 py-10"
                >
                  <input
                    type="checkbox"
                    checked={draft.featuredProductIds.includes(product.id)}
                    onChange={(event) => updateSelectedProduct(product, event.target.checked)}
                  />
                  <span>
                    {product.name}
                    <small className="ml-8 text-text-3">{product.brand}</small>
                  </span>
                </label>
              ))}
          </div>
        </AdminPanel>
        <AdminPanel
          id="home-cta"
          title="맞춤 주문 CTA"
          description="홈 하단 이벤트·견적 진입 영역입니다."
        >
          <div className="grid gap-10 p-16">
            <label className="flex items-center gap-8 text-label-s">
              <input
                type="checkbox"
                checked={Boolean(draft.ctaBand)}
                onChange={(event) =>
                  setDraft(
                    (current) =>
                      current && {
                        ...current,
                        ctaBand: event.target.checked
                          ? {
                              eyebrow: '',
                              title: '',
                              cta: { label: '', destination: '/solutions' },
                            }
                          : null,
                      },
                  )
                }
              />
              홈에 CTA 표시
            </label>
            {draft.ctaBand ? (
              <>
                <label className="grid gap-4 text-label-s">
                  상단 문구
                  <input
                    value={draft.ctaBand.eyebrow}
                    onChange={(event) =>
                      setDraft((current) =>
                        current?.ctaBand
                          ? {
                              ...current,
                              ctaBand: { ...current.ctaBand, eyebrow: event.target.value },
                            }
                          : current,
                      )
                    }
                    className="h-36 rounded-6 border border-line-control px-8"
                  />
                </label>
                <label className="grid gap-4 text-label-s">
                  제목
                  <input
                    value={draft.ctaBand.title}
                    onChange={(event) =>
                      setDraft((current) =>
                        current?.ctaBand
                          ? {
                              ...current,
                              ctaBand: { ...current.ctaBand, title: event.target.value },
                            }
                          : current,
                      )
                    }
                    className="h-36 rounded-6 border border-line-control px-8"
                  />
                </label>
                <div className="grid gap-8 sm:grid-cols-2">
                  <label className="grid gap-4 text-label-s">
                    버튼 문구
                    <input
                      value={draft.ctaBand.cta.label}
                      onChange={(event) =>
                        setDraft((current) =>
                          current?.ctaBand
                            ? {
                                ...current,
                                ctaBand: {
                                  ...current.ctaBand,
                                  cta: { ...current.ctaBand.cta, label: event.target.value },
                                },
                              }
                            : current,
                        )
                      }
                      className="h-36 rounded-6 border border-line-control px-8"
                    />
                  </label>
                  <label className="grid gap-4 text-label-s">
                    이동 경로
                    <input
                      value={draft.ctaBand.cta.destination}
                      onChange={(event) =>
                        setDraft((current) =>
                          current?.ctaBand
                            ? {
                                ...current,
                                ctaBand: {
                                  ...current.ctaBand,
                                  cta: { ...current.ctaBand.cta, destination: event.target.value },
                                },
                              }
                            : current,
                        )
                      }
                      className="h-36 rounded-6 border border-line-control px-8"
                    />
                  </label>
                </div>
              </>
            ) : null}
          </div>
        </AdminPanel>
      </div>
      <div className="mt-16 flex justify-end">
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? '저장 중…' : '변경 사항 저장'}
        </Button>
      </div>
    </section>
  );
}
