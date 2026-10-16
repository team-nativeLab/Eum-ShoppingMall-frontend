import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(resolve(process.cwd(), 'packages/ui/src/tokens.css'), 'utf8');

describe('rating color tokens', () => {
  it('defines a modern yellow fill and dark gold stroke', () => {
    expect(tokensCss).toMatch(/--color-rating-star-fill:\s*#f5b82e;/i);
    expect(tokensCss).toMatch(/--color-rating-star-stroke:\s*#8a5a00;/i);
  });
});
