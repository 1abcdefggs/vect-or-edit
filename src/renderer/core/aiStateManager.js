/**
 * aiStateManager.js - Deep Module for AI State Management
 * 
 * Provides a clean interface (seam) for managing the state of Master AI,
 * Editor AI, and Sidebar AI. Emits 'app:aiStateChanged' events for UI adapters.
 */

class AiStateManager extends EventTarget {
  constructor() {
    super();
    this.state = {
      master: false,
      editor: false,
      sidebar: false,
      modelConfigured: false
    };
  }

  /**
   * Initializes the AI state with the current model configuration.
   * @param {boolean} modelConfigured 
   */
  init(modelConfigured) {
    this.state.modelConfigured = !!modelConfigured;
    this._emitChange();
  }

  /**
   * Sets the model configured state (e.g., when a user downloads/imports a model)
   * @param {boolean} isConfigured 
   */
  setModelConfigured(isConfigured) {
    this.state.modelConfigured = !!isConfigured;
    // If we lose the model configuration, disable everything
    if (!this.state.modelConfigured) {
      this.state.master = false;
      this.state.editor = false;
      this.state.sidebar = false;
    }
    this._emitChange();
  }

  /**
   * Toggles the Master AI state.
   * Invariant: If Master turns ON, child AIs turn ON.
   * Invariant: If Master turns OFF, child AIs turn OFF.
   * @param {boolean} enabled 
   */
  setMasterAi(enabled) {
    if (enabled && !this.state.modelConfigured) {
      throw new Error("Cannot enable Master AI: No model configured.");
    }
    this.state.master = !!enabled;
    
    // Sync children
    if (this.state.master) {
      this.state.editor = true;
      this.state.sidebar = true;
    } else {
      this.state.editor = false;
      this.state.sidebar = false;
    }
    
    this._emitChange();
  }

  /**
   * Toggles Editor AI.
   * Invariant: Cannot turn ON if Master is OFF.
   * @param {boolean} enabled 
   */
  setEditorAi(enabled) {
    if (enabled && !this.state.master) {
      throw new Error("Cannot enable Editor AI: Master AI is OFF.");
    }
    this.state.editor = !!enabled;
    this._emitChange();
  }

  /**
   * Toggles Sidebar Suggest AI.
   * Invariant: Cannot turn ON if Master is OFF.
   * @param {boolean} enabled 
   */
  setSidebarAi(enabled) {
    if (enabled && !this.state.master) {
      throw new Error("Cannot enable Sidebar AI: Master AI is OFF.");
    }
    this.state.sidebar = !!enabled;
    this._emitChange();
  }

  /**
   * Returns an immutable copy of the current state.
   * @returns {Readonly<{master: boolean, editor: boolean, sidebar: boolean, modelConfigured: boolean}>}
   */
  getState() {
    return Object.freeze({ ...this.state });
  }

  /**
   * Internal helper to dispatch state change events to UI adapters.
   */
  _emitChange() {
    this.dispatchEvent(new CustomEvent('app:aiStateChanged', { 
      detail: this.getState() 
    }));
  }
}

// Export a singleton instance
export const aiManager = new AiStateManager();
