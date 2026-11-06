// Entry for the After Effects extension's copy of the GLB → OBJ converter.
import { glbToObjFiles } from "../src/lib/objExport";

// three.js uses Array#at, which After Effects 2023's Chromium 88 doesn't have.
[Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array].forEach((Type) => {
  if (!Type.prototype.at) {
    Object.defineProperty(Type.prototype, "at", {
      configurable: true,
      writable: true,
      value(index) {
        const i = Math.trunc(index) || 0;
        return this[i < 0 ? this.length + i : i];
      },
    });
  }
});

window.EAObjConverter = { glbToObjFiles };
