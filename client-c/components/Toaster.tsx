declare global {
  interface Window {
    RobotToastUtils?: {
      showRobotToast: (options: {
        message: string;
        duration?: number;
        position?: string;
        robotSide?: string;
        robotVariant?: string;
        robotPath?: string;
        typeSpeed?: number;
      }) => Promise<void>;
    };
  }
}

export interface RobotToastOptions {
  toastShownRef: React.RefObject<boolean>;
  message: string;
  duration?: number;
  className?: string;
  typeSpeed?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  robotSide?: 'left' | 'right';
  robotVariant?: string;
}

export const Toaster = ({
    toastShownRef,
    message='',
    duration=5000,
    position='top-left',
    robotSide='left',
    robotVariant='base2.svg',
    typeSpeed=25,
}: RobotToastOptions) => {
  // SSR safety check - window only exists on client side
  if (typeof window === 'undefined') {
    return null;
  }

  if (!toastShownRef.current) {
      toastShownRef.current = true;
      
      // Use global RobotToastUtils if available
      if (window.RobotToastUtils) {
        window.RobotToastUtils.showRobotToast({
          message,
          duration,
          position,
          robotSide,
          robotVariant,
          robotPath: `${process.env.NEXT_PUBLIC_IDP_SERVER}/robots`,
          typeSpeed,
        }).catch(error => {
          console.error('Failed to show toast:', error);
        });
      }
    } else {
      // Reset the toast ref when user logs out
      toastShownRef.current = false;
    }
}