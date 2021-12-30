import { assert, assertEquals } from "./deps.ts";
import { NamedArgument, PyObject, python } from "../mod.ts";

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

  await t.step("set", () => {
    let value = python.set([1, 2, 3]);
    assertEquals(value.valueOf(), new Set([1, 2, 3]));
    value = PyObject.from(new Set([1, 2, 3]));
    assertEquals(value.valueOf(), new Set([1, 2, 3]));
  });
});

Deno.test("object", async (t) => {
  const { Person } = python.runModule(`
class Person:
  def __init__(self, name):
    self.name = name
`);
  const person = new Person("John");

  await t.step("get attr", () => {
    assertEquals(person.name.valueOf(), "John");
  });

  await t.step("set attr", () => {
    person.name = "Jane";
    assertEquals(person.name.valueOf(), "Jane");
  });

  await t.step("has attr", () => {
    assert("name" in person);
  });

  await t.step("dict item", () => {
    const dict = python.dict({ prop: "value" });
    assertEquals(dict.prop.valueOf(), "value");
  });

  await t.step("dict set item", () => {
    const dict = python.dict({ prop: "value" });
    dict.prop = "new value";
    assertEquals(dict.prop.valueOf(), "new value");
  });

  await t.step("dict has item", () => {
    const dict = python.dict({ prop: "value" });
    assert("prop" in dict);
  });

  await t.step("dict not has item", () => {
    const dict = python.dict({ prop: "value" });
    assert(!("prop2" in dict));
  });

  await t.step("list index", () => {
    const list = python.list([1, 2, 3]);
    assertEquals(list[0].valueOf(), 1);
  });

  await t.step("list set index", () => {
    const list = python.list([1, 2, 3]);
    list[0] = 42;
    assertEquals(list[0].valueOf(), 42);
  });
});

Deno.test("named argument", () => {
  assertEquals(
    python.str("Hello, {name}!").format(new NamedArgument("name", "world"))
      .valueOf(),
    "Hello, world!",
  );
});
