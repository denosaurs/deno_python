export const SYMBOLS = {
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
    parameters: ["buffer"],
    result: "pointer",
  },

  PyRun_SimpleString: {
    parameters: ["buffer"],
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
    parameters: ["buffer", "buffer", "buffer"],
    result: "void",
  },

  PyDict_New: {
    parameters: [],
    result: "pointer",
  },

  PyDict_SetItemString: {
    parameters: ["pointer", "buffer", "pointer"],
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
    callback: true,
    parameters: ["pointer", "pointer", "pointer"],
    result: "pointer",
  },

  PyObject_GetAttrString: {
    parameters: ["pointer", "buffer"],
    result: "pointer",
  },

  PyObject_SetAttrString: {
    parameters: ["pointer", "buffer", "pointer"],
    result: "i32",
  },

  PyObject_HasAttrString: {
    parameters: ["pointer", "buffer"],
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
    parameters: ["buffer", "i32", "pointer"],
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

  PySet_New: {
    parameters: ["pointer"],
    result: "pointer",
  },

  PySet_Add: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  PyImport_ExecCodeModule: {
    parameters: ["buffer", "pointer"],
    result: "pointer",
  },

  PyObject_IsInstance: {
    parameters: ["pointer", "pointer"],
    result: "i32",
  },

  PyDict_GetItemString: {
    parameters: ["pointer", "buffer"],
    result: "pointer",
  },

  PyTuple_Size: {
    parameters: ["pointer"],
    result: "i32",
  },

  PyTuple_GetItem: {
    parameters: ["pointer", "i32"],
    result: "pointer",
  },

  PyCFunction_NewEx: {
    parameters: ["buffer", "pointer", "pointer"],
    result: "pointer",
  },
} as const;
