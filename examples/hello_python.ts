import { python } from "../mod.ts";

const { print, str } = python.builtins;
const { version } = python.import("sys");

print(str("Hello, World!").lower());
print("Python version:", version);
