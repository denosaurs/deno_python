import { add } from "./test.py";
import { print } from "python:builtins";
import * as np from "python:numpy";

console.log(add(1, 2));
print("Hello, world!");
console.log(np.array([1, 2, 3]));
