/**
 * RobotToast Utility
 * Provides easy access to the RobotToast global API
 * Shared utility across all client applications
 */

export interface RobotToastOptions {
  message: string;
  duration?: number;
  className?: string;
  typeSpeed?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  robotSide?: 'left' | 'right';
  robotVariant?: string;
  robotPath?: string;
}

/**
 * Ensure RobotToast is available globally, with timeout for safety
 */
export function ensureRobotToastReady(
  timeout = 5000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('RobotToast only works in browser environment'));
      return;
    }

    const globalWindow = window as unknown as Record<string, unknown>;
    // Already available
    if (globalWindow.RobotToast) {
      resolve(globalWindow.RobotToast as Record<string, unknown>);
      return;
    }

    // Wait for it to be available
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (globalWindow.RobotToast) {
        clearInterval(checkInterval);
        resolve(globalWindow.RobotToast as Record<string, unknown>);
        return;
      }

      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('RobotToast failed to load within timeout'));
      }
    }, 100);
  });
}

/**
 * Show a robot toast notification
 */
export async function showRobotToast(
  options: RobotToastOptions
): Promise<void> {
  try {
    const robotToast = await ensureRobotToastReady();
    const showFn = robotToast.show as (options: RobotToastOptions) => void;
    showFn(options);
  } catch (error) {
    console.error('[RobotToast Utility] Failed to show toast:', error);
    // Silently fail - don't break the app if toast fails
  }
}

/**
 * Close the current robot toast
 */
export async function closeRobotToast(): Promise<void> {
  try {
    const robotToast = await ensureRobotToastReady();
    const closeFn = robotToast.close as () => void;
    closeFn();
  } catch (error) {
    console.error('[RobotToast Utility] Failed to close toast:', error);
  }
}

/**
 * Get the RobotToast instance
 */
export async function getRobotToastInstance(): Promise<
  Record<string, unknown>
> {
  return ensureRobotToastReady();
}
