/** cx()가 받는 클래스 값. false·null·undefined는 무시합니다. */
export type ClassValue = string | false | null | undefined;

/**
 * 조건부 className을 공백으로 이어 붙이는 함수(clsx 대체용 최소 구현).
 * 같은 속성의 클래스 충돌은 해결하지 않으므로, 컴포넌트에서 변형별 클래스를 겹치지 않게 나눠 씁니다.
 */
export function cx(...classValues: ClassValue[]): string {
  return classValues.filter(Boolean).join(' ');
}
