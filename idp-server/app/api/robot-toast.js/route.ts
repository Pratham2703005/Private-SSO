/**
 * RobotToast Script Endpoint
 * Serves the injectable robot toast notification script
 * Usage in clients:
 * <script src="http://localhost:3000/api/robot-toast.js"></script>
 * Then use: window.RobotToast.show({ message: 'Hello!' })
 */

export async function GET() {
  const robotToastScript = `
(function(window) {
  "use strict";

  // Prevent duplicate loads
  if (window.__robotToastLoaded) {
    console.log("[RobotToast] Already loaded, skipping");
    return;
  }
  window.__robotToastLoaded = true;

  class RobotToast {
    constructor() {
      this.instance = null;
      this.container = null;
      this.messageBox = null;
      this.robot = null;
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
      this.currentTimeout = null;
      this.injectStyles();
    }

    static getInstance() {
      if (!RobotToast._instance) {
        RobotToast._instance = new RobotToast();
      }
      return RobotToast._instance;
    }

    show(options) {
      this.close();

      const {
        message,
        duration = 5000,
        className = '',
        typeSpeed = 30,
        position = 'bottom-right',
        robotSide = 'left',
        robotVariant = '',
        robotPath = '/robots',
      } = options;

      // Create container
      this.container = document.createElement('div');
      this.container.className = \`robot-toast-container robot-toast-\${position}\`;
      
      // Create robot
      this.robot = document.createElement('div');
      this.robot.className = \`robot-toast-robot robot-toast-robot-\${robotSide}\`;
      
      // Load robot image (external SVG or inline fallback)
      if (robotVariant) {
        const img = document.createElement('img');
        img.src = \`\${robotPath}/\${robotVariant}\`;
        img.alt = 'Robot';
        img.style.width = '60px';
        img.style.height = '80px';
        img.onerror = () => {
          this.robot.innerHTML = this.getRobotSVG();
        };
        this.robot.appendChild(img);
      } else {
        this.robot.innerHTML = this.getRobotSVG();
      }

      // Create message box
      this.messageBox = document.createElement('div');
      this.messageBox.className = \`robot-toast-message \${className}\`;
      this.messageBox.style.cursor = 'move';

      // Create close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'robot-toast-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.onclick = () => this.close();

      // Create message text container
      const messageText = document.createElement('div');
      messageText.className = 'robot-toast-text';

      this.messageBox.appendChild(closeBtn);
      this.messageBox.appendChild(messageText);

      // Assemble based on robot side
      if (robotSide === 'left') {
        this.container.appendChild(this.robot);
        this.container.appendChild(this.messageBox);
      } else {
        this.container.appendChild(this.messageBox);
        this.container.appendChild(this.robot);
      }

      document.body.appendChild(this.container);

      // Add drag functionality
      this.addDragListeners();

      // Animate in
      requestAnimationFrame(() => {
        this.container.classList.add('robot-toast-visible');
        this.typeMessage(messageText, message, typeSpeed, duration);
      });
    }

    typeMessage(element, message, typeSpeed, duration) {
      let index = 0;
      const type = () => {
        if (index < message.length) {
          element.textContent += message.charAt(index);
          index++;
          setTimeout(type, typeSpeed);
        } else if (duration > 0) {
          this.currentTimeout = setTimeout(() => this.close(), duration);
        }
      };
      type();
    }

    addDragListeners() {
      if (!this.messageBox || !this.container) return;

      const onMouseDown = (e) => {
        if (e.target.closest('.robot-toast-close')) return;
        
        this.isDragging = true;
        const rect = this.messageBox.getBoundingClientRect();
        this.dragOffset = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        this.messageBox.style.cursor = 'grabbing';
      };

      const onMouseMove = (e) => {
        if (!this.isDragging || !this.messageBox || !this.container) return;

        e.preventDefault();

        let newX = e.clientX - this.dragOffset.x;
        let newY = e.clientY - this.dragOffset.y;

        const rect = this.messageBox.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        this.container.className = 'robot-toast-container robot-toast-dragging';
        this.container.style.left = \`\${newX}px\`;
        this.container.style.top = \`\${newY}px\`;
      };

      const onMouseUp = () => {
        if (this.isDragging && this.messageBox) {
          this.isDragging = false;
          this.messageBox.style.cursor = 'move';
        }
      };

      this.messageBox.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      // Touch support
      const onTouchStart = (e) => {
        if (e.target.closest('.robot-toast-close')) return;
        
        this.isDragging = true;
        const touch = e.touches[0];
        const rect = this.messageBox.getBoundingClientRect();
        this.dragOffset = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      };

      const onTouchMove = (e) => {
        if (!this.isDragging || !this.messageBox || !this.container) return;

        e.preventDefault();
        const touch = e.touches[0];

        let newX = touch.clientX - this.dragOffset.x;
        let newY = touch.clientY - this.dragOffset.y;

        const rect = this.messageBox.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        this.container.className = 'robot-toast-container robot-toast-dragging';
        this.container.style.left = \`\${newX}px\`;
        this.container.style.top = \`\${newY}px\`;
      };

      const onTouchEnd = () => {
        this.isDragging = false;
      };

      this.messageBox.addEventListener('touchstart', onTouchStart, { passive: false });
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
    }

    close() {
      if (this.currentTimeout) {
        clearTimeout(this.currentTimeout);
        this.currentTimeout = null;
      }

      if (this.container) {
        this.container.classList.remove('robot-toast-visible');
        this.container.classList.add('robot-toast-hiding');

        setTimeout(() => {
          if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
          }
          this.container = null;
          this.messageBox = null;
          this.robot = null;
        }, 400);
      }
    }

    getRobotSVG() {
      return \`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
          <defs>
            <linearGradient id="roboGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#E2F0FF" />
              <stop offset="100%" stop-color="#B8D8FF" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="30" r="20" fill="url(#roboGrad)" stroke="#2B3A55" stroke-width="2"/>
          <rect x="35" y="50" width="30" height="35" rx="4" fill="url(#roboGrad)" stroke="#2B3A55" stroke-width="2"/>
          <circle cx="42" cy="25" r="3" fill="#2B3A55"/>
          <circle cx="58" cy="25" r="3" fill="#2B3A55"/>
        </svg>
      \`;
    }

    injectStyles() {
      if (document.getElementById('robot-toast-styles')) return;

      const style = document.createElement('style');
      style.id = 'robot-toast-styles';
      style.textContent = \`
        .robot-toast-container {
          position: fixed;
          display: flex;
          align-items: flex-end;
          gap: 12px;
          z-index: 999999;
          opacity: 0;
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: none;
        }

        .robot-toast-container.robot-toast-visible {
          opacity: 1;
          pointer-events: all;
        }

        .robot-toast-container.robot-toast-hiding {
          opacity: 0;
          transform: scale(0.95);
        }

        .robot-toast-container.robot-toast-dragging {
          position: fixed !important;
          top: auto !important;
          bottom: auto !important;
          left: auto !important;
          right: auto !important;
        }

        .robot-toast-top-right {
          top: 20px;
          right: 20px;
        }

        .robot-toast-top-left {
          top: 20px;
          left: 20px;
        }

        .robot-toast-bottom-right {
          bottom: 20px;
          right: 20px;
        }

        .robot-toast-bottom-left {
          bottom: 20px;
          left: 20px;
        }

        .robot-toast-robot {
          animation: robot-bounce 2s ease-in-out infinite;
          flex-shrink: 0;
        }

        .robot-toast-robot-left {
          animation: robot-slide-in-left 0.4s ease-out, robot-bounce 2s ease-in-out 0.4s infinite;
        }

        .robot-toast-robot-right {
          animation: robot-slide-in-right 0.4s ease-out, robot-bounce 2s ease-in-out 0.4s infinite;
        }

        .robot-toast-hiding .robot-toast-robot-left {
          animation: robot-slide-out-left 0.4s ease-in;
        }

        .robot-toast-hiding .robot-toast-robot-right {
          animation: robot-slide-out-right 0.4s ease-in;
        }

        @keyframes robot-slide-in-left {
          from {
            transform: translateX(-100px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes robot-slide-in-right {
          from {
            transform: translateX(100px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes robot-slide-out-left {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100px);
            opacity: 0;
          }
        }

        @keyframes robot-slide-out-right {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100px);
            opacity: 0;
          }
        }

        @keyframes robot-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        .robot-toast-message {
          position: relative;
          background: white;
          border-radius: 12px;
          padding: 16px 40px 16px 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          min-width: 250px;
          max-width: 400px;
          animation: message-slide-in 0.4s ease-out 0.2s backwards;
          user-select: none;
          touch-action: none;
        }

        .robot-toast-hiding .robot-toast-message {
          animation: message-slide-out 0.4s ease-in;
        }

        @keyframes message-slide-in {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes message-slide-out {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(20px);
            opacity: 0;
          }
        }

        .robot-toast-text {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #1f2937;
          min-height: 21px;
        }

        .robot-toast-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          font-size: 24px;
          line-height: 1;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px 8px;
          transition: color 0.2s;
        }

        .robot-toast-close:hover {
          color: #ef4444;
        }

        @media (max-width: 640px) {
          .robot-toast-container {
            max-width: calc(100vw - 40px);
          }

          .robot-toast-message {
            max-width: 300px;
            min-width: 200px;
          }

          .robot-toast-robot svg {
            width: 50px;
            height: 66px;
          }
        }
      \`;

      document.head.appendChild(style);
    }
  }

  RobotToast._instance = null;

  // Global API
  window.RobotToast = {
    show: (options) => {
      RobotToast.getInstance().show(options);
    },
    close: () => {
      RobotToast.getInstance().close();
    },
    getInstance: () => {
      return RobotToast.getInstance();
    }
  };

  // Signal readiness
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[RobotToast] Ready');
    });
  } else {
    console.log('[RobotToast] Ready');
  }

})(window);
`;

  return new Response(robotToastScript, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
