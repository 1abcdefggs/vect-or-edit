/**
 * Markdown Preview - read-only rendered view of the active document.
 * marked and DOMPurify are loaded on first use, so editor startup cost stays unchanged.
 */
import { getCurrentContent, focusEditor } from '../core/editorCore.js';
import { t } from '../../core/i18n.js';
import { showToast } from '../../ui/notifications/toastManager.js';

const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  // Only http(s), mailto and in-page anchors. Relative and file: URLs are dropped.
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):|^#/i,
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style']
};

let rendererPromise = null;
let isPreviewVisible = false;

function loadRenderer() {
  if (!rendererPromise) {
    rendererPromise = Promise.all([import('marked'), import('dompurify')])
      .then(([markedModule, purifyModule]) => ({
        marked: markedModule.marked,
        purify: purifyModule.default
      }))
      .catch((err) => {
        rendererPromise = null;
        throw err;
      });
  }
  return rendererPromise;
}

/**
 * Renders Markdown text into an element with the same renderer and the same sanitizing as the preview.
 * The first-run format sample uses it too, so the sample shows exactly what the preview will show.
 */
export async function renderMarkdownInto(target, markdown) {
  const { marked, purify } = await loadRenderer();
  const rawHtml = marked.parse(markdown || '', { gfm: true, async: false });
  target.innerHTML = purify.sanitize(rawHtml, SANITIZE_CONFIG);
}

async function renderPreview(preview) {
  await renderMarkdownInto(preview, getCurrentContent() || '');
}

function updateButtonLabel() {
  const button = document.getElementById('btnMarkdownPreview');
  if (!button) return;
  const label = isPreviewVisible ? t('btn_markdown_edit') : t('btn_markdown_preview');
  button.querySelector('.markdown-preview-label').textContent = label;
  button.setAttribute('aria-pressed', String(isPreviewVisible));
}

export async function toggleMarkdownPreview() {
  const preview = document.getElementById('markdownPreview');
  const monacoContainer = document.getElementById('monacoContainer');
  if (!preview || !monacoContainer) return;

  const nextVisible = !isPreviewVisible;

  if (nextVisible) {
    try {
      await renderPreview(preview);
    } catch (err) {
      console.error('[MarkdownPreview] Failed to render preview:', err);
      showToast(t('markdown_preview_failed'), 'error');
      return;
    }
  }

  isPreviewVisible = nextVisible;
  preview.hidden = !isPreviewVisible;
  monacoContainer.style.display = isPreviewVisible ? 'none' : 'block';
  updateButtonLabel();

  if (!isPreviewVisible) focusEditor();
}

/**
 * Shows or hides the Preview button: only a Markdown document has a rendered view.
 * When the active document becomes Text while the preview is open, the preview closes and the editor comes back.
 */
export function setPreviewAvailable(available) {
  const button = document.getElementById('btnMarkdownPreview');
  if (!button) return;
  // It stays in the layout (invisible), so the format button beside it does not shift when the format changes
  button.classList.toggle('is-unavailable', !available);
  button.tabIndex = available ? 0 : -1;
  button.setAttribute('aria-hidden', String(!available));
  const separator = document.querySelector('[data-preview-separator]');
  if (separator) separator.classList.toggle('is-unavailable', !available);
  if (!available && isPreviewVisible) toggleMarkdownPreview();
}

export function initMarkdownPreview() {
  const button = document.getElementById('btnMarkdownPreview');
  if (!button) return;

  button.addEventListener('click', () => {
    toggleMarkdownPreview();
  });
  window.addEventListener('app:languageChanged', updateButtonLabel);
  updateButtonLabel();
}
