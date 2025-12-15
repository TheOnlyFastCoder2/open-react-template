import { signal, computed, effect } from '../reactivity-v6';
import { expect, test } from 'bun:test';

// формат баров для таймлайна
const bar = (ms: number, color: string) => {
  const len = Math.min(20, Math.round((ms / 16.6) * 20));
  const block = '█'.repeat(len);
  return color + block + '\x1b[0m' + ' '.repeat(20 - len);
};

const green = '\x1b[32m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const gray = '\x1b[90m';

test('⚔️ Phased scheduler adaptive benchmark', async () => {
  console.log('\n🚀 Запуск PhasedMonsterAdaptive benchmark...\n');

  const src = signal(0);
  const heavy = computed(() => src.v * 2);
  const EFFECT_COUNT = 300;

  // распределяем эффекты по фазам
  const updateEffects: any[] = [];
  const commitEffects: any[] = [];
  const idleEffects: any[] = [];

  for (let i = 0; i < EFFECT_COUNT; i++) {
    const p = i % 3;
    const eff = effect(async () => {
      heavy.v;
      for (let j = 0; j < 50000; j++) {
        if (j % 10000 === 0) await Promise.resolve();
      }
    });
    if (p === 0) updateEffects.push(eff);
    else if (p === 1) commitEffects.push(eff);
    else idleEffects.push(eff);
  }

  let frame = 0;
  const frameStats: number[] = [];

  const startMem = process.memoryUsage().heapUsed / 1024;
  const startTime = performance.now();

  const runPhase = async (name: string, effects: any[], color: string) => {
    const t0 = performance.now();
    for (const eff of effects) {
      await Promise.resolve();
      eff._dirty && eff.run();
    }
    const t1 = performance.now();
    const ms = t1 - t0;
    return { name, ms, color };
  };

  while (performance.now() - startTime < 5000) {
    const tFrame0 = performance.now();

    const update = await runPhase('update', updateEffects, green);
    const commit = await runPhase('commit', commitEffects, yellow);
    const idle = await runPhase('idle', idleEffects, blue);

    const frameMs = performance.now() - tFrame0;
    frameStats.push(frameMs);

    // адаптация: если кадр тяжелый, часть commit → idle
    if (frameMs > 25 && commitEffects.length > 10) {
      const moved = commitEffects.splice(0, 10);
      idleEffects.push(...moved);
      console.warn(
        gray + `⚠️  frame ${frame} too heavy (${frameMs.toFixed(1)}ms) → moved 10 commits to idle` + '\x1b[0m'
      );
    }

    frame++;
    console.log(
      `${gray}🎞 frame ${frame.toString().padStart(3)} ${bar(update.ms, green)}${bar(commit.ms, yellow)}${bar(
        idle.ms,
        blue
      )} ${frameMs.toFixed(2)}ms\x1b[0m`
    );

    src.v++;
    await new Promise((r) => setTimeout(r, 8 + Math.random() * 8));
  }

  const avg = frameStats.reduce((a, b) => a + b, 0) / frameStats.length;
  const min = Math.min(...frameStats);
  const max = Math.max(...frameStats);
  const endMem = process.memoryUsage().heapUsed / 1024;
  const memDelta = (endMem - startMem).toFixed(1);

  console.log('\n📊 Итог:');
  console.table([
    { Metric: 'Средний кадр', Value: `${avg.toFixed(2)} ms` },
    { Metric: 'Мин. кадр', Value: `${min.toFixed(2)} ms` },
    { Metric: 'Макс. кадр', Value: `${max.toFixed(2)} ms` },
    { Metric: 'Δ Памяти', Value: `${memDelta} KB` },
  ]);

 
  expect(avg).toBeGreaterThan(0);
  expect(avg).toBeLessThan(100);
});
