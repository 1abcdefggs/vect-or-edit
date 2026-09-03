/**
 * aiStateManager.ts - Deep Module for AI State Management
 * 
 * Provides a clean interface (seam) for managing the state of Master AI,
 * Editor AI, and Sidebar AI. Emits 'app:aiStateChanged' events for UI adapters.
 */

export interface AiState {
  master: boolean;
  editor: boolean;
  sidebar: boolean;
  modelConfigured: boolean;
}

export class AiStateManager extends EventTarget {
  private state: AiState = {
    master: false,
    editor: false,
    sidebar: false,
    modelConfigured: false
  };

  /**
   * Initializes the AI state with the current model configuration.
   */
  init(modelConfigured: boolean): void {
    this.state.modelConfigured = Boolean(modelConfigured);
    this._emitChange();
  }

  /**
   * Sets the model configured state (e.g., when a user downloads/imports a model)
   */
  setModelConfigured(isConfigured: boolean): void {
    this.state.modelConfigured = Boolean(isConfigured);
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
   */
  setMasterAi(enabled: boolean): void {
    if (enabled && !this.state.modelConfigured) {
      throw new Error("Cannot enable Master AI: No model configured.");
    }
    this.state.master = Boolean(enabled);
    
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
   */
  setEditorAi(enabled: boolean): void {
    if (enabled && !this.state.master) {
      throw new Error("Cannot enable Editor AI: Master AI is OFF.");
    }
    this.state.editor = Boolean(enabled);
    this._emitChange();
  }

  /**
   * Toggles Sidebar Suggest AI.
   * Invariant: Cannot turn ON if Master is OFF.
   */
  setSidebarAi(enabled: boolean): void {
    if (enabled && !this.state.master) {
      throw new Error("Cannot enable Sidebar AI: Master AI is OFF.");
    }
    this.state.sidebar = Boolean(enabled);
    this._emitChange();
  }

  /**
   * Returns an immutable copy of the current state.
   */
  getState(): Readonly<AiState> {
    return Object.freeze({ ...this.state });
  }

  /**
   * Checks if Master AI is currently enabled.
   */
  isMasterAiEnabled(): boolean {
    return this.state.master;
  }

  /**
   * Checks if Editor AI is currently enabled.
   */
  isEditorAiEnabled(): boolean {
    return this.state.editor;
  }

  /**
   * Checks if Sidebar AI is currently enabled.
   */
  isSidebarAiEnabled(): boolean {
    return this.state.sidebar;
  }

  private _emitChange(): void {
    const detail = { state: this.getState() };
    this.dispatchEvent(new CustomEvent('app:aiStateChanged', { detail }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:aiStateChanged', { detail }));
    }
  }
}

export const aiStateManager = new AiStateManager();
export const aiManager = aiStateManager;
