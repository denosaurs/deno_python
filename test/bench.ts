import { python } from "../mod.ts";
import { bench, run } from "mitata";

const { add } = python.runModule(`
def add(a, b):
  return a + b
`);

bench("noop", () => {});

bench("python.add", () => {
  add(1, 2);
});

await run();
