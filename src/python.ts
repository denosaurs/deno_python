// deno-lint-ignore-file no-explicit-any no-fallthrough

import { py } from "./ffi.ts";
import { cstr, SliceItemRegExp } from "./util.ts";

const refregistry = new FinalizationRegistry(py.Py_DecRef);

/**
 * Symbol used on proxied Python objects to point to the original PyObject object.
 * Can be used to implement PythonProxy and create your own proxies.
 *
 * See `PyObject#proxy` for more info on proxies.
 */
export const ProxiedPyObject = Symbol("ProxiedPyObject");

/**
 * Proxied Python object.
 *
 * When an object implements this interface, the object will not be converted
 * to a Python Object and the original PyObject will be used.
 */
export interface PythonProxy {
  [ProxiedPyObject]: PyObject;
}

/**
 * JS types that can be converted to Python Objects.
 *
 * - `number` becomes `int` or `float` depending on its value.
 *   If you need to specifically use `float` or `int`, use the
 *   `python.float` or `python.int` classes, like:
 *   `python.float(42.0)`. Note that they become PyObjects,
 *   not JS values but are still easily passable to Python.
 *
 * - `bigint` currently is casted as number and then transformed
 *   to `int` Python type.
 *
 * - `null` and `undefined` becomes `None` in Python. Note that when
 *   calling `valueOf` on PyObject, it is always `null`.
 *
 * - `boolean` becomes `bool` in Python.
 *
 * - `string` and `Symbol` becomes `str` in Python.
 *
 * - `Array` becomes `list` in Python.
 *
 * - `Map` and other objects becomes `dict` in Python. Note that when
 *   calling `valueOf` on PyObject, it is always `Map` because JS object
 *   can only have string keys, while Python dict can have any type.
 *
 * - `Set` becomes `set` in Python.
 *
 * - `Callback` (custom type) becomes a Python function. First argument
 *   passed is an object containing kwargs and rest arguments are
 *   positional.
 *
 * If you pass a PyObject, it is used as-is.
 *
 * If you pass a PythonProxy, its original PyObject will be used.
 */
export type PythonConvertible =
  | number
  | bigint
  | void
  | null
  | undefined
  | boolean
  | PyObject
  | string
  // deno-lint-ignore ban-types
  | Symbol
  | PythonProxy
  | PythonConvertible[]
  | { [key: string]: PythonConvertible }
  | Map<PythonConvertible, PythonConvertible>
  | Set<PythonConvertible>
  | Callback;

export type PythonJSCallback = (
  kwargs: any,
  ...args: any[]
) => PythonConvertible;

/**
 * An argument that can be passed to PyObject calls to indicate that the
 * argument should be passed as a named one.
 *
 * It is allowed to pass named argument like this along with the `named` arg in
 * `PyObject#call` because of the use in proxy objects.
 */
export class NamedArgument {
  name: string;
  value: PyObject;

  constructor(name: string, value: PythonConvertible) {
    this.name = name;
    this.value = PyObject.from(value);
  }
}

/**
 * Template Tag to create Keyword Arguments easily
 *
 * Ex:
 *
 * ```ts
 * some_python_function(kw`name=${value}`);
 * ```
 */
export function kw(
  strings: TemplateStringsArray,
  value: PythonConvertible,
): NamedArgument {
  return new NamedArgument(strings[0].split("=")[0].trim(), value);
}

/**
 * Wraps a JS function into Python callback which can be
 * passed to Python land. It must be destroyed explicitly
 * to free up resources on Rust-side.
 *
 * Example:
 * ```ts
 * // Creating
 * const add = new Callback((_, a: number, b: number) => {
 *   return a + b;
 * });
 * // or
 * const add = new Callback((kw: { a: number, b: number }) => {
 *   return kw.a + kw.b;
 * });
 *
 * // Usage
 * some_python_func(add);
 *
 * // Destroy
 * add.destroy();
 * ```
 */
export class Callback {
  unsafe;

  constructor(public callback: PythonJSCallback) {
    this.unsafe = new Deno.UnsafeCallback(
      {
        parameters: ["pointer", "pointer", "pointer"],
        result: "pointer",
      },
      (
        _self: Deno.PointerValue,
        args: Deno.PointerValue,
        kwargs: Deno.PointerValue,
      ) => {
        return PyObject.from(callback(
          kwargs === null ? {} : Object.fromEntries(
            new PyObject(kwargs).asDict()
              .entries(),
          ),
          ...(args === null ? [] : new PyObject(args).valueOf()),
        )).handle;
      },
    );
  }

