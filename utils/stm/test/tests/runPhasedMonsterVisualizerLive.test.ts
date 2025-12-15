import { signal, computed, effect } from "../reactivity-v6";
import { test, expect } from "bun:test";

// 🎨 Цвета для консоли
const c = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  clear: "\x1b[2J\x1b[H",
};

// 🧩 Настройки графа
const WIDTH = 80; // ширина "экрана"
const HEIGHT = 12; // высота осциллограммы

class LiveGraph {
  rows: string[][];

  constructor() {
    this.rows = Array.from({ length: HEIGHT }, () =>
      Array(WIDTH).fill(" ")
    );
  }

  pushFrame(ms: number) {
    // масштаб по оси Y
    const scaled = Math.min(HEIGHT - 1, Math.floor((ms / 33) * HEIGHT));
    for (let y = 0; y < HEIGHT; y++) {
      const char = y === HEIGHT - 1 - scaled ? "▇" : " ";
      const color =
        ms < 8 ? c.green : ms < 16 ? c.yellow : ms < 25 ? c.red : c.magenta;
      this.rows[y].push(color + char + c.reset);
      this.rows[y].shift();
    }
  }

  render() {
    return this.rows.map((r) => r.join("")).join("\n");
  }
}

test("⚔️ Phased scheduler live visualizer", async () => {
  console.clear();
  console.log("🚀 Запуск PhasedMonster LIVE Visualizer...\n");

  const src = signal(0);
  const heavy = computed(() => src.v * 2);

  const updateFx: any[] = [];
  const commitFx: any[] = [];
  const idleFx: any[] = [];

  const EFFECTS = 150;
  for (let i = 0; i < EFFECTS; i++) {
    const eff = effect(() => {
      heavy.v;
      for (let j = 0; j < 2000; j++) Math.sqrt(j);
    });
    if (i % 3 === 0) updateFx.push(eff);
    else if (i % 3 === 1) commitFx.push(eff);
    else idleFx.push(eff);
  }

  const runPhase = async (fx: any[]) => {
    const t0 = performance.now();
    for (const f of fx) {
      f._dirty && f.run();
    }
    return performance.now() - t0;
  };

  const graph = new LiveGraph();
  const start = performance.now();
  let frame = 0;
  const frames: number[] = [];

  while (performance.now() - start < 8000) {
    const t0 = performance.now();
    const up = await runPhase(updateFx);
    const co = await runPhase(commitFx);
    const id = await runPhase(idleFx);
    const frameTime = performance.now() - t0;
    frames.push(frameTime);
    graph.pushFrame(frameTime);

    // адаптация нагрузки
    if (frameTime > 20 && commitFx.length > 10) {
      const moved = commitFx.splice(0, 5);
      idleFx.push(...moved);
    }

    const fps = (1000 / frameTime).toFixed(0);
    const avg =
      frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
    const bar = `${c.green}${"█".repeat(Math.round(up / 2))}${c.yellow}${"█".repeat(
      Math.round(co / 2)
    )}${c.blue}${"█".repeat(Math.round(id / 2))}${c.reset}`;

    console.log(
      `${c.gray}Frame ${frame.toString().padStart(4)}${c.reset}  ${bar} ${frameTime.toFixed(
        2
      )}ms (${fps} fps) avg=${avg.toFixed(2)}ms`
    );

    console.log(graph.render());
    console.log(`${c.gray}${"─".repeat(WIDTH)}${c.reset}`);
    await new Promise((r) => setTimeout(r, 33)); // ≈ 30 FPS
    src.v++;
    frame++;
  }

  const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
  const min = Math.min(...frames);
  const max = Math.max(...frames);
  const mem = (process.memoryUsage().heapUsed / 1024).toFixed(1);

  console.log("\n📊 Итог:");
  console.table([
    { Metric: "Средний кадр", Value: `${avg.toFixed(2)} ms` },
    { Metric: "Мин. кадр", Value: `${min.toFixed(2)} ms` },
    { Metric: "Макс. кадр", Value: `${max.toFixed(2)} ms` },
    { Metric: "Память", Value: `${mem} KB` },
  ]);

  expect(avg).toBeLessThan(40);
}, 20000)
