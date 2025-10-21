import python, { Callback } from "../mod.ts";
import { assertEquals } from "./asserts.ts";

Deno.test("js fns are automaticlly converted to callbacks", () => {
  const pyModule = python.runModule(
    `
def call_the_callback(cb):
  result = cb()
  return result + 1
  `,
    "test_module",
  );

  assertEquals(pyModule.call_the_callback(() => 4).valueOf(), 5);
});

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

  // @ts-ignore:requires: --v8-flags=--expose-gc
  gc();

  // If the callback was incorrectly GC'd, this should segfault
  // But it should work because Python holds a reference
  assertEquals(pyModule.call_stored_callback().valueOf(), 20);
  assertEquals(callCount, 2);

  // Call it again to be sure
  assertEquals(pyModule.call_stored_callback().valueOf(), 30);
  assertEquals(callCount, 3);
  callbackObj.destroy();
});

Deno.test("callbacks are not gc'd while still needed by python (function version)", () => {
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

def clear_callback():
  global stored_callback
  stored_callback = None
  `,
    "test_gc_module",
  );

  // Store the callback in Python and call it
  {
    assertEquals(pyModule.store_and_call_callback(() => 4).valueOf(), 4);
  }

  // @ts-ignore:requires: --v8-flags=--expose-gc
  gc();

  // If the callback was incorrectly GC'd, this should segfault
  // But it should work because Python holds a reference
  assertEquals(pyModule.call_stored_callback().valueOf(), 4);

  // Call it again to be sure
  assertEquals(pyModule.call_stored_callback().valueOf(), 4);

  // Clean up Python's reference to allow callback to be freed
  pyModule.clear_callback();

  // Force GC to trigger capsule destructor
  // @ts-ignore:requires: --v8-flags=--expose-gc
  gc();
});
