/**
 * aiStateManager.ts - Deep Module for AI State Management
 *
 * LLM (cloud generation) and Embedding (local vector model) are two independent switches (ADR-11).
 * Neither one changes the other. Each also has a "configured" flag: the LLM needs a provider and a key,
 * the Embedding needs a ready local model. A switch cannot be ON while its flag is false.
 *
 * Callers do not read the switches directly; they ask `aiAccess` (core/aiAccess.ts) whether a feature may run.
 * Emits 'app:aiStateChanged' for UI adapters and 'app:aiSwitchChanged' once per switch change (for the toast and the log).
 */

export interface AiState {
  llm: boolean;
  embed: boolean;
  llmConfigured: boolean;
  embedConfigured: boolean;
}

export type AiSwitch = 'llm' | 'embed';
export type AiSwitchSource = 'toolbar' | 'sidebar' | 'settings' | 'config';

export interface AiSwitchChange {
  which: AiSwitch;
  from: boolean;
  to: boolean;
  source: AiSwitchSource;
}

export class AiStateManager extends EventTarget {
  private state: AiState = {
    llm: false,
    embed: false,
    llmConfigured: false,
    embedConfigured: false
  };

  /** Initializes the "configured" flags (nothing is switched on by itself). */
  init(configured: { llm: boolean; embed: boolean }): void {
    this.state.llmConfigured = Boolean(configured.llm);
    this.state.embedConfigured = Boolean(configured.embed);
    this._emitChange();
  }

  /**
   * Updates the "configured" flags (a key was saved or removed, a model became ready).
   * A switch whose flag turns false is switched off, and that is announced like any other change.
   */
  setConfigured(configured: Partial<{ llm: boolean; embed: boolean }>): void {
    const changes: AiSwitchChange[] = [];
    if (configured.llm !== undefined) {
      this.state.llmConfigured = Boolean(configured.llm);
      if (!this.state.llmConfigured && this.state.llm) {
        this.state.llm = false;
        changes.push({ which: 'llm', from: true, to: false, source: 'config' });
      }
    }
    if (configured.embed !== undefined) {
      this.state.embedConfigured = Boolean(configured.embed);
      if (!this.state.embedConfigured && this.state.embed) {
        this.state.embed = false;
        changes.push({ which: 'embed', from: true, to: false, source: 'config' });
      }
    }
    this._emitChange();
    changes.forEach((change) => this._emitSwitch(change));
  }

  /** Switches the LLM. Throws when asked to switch on without a provider and key. */
  setLlm(enabled: boolean, source: AiSwitchSource = 'toolbar'): void {
    this._set('llm', enabled, source);
  }

  /** Switches the Embedding. Throws when asked to switch on without a ready model. */
  setEmbed(enabled: boolean, source: AiSwitchSource = 'sidebar'): void {
    this._set('embed', enabled, source);
  }

  /** Returns an immutable copy of the current state. */
  getState(): Readonly<AiState> {
    return Object.freeze({ ...this.state });
  }

  isLlmEnabled(): boolean {
    return this.state.llm;
  }

  isEmbedEnabled(): boolean {
    return this.state.embed;
  }

  private _set(which: AiSwitch, enabled: boolean, source: AiSwitchSource): void {
    const want = Boolean(enabled);
    const configured = which === 'llm' ? this.state.llmConfigured : this.state.embedConfigured;
    if (want && !configured) {
      throw new Error(which === 'llm' ? 'Cannot enable LLM: no provider and key configured.' : 'Cannot enable Embedding: no model is ready.');
    }
    const from = this.state[which];
    if (from === want) return;
    this.state[which] = want;
    this._emitChange();
    this._emitSwitch({ which, from, to: want, source });
  }

  private _emitChange(): void {
    const detail = { state: this.getState() };
    this.dispatchEvent(new CustomEvent('app:aiStateChanged', { detail }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:aiStateChanged', { detail }));
    }
  }

  private _emitSwitch(change: AiSwitchChange): void {
    const detail = { change, state: this.getState() };
    this.dispatchEvent(new CustomEvent('app:aiSwitchChanged', { detail }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:aiSwitchChanged', { detail }));
    }
  }
}

export const aiStateManager = new AiStateManager();
export const aiManager = aiStateManager;
