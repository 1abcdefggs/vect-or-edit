/**
 * Deep Module: AboutModalController
 * Small Interface: showAboutModal() / hideAboutModal()
 * Deep Implementation: Manages modal DOM lifecycle, backdrop blur, theme grounding, and safe external link dispatch.
 */

import { confirmClose } from '../notifications/closeGuard.js';
import { t } from '../../core/i18n.js';
import appLogoUrl from '../../assets/icon.png';
import { STORAGE_KEYS } from '../../core/constants.js';
import { getStoredThemeSetting } from '../../editor/core/themeLoader.js';
import { getActiveModelId, getDownloadedModelIds } from '../../search/embeddingModels.js';
import { REGISTRY } from '../../../shared/embeddingCatalog';
import themeAttribution from '../../../shared/themeAttribution.json';
import { AUTHOR, AUTHOR_URL, ELECTRON_URL, ENGINE_URL, MONACO_URL, REPOSITORY_URL } from '../../../shared/projectLinks';

interface ThemeAttribution {
  origin: string;
  license: string;
  copyright?: string;
  source?: string;
}

/** Fills the rows that name the parts in use: the chosen theme and model, and the versions of the built-in parts. */
function fillComponentRows(div: HTMLElement): void {
  const set = (id: string, value: string) => {
    const el = div.querySelector<HTMLElement>(`#${id}`);
    if (el) el.textContent = value;
  };
  // A row with a source links to it (data-url, opened by the dialog's click handler); a row without one stays plain text
  const setLink = (id: string, value: string, url?: string) => {
    const el = div.querySelector<HTMLAnchorElement>(`#${id}`);
    if (!el) return;
    el.textContent = value;
    if (url) {
      el.href = '#';
      el.dataset.url = url;
      el.style.color = 'var(--accent-text)';
    } else {
      el.removeAttribute('href');
      delete el.dataset.url;
      el.style.color = 'var(--text-main)';
    }
  };

  // The app version is filled once at startup (topBarRenderer), before this dialog exists, so it is read again here
  window.engineAPI?.getAppVersion?.()
    .then((version) => {
      if (version) set('aboutVersionBadge', `v${version}`);
    })
    .catch(() => {});

  const engine = __COMPONENT_VERSIONS__.engine;
  const monaco = __COMPONENT_VERSIONS__.monaco;
  const electron = /Electron\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? 'unknown';
  set('aboutEngineValue', `vect-or-engine ${engine} (Rust HNSW Core)`);
  set('aboutMonacoValue', `Monaco ${monaco}`);
  set('aboutElectronValue', `Electron ${electron}`);

  const themeName = getStoredThemeSetting();
  const theme = (themeAttribution as Record<string, ThemeAttribution>)[themeName];
  setLink('aboutThemeValue', theme ? `${themeName} (${theme.license})` : themeName, theme?.source);

  // Every downloaded model is listed; the one in use is marked. Each model links to its Hugging Face page.
  const activeModelId = getActiveModelId();
  const modelIds = [activeModelId, ...[...getDownloadedModelIds()].filter((id) => id !== activeModelId)];
  const modelsEl = div.querySelector<HTMLElement>('#aboutModelValue');
  modelsEl?.replaceChildren(...modelIds.map((id) => {
    const license = REGISTRY.models.find((m) => m.id === id)?.license.original;
    const link = document.createElement('a');
    link.href = '#';
    link.dataset.url = `https://huggingface.co/${id}`;
    link.style.cssText = 'display: block; color: var(--accent-text); text-decoration: none;';
    link.textContent = `${id === activeModelId ? '● ' : ''}${id}${license ? ` (${license})` : ''}`;
    link.title = id === activeModelId ? 'In use' : 'Downloaded';
    return link;
  }));

  // A cloud provider is named only when one is chosen; a service has its own terms, not an open-source license
  const cloudProvider = localStorage.getItem(STORAGE_KEYS.LLM_PROVIDER) ?? '';
  const cloudName = CLOUD_PROVIDER_NAMES[cloudProvider];
  setLink('aboutCloudValue', cloudName ? `${cloudName} (API, provider terms apply)` : 'Not used', CLOUD_PROVIDER_URLS[cloudProvider]);
}

let modalInstance: HTMLElement | null = null;

