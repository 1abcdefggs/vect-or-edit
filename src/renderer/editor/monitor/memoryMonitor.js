/**
 * Memory monitoring subsystem
 */
let memoryMonitorInterval = null;

export function initMemoryMonitor() {
  const statusMemoryUsage = document.getElementById('statusMemoryUsage');
  if (!statusMemoryUsage) return;

  // The text is hidden on a narrow bottom bar, so the item's tooltip carries the same value
  const statusItem = statusMemoryUsage.closest('.status-bar-item');

  const updateMem = () => {
    if (performance && performance.memory) {
      const usedMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
      statusMemoryUsage.textContent = `RAM: ${usedMB} MB`;
    } else {
      statusMemoryUsage.textContent = `RAM: Active`;
    }
    if (statusItem) statusItem.title = statusMemoryUsage.textContent;
  };

  updateMem();
  if (memoryMonitorInterval) clearInterval(memoryMonitorInterval);
  memoryMonitorInterval = setInterval(updateMem, 3000);
}
