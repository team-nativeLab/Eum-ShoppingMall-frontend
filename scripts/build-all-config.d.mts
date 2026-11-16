export interface AppBuildTarget {
  workspace: string;
  modeEnv: string;
  allowEnv: string;
}

export type BuildEnvironmentResult =
  | {
      env: Record<string, string | undefined>;
      warning?: string;
      error?: never;
    }
  | {
      error: string;
      env?: never;
      warning?: never;
    };

export const APP_TARGETS: AppBuildTarget[];

export function resolveBuildEnvironment(
  appTarget: AppBuildTarget,
  sourceEnv: Record<string, string | undefined>,
): BuildEnvironmentResult;
