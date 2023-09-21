// TODO: Maybe add support for pip: namespace that automatically installs the module if it's not found.

// deno-lint-ignore-file no-explicit-any
import { plugin } from "bun";
import { python } from "./mod.ts";

const { dir } = python.builtins;
const { SourceFileLoader } = python.import("importlib.machinery");

export function exportModule(mod: any) {
  const props = dir(mod).valueOf();
  const exports: Record<string, any> = {};
  for (let prop of props) {
    prop = prop.toString();
    exports[prop] = mod[prop];
  }
  return exports;
}

plugin({
  name: "Python Loader",
  setup: (build) => {
    build.onLoad({ filter: /\.py$/ }, (args) => {
      const name = args.path.split("/").pop()!.split(".py")[0];
      const exports = SourceFileLoader(name, args.path).load_module();
      return {
        exports: exportModule(exports),
        loader: "object",
      };
    });

    build.onResolve({ filter: /.+/, namespace: "python" }, (args) => {
      return { path: args.path, namespace: "python" };
    });

    build.onLoad({ filter: /.+/, namespace: "python" }, (args) => {
      const exports = python.import(args.path);
      return {
        exports: exportModule(exports),
        loader: "object",
      };
    });
  },
});
