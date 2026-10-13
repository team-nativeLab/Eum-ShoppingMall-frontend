/// <reference types="vite/client" />

// admin에서 읽는 공개 환경변수. 브라우저 번들에 들어가므로 비밀값을 넣지 않습니다.
interface ImportMetaEnv {
  readonly VITE_API_MODE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MOCK_SCENARIO?: string;
  readonly VITE_ALLOW_MOCK_IN_PRODUCTION?: string;
  /** TopBar "쇼핑몰 보기" 링크 주소 */
  readonly VITE_WEB_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
