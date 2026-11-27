import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductImage } from './product-image';

describe('ProductImage', () => {
  it('uses Next Image for same-origin paths while preserving lazy loading and alt text', () => {
    render(
      <ProductImage
        src="/test-placeholder.png"
        alt="상품 사진"
        sizes="(min-width: 700px) 600px, 100vw"
      />,
    );

    const image = screen.getByRole('img', { name: '상품 사진' });
    expect(image).toHaveAttribute('src', expect.stringContaining('/_next/image?url='));
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).not.toHaveAttribute('fetchpriority');
    expect(image).toHaveAttribute('sizes', '(min-width: 700px) 600px, 100vw');
    expect(image).toHaveClass('size-full', 'object-cover');
  });

  it('forwards eager loading and high fetch priority to local Next Image', () => {
    render(
      <ProductImage
        src="/test-placeholder.png"
        alt="상품 사진"
        sizes="600px"
        loading="eager"
        fetchPriority="high"
      />,
    );

    const image = screen.getByRole('img', { name: '상품 사진' });
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });

  it.each(['https://images.example.com/product.webp', 'data:image/png;base64,ZmFrZQ=='])(
    'keeps non-local source %s on the native image path',
    (src) => {
      render(<ProductImage src={src} alt="상품 사진" sizes="600px" />);

      expect(screen.getByRole('img', { name: '상품 사진' })).toHaveAttribute('src', src);
    },
  );

  it('forwards eager loading and high fetch priority to remote image fallback', () => {
    render(
      <ProductImage
        src="https://images.example.com/product.webp"
        alt="상품 사진"
        sizes="600px"
        loading="eager"
        fetchPriority="high"
      />,
    );

    const image = screen.getByRole('img', { name: '상품 사진' });
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });

  it('keeps the empty image placeholder unchanged', () => {
    render(<ProductImage src={null} alt="상품 사진 없음" sizes="600px" />);

    expect(screen.getByRole('img', { name: '상품 사진 없음' })).toBeInTheDocument();
  });
});
