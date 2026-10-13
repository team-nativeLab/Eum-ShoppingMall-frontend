import { Heart, type LucideIcon, type LucideProps } from 'lucide-react';

/**
 * Figma HF/Icon(Lucide 기준) → lucide-react 매핑 메모.
 * Figma 아이콘 90개 중 89개는 이름을 PascalCase로 바꾸면 그대로 lucide-react export입니다
 * (예: circle-alert → CircleAlert, building-2 → Building2).
 * 예외: heart-filled는 Lucide에 없어 아래 HeartFilled(Heart + 채움)로 대신합니다.
 * 아이콘을 이름 문자열로 고르는 맵을 두면 90개가 모두 번들에 들어가므로, 컴포넌트를 직접 import해서 넘깁니다.
 */

/** Figma 아이콘 크기 단계 */
export type IconSize = 12 | 14 | 16 | 20 | 24 | 28;

export interface IconProps extends Omit<LucideProps, 'size' | 'ref'> {
  /** lucide-react 아이콘 컴포넌트 */
  icon: LucideIcon;
  size?: IconSize;
  /** 의미가 있는 아이콘이면 읽어 줄 이름. 없으면 장식용으로 숨깁니다. */
  label?: string;
}

/** 디자인 기준(stroke 1.5)을 적용한 아이콘. 강조 상태는 strokeWidth={2}로 덮어씁니다. */
export function Icon({
  icon: IconComponent,
  size = 24,
  label,
  strokeWidth = 1.5,
  ...restProps
}: IconProps) {
  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
      {...restProps}
    />
  );
}

/** Figma heart-filled: Lucide Heart를 현재 색으로 채운 아이콘 */
export function HeartFilled(props: LucideProps) {
  return <Heart fill="currentColor" {...props} />;
}
