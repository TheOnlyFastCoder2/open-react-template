import { describe, expect, test } from "bun:test";
import { signal, computed, effect } from "../reactivity-v4"; // <-- путь к твоей v4

// 📦 утилита для подсчёта памяти
function getMemKB() {
  if (globalThis.gc) globalThis.gc();
  return (process.memoryUsage().heapUsed / 1024).toFixed(1);
}

async function makeSchedulerScenario(priority: any, label: string) {
  console.log(`⚡ Запуск сценария [${label}] (${priority})...`);
  const signals: any[] = [];
  const computedArr: any[] = [];

  const root = signal(0);
  for (let i = 0; i < 1000; i++) {
    const s = signal(i);
    const c = computed(() => (s.v + root.v) * 2);
    signals.push(s);
    computedArr.push(c);
  }

  let calls = 0;
  const effs: any[] = [];

  for (let i = 0; i < 300; i++) {
    effs.push(
      effect(() => {
        const idx = i % computedArr.length;
        computedArr[idx].v;
        calls++;
      }, priority)
    );
  }

  const startMem = getMemKB();
  const start = performance.now();

  for (let step = 0; step < 200; step++) {
    const idx = step % signals.length;
    signals[idx].v++;
    if (step % 50 === 0) await new Promise((r) => setTimeout(r, 5));
  }

  await new Promise((r) => setTimeout(r, 200));
  const endMem = getMemKB();
  const time = performance.now() - start;

  console.log(`✅ ${label}: ${calls} calls, ${time.toFixed(2)}ms, mem Δ ${(
    parseFloat(endMem) - parseFloat(startMem)
  ).toFixed(1)} KB`);

  effs.forEach((e) => e.dispose());
  return { label, calls, time, mem: parseFloat(endMem) - parseFloat(startMem) };
}

describe("⚔️ Scheduler monster benchmark", () => {
  test("compare effect scheduling priorities", async () => {
    console.log("🚀 Запуск SchedulerMonster benchmark...\n");

    const results = [];
    results.push(await makeSchedulerScenario("immediate", "Immediate"));
    results.push(await makeSchedulerScenario("microtask", "Microtask"));
    results.push(await makeSchedulerScenario("animationFrame", "Frame"));
    results.push(await makeSchedulerScenario("idle", "Idle"));

    console.log("\n📊 Итог:\n");
    console.table(
      results.map((r) => ({
        Priority: r.label,
        Calls: r.calls,
        Time_ms: r.time.toFixed(2),
        Mem_kB: r.mem.toFixed(1),
      }))
    );

    // sanity check: microtask и frame не должны быть медленнее idle
    expect(results[1].time).toBeLessThan(results[3].time + 200);
  });
});
