import { python } from "../mod.ts";

const np = python.import("numpy");
const plt = python.import("matplotlib.pyplot");

const xpoints = np.array([1, 8]);
const ypoints = np.array([3, 10]);

plt.plot(xpoints, ypoints);
plt.show();
