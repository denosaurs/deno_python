import { assert, assertEquals } from "./deps.ts";
import { python } from "../mod.ts";

Deno.test("python version", () => {
  const { version } = python.import("sys");
  assert(String(version).match(/^\d+\.\d+\.\d+/));
});

Deno.test("types", async (t) => {
  await t.step("bool", () => {
    const value = python.bool(true);
    assertEquals(value.valueOf(), true);
  });

  await t.step("int", () => {
    const value = python.int(42);
    assertEquals(value.valueOf(), 42);
  });

  await t.step("float", () => {
    const value = python.float(42.0);
    assertEquals(value.valueOf(), 42.0);
  });

  await t.step("str", () => {
    const value = python.str("hello");
    assertEquals(value.valueOf(), "hello");
  });

  await t.step("list", () => {
    const value = python.list([1, 2, 3]);
    assertEquals(value.valueOf(), [1, 2, 3]);
  });

  await t.step("dict", () => {
    const value = python.dict({ a: 1, b: 2 });
    assertEquals(value.valueOf(), new Map([["a", 1], ["b", 2]]));
  });
});