/** A small heading that splits the info box into groups: what is built in, and what is in use now. */
const groupLabel = (text: string) =>
  `<div style="margin-top: 4px; font-size: var(--fs-11); font-weight: 600; letter-spacing: 0.06em; color: var(--accent-text);">${text}</div>`;

const CLOUD_PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Gemini (Google)',
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI (GPT)'
};

// The provider's own site, where its terms are published
const CLOUD_PROVIDER_URLS: Record<string, string> = {
  gemini: 'https://ai.google.dev/',
  claude: 'https://www.anthropic.com/',
  openai: 'https://platform.openai.com/'
};

// The GitHub mark, in front of every link that goes to a GitHub repository or profile
const GITHUB_MARK = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style="vertical-align: -2px; margin-right: 5px;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

export function showAboutModal(): void {
  if (!modalInstance) {
    modalInstance = createAboutModalElement();
    document.body.appendChild(modalInstance);
  }
  // Refreshed on every open: the theme and model may have changed since the modal was built
  fillComponentRows(modalInstance);
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
    <div class="settings-modal-dialog" style="width: 720px; max-width: calc(100vw - 2rem); height: auto; max-height: calc(100vh - 4rem); margin: 1rem; border-radius: 12px; box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65); border: var(--border-width) solid var(--border-color); overflow: hidden;">
      <div class="modal-header" style="padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${appLogoUrl}" alt="VectOrEdit" style="width: 22px; height: 22px; border-radius: 4px;">
          <span class="modal-title" style="font-weight: 600; font-size: var(--fs-16);">About VectOrEdit</span>
        </div>
        <button id="btnCloseAboutModal" class="toolbar-btn" style="padding: 4px; border-radius: 4px; cursor: pointer;" title="${t('tip_close')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="settings-modal-body" style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 18px 24px; text-align: center;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <img src="${appLogoUrl}" alt="VectOrEdit" style="width: 48px; height: 48px; border-radius: 14px; box-shadow: 0 8px 24px rgba(56, 189, 248, 0.25);">
          <div style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px;">
            <span style="font-family: var(--font-brand); font-size: var(--fs-22); font-weight: 600; letter-spacing: 0.6px; color: var(--text-main);">VectOrEdit</span>
            <span style="display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 20px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); color: var(--accent-text); font-family: var(--font-mono); font-size: var(--fs-12); font-weight: 600;">
              <span id="aboutVersionBadge"></span>
            </span>
          </div>
        </div>
        <p style="font-size: var(--fs-13); color: var(--text-muted); line-height: 1.6; margin: 0;">
          ${t('about_tagline')}
        </p>
        <div style="width: 100%; display: flex; flex-direction: column; gap: 6px; background: var(--bg-primary); border: var(--border-width) solid var(--border-color); border-radius: 8px; padding: 12px 16px; text-align: left; font-size: var(--fs-12); box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Author</span>
            <a id="btnAboutOpenAuthor" href="#" style="font-weight: 600; color: var(--accent-text); text-decoration: none;">${GITHUB_MARK}${AUTHOR}</a>
          </div>
          ${groupLabel('Components')}
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Inference Engine</span>
            <a id="aboutEngineValue" href="#" style="color: var(--accent-text); text-decoration: none;">${GITHUB_MARK}vect-or-engine (Rust HNSW Core)</a>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Editor</span>
            <span id="aboutEditorValue" style="color: var(--text-main);"><a id="aboutMonacoLink" href="#" style="color: var(--accent-text); text-decoration: none;">${GITHUB_MARK}<span id="aboutMonacoValue"></span></a> on <a id="aboutElectronLink" href="#" style="color: var(--accent-text); text-decoration: none;">${GITHUB_MARK}<span id="aboutElectronValue"></span></a></span>
          </div>
          ${groupLabel('In use')}
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Theme in use</span>
            <a id="aboutThemeValue" href="#" style="color: var(--text-main); text-decoration: none;"></a>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Embedding model</span>
            <span id="aboutModelValue" style="color: var(--text-main); text-align: right;"></span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Cloud AI</span>
            <a id="aboutCloudValue" href="#" style="color: var(--text-main); text-decoration: none;"></a>
          </div>
          <div style="border-top: var(--border-width) solid var(--border-color); margin: 4px 0;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">License</span>
            <a id="btnAboutToggleLicense" href="#" style="color: var(--accent-text); text-decoration: none; font-weight: 500;">MIT License ↓</a>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Third-party licenses</span>
            <a id="btnAboutToggleNotices" href="#" style="color: var(--accent-text); text-decoration: none; font-weight: 500;">Show ↓</a>
          </div>
          <pre id="aboutNoticesText" hidden style="margin: 4px 0 0; max-height: 220px; overflow: auto; padding: 8px 10px; background: var(--bg-secondary); border: var(--border-width) solid var(--border-color); border-radius: 6px; font-size: var(--fs-11); line-height: 1.5; white-space: pre-wrap; word-break: break-word; user-select: text;"></pre>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);">Repository</span>
            <a id="btnAboutOpenRepo" href="#" style="color: var(--accent-text); text-decoration: none; font-weight: 500;">${GITHUB_MARK}${REPOSITORY_URL.replace('https://github.com/', '')}</a>
          </div>
        </div>
        <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: var(--border-width) solid var(--border-color); font-size: var(--fs-12); color: var(--text-muted);">
          <span>© 2026 ${AUTHOR}. MIT License.</span>
          <button id="btnAboutOk" class="toolbar-btn" style="padding: 6px 18px; background: var(--accent-color, #38bdf8); color: var(--text-on-accent, #ffffff); font-weight: 600; border-radius: 6px; font-size: var(--fs-13); cursor: pointer;">OK</button>
        </div>
      </div>
    </div>
  `;

  div.querySelector('#btnCloseAboutModal')?.addEventListener('click', async () => {
    if (await confirmClose('about')) hideAboutModal();
  });
  div.querySelector('#btnAboutOk')?.addEventListener('click', hideAboutModal);
  div.addEventListener('click', (e) => {
    if (e.target === div) hideAboutModal();
  });
  const noticesToggle = div.querySelector<HTMLAnchorElement>('#btnAboutToggleNotices');
  const noticesText = div.querySelector<HTMLElement>('#aboutNoticesText');
  let noticesLoaded = false;
  // The notices text starts with the full LICENSE, so the License row opens the same panel
  const toggleNotices = async (e: Event) => {
    e.preventDefault();
    if (!noticesText) return;
    const opening = noticesText.hidden;
    noticesText.hidden = !opening;
    if (noticesToggle) noticesToggle.textContent = opening ? 'Hide ↑' : 'Show ↓';
    if (opening && !noticesLoaded) {
      noticesLoaded = true;
      const text = await window.engineAPI?.getThirdPartyNotices?.().catch(() => null);
      // textContent: the file is plain text and must never be parsed as markup
      noticesText.textContent = text ?? 'The license list is not bundled with this build. See the LICENSE file in the installation folder.';
    }
  };
  noticesToggle?.addEventListener('click', toggleNotices);
  div.querySelector('#btnAboutToggleLicense')?.addEventListener('click', toggleNotices);
  // Each upstream link opens its own project page; the same helper serves every link in this dialog
  const openLink = (id: string, url: string) =>
    div.querySelector(`#${id}`)?.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.engineAPI?.openExternal) {
        window.engineAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    });
  openLink('aboutMonacoLink', MONACO_URL);
  openLink('aboutElectronLink', ELECTRON_URL);
  // Rows filled by setLink (theme, model, cloud provider) open their source through data-url
  div.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLElement>('[data-url]');
    if (!link?.dataset.url) return;
    e.preventDefault();
    if (window.engineAPI?.openExternal) {
      window.engineAPI.openExternal(link.dataset.url);
    } else {
      window.open(link.dataset.url, '_blank');
    }
  });
  div.querySelector('#aboutEngineValue')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.engineAPI?.openExternal) {
      window.engineAPI.openExternal(ENGINE_URL);
    } else {
      window.open(ENGINE_URL, '_blank');
    }
  });
  div.querySelector('#btnAboutOpenAuthor')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.engineAPI?.openExternal) {
      window.engineAPI.openExternal(AUTHOR_URL);
    } else {
      window.open(AUTHOR_URL, '_blank');
    }
  });
  div.querySelector('#btnAboutOpenRepo')?.addEventListener('click', (e) => {
    e.preventDefault();
    const repoUrl = REPOSITORY_URL;
    if (window.engineAPI?.openExternal) {
      window.engineAPI.openExternal(repoUrl);
    } else {
      window.open(repoUrl, '_blank');
    }
  });


  return div;
}
