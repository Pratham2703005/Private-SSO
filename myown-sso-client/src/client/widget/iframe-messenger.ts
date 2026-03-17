/**
 * Iframe communication utilities
 * Handle postMessage with widget iframe
 */

import type { WidgetMessage } from '../../shared/widget-types';

export class IframeMessenger {
  private frame: Window | null = null;
  private origin: string;
  private listeners: Map<string, Function[]> = new Map();

  constructor(origin: string) {
    this.origin = origin;
  }

  /**
   * Set reference to widget iframe window
   */
  setFrame(frame: Window) {
    this.frame = frame;
  }

  /**
   * Send message to widget iframe
   */
  send<T>(type: string, data?: T): void {
    if (!this.frame) {
      console.warn('[IframeMessenger] Frame not set, cannot send message');
      return;
    }

    const message: WidgetMessage = {
      type: type as any,
      data,
      timestamp: Date.now(),
    };

    this.frame.postMessage(message, this.origin);
  }

  /**
   * Listen for messages from iframe
   */
  on(type: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(type) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Handle incoming message from iframe
   */
  handleMessage(event: MessageEvent<WidgetMessage>): void {
    // Validate origin
    if (event.origin !== this.origin) {
      console.warn('[IframeMessenger] Invalid origin:', event.origin);
      return;
    }

    const { type, data } = event.data;

    // Call all listeners for this type
    const callbacks = this.listeners.get(type) || [];
    callbacks.forEach(cb => cb(data));
  }
}