  destroy() {
    this.unsafe.close();
  }
}

/**
 * Represents a Python object.
 *
 * It can be anything, like an int, a string, a list, a dict, etc. and
 * even a module itself.
 *
 * Normally, you will deal with proxied PyObjects, which are basically JS
 * objects but the get, set, etc. methods you perform on them are actually
 * proxied to Python interpreter API.
 *
 * In case you need access to actual PyObject (which this module does too,
 * internally), there's a Symbol on Proxied PyObjects `ProxiedPyObject`
 * that is exported from this module too. It contains reference to `PyObject`.
 *
 * Both proxied PyObject and normal PyObject implement some basic methods like
 * `valueOf`, `toString` and Deno inspect to provide pretty-printing, and also
 * a way to cast Python values as JS types using `valueOf`. For caveats on `valueOf`,
 * see its documentation.
 *
 * Do not construct this manually, as it takes an Unsafe Pointer pointing to the
 * C PyObject.
 */
export class PyObject {
  /**
   * A Python callabale object as Uint8Array
   * This is used with `PyCFunction_NewEx` in order to extend its liftime and not allow v8 to release it before its actually used
   */
  #pyMethodDef?: Uint8Array;
  constructor(public handle: Deno.PointerValue) {}

  /**
   * Check if the object is NULL (pointer) or None type in Python.
   */
  get isNone() {
    // deno-lint-ignore ban-ts-comment
    // @ts-expect-error
    return this.handle === null || this.handle === 0 ||
      this.handle === python.None[ProxiedPyObject].handle;
  }

  /**
   * Increases ref count of the object and returns it.
   */
  get owned(): PyObject {
    py.Py_IncRef(this.handle);
    refregistry.register(this, this.handle);
    return this;
  }

