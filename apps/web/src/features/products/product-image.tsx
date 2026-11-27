import { ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { isLocalImageSource } from '@/lib/image-source';

/** 상품 사진이 아직 없는 경우에도 크기와 대비가 유지되는 Figma 스타일 플레이스홀더입니다. */
export function ProductImage({
  src,
  alt,
  sizes,
  className = '',
  loading = 'lazy',
  fetchPriority,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'low' | 'high' | 'auto';
}) {
  return src && isLocalImageSource(src) ? (
    // 호출부의 size-full 부모가 aspect ratio와 표시 크기를 이미 예약합니다.
    <Image
      src={src}
      alt={alt}
      width={1}
      height={1}
      sizes={sizes}
      className={`size-full object-cover ${className}`}
      loading={loading}
      {...(fetchPriority ? { fetchPriority } : {})}
    />
  ) : src ? (
    // 실서비스 상품 이미지 URL은 외부 호스트나 data URL일 수 있습니다.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`size-full object-cover ${className}`}
      loading={loading}
      {...(fetchPriority ? { fetchPriority } : {})}
    />
  ) : (
    <div
      role="img"
      aria-label={alt}
      className={`flex size-full items-center justify-center bg-linear-135 from-surface to-surface-2 text-ph-glyph ${className}`}
    >
      <ImageIcon aria-hidden="true" size={28} strokeWidth={1.2} />
    </div>
  );
}
