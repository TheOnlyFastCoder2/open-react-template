import { signal, computed, effect } from '../reactivity-v6';
import { test, expect } from 'bun:test';

// Консольные цвета
const c = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

// Стиль бара в зависимости от длины
function bar(ms: number, color: string) {
  const len = Math.min(20, Math.round((ms / 16.6) * 20));
  return color + '█'.repeat(len) + c.reset + ' '.repeat(20 - len);
}

// FPS-граф (скользящая история)
class FPSGraph {
  history: number[] = [];
  max = 60;

  push(ms: number) {
    this.history.push(ms);
    if (this.history.length > this.max) this.history.shift();
  }

  draw() {
    const max = Math.max(...this.history, 1);
    const scale = 20 / max;
    const line = this.history
      .map((v) => {
        const h = Math.round(v * scale);
        if (v < 8) return c.green + '▇' + c.reset;
        if (v < 16) return c.yellow + '▇' + c.reset;
        return c.red + '▇' + c.reset;
      })
      .join('');
    return line.padEnd(this.max, ' ');
  }
}

test('⚔️ Phased scheduler visual benchmark', async () => {
  console.clear();
  console.log('🚀 Запуск PhasedMonster Visualizer...\n');

  const src = signal(0);
  const heavy = computed(() => src.v * 2);

  const EFFECTS = 200;
  const updateFx: any[] = [];
  const commitFx: any[] = [];
  const idleFx: any[] = [];

  // создаём эффекты с нагрузкой
  for (let i = 0; i < EFFECTS; i++) {
    const idx = i % 3;
    const eff = effect(async () => {
      heavy.v;
      for (let j = 0; j < 4000; j++) {
        if (j % 2000 === 0) await Promise.resolve();
      }
    });
    if (idx === 0) updateFx.push(eff);
    else if (idx === 1) commitFx.push(eff);
    else idleFx.push(eff);
  }

  const graph = new FPSGraph();
  const start = performance.now();
  let frame = 0;

  const runPhase = async (fx: any[], color: string) => {
    const t0 = performance.now();
    for (const f of fx) {
      // добавим лёгкий CPU busy loop
      for (let i = 0; i < 20000; i++) Math.sqrt(i);
      await Promise.resolve();
      f._dirty && f.run();
    }
    return performance.now() - t0;
  };

  while (performance.now() - start < 5000) {
    const tFrame0 = performance.now();
    const up = await runPhase(updateFx, c.green);
    const co = await runPhase(commitFx, c.yellow);
    const id = await runPhase(idleFx, c.blue);
    const frameMs = performance.now() - tFrame0;

    // FPS-график
    graph.push(frameMs);
    const fps = (1000 / frameMs).toFixed(1);
    const bars = `${bar(up, c.green)}${bar(co, c.yellow)}${bar(id, c.blue)}`;
    process.stdout.write(
      `\r${c.gray}🎞 frame ${frame.toString().padStart(3)} ${bars} ${frameMs.toFixed(2)}ms (${fps} fps) ${graph.draw()}${
        c.reset
      }`
    );

    // Адаптивное перераспределение
    if (frameMs > 25 && commitFx.length > 10) {
      const moved = commitFx.splice(0, 5);
      idleFx.push(...moved);
      process.stdout.write(`\n${c.red}⚠️  frame ${frame} too heavy → moved 5 commits to idle${c.reset}\n`);
    }

    src.v++;
    frame++;
    await new Promise((r) => setTimeout(r, 16));
  }

  const avg = graph.history.reduce((a, b) => a + b, 0) / graph.history.length;
  const min = Math.min(...graph.history);
  const max = Math.max(...graph.history);
  const mem = (process.memoryUsage().heapUsed / 1024).toFixed(1);

  console.log('\n\n📊 Итог:');
  console.table([
    { Metric: 'Средний кадр', Value: `${avg.toFixed(2)} ms` },
    { Metric: 'Мин. кадр', Value: `${min.toFixed(2)} ms` },
    { Metric: 'Макс. кадр', Value: `${max.toFixed(2)} ms` },
    { Metric: 'Память', Value: `${mem} KB` },
  ]);

  expect(avg).toBeGreaterThan(0);
  expect(avg).toBeLessThan(100);
}, 15000);
