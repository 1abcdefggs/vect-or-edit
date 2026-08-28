/**
 * Memory monitoring subsystem
 */
let memoryMonitorInterval = null;

export function initMemoryMonitor() {
  const statusMemoryUsage = document.getElementById('statusMemoryUsage');
  if (!statusMemoryUsage) return;

  const updateMem = () => {
    if (performance && performance.memory) {
      const usedMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
      statusMemoryUsage.textContent = `RAM: ${usedMB} MB`;
    } else {
      statusMemoryUsage.textContent = `RAM: Active`;
    }
  };

  updateMem();
  if (memoryMonitorInterval) clearInterval(memoryMonitorInterval);
  memoryMonitorInterval = setInterval(updateMem, 3000);
}
