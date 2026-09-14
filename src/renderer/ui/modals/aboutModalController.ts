/**
 * Deep Module: AboutModalController
 * Small Interface: showAboutModal() / hideAboutModal()
 * Deep Implementation: Manages modal DOM lifecycle, backdrop blur, theme grounding, and safe external link dispatch.
 */

let modalInstance: HTMLElement | null = null;

export function showAboutModal(): void {
  if (!modalInstance) {
    modalInstance = createAboutModalElement();
    document.body.appendChild(modalInstance);
  }
  modalInstance.style.display = 'flex';
}

export function hideAboutModal(): void {
  if (modalInstance) {
    modalInstance.style.display = 'none';
  }
}

function createAboutModalElement(): HTMLElement {
  const div = document.createElement('div');
  div.id = 'aboutModal';
  div.className = 'settings-modal-overlay';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="settings-modal-dialog" style="width: 480px; max-width: calc(100vw - 2rem); margin: 1rem; border-radius: 12px; box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65); border: 1px solid var(--border-color); overflow: hidden;">
      <div class="modal-header" style="padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="./assets/icon.png" alt="VectOrEdit" style="width: 22px; height: 22px; border-radius: 4px;">
          <span class="modal-title" style="font-weight: 600; font-size: 0.98rem;">About VectOrEdit</span>
        </div>
        <button id="btnCloseAboutModal" class="toolbar-btn" style="padding: 4px; border-radius: 4px; cursor: pointer;" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="settings-modal-body" style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 18px 24px; text-align: center;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <img src="./assets/icon.png" alt="VectOrEdit" style="width: 48px; height: 48px; border-radius: 14px; box-shadow: 0 8px 24px rgba(56, 189, 248, 0.25);">
          <div style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); letter-spacing: -0.02em;">VectOrEdit</div>
          <div style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 20px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); color: var(--accent-color, #38bdf8); font-size: 0.8rem; font-family: monospace; font-weight: 600;">
            v0.3.21 (Stable)
          </div>
        </div>
        <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.6; margin: 0;">
          Next-Generation Vector-Native Semantic Knowledge Editor & Real-Time Linter.<br>
          10-Layer Semantic Knowledge Representation Standard (W3C / DIKWP Compliant).
        </p>
        <div style="width: 100%; display: flex; flex-direction: column; gap: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 16px; text-align: left; font-size: 0.78rem; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Organization</span>
            <span style="font-weight: 600; color: var(--text-main);">vect-organization</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Inference Engine</span>
            <span style="color: var(--text-main);">vect-or-engine (Rust HNSW Core)</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">License</span>
            <span style="color: var(--text-muted);">MIT License</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Repository</span>
            <a id="btnAboutOpenRepo" href="#" style="color: var(--accent-color, #38bdf8); text-decoration: none; font-weight: 500;">vect-organization/vect-or-edit ↙</a>
          </div>
        </div>
        <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 0.72rem; color: var(--text-muted);">
          <span>© 2026 vect-organization.</span>
          <button id="btnAboutOk" class="toolbar-btn" style="padding: 6px 18px; background: var(--accent-color, #38bdf8); color: #020617; font-weight: 600; border-radius: 6px; font-size: 0.8rem; cursor: pointer;">OK</button>
        </div>
      </div>
    </div>
  `;

  div.querySelector('#btnCloseAboutModal')?.addEventListener('click', hideAboutModal);
  div.querySelector('#btnAboutOk')?.addEventListener('click', hideAboutModal);
  div.addEventListener('click', (e) => {
    if (e.target === div) hideAboutModal();
  });
  div.querySelector('#btnAboutOpenRepo')?.addEventListener('click', (e) => {
    e.preventDefault();
    const repoUrl = 'https://github.com/vect-organization/vect-or-edit';
    if (window.engineAPI?.openExternal) {
      window.engineAPI.openExternal(repoUrl);
    } else {
      window.open(repoUrl, '_blank');
    }
  });


  return div;
}
