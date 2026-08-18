/**
 * Advanced Stage-Aware Cyber LED Matrix Visualizer
 * Renders an ambient micro LED matrix directly behind the 7 pipeline status badges.
 * Dynamically highlights zones based on individual subsystem ON/OFF/ACTIVE states.
 */
export class LedMatrixVisualizer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.cellSize = options.cellSize || 4;
    this.cellGap = options.cellGap || 2;
    this.baseColor = options.baseColor || '#0c121e';
    this.litColor = options.litColor || '#0080FF';
    this.glowColor = options.glowColor || '#38bdf8';
    this.activityLevel = 0.15;
    this.targetActivity = 0.15;
    this.status = 'INFO';
    this.animationFrameId = null;
    this.cols = 0;
    this.rows = 0;
    this.cells = [];
    this.time = 0;

    // 7 Subsystem stage states (0 to 6)
    this.stageStates = [false, false, false, false, false, false, false];

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.startAnimation();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(10, rect.width) * dpr;
    this.canvas.height = Math.max(10, rect.height) * dpr;
    this.ctx.scale(dpr, dpr);

    const step = this.cellSize + this.cellGap;
    this.cols = Math.ceil(rect.width / step);
    this.rows = Math.ceil(rect.height / step);

    this.cells = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          brightness: Math.random() * 0.15,
          targetBrightness: 0,
          speed: 0.06 + Math.random() * 0.08
        });
      }
      this.cells.push(row);
    }
  }

  setSubsystemStates(statesArray) {
    if (Array.isArray(statesArray)) {
      this.stageStates = statesArray;
    }
  }

  triggerActivity(type = 'INFO', boost = 0.85) {
    this.status = type;
    this.targetActivity = boost;
  }

  startAnimation() {
    const loop = () => {
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    this.time += 0.04;
    this.activityLevel += (this.targetActivity - this.activityLevel) * 0.06;
    if (this.targetActivity > 0.15) {
      this.targetActivity -= 0.006;
    }

    this.ctx.clearRect(0, 0, w, h);

    const step = this.cellSize + this.cellGap;
    const stageWidthCols = this.cols > 0 ? this.cols / 7 : 1;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r]?.[c];
        if (!cell) continue;

        // Determine which of the 7 stages this column belongs to
        const stageIndex = Math.min(6, Math.floor(c / stageWidthCols));
        const isStageReady = this.stageStates[stageIndex];

        // Wave formula across the pipeline
        const flowWave = Math.sin(c * 0.4 - this.time * 2.5 + r * 0.6);
        const noise = Math.sin(c * 13.7 + r * 37.1 + this.time * 1.8);

        let probability = this.activityLevel * 0.2 + (flowWave * 0.12) + (noise * 0.1);

        if (isStageReady) {
          // If this stage is ON/Ready, elevate matrix brightness & activity
          probability += 0.35;
        }

        if (Math.random() < probability * 0.4) {
          cell.targetBrightness = isStageReady ? (0.6 + Math.random() * 0.4) : (0.2 + Math.random() * 0.3);
        } else {
          cell.targetBrightness = isStageReady ? 0.08 : 0.02;
        }

        cell.brightness += (cell.targetBrightness - cell.brightness) * cell.speed;

        const x = c * step;
        const y = r * step;

        if (cell.brightness > 0.25) {
          // Determine color based on stage and system health
          let litColor = isStageReady ? '#00e5ff' : '#0284c7';
          let glowColor = isStageReady ? '#38bdf8' : '#0369a1';

          if (this.status === 'ERROR') {
            litColor = '#ef4444';
            glowColor = '#f87171';
          } else if (this.status === 'WARN') {
            litColor = '#f59e0b';
            glowColor = '#fbbf24';
          }

          this.ctx.fillStyle = litColor;
          this.ctx.globalAlpha = Math.min(1, cell.brightness);
          this.ctx.shadowColor = glowColor;
          this.ctx.shadowBlur = cell.brightness > 0.5 ? 4 : 1;
          this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
        } else {
          // Dim grid base
          this.ctx.fillStyle = this.baseColor;
          this.ctx.globalAlpha = 0.5;
          this.ctx.shadowBlur = 0;
          this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
        }
      }
    }

    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;
  }
}
