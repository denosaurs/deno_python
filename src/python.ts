import { py } from "./ffi.ts";
import { cstr } from "./util.ts";

export type PythonConvertibleBase =
  | number
  | bigint
  | null
  | undefined
  | boolean
  | PyObject
  | string
  | Symbol;

export type PythonConvertible = PythonConvertibleBase | PythonConvertibleBase[];

export const ProxiedPyObject = Symbol("ProxiedPyObject");

export class PyObject {
  constructor(public handle: Deno.UnsafePointer) {}

  get isNone() {
    return this.handle.value === 0n ||
      this.handle.value === python.builtins.None[ProxiedPyObject].handle.value;
  }

  get owned(): PyObject {
    py.Py_IncRef(this.handle);
    return this;
  }

  get proxy(): any {
    const object = (...args: any[]) => {
      return this.call(args)?.proxy;
    };

    Object.defineProperty(object, Symbol.for("Deno.customInspect"), {
      value: () => this.toString(),
    });

    Object.defineProperty(object, ProxiedPyObject, {
      value: this,
      enumerable: false,
    });

    Object.defineProperty(object, "toString", {
      value: () => this.toString(),
    });

    Object.defineProperty(object, "valueOf", {
      value: () => this.valueOf(),
    });

    return new Proxy(object, {
      get: (_, name) => {
        // For the symbols.
        if (typeof name === "symbol" && name in object) {
          return (object as any)[name];
        }

        // Don't wanna throw errors when accessing properties.
        const attr = this.maybeGetAttr(String(name))?.proxy;

        // For non-symbol properties, we prioritize returning the attribute.
        if (attr === undefined) {
          if (name in object) {
            return (object as any)[name];
          }
        } else {
          return attr;
        }
      },
    }) as unknown as any;
  }

  static from<T extends PythonConvertible>(v: T): PyObject {
    switch (typeof v) {
      case "boolean": {
        return new PyObject(
          py.PyBool_FromLong(v ? 1 : 0) as Deno.UnsafePointer,
        );
      }

      case "number": {
        if (Number.isInteger(v)) {
          return new PyObject(py.PyLong_FromLong(v) as Deno.UnsafePointer);
        } else {
          return new PyObject(py.PyFloat_FromDouble(v) as Deno.UnsafePointer);
        }
      }

      case "bigint": {
        // TODO
        return new PyObject(
          py.PyLong_FromLong(Number(v)) as Deno.UnsafePointer,
        );
      }

      case "object": {
        if (v === null) {
          return python.builtins.None[ProxiedPyObject];
        } else if (Array.isArray(v)) {
          const list = py.PyList_New(v.length) as Deno.UnsafePointer;
          for (let i = 0; i < v.length; i++) {
            py.PyList_SetItem(list, i, PyObject.from(v[i]).owned.handle);
          }
          return new PyObject(list);
        } else if (v instanceof PyObject) {
          return v;
        } else {
          const dict = py.PyDict_New() as Deno.UnsafePointer;
          for (
            const [key, value] of (v instanceof Map
              ? v.entries()
              : Object.entries(v))
          ) {
            const keyObj = PyObject.from(key);
            const valueObj = PyObject.from(value);
            py.PyDict_SetItem(
              dict,
              keyObj.owned.handle,
              valueObj.owned.handle,
            );
            py.Py_DecRef(keyObj.handle);
            py.Py_DecRef(valueObj.handle);
          }
          return new PyObject(dict);
        }
      }

      case "symbol":
      case "string": {
        const str = String(v);
        return new PyObject(
          py.PyUnicode_DecodeUTF8(
            cstr(str),
            str.length,
            null,
          ) as Deno.UnsafePointer,
        );
      }

      case "undefined": {
        return PyObject.from(null);
      }

      case "function": {
        if (ProxiedPyObject in v) {
          return v[ProxiedPyObject];
        }
      }

      default:
        throw new TypeError(`Unsupported type: ${typeof v}`);
    }
  }

  maybeGetAttr(name: string): PyObject | undefined {
    const obj = new PyObject(
      py.PyObject_GetAttrString(this.handle, cstr(name)) as Deno.UnsafePointer,
    );
    if (obj.handle.value === 0n) {
      py.PyErr_Clear();
      return undefined;
    } else {
      return obj;
    }
  }

  getAttr(name: string): PyObject {
    const obj = this.maybeGetAttr(name);
    if (obj === undefined) {
      throw new Error(`Attribute '${name}' not found`);
    } else {
      return obj;
    }
  }

  asBoolean() {
    return py.PyLong_AsLong(this.handle) === 1;
  }

  asLong() {
    return py.PyLong_AsLong(this.handle) as number;
  }

  asDouble() {
    return py.PyFloat_AsDouble(this.handle) as number;
  }

