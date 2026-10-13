# 보안 정책

## 취약점 제보

이 저장소에서 보안 취약점을 발견하셨다면 **공개 이슈로 올리지 말아 주십시오.**
공개 이슈에 남기면 수정 전에 취약점이 알려질 수 있습니다.

대신 GitHub의 비공개 취약점 제보(Private vulnerability reporting)를 이용해 주십시오.

1. 저장소의 **Security** 탭으로 이동합니다.
2. **Report a vulnerability**를 누릅니다.
3. 아래 내용을 적어 제출합니다.
   - 영향을 받는 화면·파일·버전
   - 재현 절차
   - 예상되는 영향

제보 내용은 저장소 관리자만 볼 수 있습니다. 확인 후 같은 화면에서 진행 상황을 안내드립니다.

## 지원 범위

- `main` 브랜치의 최신 코드
- `apps/web`, `apps/admin`, `packages/*`

목 API·목 인증(`packages/api`의 mock 모듈)은 개발·검증용 스텁입니다.
운영 빌드에서 목 모드는 `*_ALLOW_MOCK_IN_PRODUCTION=true`를 명시했을 때만 허용되고, 그렇지 않으면 빌드가 실패합니다.
단, Web은 저장소에 커밋된 `apps/web/.env.production`이 이 허용값(`NEXT_PUBLIC_API_MODE=mock`, `NEXT_PUBLIC_ALLOW_MOCK_IN_PRODUCTION=true`)을 넣어 두었으므로, 환경변수 없이 빌드하면 목 데모 빌드가 됩니다.
목 데모 화면에는 맨 위에 "데모(목 데이터)" 안내 띠가 표시됩니다.
셸·CI·Vercel에서 지정한 실제 환경변수가 이 파일보다 우선하므로, 운영 배포는 `NEXT_PUBLIC_API_MODE=real`과 `https` 주소의 `NEXT_PUBLIC_API_BASE_URL`을 설정해야 합니다.
