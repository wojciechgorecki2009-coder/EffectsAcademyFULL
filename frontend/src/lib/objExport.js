import { strToU8, zipSync } from "fflate";

/*
 * GLB → OBJ, on the user's device, for apps like After Effects that prefer OBJ.
 *
 * The result is a zip holding the .obj (every mesh with its world transform
 * baked in, UVs flipped to OBJ's bottom-left origin), a .mtl with each
 * material's colour, roughness, opacity and texture maps, and the textures
 * themselves, copied byte for byte from the GLB where possible.
 * OBJ is a still mesh: animation, rigs and morph targets aren't carried over.
 *
 * The After Effects extension uses glbToObjFiles too, through a standalone
 * build of this file (see frontend/scripts/build-extension-converter.js).
 */

const round = (value) => {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const safeName = (name, fallback) => (String(name || "").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || fallback);

const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

function uniqueNamer() {
  const used = new Set();
  return (base) => {
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i += 1) name = `${base}_${i}`;
    used.add(name.toLowerCase());
    return name;
  };
}

async function encodePng(image) {
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
  canvas.getContext("2d").drawImage(image, 0, 0);
  const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type: "image/png" }) : await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Converts GLB bytes to OBJ + MTL + textures. Resolves to
 * { files: { "name.obj": Uint8Array, "name.mtl": …, "textures/…": … }, objName,
 *   meshes, vertices, triangles, textures, hadAnimation }.
 */
