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
        className?: string;
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
    className='',
}: RobotToastOptions) => {
  // SSR safety check - window only exists on client side
  if (typeof window === 'undefined') {
    return null;
  }

  if (!toastShownRef.current) {
      toastShownRef.current = true;
      
      // Use global RobotToastUtils if available
      if (window.RobotToastUtils) {
        // Note: className works with custom CSS classes defined in your stylesheets,
        // but NOT with Tailwind utility classes since the HTML is injected from a different build.
        // For styling, either:
        // 1. Define custom CSS classes in your app's global CSS
        // 2. Use window.RobotToastUtils directly with inline style manipulation
        // Example: className: 'custom-toast-style'
        window.RobotToastUtils.showRobotToast({
          message,
          duration,
          position,
          robotSide,
          robotVariant,
          robotPath: `${process.env.NEXT_PUBLIC_IDP_SERVER}/robots`,
          typeSpeed,
          className,
        }).catch(error => {
          console.error('Failed to show toast:', error);
        });
      }
    } else {
      // Reset the toast ref when user logs out
      toastShownRef.current = false;
    }
}