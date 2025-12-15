import { signal, computed, effect } from '../reactivity-v6'; // путь к твоей v6
import { expect, test } from 'bun:test';

// Простая утилита для замера времени и памяти
const mem = () => (process.memoryUsage().heapUsed / 1024).toFixed(1) + ' KB';

// Отрисовка маленького ASCII-графика
function drawBar(value: number, max = 20): string {
  const filled = Math.round(Math.min(max, (value / 16.6) * max));
  return '█'.repeat(filled) + '░'.repeat(max - filled);
}

test('⚔️ Phased scheduler monster benchmark', async () => {
  console.log('\n🚀 Запуск PhasedMonster benchmark...');

  const src = signal(0);
  const heavy = computed(() => src.v * 2);

  const EFFECT_COUNT = 200;
  const durations: number[] = [];
  const frameStats: { frame: number; ms: number }[] = [];

  // создаем эффекты разных приоритетов
  for (let i = 0; i < EFFECT_COUNT; i++) {
    const p = i % 5 === 0 ? 'high' : i % 3 === 0 ? 'low' : 'normal';
    effect(async () => {
      heavy.v;
      for (let j = 0; j < 10000; j++) {
        if (j % 2000 === 0) await Promise.resolve(); // уступаем цикл event-loop
      }
    }, p as any);
  }

  let frame = 0;
  const startMem = process.memoryUsage().heapUsed / 1024;

  const ticker = setInterval(() => {
    src.v++;
  }, 16);

  const frameMonitor = setInterval(() => {
    frame++;
    const now = performance.now();
    if (frame > 1) {
      const delta = now - (frameStats.at(-1)?.ms ?? now - 16);
      durations.push(delta);
      frameStats.push({ frame, ms: delta });
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(
        `🎯 Frame ${frame.toString().padStart(3)} | ${drawBar(delta)} ${delta.toFixed(2)}ms | avg=${avg.toFixed(
          2
        )}ms | memΔ=${(process.memoryUsage().heapUsed / 1024 - startMem).toFixed(1)} KB`
      );
    } else {
      frameStats.push({ frame, ms: now });
    }
  }, 100);

  await new Promise((r) => setTimeout(r, 5000));

  clearInterval(ticker);
  clearInterval(frameMonitor);

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const max = Math.max(...durations);
  const min = Math.min(...durations);
  const endMem = process.memoryUsage().heapUsed / 1024;

  console.log('\n📊 Итог:');
  console.table([
    {
      Metric: 'Средний кадр',
      Value: `${avg.toFixed(2)} ms`,
    },
    {
      Metric: 'Мин. кадр',
      Value: `${min.toFixed(2)} ms`,
    },
    {
      Metric: 'Макс. кадр',
      Value: `${max.toFixed(2)} ms`,
    },
    {
      Metric: 'Δ Памяти',
      Value: `${(endMem - startMem).toFixed(1)} KB`,
    },
  ]);

  // expect(avg).toBeLessThan(20);
})
