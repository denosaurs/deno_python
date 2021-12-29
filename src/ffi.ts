let lib: string | undefined;

try {
  lib = Deno.env.get("DENO_PYTHON_PATH");
} finally {
  // todo
}

try {
  // deno-lint-ignore no-inner-declarations no-var
  var py = Deno.dlopen(lib ?? "D:\\Python39\\python39.dll", {
    Py_DecodeLocale: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    Py_SetProgramName: {
      parameters: ["pointer"],
      result: "void",
    },

    Py_Initialize: {
      parameters: [],
      result: "void",
    },

    Py_IncRef: {
      parameters: ["pointer"],
      result: "void",
    },

    Py_DecRef: {
      parameters: ["pointer"],
      result: "void",
    },

    PyImport_ImportModule: {
      parameters: ["pointer"],
      result: "pointer",
    },

    PyEval_GetBuiltins: {
      parameters: [],
      result: "pointer",
    },

    PyRun_SimpleString: {
      parameters: ["pointer"],
      result: "i32",
    },

    PyErr_Occurred: {
      parameters: [],
      result: "pointer",
    },

    PyErr_Clear: {
      parameters: [],
      result: "void",
    },

    PyErr_Fetch: {
      parameters: ["pointer", "pointer", "pointer"],
      result: "void",
    },

    PyDict_New: {
      parameters: [],
      result: "pointer",
    },

    PyDict_SetItemString: {
      parameters: ["pointer", "pointer", "pointer"],
      result: "i32",
    },

    PyObject_GetItem: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyObject_SetItem: {
      parameters: ["pointer", "pointer", "pointer"],
      result: "i32",
    },

    PyObject_DelItem: {
      parameters: ["pointer", "pointer"],
      result: "i32",
    },

    PyObject_Call: {
      parameters: ["pointer", "pointer", "pointer"],
      result: "pointer",
    },

    PyObject_CallObject: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyObject_GetAttrString: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyObject_SetAttrString: {
      parameters: ["pointer", "pointer", "pointer"],
      result: "i32",
    },

    PySlice_New: {
      parameters: ["pointer", "pointer", "pointer"],
      result: "pointer",
    },

    PyTuple_New: {
      parameters: ["i32"],
      result: "pointer",
    },

    PyTuple_SetItem: {
      parameters: ["pointer", "i32", "pointer"],
      result: "i32",
    },

    PyObject_RichCompare: {
      parameters: ["pointer", "pointer", "i32"],
      result: "pointer",
    },

    PyObject_RichCompareBool: {
      parameters: ["pointer", "pointer", "i32"],
      result: "i32",
    },

    PyDict_Next: {
      parameters: ["pointer", "pointer", "pointer", "pointer"],
      result: "i32",
    },

    PyDict_SetItem: {
      parameters: ["pointer", "pointer", "pointer"],
      result: "i32",
    },

    PyIter_Next: {
      parameters: ["pointer"],
      result: "pointer",
    },

    PyObject_GetIter: {
      parameters: ["pointer"],
      result: "pointer",
    },

    PyList_New: {
      parameters: ["i32"],
      result: "pointer",
    },

    PyList_SetItem: {
      parameters: ["pointer", "i32", "pointer"],
      result: "i32",
    },

    PyBool_FromLong: {
      parameters: ["i32"],
      result: "pointer",
    },

    PyFloat_AsDouble: {
      parameters: ["pointer"],
      result: "f64",
    },

    PyFloat_FromDouble: {
      parameters: ["f64"],
      result: "pointer",
    },

    PyLong_AsLong: {
      parameters: ["pointer"],
      result: "i32",
    },

    PyLong_FromLong: {
      parameters: ["i32"],
      result: "pointer",
    },

    PyLong_AsUnsignedLongMask: {
      parameters: ["pointer"],
      result: "u32",
    },

    PyLong_FromUnsignedLong: {
      parameters: ["u32"],
      result: "pointer",
    },

    PyUnicode_AsUTF8: {
      parameters: ["pointer"],
      result: "pointer",
    },

    PyUnicode_DecodeUTF8: {
      parameters: ["pointer", "i32", "pointer"],
      result: "pointer",
    },

    PyBytes_FromStringAndSize: {
      parameters: ["pointer", "i32"],
      result: "pointer",
    },

    PyBytes_AsStringAndSize: {
      parameters: ["pointer", "pointer", "pointer"],
      result: "i32",
    },

    PyBool_Type: {
      parameters: [],
      result: "pointer",
    },

    PySlice_Type: {
      parameters: [],
      result: "pointer",
    },

    PyNumber_Add: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_Subtract: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_Multiply: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_TrueDivide: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_InPlaceAdd: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_InPlaceSubtract: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_InPlaceMultiply: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_InPlaceTrueDivide: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_Negative: {
      parameters: ["pointer"],
      result: "pointer",
    },

    PyNumber_And: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_Or: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_Xor: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_InPlaceAnd: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_InPlaceOr: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_InPlaceXor: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },

    PyNumber_Invert: {
      parameters: ["pointer"],
      result: "pointer",
    },

    PyList_Size: {
      parameters: ["pointer"],
      result: "i32",
    },

    PyList_GetItem: {
      parameters: ["pointer", "i32"],
      result: "pointer",
    },

    PyObject_Type: {
      parameters: ["pointer"],
      result: "pointer",
    },

    PyObject_Str: {
      parameters: ["pointer"],
      result: "pointer",
    },

    PyDict_Keys: {
      parameters: ["pointer"],
      result: "pointer",
    },

    PyDict_GetItem: {
      parameters: ["pointer", "pointer"],
      result: "pointer",
    },
  }).symbols;
} catch (e) {
  throw new Error(`Python library not found: ${(e as Error).message}`);
}

export { py };
