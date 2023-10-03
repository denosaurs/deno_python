import { SYMBOLS } from "./symbols.ts";
import { postSetup } from "./util.ts";

const searchPath: string[] = [];

const SUPPORTED_VERSIONS = [[3, 12], [3, 11], [3, 10], [3, 9], [3, 8]];
const DENO_PYTHON_PATH = Deno.env.get("DENO_PYTHON_PATH");

if (DENO_PYTHON_PATH) {
  searchPath.push(DENO_PYTHON_PATH);
} else {
  if (Deno.build.os === "windows" || Deno.build.os === "linux") {
    searchPath.push(
      ...SUPPORTED_VERSIONS.map(([major, minor]) =>
        `${Deno.build.os === "linux" ? "lib" : ""}python${major}${
          Deno.build.os === "linux" ? "." : ""
        }${minor}.${Deno.build.os === "linux" ? "so" : "dll"}`
      ),
    );
  } else if (Deno.build.os === "darwin") {
    for (
      const framework of [
        "/Library/Frameworks/Python.framework/Versions",
        "/opt/homebrew/Frameworks/Python.framework/Versions",
        "/usr/local/Frameworks/Python.framework/Versions",
      ]
    ) {
      for (const [major, minor] of SUPPORTED_VERSIONS) {
        searchPath.push(`${framework}/${major}.${minor}/Python`);
      }
    }
  } else {
    throw new Error(`Unsupported OS: ${Deno.build.os}`);
  }
}

let py!: Deno.DynamicLibrary<typeof SYMBOLS>["symbols"];

for (const path of searchPath) {
  try {
    py = Deno.dlopen(path, SYMBOLS).symbols;
    postSetup(path);
    break;
  } catch (err) {
    if (err instanceof TypeError && !("Bun" in globalThis)) {
      throw new Error(
        "Cannot load dynamic library because --unstable flag was not set",
        { cause: err },
      );
    }
    continue;
  }
}

const LIBRARY_NOT_FOUND = new Error(`
Could not find Python library!

Tried searching for these versions:
${searchPath.map((e) => "  " + e).join("\n")}

Make sure you have a supported version of Python
installed on your system, which should be one of
these: ${SUPPORTED_VERSIONS.map((e) => `${e[0]}.${e[1]}`).join(", ")}

If the module still somehow fails to find it,
you can open an issue: https://github.com/denosaurs/deno_python/issues

However, if your Python distribution is not in search
path, you can set DENO_PYTHON_PATH env variable pointing
to dll/dylib/so file for Python library.
`);

if (typeof py !== "object") {
  throw LIBRARY_NOT_FOUND;
}

export { py };
