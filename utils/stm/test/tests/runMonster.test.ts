import { signal, computed, effect } from '../reactivity-v1';
import { signal as signal2, computed as computed2, effect as effect2 } from '../reactivity-v2';
import { signal as signal3, computed as computed3, effect as effect3 } from '../reactivity-v3';

type API = { signal: any; computed: any; effect: any };

async function runMonster({ signal, computed, effect }: API) {
  const N_SIGNALS = 20;
  const N_COMPUTEDS = 100;
  const N_EFFECTS = 200;

  const signals = Array.from({ length: N_SIGNALS }, (_, i) => signal(i));

  const computeds = Array.from({ length: N_COMPUTEDS }, (_, i) =>
    computed(() => {
      const base = signals[i % N_SIGNALS];
      const next = signals[(i + 1) % N_SIGNALS];
      return base.v * 2 + next.v;
    })
  );

  let asyncCalls = 0;
  const effects: any[] = [];

  // создаём пачку эффектов
  for (let i = 0; i < N_EFFECTS; i++) {
    const c = computeds[i % N_COMPUTEDS];
    const e = effect(() => {
      const val = c.v;
      let active = true;
      const t = setTimeout(() => {
        if (active) asyncCalls++;
      }, 5);
      return () => {
        active = false;
        clearTimeout(t);
      };
    });
    effects.push(e);
  }

  const tStart = performance.now();
  const memStart = process.memoryUsage().heapUsed / 1024;

  let tick = 0;
  const interval = setInterval(() => {
    // случайно обновляем сигналы
    for (let j = 0; j < 5; j++) {
      const idx = Math.floor(Math.random() * N_SIGNALS);
      signals[idx].v++;
    }

    // иногда обновляем вычисления
    if (tick % 10 === 0) {
      const i = Math.floor(Math.random() * N_COMPUTEDS);
      computeds[i].fn = () => {
        const a = signals[(i + tick) % N_SIGNALS];
        const b = signals[(i + tick + 3) % N_SIGNALS];
        return a.v + b.v * 3;
      };
    }

    // иногда удаляем эффекты
    if (tick % 7 === 0 && effects.length > 0) {
      const e = effects.shift();
      e.dispose();
    }

    tick++;
    if (tick > 100) clearInterval(interval);
  }, 10);

  // ждём окончания
  await new Promise((r) => setTimeout(r, 2000));

  const memEnd = process.memoryUsage().heapUsed / 1024;
  const tEnd = performance.now();

  return {
    asyncCalls,
    time: (tEnd - tStart).toFixed(2),
    memDelta: (memEnd - memStart).toFixed(1),
  };
}

test('⚔️ Monster benchmark: v1 vs v2', async () => {
  console.log('\n🚀 Запуск монстр-теста...\n');

  console.time('v1 time');
  const res1 = await runMonster({ signal, computed, effect });
  console.timeEnd('v1 time');

  console.time('v2 time');
  const res2 = await runMonster({
    signal: signal2,
    computed: computed2,
    effect: effect2,
  });
  console.timeEnd('v2 time');

  console.table([
    { Version: 'v1', Calls: res1.asyncCalls, Time_ms: res1.time, Mem_kB: res1.memDelta },
    { Version: 'v2', Calls: res2.asyncCalls, Time_ms: res2.time, Mem_kB: res2.memDelta },
  ]);

  // expect(res3.asyncCalls).toBeLessThanOrEqual(res2.asyncCalls);
  // expect(res3.asyncCalls).toBeLessThanOrEqual(res2.asyncCalls);
});

test('⚔️ Monster benchmark: v2 vs v3', async () => {
  console.log('\n🚀 Запуск монстр-теста...\n');

  console.time('v2 time');
  const res2 = await runMonster({
    signal: signal2,
    computed: computed2,
    effect: effect2,
  });
  console.timeEnd('v2 time');

  console.time('v3 time');
  const res3 = await runMonster({
    signal: signal2,
    computed: computed2,
    effect: effect2,
  });
  console.timeEnd('v3 time');

  console.table([
    { Version: 'v2', Calls: res2.asyncCalls, Time_ms: res2.time, Mem_kB: res2.memDelta },
    { Version: 'v3', Calls: res3.asyncCalls, Time_ms: res3.time, Mem_kB: res3.memDelta },
  ]);
});
