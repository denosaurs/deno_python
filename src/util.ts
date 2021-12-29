import {
  dirname,
  join,
  resolve,
} from "https://deno.land/std@0.119.0/path/mod.ts";

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

const prefix = Deno.build.os === "windows" ? "" : "lib";
const extension = Deno.build.os === "windows"
  ? "dll"
  : Deno.build.os === "darwin"
  ? "dylib"
  : "so";
const versions = [[3, 9], [3, 10], [3, 8]];

async function exists(file: string): Promise<boolean> {
  try {
    await Deno.lstat(file);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return false;
    }
    throw err;
  }
}

async function where(name: string): Promise<string[]> {
  return decoder.decode(
    await Deno.run({
      cmd: ["where", name],
      stdin: "null",
      stderr: "null",
      stdout: "piped",
    }).output(),
  ).split("\r\n").filter((path) => path !== "").map((path) => resolve(path));
}

async function find(path: string, name: string): Promise<string[]> {
  return decoder.decode(
    await Deno.run({
      cmd: ["find", path, "-name", name],
      stdin: "null",
      stderr: "null",
      stdout: "piped",
    }).output(),
  ).split("\n").filter((path) => path !== "").map((path) => resolve(path));
}

async function search(path: string): Promise<string[]> {
  const found = [];

  for (const [major, minor] of versions) {
    const version = Deno.build.os === "windows"
      ? `${major}${minor}`
      : `${major}.${minor}`;
    const filename = `${prefix}python${version}.${extension}`;
    const file = resolve(join(path, filename));

    if (await exists(file)) {
      found.push(file);
    }
  }

  return found;
}

async function findlibs(): Promise<string[]> {
  const libs: string[] = [];

  if (Deno.build.os === "windows") {
    for (const location of await where("python*.dll")) {
      libs.push(resolve(location));
    }

    for (const location of (await where("python*")).map(dirname)) {
      libs.concat(await search(location));
    }
  } else {
    const paths = ["/usr/lib", "/lib"];

    if (Deno.build.os === "darwin") {
      paths.push(
        "/System/Library",
        "/opt/homebrew/Frameworks",
        "/usr/local/Frameworks",
      );

      for (const [major, minor] of versions) {
        const path = `Python.framework/Versions/${major}.${minor}/Python`;
        if (await exists(path)) {
          paths.push(path);
        }
      }
    }

    for (const path of paths) {
      for (
        const location of await find(path, `libpython*.${extension}`)
      ) {
        libs.push(resolve(location));
      }
    }
  }

  for (
    const location of Deno.env.get(
      Deno.build.os === "windows"
        ? "PATH"
        : Deno.build.os === "darwin"
        ? "DYLD_LIBRARY_PATH"
        : "LD_LIBRARY_PATH",
    )?.split(Deno.build.os === "windows" ? ";" : ":") ?? []
  ) {
    libs.concat(await search(location));
  }

  return [...new Set(libs)];
}

export async function findlib(): Promise<string> {
  const candidates = await findlibs();

  for (const [major, minor] of versions) {
    const version = Deno.build.os === "windows"
      ? `${major}${minor}`
      : `${major}.${minor}`;
    const filename = `${prefix}python${version}.${extension}`;

    for (const candidate of candidates) {
      if (
        candidate.endsWith(filename) ||
        (Deno.build.os === "darwin" &&
          candidate === `Python.framework/Versions/${major}.${minor}/Python`)
      ) {
        return candidate;
      }
    }
  }

  throw new Error(
    `Could not find python library, try setting the environmental variable DENO_PYTHON_PATH or installing one of the following versions of python: ${
      versions.map(([major, minor]) => `v${major}.${minor}`).join(", ")
    }`,
  );
}

/**
 * Encodes a C string.
 */
export function cstr(str: string): Uint8Array {
  const buf = new Uint8Array(str.length + 1);
  encoder.encodeInto(str, buf);
  return buf;
}
