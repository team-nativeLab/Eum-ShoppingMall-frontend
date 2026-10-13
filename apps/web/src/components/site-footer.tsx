import { PageContainer } from './page-container';

/** 임시 하단 영역(빈 레이아웃 골격). 2단계에서 HF/Web/Footer로 바꿉니다. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg-subtle">
      <PageContainer className="py-40 text-caption text-text-3">
        <p>이음산업건설</p>
      </PageContainer>
    </footer>
  );
}
