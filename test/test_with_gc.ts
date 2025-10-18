import python, { Callback } from "../mod.ts";
import { assertEquals } from "./asserts.ts";

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
