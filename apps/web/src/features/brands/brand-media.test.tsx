import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandLogo } from './brand-media';

describe('BrandLogo', () => {
  it('uses Next Image for same-origin paths and retains loading, alt text, and fit', () => {
    render(
      <BrandLogo
        logoUrl="/test-placeholder.png"
        brandName="테스트 브랜드"
        className="size-full"
        loading="eager"
        settings={{ fit: 'contain', width: 320, height: 160 }}
      />,
    );

    const image = screen.getByRole('img', { name: '테스트 브랜드 로고' });
    expect(image).toHaveAttribute('src', expect.stringContaining('/_next/image?url='));
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveStyle({ objectFit: 'contain' });
    expect(image.parentElement).toHaveClass('relative', 'size-full', 'overflow-hidden');
  });

  it.each(['https://images.example.com/brand.webp', 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'])(
    'keeps non-local source %s on the native image path',
    (logoUrl) => {
      render(<BrandLogo logoUrl={logoUrl} brandName="테스트 브랜드" />);

      const image = screen.getByRole('img', { name: '테스트 브랜드 로고' });
      expect(image).toHaveAttribute('src', logoUrl);
      expect(image).toHaveAttribute('loading', 'lazy');
    },
  );

  it('keeps the empty logo placeholder unchanged', () => {
    render(<BrandLogo logoUrl={null} brandName="테스트 브랜드" />);

    expect(screen.getByRole('img', { name: '테스트 브랜드 로고' })).toBeInTheDocument();
  });
});
