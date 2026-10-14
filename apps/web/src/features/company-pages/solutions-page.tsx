import { Checkbox } from '@eum/ui/components/Checkbox';
import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { Radio } from '@eum/ui/components/Radio';
import { TextField } from '@eum/ui/components/TextField';
import { cx } from '@eum/ui/lib/cx';
import { ChevronRight, Upload } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/page-container';
import { CompanyContactSummary } from './company-contact-summary';
import { QuoteDateField } from './quote-date-field';
import { QuoteDetailsField } from './quote-details-field';

const PROCESS_STEPS = [
  { title: '문의 접수', description: '품목·수량·납기를 알려주세요.' },
  { title: '상담', description: '담당자가 요구사항을 확인합니다.' },
  { title: '견적서 발송', description: '맞춤 견적서를 보내드립니다.' },
  { title: '제작·납품', description: '확정 후 제작·납품합니다.' },
] as const;

const CUSTOM_ITEMS = [
  '작업복·유니폼 로고 인쇄',
  '안전모 로고·색상 맞춤',
  '현장 표지판·안전 시설물',
  '대량 정기 납품',
] as const;

const INTEREST_ITEMS = [
  '개인보호장비',
  '작업복/유니폼',
  '교통·도로 안전',
  '소방·방재용품',
  '산업 현장용품',
  '보안·감시',
  '생활 안전용품',
  '맞춤 제작/납품',
] as const;

