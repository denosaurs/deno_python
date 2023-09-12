// deno-lint-ignore no-explicit-any
export function assert(condition: any) {
  if (!condition) {
    throw new Error("Assertion failed");
  }
}

export function assertEquals<T>(actual: T, expected: T) {
  if (
    (actual instanceof Map && expected instanceof Map) ||
    (actual instanceof Set && expected instanceof Set)
  ) {
    return assertEquals([...actual], [...expected]);
  }
  const actualS = JSON.stringify(actual);
  const expectedS = JSON.stringify(expected);
  if (actualS !== expectedS) {
    throw new Error(`Expected ${expectedS}, got ${actualS}`);
  }
}

export function assertThrows(fn: () => void) {
  try {
    fn();
  } catch (_e) {
    return;
  }
  throw new Error("Expected exception");
}
