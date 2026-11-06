/*
 * Builds src/lib/objExport.js into one plain script for the After Effects
 * extension, which has no bundler: after-effects-extension/js/vendor/obj-converter.js.
 * It exposes window.EAObjConverter.glbToObjFiles. Rerun after changing objExport.js:
 *
 *   npm run build:extension-converter
 */
const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

const outDir = path.resolve(__dirname, "../../after-effects-extension/js/vendor");

const config = {
  mode: "production",
  entry: path.join(__dirname, "extension-converter-entry.js"),
  // After Effects 2023 runs CEP 11 (Chromium 88).
  target: ["web", "es2020"],
  output: { path: outDir, filename: "obj-converter.js", asyncChunks: false, clean: false },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: { fullySpecified: false },
        use: {
          loader: "babel-loader",
          options: { babelrc: false, configFile: false, presets: [["@babel/preset-env", { targets: "chrome 88", modules: false }]] },
        },
      },
    ],
  },
  performance: { hints: false },
  plugins: [
    new webpack.BannerPlugin({
      banner:
        "Effects Academy GLB to OBJ converter, built from frontend/src/lib/objExport.js (do not edit by hand).\n" +
        "Includes three.js (MIT) and fflate (MIT); their licenses are in ./LICENSES.",
    }),
  ],
};

webpack(config, (error, stats) => {
  if (error || stats.hasErrors()) {
    console.error(error || stats.toString({ colors: true, all: false, errors: true }));
    process.exit(1);
  }
  const licenses = path.join(outDir, "LICENSES");
  fs.mkdirSync(licenses, { recursive: true });
  const modules = path.resolve(__dirname, "../node_modules");
  fs.copyFileSync(path.join(modules, "three/LICENSE"), path.join(licenses, "three.js.txt"));
  fs.copyFileSync(path.join(modules, "fflate/LICENSE"), path.join(licenses, "fflate.txt"));
  const size = fs.statSync(path.join(outDir, "obj-converter.js")).size;
  console.log(`Built ${path.relative(process.cwd(), path.join(outDir, "obj-converter.js"))} (${Math.round(size / 1024)} KB)`);
});
