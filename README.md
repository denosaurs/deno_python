# Python Bridge

[![Tags](https://img.shields.io/github/release/denosaurs/deno_python)](https://github.com/denosaurs/deno_python/releases)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/python/mod.ts)
[![checks](https://github.com/denosaurs/deno_python/actions/workflows/checks.yml/badge.svg)](https://github.com/denosaurs/deno_python/actions/workflows/checks.yml)
[![License](https://img.shields.io/github/license/denosaurs/deno_python)](https://github.com/denosaurs/deno_python/blob/master/LICENSE)

This module provides a seamless integration between JavaScript (Deno/Bun) and
Python by integrating with the
[Python/C API](https://docs.python.org/3/c-api/index.html). It acts as a bridge
between the two languages, enabling you to pass data and execute python code
from within your JS applications. This enables access to the large and wonderful
[python ecosystem](https://pypi.org/) while remaining native (unlike a runtime
like the wonderful [pyodide](https://github.com/pyodide/pyodide) which is
compiled to wasm, sandboxed and may not work with all python packages) and
simply using the existing python installation.

## Example

Import any locally installed Python package, for example, `matplotlib`:

```ts
import { python } from "https://deno.land/x/python/mod.ts";

const np = python.import("numpy");
const plt = python.import("matplotlib.pyplot");

const xpoints = np.array([1, 8]);
const ypoints = np.array([3, 10]);

plt.plot(xpoints, ypoints);
plt.show();
```

When running, you **must** specify `--allow-ffi`, `--allow-env` and
`--unstable-ffi` flags. Alternatively, you may also just specify `-A` instead of
specific permissions since enabling FFI effectively escapes the permissions
sandbox.

```shell
deno run -A --unstable-ffi <file>
```

### Usage in Bun

You can import from the `bunpy` NPM package to use this module in Bun.

```ts
import { python } from "bunpy";

const np = python.import("numpy");
const plt = python.import("matplotlib.pyplot");

const xpoints = np.array([1, 8]);
const ypoints = np.array([3, 10]);

plt.plot(xpoints, ypoints);
plt.show();
```

### Dependencies

Normally deno_python follows the default python way of resolving imports, going
through `sys.path` resolving them globally, locally or scoped to a virtual
environment. This is ~~great~~ and allows you to manage your python dependencies
for `deno_python` projects in the same way you would any other python project
using your favorite package manager, be it
[`pip`](https://pip.pypa.io/en/stable/),
[`conda`](https://docs.conda.io/en/latest/) or
[`poetry`](https://python-poetry.org/).

This may not be a good thing though, especially for something like a deno module
which may depend on a python package. That is why the [`ext/pip`](./ext/pip.ts)
utility exists for this project. It allows you to install python dependencies
using pip, scoped to either the global deno installation or if defined the
`--location` passed to deno without leaking to the global python scope. It uses
the same caching location and algorithm as
[plug](https://github.com/denosaurs/deno) and
[deno cache](https://github.com/denoland/deno_cache).

To use [`ext/pip`](./ext/pip.ts) for python package management you simply use
the provided `import` or `install` methods. The rest is handled automatically
for you! Just take a look!

```ts
import { pip } from "https://deno.land/x/python/ext/pip.ts";

const np = await pip.import("numpy");
const plt = await pip.import("matplotlib", "matplotlib.pyplot");

const xpoints = np.array([1, 8]);
const ypoints = np.array([3, 10]);

plt.plot(xpoints, ypoints);
plt.show();
```

## Documentation

Check out the docs
[here](https://doc.deno.land/https://deno.land/x/python/mod.ts).

## Python Installation

This module uses FFI to interface with the Python interpreter's C API. So you
must have an existing Python installation (with the shared library), which is
something like `python310.dll`, etc.

Python installed from Microsoft Store does not work, as it does not contain
shared library for interfacing with Python interpreter.

If the module fails to find Python, you can add the path to the Python in the
`DENO_PYTHON_PATH` environment variable.

`DENO_PYTHON_PATH` if set, must point to full path including the file name of
the Python dynamic library, which is like `python310.dll` (Windows),
`libpython310.dylib` (macOS) and `libpython310.so` (Linux) depending on
platform.

## Usage with docker

Usage with docker is easiest done using the
[`denoland/deno:bin` image](https://github.com/denoland/deno_docker?tab=readme-ov-file#using-your-own-base-image)
along with the [official `python` image](https://hub.docker.com/_/python/).

```Dockerfile
ARG DENO_VERSION=1.38.2
ARG PYTHON_VERSION=3.12

FROM denoland/deno:bin-$DENO_VERSION AS deno
FROM python:$PYTHON_VERSION

# Copy and configure deno
COPY --from=deno /deno /usr/local/bin/deno
ENTRYPOINT ["/usr/local/bin/deno"]

# Copy your project source
COPY . .

RUN ["run", "-A", "--unstable", "https://deno.land/x/python@0.4.2/examples/hello_python.ts"]
```

## Maintainers

- DjDeveloper ([@DjDeveloperr](https://github.com/DjDeveloperr))
- Elias Sjögreen ([@eliassjogreen](https://github.com/eliassjogreen))

## Other

### Contribution

Pull request, issues and feedback are very welcome. Code style is formatted with
`deno fmt` and commit messages are done following Conventional Commits spec.

### Licence

Copyright 2021, DjDeveloperr.

Copyright 2023, the Denosaurs team. All rights reserved. MIT license.
