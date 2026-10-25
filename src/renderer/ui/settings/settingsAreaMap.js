/**
 * The window map at the top of the settings page: Header, Editor, Sidebar and System laid out as in the window.
 * A press selects the matching tab by clicking its tab button, so the tab logic stays in one place.
 * The marked area follows the active tab, however the tab was changed (button, guide, jump from a lamp).
 */
export function initSettingsAreaMap() {
  const areas = document.querySelectorAll('.settings-area[data-area-tab]');
  const tabs = document.querySelectorAll('.settings-tab-btn[data-tab]');
  if (!areas.length || !tabs.length) return;

  const sync = () => {
    const active = document.querySelector('.settings-tab-btn.active')?.dataset.tab;
    areas.forEach((area) => {
      const isActive = area.dataset.areaTab === active;
      area.classList.toggle('active', isActive);
      area.setAttribute('aria-pressed', String(isActive));
    });
  };

  areas.forEach((area) => {
    area.addEventListener('click', () => {
      document.querySelector(`.settings-tab-btn[data-tab="${area.dataset.areaTab}"]`)?.click();
    });
  });

  const observer = new MutationObserver(sync);
  tabs.forEach((tab) => observer.observe(tab, { attributes: true, attributeFilter: ['class'] }));
  sync();
}
