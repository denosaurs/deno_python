import { assert, assertEquals } from "./deps.ts";
import { NamedArgument, PyObject, python, PythonLoader } from "../mod.ts";

const { version, executable } = python.import("sys");
console.log("Python version:", version);
console.log("Executable:", executable);

Deno.test("python version", () => {
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

  await t.step("tuple", () => {
    const value = python.tuple([1, 2, 3]);
    assertEquals(value.valueOf(), [1, 2, 3]);
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

  await t.step("list iter", () => {
    const array = [1, 2, 3];
    const list = python.list(array);
    let i = 0;
    for (const v of list) {
      assertEquals(v.valueOf(), array[i]);
      i++;
    }
  });
});

Deno.test("named argument", async (t) => {
  await t.step("single named argument", () => {
    assertEquals(
      python.str("Hello, {name}!").format(new NamedArgument("name", "world"))
        .valueOf(),
      "Hello, world!",
    );
  });

  await t.step(
    "combination of positional parameters and named argument",
    () => {
      const { Test } = python.runModule(`
class Test:
  def test(self, *args, **kwargs):
    return all([len(args) == 3, "name" in kwargs])
`);
      const t = new Test();

      const d = python.dict({ a: 1, b: 2 });
      const v = t.test(1, 2, new NamedArgument("name", "vampire"), d);
      assertEquals(v.valueOf(), true);
    },
  );
});

Deno.test("numpy", () => {
  const _np = python.import("numpy");
});

// using ambient namespace is much nicer
declare namespace Numpy {
  export {}; // no default export behavior

  export const Inf: number;

  // deno-lint-ignore no-shadow-restricted-names
  export const Infinity: number;
}

// implementors would then just export the type
type Numpy = typeof Numpy;

Deno.test("typed loader", () => {
  const loader = new PythonLoader<{
    numpy: Numpy;
  }>(python);

  const np = loader.import("numpy");

  function takeNum(_n: number) {}

  takeNum(np.Inf);
  takeNum(np.Infinity);

  // @ts-expect-error Should be an invalid name.
  loader.import("not-a-mod");
});
