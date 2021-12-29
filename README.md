# deno_python

[![Tags](https://img.shields.io/github/release/denosaurs/deno_python)](https://github.com/denosaurs/deno_python/releases)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/python/mod.ts)
[![checks](https://github.com/denosaurs/deno_python/actions/workflows/checks.yml/badge.svg)](https://github.com/denosaurs/deno_python/actions/workflows/checks.yml)
[![License](https://img.shields.io/github/license/denosaurs/deno_python)](https://github.com/denosaurs/deno_python/blob/master/LICENSE)

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

Check out the docs
[here](https://doc.deno.land/https://deno.land/x/python@0.0.1/mod.ts).

## Python Installation

This module uses FFI to interface with the Python interpreter's C API. So you
must have an existing Python installation (with the shared library), which is
something like `python39.dll`, etc.

Python installed from Microsoft Store does not work.

If the module fails to find Python, you can add the path to the Python in the
`DENO_PYTHON_PATH` environment variable.

## Maintainers

- DjDeveloper ([@DjDeveloperr](https://github.com/DjDeveloperr))
- Elias Sjögreen ([@eliassjogreen](https://github.com/eliassjogreen))

## Permission Table

| Permission Needed | Required | Reason                                         |
| ----------------- | -------- | ---------------------------------------------- |
| `--allow-env`     | yes      | For finding the location of the python library |
| `--allow-run`     | yes      | For finding the location of the python library |
| `--allow-read`    | yes      | For reading the library                        |
| `--allow-ffi`     | yes      | It uses FFI to interact with python            |
| `--unstable`      | yes      | It's unstable because it is uses FFI           |

## Other

### Related

- [python](https://www.python.org/)

### Contribution

Pull request, issues and feedback are very welcome. Code style is formatted with
`deno fmt` and commit messages are done following Conventional Commits spec.

### Licence

Copyright 2022, the denosaurs team. All rights reserved. MIT license.
