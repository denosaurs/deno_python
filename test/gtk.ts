import { kw, NamedArgument, type PyObject, python } from "../mod.ts";

import {
  type Adw1_ as Adw_,
  DenoGLibEventLoop,
  type Gtk4_ as Gtk_,
  // deno-lint-ignore no-import-prefix
} from "jsr:@sigma/gtk-py@0.7.0";

const gi = python.import("gi");
gi.require_version("Gtk", "4.0");
gi.require_version("Adw", "1");
const Gtk: Gtk_.Gtk = python.import("gi.repository.Gtk");
const Adw: Adw_.Adw = python.import("gi.repository.Adw");
const GLib = python.import("gi.repository.GLib");
const gcp = python.import("gc");
const el = new DenoGLibEventLoop(GLib); // this is important so setInterval works (by unblockig deno async event loop)

const gcInterval = setInterval(() => {
  gcp.collect();
  // @ts-ignore: requirse --v8-flags=--expose-gc
  gc();
}, 100);

class MainWindow extends Gtk.ApplicationWindow {
  #state = false;
  #f?: PyObject;
  constructor(kwArg: NamedArgument) {
    // deno-lint-ignore no-explicit-any
    super(kwArg as any);
    this.set_default_size(300, 150);
    this.set_title("Awaker");
    this.connect("close-request", () => {
      el.stop();
      clearInterval(gcInterval);
      return false;
    });

    const button = Gtk.ToggleButton(
      new NamedArgument("label", "OFF"),
    );
    const f = python.callback(this.onClick);
    button.connect("clicked", f);
    const vbox = Gtk.Box(
      new NamedArgument("orientation", Gtk.Orientation.VERTICAL),
    );
    vbox.append(button);
    this.set_child(vbox);
  }

  // deno-lint-ignore no-explicit-any
  onClick = (_: any, button: Gtk_.ToggleButton) => {
    this.#state = !this.#state;
    (this.#state) ? button.set_label("ON") : button.set_label("OFF");
  };
}

class App extends Adw.Application {
  #win: MainWindow | undefined;
  constructor(kwArg: NamedArgument) {
    super(kwArg);
    this.connect("activate", this.onActivate);
  }
  onActivate = python.callback((_kwarg, app: Gtk_.Application) => {
    new MainWindow(new NamedArgument("application", app)).present();
  });
}

const app = new App(kw`application_id=${"com.example.com"}`);
app.register();
app.activate();
el.start();
