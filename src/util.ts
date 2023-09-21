export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

const libDlDef = {
  dlopen: {
    parameters: ["buffer", "i32"],
    result: "pointer",
  },
} as const;

/**
 * On Unix based systems, we need to supply dlopen with RTLD_GLOBAL
 * but Deno.dlopen does not support passing that flag. So we'll open
 * libc and use its dlopen to open with RTLD_LAZY | RTLD_GLOBAL to
 * allow subsequently loaded shared libraries to be able to use symbols
 * from Python C API.
 */
export function postSetup(lib: string) {
  let libdl: Deno.DynamicLibrary<typeof libDlDef>;
  if (Deno.build.os === "linux") {
    const libc = Deno.dlopen(`libc.so.6`, {
      gnu_get_libc_version: { parameters: [], result: "pointer" },
    });
    const ptrView = new Deno.UnsafePointerView(
      libc.symbols.gnu_get_libc_version()!,
    );
    const glibcVersion = parseFloat(ptrView.getCString());

    libdl = Deno.dlopen(
      // starting with glibc 2.34, libdl is merged into libc
      glibcVersion >= 2.34 ? `libc.so.6` : `libdl.so.2`,
      libDlDef,
    );
  } else if (Deno.build.os === "darwin") {
    libdl = Deno.dlopen(`libc.dylib`, libDlDef);
  } else {
    return;
  }
  libdl.symbols.dlopen(cstr(lib), 0x00001 | 0x00100);
}

/**
 * Encodes a C string.
 */
export function cstr(str: string): Uint8Array {
  const buf = new Uint8Array(str.length + 1);
  encoder.encodeInto(str, buf);
  return buf;
}

/**
 * Regular Expression used to test if a string is a `proper_slice`.
 *
 * Based on https://docs.python.org/3/reference/expressions.html#slicings
 */
export const SliceItemRegExp =
  /^\s*(-?\d+)?\s*:\s*(-?\d+)?\s*(:\s*(-?\d+)?\s*)?$/;
