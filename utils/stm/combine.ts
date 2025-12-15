import test from 'node:test';
import { signal, computed, effect } from './index'; // первая версия
import { signal as signal2, computed as computed2, effect as effect2 } from './test'; // вторая версия

function makeScenario({ signal, computed, effect }: any) {
  const srcA = signal(0);
  const srcB = signal(0);

  const combined = computed(() => (srcA.v % 2 ? srcA.v : srcB.v));

  let calls = 0;
  const effects: any[] = [];

  const spawn = (id: number) =>
    effect(() => {
      const val = combined.v;
      let active = true;
      const t = setTimeout(() => {
        if (active) calls++;
      }, 5);
      return () => { active = false; clearTimeout(t); };
    });

  for (let i = 0; i < 10; i++) effects.push(spawn(i));

  let step = 0;
  const timer = setInterval(() => {
    if (step % 2 === 0) srcA.v++; else srcB.v++;
    if (step % 3 === 0 && effects.length) effects.shift()!.dispose();
    if (step++ > 15) {
      clearInterval(timer);
    }
  }, 10);

  return new Promise(resolve => {
    setTimeout(() => resolve(calls), 400);
  });
}

test('second version should emit fewer redundant async calls', async () => {
  const callsV1 = await makeScenario({ signal, computed, effect });
  const callsV2 = await makeScenario({ signal: signal2, computed: computed2, effect: effect2 });
  console.log('Calls v1:', callsV1, 'Calls v2:', callsV2);
  // expect(callsV2).toBeLessThanOrEqual(callsV1);
});

