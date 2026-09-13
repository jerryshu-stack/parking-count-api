/**
 * Forwards unhandled JS errors to the Metro console with a findable tag.
 *
 * A crash on a physical device otherwise leaves no trace anywhere the developer
 * can read: Expo Go shows a red screen the tester dismisses, and a hard native
 * termination prints nothing at all. Tagging every unhandled error means the dev
 * server log answers "what happened" without needing the device in hand.
 */

const TAG = '[parktogether]';

type Handler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler?: () => Handler;
  setGlobalHandler?: (handler: Handler) => void;
}

export function installErrorReporting() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previous = errorUtils.getGlobalHandler?.();

  errorUtils.setGlobalHandler((error, isFatal) => {
    const e = error as { message?: string; stack?: string };
    console.error(
      `${TAG} ${isFatal ? 'FATAL' : 'error'}: ${e?.message ?? String(error)}\n${e?.stack ?? ''}`,
    );
    previous?.(error, isFatal);
  });
}
