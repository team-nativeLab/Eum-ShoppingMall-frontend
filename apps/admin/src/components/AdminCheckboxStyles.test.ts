import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const adminStyles = readFileSync(resolve(process.cwd(), 'apps/admin/src/index.css'), 'utf8');

describe('Admin checkbox styles', () => {
  it('uses one blue checked style and consistent dimensions for native checkboxes', () => {
    expect(adminStyles).toMatch(
      /input\[type='checkbox'\]\s*\{[^}]*accent-color:\s*var\(--color-info\) !important;/s,
    );
    expect(adminStyles).toMatch(
      /input\[type='checkbox'\]\s*\{[^}]*-webkit-appearance:\s*none !important;/s,
    );
    expect(adminStyles).toMatch(
      /input\[type='checkbox'\]\s*\{[^}]*width:\s*20px;[^}]*height:\s*20px;/s,
    );
    expect(adminStyles).toMatch(
      /input\[type='checkbox'\]\s*\{[^}]*border:\s*1px solid var\(--color-line-control\);/s,
    );
    expect(adminStyles).toMatch(
      /input\[type='checkbox'\]:checked\s*\{[^}]*background-color:\s*var\(--color-info\) !important;/s,
    );
    expect(adminStyles).toMatch(
      /input\[type='checkbox'\]:checked\s*\{[^}]*border-color:\s*var\(--color-info\) !important;/s,
    );
    expect(adminStyles).toMatch(/input\[type='checkbox'\]:checked::before\s*\{/);
  });

  it('keeps arrow spacing scoped to selects, with checkbox focus and disabled states intact', () => {
    expect(adminStyles).toMatch(/select:not\(\[data-custom-chevron\]\)/);
    expect(adminStyles).not.toMatch(
      /input\[type=['"](?:checkbox|radio|switch)['"]\][^{]*background-image/,
    );
    expect(adminStyles).toMatch(/input\[type='checkbox'\]:focus-visible\s*\{/);
    expect(adminStyles).toMatch(/input\[type='checkbox'\]:disabled\s*\{/);
  });

  it('keeps disabled checked checkboxes gray above the blue checked rule', () => {
    expect(adminStyles).toMatch(
      /input\[type='checkbox'\]:disabled:checked\s*\{[^}]*border-color:\s*var\(--color-text-disabled\) !important;[^}]*background-color:\s*var\(--color-text-disabled\) !important;/s,
    );
  });
});
