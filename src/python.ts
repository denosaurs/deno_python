// deno-lint-ignore-file no-explicit-any no-fallthrough
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
  // deno-lint-ignore ban-types
  | Symbol;

/**
 * JS types that can be converted to Python Objects.
 */
export type PythonConvertible =
  | PythonConvertibleBase
  | PythonConvertible[]
  | { [key: string]: PythonConvertible }
  | Map<PythonConvertible, PythonConvertible>
  | Set<PythonConvertible>;

/**
 * Symbol used on proxied Python objects to point to the original PyObject object.
 */
export const ProxiedPyObject = Symbol("ProxiedPyObject");

/**
 * Represents a Python object.
 * It can be anything, like an int, a string, a list, a dict, etc. and
 * even a module itself.
 */
export class PyObject {
  constructor(public handle: Deno.UnsafePointer) {}

  /**
   * Check if the object is NULL or None.
   */
  get isNone() {
    return this.handle.value === 0n ||
      this.handle.value === python.None[ProxiedPyObject].handle.value;
  }

  /**
   * Increases ref count of the object and returns it.
   */
  get owned(): PyObject {
    py.Py_IncRef(this.handle);
    return this;
  }

  /**
   * Creates an ES6 proxy object that can be used to access
   * properties on the Python object easily.
   */
  get proxy(): any {
    // deno-lint-ignore no-this-alias
    const scope = this;
    // Not using arrow function here because it disallows
    // `new` operator being used.
    function object(...args: any[]) {
      return scope.call(args)?.proxy;
    }

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

    // Proxied object must be a function in order for it
    // to be callable. We cannot just define `apply`.
    return new Proxy(object, {
      get: (_, name) => {
        // For the symbols.
        if (typeof name === "symbol" && name in object) {
          return (object as any)[name];
        }

        if (typeof name === "string" && /^\d+$/.test(name)) {
          if (this.isInstance(python.list)) {
            const item = py.PyList_GetItem(
              this.handle,
              parseInt(name),
            ) as Deno.UnsafePointer;
            if (item.value !== 0n) {
              return new PyObject(item).proxy;
            }
          }
        }

        // Don't wanna throw errors when accessing properties.
        const attr = this.maybeGetAttr(String(name))?.proxy;

        // For non-symbol properties, we prioritize returning the attribute.
        if (attr === undefined) {
          if (name in object) {
            return (object as any)[name];
          } else if (typeof name === "string" && this.isInstance(python.dict)) {
            const value = py.PyDict_GetItemString(
              this.handle,
              cstr(name),
            ) as Deno.UnsafePointer;
            if (value.value !== 0n) {
              return new PyObject(value).proxy;
            }
          }
        } else {
          return attr;
        }
      },

      set: (_, name, value) => {
        name = String(name);
        if (this.hasAttr(name)) {
          this.setAttr(String(name), value);
          return true;
        } else if (this.isInstance(python.dict)) {
          py.PyDict_SetItemString(
            this.handle,
            cstr(name),
            PyObject.from(value).handle,
          );
          return true;
        } else if (this.isInstance(python.list) && /^\d+$/.test(name)) {
          py.PyList_SetItem(
            this.handle,
            Number(name),
            PyObject.from(value).handle,
          );
          return true;
        } else {
          return false;
        }
      },

      has: (_, name) => {
        if (typeof name === "symbol" && name in object) {
          return true;
        }

        name = String(name);

        return this.hasAttr(name) ||
          (this.isInstance(python.dict) &&
            this.proxy.__contains__(name).valueOf()) ||
          name in object;
      },
    }) as any;
  }

  /**
   * Calls Python `isinstance` function.
   */
  isInstance(cls: PythonConvertible): boolean {
    return py.PyObject_IsInstance(this.handle, PyObject.from(cls).handle) !== 0;
  }

  /**
   * Performs an equals operation on the Python object.
   */
  equals(rhs: PythonConvertible) {
    const rhsObject = PyObject.from(rhs);
    return py.PyObject_RichCompareBool(this.handle, rhsObject.handle, 3);
  }

