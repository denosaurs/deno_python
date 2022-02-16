import { SYMBOLS } from "./symbols.ts";
import { postSetup } from "./util.ts";

const searchPath: string[] = [];

const SUPPORTED_VERSIONS = [[3, 9], [3, 10], [3, 8]];
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
  } catch (_) {
    continue;
  }
}

if (typeof py !== "object") {
  throw new Error("Python not found");
}

export { py };