export async function glbToObjFiles(glb, baseName = "model", onProgress) {
  const [THREE, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
  ]);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.parseAsync(glb, "");
  } catch (error) {
    const compressed = /draco|ktx2|basisu/i.test(String(error?.message));
    throw new Error(
      compressed
        ? "This model uses a compressed format the OBJ converter can't read yet. Download the GLB instead."
        : "This model couldn't be converted to OBJ. Download the GLB instead."
    );
  }

  const { parser } = gltf;
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  const stem = safeName(baseName, "model");
  const objName = `${stem}.obj`;
  const mtlName = `${stem}.mtl`;
  const files = {};
  const nameMaterial = uniqueNamer();
  const nameTexture = uniqueNamer();
  const materialNames = new Map();
  const texturePaths = new Map();
  const decoded = new Set();
  const mtl = [`# Materials for ${objName}`, ""];

  // A texture's original image (JPEG/PNG straight from the GLB), or a PNG re-encode.
  const texturePath = async (texture, fallbackName) => {
    if (!texture?.image) return null;
    const ref = parser.associations.get(texture);
    // Tiled copies of a texture share their glTF texture index, so each image is saved once.
    const key = ref?.textures ?? texture;
    if (texturePaths.has(key)) return texturePaths.get(key);
    let bytes = null;
    let ext = "png";
    let label = texture.name;
    const def = ref?.textures !== undefined ? parser.json.textures?.[ref.textures] : null;
    const source = def ? def.source ?? def.extensions?.EXT_texture_webp?.source ?? def.extensions?.EXT_texture_avif?.source : undefined;
    const image = source !== undefined ? parser.json.images?.[source] : null;
    if (image) label ||= image.name;
    if (image?.bufferView !== undefined && /image\/(jpeg|png)/.test(image.mimeType || "")) {
      bytes = new Uint8Array(await parser.getDependency("bufferView", image.bufferView));
      ext = image.mimeType === "image/png" ? "png" : "jpg";
    } else {
      bytes = await encodePng(texture.image);
    }
    const stemName = safeName(String(label || "").replace(/\.(png|jpe?g|webp|avif|ktx2)$/i, ""), fallbackName);
    const path = `textures/${nameTexture(stemName)}.${ext}`;
    files[path] = bytes;
    texturePaths.set(key, path);
    decoded.add(texture);
    return path;
  };

  const materialName = async (material) => {
    if (!material) return "default";
    if (materialNames.has(material)) return materialNames.get(material);
    const name = nameMaterial(safeName(material.name, `material_${materialNames.size + 1}`));
    materialNames.set(material, name);

    const rgb = (color) => {
      const c = color.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
      return `${round(c.r)} ${round(c.g)} ${round(c.b)}`;
    };
    const roughness = material.roughness ?? 1;
    const metalness = material.metalness ?? 0;
    const opacity = material.transparent || material.opacity < 1 ? material.opacity ?? 1 : 1;
    mtl.push(`newmtl ${name}`);
    mtl.push("Ka 1 1 1");
    mtl.push(`Kd ${material.color ? rgb(material.color) : "0.8 0.8 0.8"}`);
    const spec = round(0.04 + 0.5 * (1 - roughness) * (1 - metalness));
    mtl.push(`Ks ${spec} ${spec} ${spec}`);
    mtl.push(`Ns ${Math.round((1 - roughness) ** 2 * 900 + 10)}`);
    if (material.emissive && (material.emissive.r || material.emissive.g || material.emissive.b || material.emissiveMap)) {
      mtl.push(`Ke ${rgb(material.emissive.clone().multiplyScalar(material.emissiveIntensity ?? 1))}`);
    }
    mtl.push(`Pr ${round(roughness)}`, `Pm ${round(metalness)}`);
    mtl.push(`d ${round(opacity)}`, "illum 2");
    const maps = [
      ["map_Kd", material.map, "color"],
      ["map_Bump", material.normalMap, "normal"],
      ["map_Ke", material.emissiveMap, "emissive"],
      ["map_d", material.alphaMap, "alpha"],
    ];
    for (const [key, map, kind] of maps) {
      const path = await texturePath(map, `${name}_${kind}`);
      if (path) mtl.push(`${key} ${path}`);
    }
    mtl.push("");
    return name;
  };

  const meshes = [];
  scene.traverse((node) => {
    if (node.isMesh && node.geometry?.attributes?.position) meshes.push(node);
  });
  if (!meshes.length) throw new Error("This model has no meshes to convert. Download the GLB instead.");

  const chunks = [`# Converted from ${baseName}.glb by Effects Academy`, `mtllib ${mtlName}`, ""];
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  const texel = new THREE.Vector3();
  const nameObject = uniqueNamer();
  let vOffset = 1;
  let tOffset = 1;
  let nOffset = 1;
  let triangles = 0;
  let vertices = 0;

  for (let m = 0; m < meshes.length; m += 1) {
    const mesh = meshes[m];
    const geometry = mesh.geometry;
    const pos = geometry.attributes.position;
    const nor = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    const index = geometry.index;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const world = mesh.matrixWorld;
    normalMatrix.getNormalMatrix(world);
    // A mirrored transform flips the triangle winding, so faces are written the other way round.
    const mirrored = world.determinant() < 0;
    const lines = [`o ${nameObject(safeName(mesh.name, `mesh_${m + 1}`))}`];

    for (let i = 0; i < pos.count; i += 1) {
      position.fromBufferAttribute(pos, i).applyMatrix4(world);
      lines.push(`v ${round(position.x)} ${round(position.y)} ${round(position.z)}`);
    }
    if (uv) {
      // Tiled or offset textures (KHR_texture_transform) are baked into the UVs, since OBJ
      // has no dependable way to say so. glTF's UV origin is top-left; OBJ's is bottom-left.
      const mapped = materials.find((material) => material?.map)?.map;
      const tiled = mapped && (mapped.offset.x || mapped.offset.y || mapped.repeat.x !== 1 || mapped.repeat.y !== 1 || mapped.rotation);
      if (tiled) mapped.updateMatrix();
      for (let i = 0; i < uv.count; i += 1) {
        texel.set(uv.getX(i), uv.getY(i), 1);
        if (tiled) texel.applyMatrix3(mapped.matrix);
        lines.push(`vt ${round(texel.x)} ${round(1 - texel.y)}`);
      }
    }
    if (nor) {
      for (let i = 0; i < nor.count; i += 1) {
        normal.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        lines.push(`vn ${round(normal.x)} ${round(normal.y)} ${round(normal.z)}`);
      }
    }

    const corner = (i) => {
      const v = vOffset + i;
      if (uv && nor) return `${v}/${tOffset + i}/${nOffset + i}`;
      if (uv) return `${v}/${tOffset + i}`;
      if (nor) return `${v}//${nOffset + i}`;
      return `${v}`;
    };
    const total = index ? index.count : pos.count;
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: total, materialIndex: 0 }];
    for (const group of groups) {
      lines.push(`usemtl ${await materialName(materials[group.materialIndex] ?? materials[0])}`);
      const end = Math.min(group.start + group.count, total);
      for (let k = group.start; k + 2 < end; k += 3) {
        const a = index ? index.getX(k) : k;
        const b = index ? index.getX(k + 1) : k + 1;
        const c = index ? index.getX(k + 2) : k + 2;
        lines.push(mirrored ? `f ${corner(a)} ${corner(c)} ${corner(b)}` : `f ${corner(a)} ${corner(b)} ${corner(c)}`);
        triangles += 1;
      }
    }

    vOffset += pos.count;
    if (uv) tOffset += uv.count;
    if (nor) nOffset += nor.count;
    vertices += pos.count;
    chunks.push(lines.join("\n"), "");
    onProgress?.((m + 1) / meshes.length);
    await pause(); // keep the page responsive on big models
  }

  files[objName] = strToU8(chunks.join("\n"));
  files[mtlName] = strToU8(mtl.join("\n"));

  // Free the decoded textures.
  decoded.forEach((texture) => texture.image?.close?.());

  return {
    files,
    objName,
    meshes: meshes.length,
    vertices,
    triangles,
    textures: texturePaths.size,
    hadAnimation: gltf.animations.length > 0,
  };
}

/** The same conversion, zipped for download: { blob, meshes, vertices, triangles, textures, hadAnimation }. */
export async function glbToObjZip(glb, baseName = "model", onProgress) {
  const { files, objName, ...stats } = await glbToObjFiles(glb, baseName, onProgress);
  // Textures are already compressed, so they're stored as-is.
  const entries = Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, path.startsWith("textures/") ? [bytes, { level: 0 }] : bytes]));
  return { blob: new Blob([zipSync(entries, { level: 6 })], { type: "application/zip" }), ...stats };
}
