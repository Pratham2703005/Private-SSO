/**
 * Event system for SSO provider
 * Allows applications to react to authentication changes
 */

import { SessionData, EventType, EventCallback } from './types';

export interface EventPayloads {
  logout: undefined;
  sessionRefresh: SessionData;
  accountSwitch: { newAccount: any; previousAccount: any };
  globalLogout: undefined;
  error: Error;
}

export class EventEmitter {
  private listeners = new Map<EventType, Set<EventCallback>>();

  on<T extends EventType>(
    event: T,
    callback: (data: EventPayloads[T]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const callbacks = this.listeners.get(event)!;
    callbacks.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback as EventCallback);
    };
  }

  once<T extends EventType>(
    event: T,
    callback: (data: EventPayloads[T]) => void
  ): () => void {
    const wrapper = (data: any) => {
      callback(data);
      unsubscribe();
    };

    const unsubscribe = this.on(event, wrapper as EventCallback);
    return unsubscribe;
  }

  emit<T extends EventType>(event: T, data: EventPayloads[T]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in ${event} event listener:`, err);
        }
      });
    }
  }

  removeAllListeners(event?: EventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: EventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