  asString() {
    const str = py.PyUnicode_AsUTF8(this.handle) as Deno.UnsafePointer;
    if (str.value === 0n) {
      return null;
    } else {
      return new Deno.UnsafePointerView(str).getCString();
    }
  }

  asArray() {
    const array: PyObject[] = [];
    const length = py.PyList_Size(this.handle) as number;
    for (let i = 0; i < length; i++) {
      array.push(
        new PyObject(py.PyList_GetItem(this.handle, i) as Deno.UnsafePointer),
      );
    }
    return array;
  }

  asDict() {
    const dict = new Map<PyObject, PyObject>();
    const key = new BigUint64Array(1);
    const value = new BigUint64Array(1);
    const length = new BigUint64Array(1);
    while (py.PyDict_Next(this.handle, key, value, length) !== 0) {
      dict.set(
        new PyObject(new Deno.UnsafePointer(key[0])),
        new PyObject(new Deno.UnsafePointer(value[0])),
      );
    }
    return dict;
  }

  valueOf() {
    const type = (py.PyObject_Type(this.handle) as Deno.UnsafePointer).value;

    if (type === python.None[ProxiedPyObject].handle.value) {
      return null;
    } else if (type === python.bool[ProxiedPyObject].handle.value) {
      return this.asBoolean();
    } else if (type === python.int[ProxiedPyObject].handle.value) {
      return this.asLong();
    } else if (type === python.float[ProxiedPyObject].handle.value) {
      return this.asDouble();
    } else if (type === python.str[ProxiedPyObject].handle.value) {
      return this.asString();
    } else if (type === python.list[ProxiedPyObject].handle.value) {
      return this.asArray();
    } else if (type === python.dict[ProxiedPyObject].handle.value) {
      return this.asDict();
    } else {
      return this.proxy;
    }
  }

  call(
    positional: PythonConvertible[] = [],
    named: Record<string, PythonConvertible> = {},
  ) {
    const args = py.PyTuple_New(positional.length);
    for (let i = 0; i < positional.length; i++) {
      py.PyTuple_SetItem(args, i, PyObject.from(positional[i]).owned.handle);
    }
    const kwargs = py.PyDict_New();
    for (const [key, value] of Object.entries(named)) {
      py.PyDict_SetItemString(
        kwargs,
        cstr(key),
        PyObject.from(value).owned.handle,
      );
    }
    const result = py.PyObject_Call(
      this.handle,
      args,
      kwargs,
    ) as Deno.UnsafePointer;

    py.Py_DecRef(args);
    py.Py_DecRef(kwargs);

    maybeThrowError();

    return new PyObject(result);
  }

  toString() {
    return new PyObject(py.PyObject_Str(this.handle) as Deno.UnsafePointer)
      .asString();
  }

  [Symbol.for("Deno.customInspect")]() {
    return this.toString();
  }
}

export class PythonError extends Error {
  name = "PythonError";

  constructor(public message: string) {
    super(message);
  }
}

export function maybeThrowError() {
  const error = py.PyErr_Occurred() as Deno.UnsafePointer;
  if (error.value === 0n) {
    return;
  }

  const pointers = new BigUint64Array(3);
  py.PyErr_Fetch(
    pointers.subarray(0, 1),
    pointers.subarray(1, 2),
    pointers.subarray(2, 3),
  );

  const type = new PyObject(new Deno.UnsafePointer(pointers[0])),
    value = new PyObject(new Deno.UnsafePointer(pointers[1])),
    traceback = new PyObject(new Deno.UnsafePointer(pointers[2]));

  let errorMessage = (value ?? type).toString() ?? "Unknown error";
  if (!traceback.isNone) {
    const tb = python.import("traceback");
    errorMessage += `\nTraceback:\n${tb.format_tb(traceback)}`;
  }

  throw new PythonError(errorMessage);
}

export class Python {
  builtins: any;
  bool: any;
  int: any;
  float: any;
  str: any;
  list: any;
  dict: any;
  None: any;

  constructor() {
    py.Py_Initialize();
    // Why is PyEval_GetBuiltins() not working?
    // It returns null on every get attr.
    this.builtins = this.import("builtins");

    this.int = this.builtins.int;
    this.float = this.builtins.float;
    this.str = this.builtins.str;
    this.list = this.builtins.list;
    this.dict = this.builtins.dict;
    this.None = this.builtins.None;
    this.bool = this.builtins.bool;
  }

  run(code: string) {
    if (py.PyRun_SimpleString(cstr(code)) !== 0) {
      throw new PythonError("Failed to run code");
    }
  }

  importObject(name: string) {
    const mod = py.PyImport_ImportModule(cstr(name)) as Deno.UnsafePointer;
    if (mod.value === 0n) {
      maybeThrowError();
      throw new PythonError(`Failed to import module ${name}`);
    }
    return new PyObject(mod);
  }

  import(name: string) {
    return this.importObject(name).proxy;
  }
}

export const python = new Python();
