import { ImageIcon } from 'lucide-react';

/** 상품 사진이 아직 없는 경우에도 크기와 대비가 유지되는 Figma 스타일 플레이스홀더입니다. */
export function ProductImage({
  src,
  alt,
  className = '',
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return src ? (
    // API가 반환하는 상품 이미지 URL은 외부 호스트일 수 있어 Next Image 최적화를 거치지 않습니다.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`size-full object-cover ${className}`} loading="lazy" />
  ) : (
    <div
      role="img"
      aria-label={alt}
      className={`flex size-full items-center justify-center bg-[linear-gradient(135deg,#f5f5f5,#e8e8e8)] text-ph-glyph ${className}`}
    >
      <ImageIcon aria-hidden="true" size={28} strokeWidth={1.2} />
    </div>
  );
}