function InterestItemChoices() {
  return (
    <fieldset className="flex flex-col gap-12">
      <legend className="text-label-m">관심 품목</legend>
      <div className="flex flex-wrap gap-8">
        {INTEREST_ITEMS.map((interestItem, index) => (
          <label key={interestItem} className="cursor-pointer">
            <input
              type="checkbox"
              name="interestItems"
              value={interestItem}
              defaultChecked={index < 2}
              className="peer sr-only"
            />
            <span
              className={cx(
                'inline-flex h-36 items-center rounded-capsule border border-line-strong bg-bg px-14 text-label-m text-text-2 transition-colors',
                'peer-checked:border-text-1 peer-checked:bg-text-1 peer-checked:text-inverse',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-1',
              )}
            >
              {interestItem}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function InquiryProductsPanel() {
  return (
    <section
      aria-labelledby="inquiry-products-title"
      className="flex flex-col gap-12 rounded-12 border border-line bg-bg-subtle p-20"
    >
      <div className="flex items-center justify-between gap-12">
        <h2 id="inquiry-products-title" className="text-label-l">
          문의 상품
        </h2>
        <Button type="button" variant="ghost" size="s" disabled>
          상품 추가
        </Button>
      </div>
      <div className="flex min-w-0 items-center gap-12">
        <span aria-hidden="true" className="size-48 shrink-0 rounded-6 bg-surface" />
        <div className="min-w-0">
          <p className="text-body-s-medium">상품 선택 대기</p>
          <p className="mt-2 text-caption text-text-3">선택한 상품이 여기에 표시됩니다.</p>
        </div>
      </div>
    </section>
  );
}

function CustomItemsPanel() {
  return (
    <section aria-labelledby="custom-items-title" className="flex flex-col gap-8">
      <h2 id="custom-items-title" className="text-h3">
        맞춤 제작 가능 품목
      </h2>
      <ul className="flex flex-col">
        {CUSTOM_ITEMS.map((customItem) => (
          <li key={customItem} className="border-b border-line last:border-b-0">
            <a
              href="#quote-form"
              className="flex min-h-56 items-center justify-between gap-12 rounded-4 text-body-l focus-ring hover:text-text-2"
            >
              <span>{customItem}</span>
              <Icon icon={ChevronRight} size={20} className="shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuoteFormVisual() {
  return (
    <section id="quote-form" aria-label="견적 문의 입력" className="min-w-0 scroll-mt-80">
      <div className="flex flex-col gap-24">
        <InquiryProductsPanel />

        <fieldset className="flex flex-col gap-12">
          <legend className="text-label-m">문의 유형 *</legend>
          <div className="flex flex-wrap gap-x-24 gap-y-12">
            <Radio name="inquiryType" value="custom" defaultChecked>
              맞춤 제작
            </Radio>
            <Radio name="inquiryType" value="bulk">
              대량 구매
            </Radio>
            <Radio name="inquiryType" value="regular-supply">
              정기 납품
            </Radio>
            <Radio name="inquiryType" value="other">
              기타
            </Radio>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-24 min-[600px]:grid-cols-2">
          <TextField
            label="회사명 *"
            name="companyName"
            autoComplete="organization"
            placeholder="회사명을 입력해 주세요"
            required
          />
          <TextField
            label="담당자명 *"
            name="contactName"
            autoComplete="name"
            placeholder="담당자 이름을 입력해 주세요"
            required
          />
          <TextField
            label="연락처 *"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="숫자만 입력해 주세요"
            required
          />
          <TextField
            label="이메일 *"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            required
          />
        </div>

        <InterestItemChoices />

        <div className="grid grid-cols-1 gap-24 min-[600px]:grid-cols-2">
          <TextField
            label="예상 수량"
            name="quantity"
            type="number"
            min={1}
            placeholder="예: 300개"
          />
          <QuoteDateField />
        </div>

        <TextField
          label="납품 지역"
          name="deliveryLocation"
          autoComplete="address-level2"
          placeholder="예: 경기도 00시"
        />

        <QuoteDetailsField />

        <div
          role="group"
          aria-disabled="true"
          aria-label="파일 첨부 영역. 파일 업로드 기능은 준비 중입니다."
          className="flex h-120 flex-col items-center justify-center gap-8 rounded-12 border border-dashed border-line-control text-center"
        >
          <Icon icon={Upload} size={24} className="text-text-2" />
          <p className="px-12 text-body-s text-text-2">
            파일 첨부 기능을 준비 중입니다. (도면·이미지)
          </p>
          <p className="text-caption text-text-3">허용 형식·용량 안내는 기능 연결 후 제공됩니다.</p>
        </div>

        <div className="flex flex-col gap-12">
          <div className="flex items-center justify-between gap-12">
            <Checkbox name="privacyAgreement" required>
              [필수] 개인정보 수집·이용 동의
            </Checkbox>
            <Link
              href="/privacy"
              className="shrink-0 rounded-4 text-label-s text-text-2 underline focus-ring"
            >
              보기
            </Link>
          </div>
          <p id="quote-submit-description" className="text-caption text-text-3">
            견적 문의 접수 기능은 아직 연결되지 않았습니다.
          </p>
          <Button
            type="button"
            size="l"
            isFullWidth
            disabled
            aria-describedby="quote-submit-description"
          >
            견적 문의 접수
          </Button>
        </div>
      </div>
    </section>
  );
}

/** 안전 솔루션 문의 과정을 소개하고 입력 화면을 보여 줍니다. */
export function SolutionsPageContent() {
  return (
    <PageContainer className="pt-48 pb-64 max-[600px]:px-16 lg:pt-64 lg:pb-120">
      <div className="flex flex-col gap-48 lg:gap-64">
        <section aria-labelledby="solutions-title" className="flex flex-col gap-32">
          <div className="flex flex-col gap-12">
            <p className="text-overline tracking-[0.16em] text-text-3">Safety Solution</p>
            <h1 id="solutions-title" className="text-h1 lg:text-[36px] lg:leading-[48px]">
              현장을 위한 맞춤 안전 솔루션
            </h1>
            <p className="max-w-[720px] text-body-s text-text-2 lg:text-body-l">
              필요한 품목·수량·납기를 알려주시면 담당자가 맞춤 견적을 보내드립니다.
            </p>
          </div>

          <ol className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-24">
            {PROCESS_STEPS.map((processStep, index) => (
              <li
                key={processStep.title}
                className="flex min-h-132 flex-col rounded-12 border border-line bg-bg-subtle p-20 lg:p-24"
              >
                <p className="text-overline tracking-[0.16em] text-text-3">
                  Step {String(index + 1).padStart(2, '0')}
                </p>
                <h2 className="mt-8 text-h3">{processStep.title}</h2>
                <p className="mt-4 text-body-s text-text-2">{processStep.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid items-start gap-32 lg:grid-cols-[minmax(0,416px)_minmax(0,1fr)] lg:gap-24">
          <aside className="flex min-w-0 flex-col gap-24">
            <CustomItemsPanel />
            <div className="flex flex-col gap-12 rounded-12 border border-line bg-bg-subtle p-24">
              <p className="text-overline tracking-[0.16em] text-text-3">Contact</p>
              <div className="flex flex-col gap-4">
                <h2 className="text-label-l">견적 담당자</h2>
                <CompanyContactSummary variant="quote" />
              </div>
            </div>
          </aside>

          <QuoteFormVisual />
        </div>
      </div>
    </PageContainer>
  );
}
