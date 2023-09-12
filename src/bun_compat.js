import { type } from "node:os";

if (!("Deno" in globalThis) && "Bun" in globalThis) {
  const { dlopen, FFIType, CString, JSCallback, ptr } = await import("bun:ffi");
  class Deno {
    static env = {
      get(name) {
        return Bun.env[name];
      },
    };

    static build = {
      os: type().toLowerCase(),
    };

    static transformFFIType(type) {
      switch (type) {
        case "void":
          return FFIType.void;
        case "i32":
          return FFIType.i64_fast;
        case "i64":
          return FFIType.i64;
        case "f32":
          return FFIType.f32;
        case "f64":
          return FFIType.f64;
        case "pointer":
        case "buffer":
          return FFIType.ptr;
        case "u32":
          return FFIType.u64_fast;
        default:
          throw new Error("Type not supported: " + type);
      }
    }

    static dlopen(path, symbols) {
      const bunSymbols = {};
      for (const name in symbols) {
        const symbol = symbols[name];
        if ("type" in symbol) {
          throw new Error("Symbol type not supported");
        } else {
          bunSymbols[name] = {
            args: symbol.parameters.map((type) => this.transformFFIType(type)),
            returns: this.transformFFIType(symbol.result),
          };
        }
      }
      const lib = dlopen(path, bunSymbols);
      return lib;
    }

    static UnsafeCallback = class UnsafeCallback {
      constructor(def, fn) {
        this.inner = new JSCallback(fn, {
          args: def.parameters.map((type) => Deno.transformFFIType(type)),
          returns: Deno.transformFFIType(def.result),
        });
        this.pointer = this.inner.ptr;
      }

      close() {
        this.inner.close();
      }
    };

    static UnsafePointerView = class UnsafePointerView {
      static getCString(ptr) {
        return new CString(ptr);
      }

      constructor(ptr) {
        this.ptr = ptr;
      }

      getCString() {
        return new CString(this.ptr);
      }
    };

    static UnsafePointer = class UnsafePointer {
      static equals(a, b) {
        return a === b;
      }

      static create(a) {
        return Number(a);
      }

      static of(buf) {
        return ptr(buf);
      }

      static value(ptr) {
        return ptr;
      }
    };

    static test(name, fn) {
      globalThis.DenoTestCompat(name, fn);
    }
  }

  globalThis.Deno = Deno;
}
