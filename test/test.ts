import { assert, assertEquals, assertThrows } from "./asserts.ts";
import {
  kw,
  NamedArgument,
  ProxiedPyObject,
  PyObject,
  python,
  PythonProxy,
} from "../mod.ts";

const { version, executable } = python.import("sys");
console.log("Python version:", version);
console.log("Executable:", executable);

Deno.test("python version", () => {
  assert(version.toString().match(/^\d+\.\d+\.\d+/));
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

    const unicode = python.str("'中文'");
    assertEquals(unicode.valueOf(), "'中文'");
  });

  await t.step("list", () => {
    const value = python.list([1, 2, 3]);
    assertEquals(value.valueOf(), [1, 2, 3]);
  });

  await t.step("dict", () => {
    const value = python.dict({ a: 1, b: 2 });
    assertEquals(
      value.valueOf(),
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
    );
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
      python
        .str("Hello, {name}!")
        .format(kw`name=${"world"}`)
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

Deno.test("custom proxy", () => {
  const np = python.import("numpy");

  // We declare our own PythonProxy wrapper
  const CustomProxy = class implements PythonProxy {
    public readonly [ProxiedPyObject]: PyObject;

    constructor(array: PythonProxy) {
      this[ProxiedPyObject] = array[ProxiedPyObject];
    }
  };

  // Wrap the result in our custom wrapper
  const arr = new CustomProxy(np.array([1, 2, 3]));

  // Then, we use the wrapped proxy as if it were an original PyObject
  assertEquals(np.add(arr, 2).tolist().valueOf(), [3, 4, 5]);
});

Deno.test("slice", async (t) => {
  await t.step("get", () => {
    const list = python.list([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assertEquals(list["1:"].valueOf(), [2, 3, 4, 5, 6, 7, 8, 9]);
    assertEquals(list["1:2"].valueOf(), [2]);
    assertEquals(list[":2"].valueOf(), [1, 2]);
    assertEquals(list[":2:"].valueOf(), [1, 2]);
    assertEquals(list["0:3:2"].valueOf(), [1, 3]);
    assertEquals(list["-2:"].valueOf(), [8, 9]);
    assertEquals(list["::2"].valueOf(), [1, 3, 5, 7, 9]);
  });

  await t.step("set", () => {
    const np = python.import("numpy");
    let list = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    list["1:"] = -5;
    assertEquals(list.tolist().valueOf(), [1, -5, -5, -5, -5, -5, -5, -5, -5]);

    list = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    list["1::3"] = -5;
    assertEquals(list.tolist().valueOf(), [1, -5, 3, 4, -5, 6, 7, -5, 9]);

    list = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    list["1:2:3"] = -5;
    assertEquals(list.tolist().valueOf(), [1, -5, 3, 4, 5, 6, 7, 8, 9]);
  });
});

Deno.test("slice list", async (t) => {
  const np = python.import("numpy");

  await t.step("get", () => {
    const array = np.array([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    assertEquals(array["0, :"].tolist().valueOf(), [1, 2, 3]);
    assertEquals(array["1:, ::2"].tolist().valueOf(), [
      [4, 6],
      [7, 9],
    ]);
    assertEquals(array["1:, 0"].tolist().valueOf(), [4, 7]);
  });

  await t.step("set", () => {
    const array = np.arange(15).reshape(3, 5);
    array["1:, ::2"] = -99;
    assertEquals(array.tolist().valueOf(), [
      [0, 1, 2, 3, 4],
      [-99, 6, -99, 8, -99],
      [-99, 11, -99, 13, -99],
    ]);
  });

  await t.step("whitespaces", () => {
    const array = np.array([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    assertEquals(array[" 1  :  , : :  2         "].tolist().valueOf(), [
      [4, 6],
      [7, 9],
    ]);
  });

  await t.step("3d slicing", () => {
    const a3 = np.array([[[10, 11, 12], [13, 14, 15], [16, 17, 18]], [
      [20, 21, 22],
      [23, 24, 25],
      [26, 27, 28],
    ], [[30, 31, 32], [33, 34, 35], [36, 37, 38]]]);

    assertEquals(a3["0, :, 1"].tolist().valueOf(), [11, 14, 17]);
  });

  await t.step("ellipsis", () => {
    const a4 = np.arange(16).reshape(2, 2, 2, 2);

    assertEquals(a4["1, ..., 1"].tolist().valueOf(), [[9, 11], [13, 15]]);
  });
});

Deno.test("async", () => {
  const { test } = python.runModule(
    `
async def test():
  return "ok"
  `,
    "async_test.py",
  );
  const aio = python.import("asyncio");
  assertEquals(aio.run(test()).valueOf(), "ok");
});

Deno.test("callback", () => {
  const { call } = python.runModule(
    `
def call(cb):
  return cb(61, reduce=1) + 1
  `,
    "cb_test.py",
  );
  const cb = python.callback((kw: { reduce: number }, num: number) => {
    return num - kw.reduce + 8;
  });
  assertEquals(
    call(cb).valueOf(),
    69,
  );
  cb.destroy();
});

Deno.test("callback returns void", () => {
  const { call } = python.runModule(
    `
def call(cb):
  cb()
  `,
    "cb_test.py",
  );
  const cb = python.callback(() => {
    // return void
  });
  call(cb);
  cb.destroy();
});

Deno.test("exceptions", async (t) => {
  await t.step("simple exception", () => {
    assertThrows(() => python.runModule("1 / 0"));
  });

  await t.step("exception with traceback", () => {
    const np = python.import("numpy");
    const array = np.zeros([2, 3, 4]);
    assertThrows(() => array.shape = [3, 6]);
  });
});

Deno.test("instance method", () => {
  const { A } = python.runModule(
    `
class A:
  def b(self):
    return 4
  `,
    "cb_test.py",
  );

  const [m, cb] = python.instanceMethod((_args, self) => {
    return self.b();
  });
  // Modifying PyObject modifes A
  PyObject.from(A).setAttr("a", m);

  assertEquals(new A().a.call().valueOf(), 4);
  cb.destroy();
});
