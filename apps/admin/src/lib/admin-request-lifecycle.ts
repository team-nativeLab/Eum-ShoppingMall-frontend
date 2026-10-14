interface AdminRequestScope {
  signal: AbortSignal;
  isCurrent(): boolean;
  cancel(): void;
  dispose(): void;
}

let adminSessionGeneration = 0;
let isAdminSessionActive = true;
const activeAdminRequestControllers = new Set<AbortController>();

/** Creates a cancellable request scope tied to the current administrator session. */
export function createAdminRequestScope(): AdminRequestScope {
  const requestGeneration = adminSessionGeneration;
  const controller = new AbortController();
  const isSessionActive = isAdminSessionActive;
  if (isSessionActive) {
    activeAdminRequestControllers.add(controller);
  } else {
    controller.abort();
  }

  return {
    signal: controller.signal,
    isCurrent: () =>
      isSessionActive &&
      isAdminSessionActive &&
      requestGeneration === adminSessionGeneration &&
      !controller.signal.aborted,
    cancel: () => {
      controller.abort();
      activeAdminRequestControllers.delete(controller);
    },
    dispose: () => {
      activeAdminRequestControllers.delete(controller);
    },
  };
}

/** Closes the administrator session and aborts its active requests. */
export function endAdminSession(): void {
  adminSessionGeneration += 1;
  isAdminSessionActive = false;
  abortActiveAdminRequests();
}

/** Starts a fresh administrator session after successful authentication. */
export function startAdminSession(): void {
  adminSessionGeneration += 1;
  isAdminSessionActive = true;
  abortActiveAdminRequests();
}

/** Restores request eligibility when the current-user check confirms an active session. */
export function ensureAdminSessionActive(): void {
  if (!isAdminSessionActive) startAdminSession();
}

function abortActiveAdminRequests(): void {
  for (const controller of activeAdminRequestControllers) {
    controller.abort();
  }
  activeAdminRequestControllers.clear();
}
