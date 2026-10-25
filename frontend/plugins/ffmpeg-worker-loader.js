// ffmpeg.wasm's worker loads its WebAssembly core with a runtime `import(url)`.
// Webpack would try to bundle that expression and break it, so tell webpack to
// leave the import to the browser. (The package only ships a Vite hint.)
module.exports = function ffmpegWorkerLoader(source) {
  return source.replace("/* @vite-ignore */", "/* webpackIgnore: true */");
};
