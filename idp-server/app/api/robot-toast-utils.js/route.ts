/**
 * RobotToast Utils Script Endpoint
 * Serves utility functions for RobotToast as a global or module
 * Usage in clients:
 * <script src="http://localhost:3000/api/robot-toast-utils.js"></script>
 * Then use: window.RobotToastUtils.showRobotToast({ message: 'Hello!' })
 */

export async function GET() {
  const utilsScript = `
(function(window) {
  "use strict";

  // Prevent duplicate loads
  if (window.__robotToastUtilsLoaded) {
    console.log("[RobotToastUtils] Already loaded, skipping");
    return;
  }
  window.__robotToastUtilsLoaded = true;

  async function ensureRobotToastReady(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('RobotToast only works in browser environment'));
        return;
      }

      const globalWindow = window;
      // Already available
      if (globalWindow.RobotToast) {
        resolve(globalWindow.RobotToast);
        return;
      }

      // Wait for it to be available
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (globalWindow.RobotToast) {
          clearInterval(checkInterval);
          resolve(globalWindow.RobotToast);
          return;
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error('RobotToast failed to load within timeout'));
        }
      }, 100);
    });
  }

  async function showRobotToast(options) {
    try {
      const robotToast = await ensureRobotToastReady();
      robotToast.show(options);
    } catch (error) {
      console.error('[RobotToast Utility] Failed to show toast:', error);
    }
  }

  async function closeRobotToast() {
    try {
      const robotToast = await ensureRobotToastReady();
      robotToast.close();
    } catch (error) {
      console.error('[RobotToast Utility] Failed to close toast:', error);
    }
  }

  async function getRobotToastInstance() {
    return ensureRobotToastReady();
  }

  // Global API
  window.RobotToastUtils = {
    showRobotToast,
    closeRobotToast,
    getRobotToastInstance,
    ensureRobotToastReady,
  };

  console.log('[RobotToastUtils] Ready');

})(window);
`;

  return new Response(utilsScript, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
