# deno_python

Python interpreter bindings for Deno.

```ts
import { python } from "https://deno.land/x/python@0.0.1/mod.ts";

const np = python.import("numpy");
const plt = python.import("matplotlib.pyplot");

const xpoints = np.array([1, 8]);
const ypoints = np.array([3, 10]);

plt.plot(xpoints, ypoints);
plt.show();
```

## Documentation

Check out the docs [here](https://doc.deno.land/https://deno.land/x/python@0.0.1/mod.ts).

## Python Installation

This module uses FFI to interface with the Python interpreter's C API.
So you must have an existing Python installation (with the shared library),
which is something like `python39.dll`, etc.

Python installed from Microsoft Store does not work.

If the module fails to find Python, you can add the path to the Python
in the `DENO_PYTHON_PATH` environment variable.

## License

[Apache 2.0 license](./LICENSE).

Copyright 2021 @ DjDeveloperr
