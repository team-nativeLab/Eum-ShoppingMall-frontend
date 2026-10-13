// jsdom 테스트 공통 설정: jest-dom 매처 등록, 테스트마다 렌더 결과·localStorage 정리
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
