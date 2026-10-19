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

async function renderPreview(preview) {
  const { marked, purify } = await loadRenderer();
  const rawHtml = marked.parse(getCurrentContent() || '', { gfm: true, async: false });
  preview.innerHTML = purify.sanitize(rawHtml, SANITIZE_CONFIG);
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

export function initMarkdownPreview() {
  const button = document.getElementById('btnMarkdownPreview');
  if (!button) return;

  button.addEventListener('click', () => {
    toggleMarkdownPreview();
  });
  window.addEventListener('app:languageChanged', updateButtonLabel);
  updateButtonLabel();
}
