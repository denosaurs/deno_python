import python, { Callback } from "../mod.ts";
import { assertEquals } from "./asserts.ts";

Deno.test(
  "js fns are automaticlly converted to callbacks",
  // auto callbacks are just a convience api, but they leak their resources
  // the user can use python.callback if they want to control the memory
  { sanitizeResources: false },
  () => {
    const pyModule = python.runModule(
      `
def call_the_callback(cb):
  result = cb()
  return result + 1
  `,
      "test_module",
    );

    assertEquals(pyModule.call_the_callback(() => 4).valueOf(), 5);

    // @ts-ignore:requires: --v8-flags=--expose-gc
    gc(); // if this is commented out, the test will fail beacuse the callback was not freed
  },
);

Deno.test("callbacks are not gc'd while still needed by python", () => {
  const pyModule = python.runModule(
    `
stored_callback = None

def store_and_call_callback(cb):
  global stored_callback
  stored_callback = cb
  return stored_callback()

def call_stored_callback():
  global stored_callback
  if stored_callback is None:
    return -1
  return stored_callback()
  `,
    "test_gc_module",
  );

  let callCount = 0;
  const callback = () => {
    callCount++;
    return callCount * 10;
  };

  // Store the callback in Python and call it
  const callbackObj = new Callback(callback);
  assertEquals(pyModule.store_and_call_callback(callbackObj).valueOf(), 10);
  assertEquals(callCount, 1);

  for (let i = 0; i < 10; i++) {
    // @ts-ignore:requires: --v8-flags=--expose-gc
    gc();
  }

  // If the callback was incorrectly GC'd, this should segfault
  // But it should work because Python holds a reference
  assertEquals(pyModule.call_stored_callback().valueOf(), 20);
  assertEquals(callCount, 2);

  // Call it again to be sure
  assertEquals(pyModule.call_stored_callback().valueOf(), 30);
  assertEquals(callCount, 3);
  callbackObj.destroy();
});

Deno.test(
  "callbacks are not gc'd while still needed by python (autocallback version)",
  // auto callbacks leak
  { sanitizeResources: false },
  () => {
    const pyModule = python.runModule(
      `
stored_callback = None

def store_and_call_callback(cb):
  global stored_callback
  stored_callback = cb
  return stored_callback()

def call_stored_callback():
  global stored_callback
  if stored_callback is None:
    return -1
  return stored_callback()
  `,
      "test_gc_module",
    );

    let callCount = 0;
    const callback = () => {
      callCount++;
      return callCount * 10;
    };

    // Store the callback in Python and call it
    assertEquals(pyModule.store_and_call_callback(callback).valueOf(), 10);
    assertEquals(callCount, 1);

    for (let i = 0; i < 10; i++) {
      // @ts-ignore:requires: --v8-flags=--expose-gc
      gc();
    }

    // If the callback was incorrectly GC'd, this should segfault
    // But it should work because Python holds a reference
    assertEquals(pyModule.call_stored_callback().valueOf(), 20);
    assertEquals(callCount, 2);

    // Call it again to be sure
    assertEquals(pyModule.call_stored_callback().valueOf(), 30);
    assertEquals(callCount, 3);
  },
);

// Disabled for now, maybe in this feature someone can figure this out
// https://github.com/denosaurs/deno_python/pull/87
// Deno.test("auto-created callbacks are cleaned up after gc", () => {
//   // Create callback and explicitly null it out to help GC
//   // @ts-ignore PyObject can be created from fns its just the types are not exposed
//   // deno-lint-ignore no-explicit-any
//   let _f: any = PyObject.from(() => 5);

//   // Explicitly null the reference
//   _f = null;

//   // Now f is null, trigger GC to clean it up
//   // Run many GC cycles with delays to ensure finalizers execute
//   for (let i = 0; i < 10; i++) {
//     // @ts-ignore:requires: --v8-flags=--expose-gc
//     gc();
//   }
// });
