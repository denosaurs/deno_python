import { describe, test } from "bun:test";

globalThis.DenoTestCompat = function (name, fn) {
  const isGroup = (fn + "").includes("(t)");
  if (isGroup) {
    describe(name, async () => {
      await fn({
        step: async (name, fn) => {
          await test(name, fn);
        },
      });
    });
  } else {
    test(name, async () => {
      await fn();
    });
  }
};
