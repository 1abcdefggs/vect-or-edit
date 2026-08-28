/**
 * Robust Event Bus for Editor Modules
 * Provides decoupled communication across deep modules.
 */
const listeners = new Map();

export const editorEvents = {
  /**
   * Subscribe to an event
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);
    return () => this.off(event, callback);
  },

  /**
   * Unsubscribe from an event
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (listeners.has(event)) {
      listeners.get(event).delete(callback);
    }
  },

  /**
   * Subscribe to an event once
   * @param {string} event
   * @param {Function} callback
   */
  once(event, callback) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      callback(...args);
    };
    return this.on(event, onceWrapper);
  },

  /**
   * Emit an event with arguments
   * @param {string} event
   * @param {...any} args
   */
  emit(event, ...args) {
    if (listeners.has(event)) {
      for (const callback of listeners.get(event)) {
        try {
          callback(...args);
        } catch (err) {
          console.error(`[editorEvents] Error in listener for "${event}":`, err);
        }
      }
    }
  },

  /**
   * Clear all listeners for an event or all events
   * @param {string} [event]
   */
  clear(event) {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  }
};
