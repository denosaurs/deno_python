import { pip } from "../ext/pip.ts";

const np = await pip.import("numpy");
const plt = await pip.import("matplotlib", "matplotlib.pyplot");

const xpoints = np.array([1, 8]);
const ypoints = np.array([3, 10]);

plt.plot(xpoints, ypoints);
plt.show();