  /**
   * Creates a new Python object from the given JS value.
   *
   * Only functions are not supported.
   *
   * @param v JS Value
   * @returns Python object
   */
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
        } else if (v instanceof Set) {
          const set = py.PySet_New(null) as Deno.UnsafePointer;
          for (const i of v) {
            const item = PyObject.from(i);
            py.PySet_Add(set, item.owned.handle);
            py.Py_DecRef(item.handle);
          }
          return new PyObject(set);
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

  /**
   * Tries to get the attribute, returns undefined otherwise.
   *
   * @param name Name of the attribute.
   * @returns Python object
   */
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

  /**
   * Same as maybeGetAttr, but throws an error if the attribute is not found.
   */
  getAttr(name: string): PyObject {
    const obj = this.maybeGetAttr(name);
    if (obj === undefined) {
      throw new Error(`Attribute '${name}' not found`);
    } else {
      return obj;
    }
  }

  /**
   * Tries to set the attribute, throws an error otherwise.
   */
  setAttr(name: string, v: PythonConvertible) {
    if (
      py.PyObject_SetAttrString(
        this.handle,
        cstr(name),
        PyObject.from(v).handle,
      ) !== 0
    ) {
      maybeThrowError();
    }
  }

  /** Checks if Python object has an attribute of given name. */
  hasAttr(attr: string) {
    return py.PyObject_HasAttrString(this.handle, cstr(attr)) !== 0;
  }

  /**
   * Casts a Bool Python object as JS Boolean value.
   */
  asBoolean() {
    return py.PyLong_AsLong(this.handle) === 1;
  }

  /**
   * Casts a Int Python object as JS Number value.
   */
  asLong() {
    return py.PyLong_AsLong(this.handle) as number;
  }

  /**
   * Casts a Float (Double) Python object as JS Number value.
   */
  asDouble() {
    return py.PyFloat_AsDouble(this.handle) as number;
  }

  /**
   * Casts a String Python object as JS String value.
   */
  asString() {
    const str = py.PyUnicode_AsUTF8(this.handle) as Deno.UnsafePointer;
    if (str.value === 0n) {
      return null;
    } else {
      return new Deno.UnsafePointerView(str).getCString();
    }
  }

  /**
   * Casts a List Python object as JS Array value.
   */
  asArray() {
    const array: PythonConvertible[] = [];
    const length = py.PyList_Size(this.handle) as number;
    for (let i = 0; i < length; i++) {
      array.push(
        new PyObject(py.PyList_GetItem(this.handle, i) as Deno.UnsafePointer)
          .valueOf(),
      );
    }
    return array;
  }

  /**
   * Casts a Dict Python object as JS Map value.
   *
   * Note: `from` supports converting both Map and Object to Python Dict.
   * But this only supports returning a Map.
   */
  asDict() {
    const dict = new Map<PythonConvertible, PythonConvertible>();
    const keys = py.PyDict_Keys(this.handle) as Deno.UnsafePointer;
    const length = py.PyList_Size(keys) as number;
    for (let i = 0; i < length; i++) {
      const key = new PyObject(
        py.PyList_GetItem(keys, i) as Deno.UnsafePointer,
      );
      const value = new PyObject(
        py.PyDict_GetItem(this.handle, key.handle) as Deno.UnsafePointer,
      );
      dict.set(key.valueOf(), value.valueOf());
    }
    return dict;
  }

  /**
   * Casts a Set Python object as JS Set value.
   */
  asSet() {
    const set = new Set<PythonConvertible>();
    const iter = py.PyObject_GetIter(this.handle) as Deno.UnsafePointer;
    let item = py.PyIter_Next(iter) as Deno.UnsafePointer;
    while (item.value !== 0n) {
      set.add(new PyObject(item).valueOf());
      item = py.PyIter_Next(iter) as Deno.UnsafePointer;
    }
    py.Py_DecRef(iter);
    return set;
  }

  /**
   * Tries to guess the value of the Python object.
   * Only primitives are casted as JS value type, otherwise returns
   * a proxy to Python object.
   */
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
    } else if (type === python.set[ProxiedPyObject].handle.value) {
      return this.asSet();
    } else {
      return this.proxy;
    }
  }

  /**
   * Calls a Python function.
   */
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

  /**
   * Returns `str` representation of the Python object.
   */
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

/**
 * Checks if there's any error set, throws it if there is.
 */
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

/**
 * Python interface. Do not construct directly, use `python` instead.
 */
export class Python {
  /** Built-ins module. */
  builtins: any;

  // Some commonly used things.
  bool: any;
  int: any;
  float: any;
  str: any;
  list: any;
  dict: any;
  set: any;
  None: any;

  constructor() {
    py.Py_Initialize();
    this.builtins = this.import("builtins");

    this.int = this.builtins.int;
    this.float = this.builtins.float;
    this.str = this.builtins.str;
    this.list = this.builtins.list;
    this.dict = this.builtins.dict;
    this.None = this.builtins.None;
    this.bool = this.builtins.bool;
    this.set = this.builtins.set;
  }

  /**
   * Runs Python script from the given string.
   */
  run(code: string) {
    if (py.PyRun_SimpleString(cstr(code)) !== 0) {
      throw new PythonError("Failed to run code");
    }
  }

  /**
   * Runs Python script as a module and returns its module object.
   */
  runModule(code: string, name?: string) {
    const module = py.PyImport_ExecCodeModule(
      cstr(name ?? "__main__"),
      PyObject.from(
        this.builtins.compile(code, name ?? "__main__", "exec"),
      )
        .handle,
    ) as Deno.UnsafePointer;
    if (module.value === 0n) {
      throw new PythonError("Failed to run module");
    }
    return new PyObject(module)?.proxy;
  }

  /**
   * Import a module as PyObject.
   */
  importObject(name: string) {
    const mod = py.PyImport_ImportModule(cstr(name)) as Deno.UnsafePointer;
    if (mod.value === 0n) {
      maybeThrowError();
      throw new PythonError(`Failed to import module ${name}`);
    }
    return new PyObject(mod);
  }

  /**
   * Import a Python module.
   */
  import(name: string) {
    return this.importObject(name).proxy;
  }
}

/**
 * Python interface.
 */
export const python = new Python();
