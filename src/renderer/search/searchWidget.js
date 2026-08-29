import { icons } from '../core/icons.js';
import { i18n, t } from '../core/i18n.js';
import { resolveItemCode, resolveItemTitle } from './searchUtils.js';

let monacoContentWidget = null;

export function showMonacoWidget(results, range, targetEditor, monacoInstance) {
  if (monacoContentWidget) {
    targetEditor.removeContentWidget(monacoContentWidget);
  }

  const domNode = document.createElement('div');
  domNode.style.cssText = "background: var(--bg-secondary); border: 1px solid var(--accent-color); border-radius: 6px; box-shadow: 0 4px 12px var(--modal-shadow); z-index: 50; display: flex; flex-direction: column; color: var(--text-main); min-width: 350px; max-width: 500px;";

  let isExpanded = false;
  const topN = 3;

  function renderWidgetContent() {
    const visibleResults = isExpanded ? results : results.slice(0, topN);
    const hiddenCount = Math.max(0, results.length - topN);
    const countText = isExpanded ? results.length : Math.min(topN, results.length);
    const headerTitle = t('widget_suggest_header', { count: countText });

    let html = `
      <div style="padding: 8px 12px; background: var(--hover-bg); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8rem;  color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
          ${icons.search}
          <span>${headerTitle}</span>
        </span>
      </div>
      <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column;">
    `;

    visibleResults.forEach((r, index) => {
      const scorePct = ((r.score || 0) * 100).toFixed(1);
      const code = resolveItemCode(r);
      const title = resolveItemTitle(r);

      let tooltipParts = [];
      const reservedKeys = new Set(['id', 'code', 'key', '@id', 'name', 'title', 'label', 'prefLabel', 'term', 'text', 'score', 'vector']);
      for (let k in r) {
        if (!reservedKeys.has(k) && r[k]) {
          tooltipParts.push(`${k}: ${typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]}`);
        }
      }
      const tooltip = tooltipParts.join('\n').replace(/"/g, '&quot;');

      html += `
        <div class="vector-widget-item" data-index="${index}" title="${tooltip}" style="position: relative; padding: 10px 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; flex-direction: column; gap: 4px; overflow: hidden; flex-shrink: 0; transition: background 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">
          <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${scorePct}%; background: var(--accent-color); opacity: 0.12; z-index: 0; pointer-events: none;"></div>
          <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
              ${code ? `<span style="background: var(--item-code-bg); color: var(--item-code-text); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;  flex-shrink: 0;">${code}</span>` : ''}
              <span style=" font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
              ${tooltipParts.length > 0 ? `<span style="color: var(--text-muted); font-size: 0.7rem; margin-left: 4px;">(i)</span>` : ''}
            </div>
            <span style="color: var(--success-color); font-size: 0.75rem;  flex-shrink: 0;">${scorePct}%</span>
          </div>
        </div>
      `;
    });

    html += `</div>`;

    if (!isExpanded && hiddenCount > 0) {
      html += `
        <div id="btnWidgetLoadMore" style="padding: 8px; text-align: center; font-size: 0.8rem;  color: var(--accent-color); cursor: pointer; background: var(--hover-bg);" onmouseover="this.style.background='var(--active-bg)'" onmouseout="this.style.background='var(--hover-bg)'">
          ${t('loadMoreLabel', { hiddenCount })}
        </div>
      `;
    }

    domNode.innerHTML = html;

    // click insert 
    const items = domNode.querySelectorAll('.vector-widget-item');
    items.forEach((item) => {
      item.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(item.getAttribute('data-index'), 10);
        const selectedResult = visibleResults[idx];
        targetEditor.executeEdits('vectorSearch', [{
          range: range,
          text: resolveItemTitle(selectedResult) || selectedResult.name,
          forceMoveMarkers: true
        }]);
        targetEditor.focus();
        if (monacoContentWidget) {
          targetEditor.removeContentWidget(monacoContentWidget);
          monacoContentWidget = null;
        }
      };
    });

    // Load More button
    const loadMoreBtn = domNode.querySelector('#btnWidgetLoadMore');
    if (loadMoreBtn) {
      loadMoreBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isExpanded = true;
        renderWidgetContent();
      };
    }
  }

  renderWidgetContent();

  monacoContentWidget = {
    getId: () => 'vector.suggestion.widget',
    getDomNode: () => domNode,
    getPosition: () => {
      return {
        position: {
          lineNumber: range.startLineNumber,
          column: range.startColumn
        },
        preference: [monacoInstance.editor.ContentWidgetPositionPreference.BELOW, monacoInstance.editor.ContentWidgetPositionPreference.ABOVE]
      };
    }
  };

  targetEditor.addContentWidget(monacoContentWidget);

  setTimeout(() => {
    const disposable = targetEditor.onMouseDown(() => {
      if (monacoContentWidget) {
        targetEditor.removeContentWidget(monacoContentWidget);
        monacoContentWidget = null;
      }
      disposable.dispose();
    });
  }, 100);
}