  /**
   * Creates proxy object that maps basic JS operations on objects
   * such as gets, sets, function calls, has, etc. to Python interpreter API.
   * This makes using Python APIs in JS less cumbersome.
   *
   * Usually, you will deal with proxied PyObjects because they're easier to interact with.
   * If you somehow need the actual `PyObject`, refer to it's documentation.
   *
   * To keep it consistent, proxied objects' further get calls return proxy objects only,
   * so you can safely chain them. But for instance, if you made a call to a method that
   * returns a Python list using proxy object, you can call `.valueOf()` on it to turn it into
   * a JS Array.
   *
   * What you can do on proxy objects:
   *
   * - Call them, if they are a function. An error will be thrown otherwise.
   *
   * - Get their attributes. Such as get `lower` attribute on a `str` object.
   *   This same thing is used to get values of given gets in `dict`s as well.
   *   But the thing is, preference is given to attributes, if its not found,
   *   then we try to look for `dict` key. We could not differentiate normal
   *   property access like something.property with `something[indexed]` in JS,
   *   so they are done on same thing. In case this is not viable for you,
   *   you can call the `get` method on the proxy object, which maps to `dict`'s
   *   `get` method of course.
   *   Just like dicts, this works for lists/tuples too - in order to return
   *   elements based on index.
   *   In special cases, this get accessor returns actual proxy methods,
   *   such as `toString`, `valueOf`, etc. Either way, preference is given to
   *   Python object first. So only if they do not have these attributes,
   *   we return the JS functions.
   *
   * - Set their attributes. Same as the "get" proxy behavior described above,
   *   but instead to set attribute / dict key / list index.
   *
   * - There's also this has accessor on proxy objects, which is basically like
   *   `in` operator in Python. It checks if attribute/dict key exists in the
   *   object.
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

    Object.defineProperty(object, Symbol.for("nodejs.util.inspect.custom"), {
      value: () => this.toString(),
    });

    Object.defineProperty(object, Symbol.toStringTag, {
      value: () => this.toString(),
    });

    Object.defineProperty(object, Symbol.iterator, {
      value: () => this[Symbol.iterator](),
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
        if ((typeof name === "symbol") && name in object) {
          return (object as any)[name];
        }

        if (typeof name === "string" && /^\d+$/.test(name)) {
          if (this.isInstance(python.list) || this.isInstance(python.tuple)) {
            const item = py.PyList_GetItem(
              this.handle,
              parseInt(name),
            );
            if (item !== null) {
              return new PyObject(item).proxy;
            }
          }
        }

        if (typeof name === "string" && isSlice(name)) {
          const slice = toSlice(name);
          const item = py.PyObject_GetItem(
            this.handle,
            slice.handle,
          );
          if (item !== null) {
            return new PyObject(item).proxy;
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
            );
            if (value !== null) {
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
        } else if ((this.isInstance(python.list)) && /^\d+$/.test(name)) {
          py.PyList_SetItem(
            this.handle,
            Number(name),
            PyObject.from(value).handle,
          );
          return true;
        } else if (isSlice(name)) {
          const slice = toSlice(name);
          py.PyObject_SetItem(
            this.handle,
            slice.handle,
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
          py.PyBool_FromLong(v ? 1 : 0),
        );
      }

      case "number": {
        if (Number.isInteger(v)) {
          return new PyObject(py.PyLong_FromLong(v));
        } else {
          return new PyObject(py.PyFloat_FromDouble(v));
        }
      }

      case "bigint": {
        // TODO
        return new PyObject(
          py.PyLong_FromLong(Number(v)),
        );
      }

      case "object": {
        if (v === null /*or void*/) {
          return python.builtins.None[ProxiedPyObject];
        } else if (ProxiedPyObject in v) {
          const proxy = v as PythonProxy;
          return proxy[ProxiedPyObject];
        } else if (Array.isArray(v)) {
          const list = py.PyList_New(v.length);
          for (let i = 0; i < v.length; i++) {
            py.PyList_SetItem(list, i, PyObject.from(v[i]).owned.handle);
          }
          return new PyObject(list);
        } else if (v instanceof Callback) {
          const pyMethodDef = new Uint8Array(8 + 8 + 4 + 8);
          const view = new DataView(pyMethodDef.buffer);
          const LE =
            new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] !== 0x7;
          const nameBuf = new TextEncoder().encode(
            "JSCallback:" + (v.callback.name || "anonymous") + "\0",
          );
          view.setBigUint64(
            0,
            BigInt(Deno.UnsafePointer.value(Deno.UnsafePointer.of(nameBuf)!)),
            LE,
          );
          view.setBigUint64(
            8,
            BigInt(Deno.UnsafePointer.value(v.unsafe.pointer)),
            LE,
          );
          view.setInt32(16, 0x1 | 0x2, LE);
          view.setBigUint64(
            20,
            BigInt(Deno.UnsafePointer.value(Deno.UnsafePointer.of(nameBuf)!)),
            LE,
          );
          const fn = py.PyCFunction_NewEx(
            pyMethodDef,
            PyObject.from(null).handle,
            null,
          );

          // NOTE: we need to extend `pyMethodDef` lifetime
          // Otherwise V8 can release it before the callback is called
          const pyObject = new PyObject(fn);
          pyObject.#pyMethodDef = pyMethodDef;
          return pyObject;
        } else if (v instanceof PyObject) {
          return v;
        } else if (v instanceof Set) {
          const set = py.PySet_New(null);
          for (const i of v) {
            const item = PyObject.from(i);
            py.PySet_Add(set, item.owned.handle);
            py.Py_DecRef(item.handle);
          }
          return new PyObject(set);
        } else {
          const dict = py.PyDict_New();
          for (
            const [key, value]
              of (v instanceof Map ? v.entries() : Object.entries(v))
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
        const encoder = new TextEncoder();
        const u8 = encoder.encode(str);
        return new PyObject(
          py.PyUnicode_DecodeUTF8(
            u8,
            u8.byteLength,
            null,
          ),
        );
      }

      case "undefined": {
        return PyObject.from(null);
      }

      case "function": {
        if (ProxiedPyObject in v) {
          return (v as any)[ProxiedPyObject];
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
      py.PyObject_GetAttrString(this.handle, cstr(name)),
    );
    if (obj.handle === null) {
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
    const str = py.PyUnicode_AsUTF8(this.handle);
    return str !== null ? Deno.UnsafePointerView.getCString(str) : null;
  }

  /**
   * Casts a List Python object as JS Array value.
   */
  asArray() {
    const array: PythonConvertible[] = [];
    for (const i of this) {
      array.push(i.valueOf());
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
    const keys = py.PyDict_Keys(this.handle);
    const length = py.PyList_Size(keys) as number;
    for (let i = 0; i < length; i++) {
      const key = new PyObject(
        py.PyList_GetItem(keys, i),
      );
      const value = new PyObject(
        py.PyDict_GetItem(this.handle, key.handle),
      );
      dict.set(key.valueOf(), value.valueOf());
    }
    return dict;
  }

  *[Symbol.iterator]() {
    const iter = py.PyObject_GetIter(this.handle);
    let item = py.PyIter_Next(iter);
    while (item !== null) {
      yield new PyObject(item);
      item = py.PyIter_Next(iter);
    }
    py.Py_DecRef(iter);
  }

  /**
   * Casts a Set Python object as JS Set object.
   */
  asSet() {
    const set = new Set();
    for (const i of this) {
      set.add(i.valueOf());
    }
    return set;
  }

  /**
   * Casts a Tuple Python object as JS Array value.
   */
  asTuple() {
    const tuple = new Array<PythonConvertible>();
    const length = py.PyTuple_Size(this.handle) as number;
    for (let i = 0; i < length; i++) {
      tuple.push(
        new PyObject(py.PyTuple_GetItem(this.handle, i))
          .valueOf(),
      );
    }
    return tuple;
  }

  /**
   * Tries to guess the value of the Python object.
   *
   * Only primitives are casted as JS value type, otherwise returns
   * a proxy to Python object.
   */
  valueOf() {
    const type = py.PyObject_Type(this.handle);

    if (Deno.UnsafePointer.equals(type, python.None[ProxiedPyObject].handle)) {
      return null;
    } else if (
      Deno.UnsafePointer.equals(type, python.bool[ProxiedPyObject].handle)
    ) {
      return this.asBoolean();
    } else if (
      Deno.UnsafePointer.equals(type, python.int[ProxiedPyObject].handle)
    ) {
      return this.asLong();
    } else if (
      Deno.UnsafePointer.equals(type, python.float[ProxiedPyObject].handle)
    ) {
      return this.asDouble();
    } else if (
      Deno.UnsafePointer.equals(type, python.str[ProxiedPyObject].handle)
    ) {
      return this.asString();
    } else if (
      Deno.UnsafePointer.equals(type, python.list[ProxiedPyObject].handle)
    ) {
      return this.asArray();
    } else if (
      Deno.UnsafePointer.equals(type, python.dict[ProxiedPyObject].handle)
    ) {
      return this.asDict();
    } else if (
      Deno.UnsafePointer.equals(type, python.set[ProxiedPyObject].handle)
    ) {
      return this.asSet();
    } else if (
      Deno.UnsafePointer.equals(type, python.tuple[ProxiedPyObject].handle)
    ) {
      return this.asTuple();
    } else {
      return this.proxy;
    }
  }

  /**
   * Call the PyObject as a Python function.
   */
  call(
    positional: (PythonConvertible | NamedArgument)[] = [],
    named: Record<string, PythonConvertible> = {},
  ) {
    // count named arguments
    const namedCount = positional.filter(
      (arg) => arg instanceof NamedArgument,
    ).length;

    const positionalCount = positional.length - namedCount;
    if (positionalCount < 0) {
      throw new TypeError(
        `${this.toString()} requires at least ${namedCount} arguments, but only ${positional.length} were passed`,
      );
    }

    const args = py.PyTuple_New(positionalCount);

    let startIndex = 0;
    for (let i = 0; i < positional.length; i++) {
      const arg = positional[i];
      if (arg instanceof NamedArgument) {
        named[arg.name] = arg.value;
      } else {
        py.PyTuple_SetItem(args, startIndex++, PyObject.from(arg).owned.handle);
      }
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
    );

    py.Py_DecRef(args);
    py.Py_DecRef(kwargs);

    maybeThrowError();

    return new PyObject(result);
  }

  /**
   * Returns `str` representation of the Python object.
   */
  toString() {
    return new PyObject(py.PyObject_Str(this.handle))
      .asString();
  }

  [Symbol.for("Deno.customInspect")]() {
    return this.toString();
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toString();
  }
}

/** Python-related error. */
export class PythonError extends Error {
  name = "PythonError";

  constructor(
    public type: PyObject,
    public value: PyObject,
    public traceback: PyObject,
  ) {
    let message = (value ?? type).toString() ?? "Unknown error";
    let stack: string | undefined;
    if (!traceback.isNone) {
      const tb = python.import("traceback");
      stack = (tb.format_tb(traceback).valueOf() as string[]).join("");
      message += stack;
    }

    super(message);
    this.stack = stack;
  }
}

/**
 * Checks if there's any error set, throws it if there is.
 */
export function maybeThrowError() {
  const error = py.PyErr_Occurred();
  if (error === null) {
    return;
  }

  const pointers = new BigUint64Array(3);
  py.PyErr_Fetch(
    pointers.subarray(0, 1),
    pointers.subarray(1, 2),
    pointers.subarray(2, 3),
  );

  const type = new PyObject(Deno.UnsafePointer.create(pointers[0])),
    value = new PyObject(Deno.UnsafePointer.create(pointers[1])),
    traceback = new PyObject(Deno.UnsafePointer.create(pointers[2]));

  throw new PythonError(type, value, traceback);
}

/**
 * Python interface. Do not construct directly, use `python` instead.
 */
export class Python {
  /** Built-ins module. */
  builtins: any;
  /** Python `bool` class proxied object */
  bool: any;
  /** Python `int` class proxied object */
  int: any;
  /** Python `float` class proxied object */
  float: any;
  /** Python `str` class proxied object */
  str: any;
  /** Python `list` class proxied object */
  list: any;
  /** Python `dict` class proxied object */
  dict: any;
  /** Python `set` class proxied object */
  set: any;
  /** Python `tuple` class proxied object */
  tuple: any;
  /** Python `None` type proxied object */
  None: any;
  /** Python `Ellipsis` type proxied object */
  Ellipsis: any;

  /** Shortcut to kw function (template string tag) */
  kw = kw;

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
    this.tuple = this.builtins.tuple;
    this.Ellipsis = this.builtins.Ellipsis;

    // Initialize arguments and executable path,
    // since some modules expect them to be set.

    const sys = this.import("sys");
    const os = this.import("os");

    sys.argv = [""];

    if (Deno.build.os === "darwin") {
      sys.executable = os.path.join(sys.exec_prefix, "bin", "python3");
    }
  }

  /**
   * Runs Python script from the given string.
   */
  run(code: string) {
    if (py.PyRun_SimpleString(cstr(code)) !== 0) {
      throw new EvalError("Failed to run python code");
    }
  }

  /**
   * Runs Python script as a module and returns its module object,
   * for using its attributes, functions, classes, etc. from JavaScript.
   */
  runModule(code: string, name?: string) {
    const module = py.PyImport_ExecCodeModule(
      cstr(name ?? "__main__"),
      PyObject.from(
        this.builtins.compile(code, name ?? "__main__", "exec"),
      )
        .handle,
    );
    if (module === null) {
      throw new EvalError("Failed to run python module");
    }
    return new PyObject(module)?.proxy;
  }

  /**
   * Import a module as PyObject.
   */
  importObject(name: string) {
    const mod = py.PyImport_ImportModule(cstr(name));
    if (mod === null) {
      maybeThrowError();
      throw new TypeError(`Failed to import module ${name}`);
    }
    return new PyObject(mod);
  }

  /**
   * Import a Python module as a proxy object.
   */
  import(name: string) {
    return this.importObject(name).proxy;
  }

  /** Shortcut to create Callback instance. */
  callback(cb: PythonJSCallback): Callback {
    return new Callback(cb);
  }
}

/**
 * Python interface.
 *
 * Most of the time, you will use `import` on this object,
 * and also make use of some common built-ins attached to
 * this object, such as `str`, `int`, `tuple`, etc.
 */
export const python = new Python();

/**
 * Returns true if the value can be converted into a Python slice or
 * slice tuple.
 */
function isSlice(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!value.includes(":") && !value.includes("...")) return false;
  return value
    .split(",")
    .map((item) => (
      SliceItemRegExp.test(item) || // Slice
      /^\s*-?\d+\s*$/.test(item) || // Number
      /^\s*\.\.\.\s*$/.test(item) // Ellipsis
    ))
    .reduce((a, b) => a && b, true);
}

/**
 * Returns a PyObject that is either a slice or a tuple of slices.
 */
function toSlice(sliceList: string): PyObject {
  if (sliceList.includes(",")) {
    const pySlicesHandle = sliceList.split(",").map(toSlice);
    return python.tuple(pySlicesHandle)[ProxiedPyObject];
  } else if (/^\s*-?\d+\s*$/.test(sliceList)) {
    return PyObject.from(parseInt(sliceList));
  } else if (/^\s*\.\.\.\s*$/.test(sliceList)) {
    return PyObject.from(python.Ellipsis);
  } else {
    const [start, stop, step] = sliceList
      .split(":")
      .map((
        bound,
      ) => (/^\s*-?\d+\s*$/.test(bound) ? parseInt(bound) : undefined));

    const pySliceHandle = py.PySlice_New(
      PyObject.from(start).handle,
      PyObject.from(stop).handle,
      PyObject.from(step).handle,
    );
    return new PyObject(pySliceHandle);
  }
}
