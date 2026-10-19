import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductDescription } from './product-description';

describe('ProductDescription', () => {
  it('renders marked admin editor formatting as semantic elements', () => {
    render(
      <ProductDescription
        content={'**굵게** *기울임* ++밑줄++\n- 목록\n[링크](https://example.com)'}
        format="rich-v1"
      />,
    );

    expect(screen.getByText('굵게').tagName).toBe('STRONG');
    expect(screen.getByText('기울임').tagName).toBe('EM');
    expect(screen.getByText('밑줄').tagName).toBe('U');
    expect(screen.getByText('목록').closest('li')).not.toBeNull();
    expect(screen.getByRole('link', { name: '링크' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
  });

  it('keeps legacy text and line breaks literal, including marker-like text', () => {
    const legacyText =
      '<!--eum-rich-text:v1-->\n*강조처럼 보이는 텍스트*\n[문구](https://example.com)';
    const { container } = render(<ProductDescription content={legacyText} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('em')).not.toBeInTheDocument();
    expect(container.firstElementChild?.textContent).toBe(legacyText);
    expect(container.firstElementChild).toHaveClass('whitespace-pre-line');
  });

  it('allows HTTPS and same-origin paths while rejecting unsafe link protocols and paths', () => {
    render(
      <ProductDescription
        content={
          '[HTTPS](https://example.com)\n[경로](/products/1)\n[스크립트](javascript:alert)\n[데이터](data:text/html,x)\n[외부 경로](//example.com)\n[백슬래시](\\evil.example)'
        }
        format="rich-v1"
      />,
    );

    expect(screen.getByRole('link', { name: 'HTTPS' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(screen.getByRole('link', { name: '경로' })).toHaveAttribute('href', '/products/1');
    expect(screen.queryByRole('link', { name: '스크립트' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '데이터' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '외부 경로' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '백슬래시' })).not.toBeInTheDocument();
  });

  it('renders unsafe links and HTML as text without interpreting them', () => {
    const content = '[위험](javascript:alert)\n<img src=x onerror="alert(1)">';
    render(<ProductDescription content={content} format="rich-v1" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('[위험](javascript:alert)')).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
