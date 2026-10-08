// @ts-nocheck -- copied as-is from rces; loose typing around the mesh decoder
import type * as THREE from "three";
import { DRACOLoader } from "three-stdlib";
import {
  getMeshVersion,
  meshDataToV2Bytes,
  readV7Container,
  type MeshData,
} from "@/lib/robloxMesh";

// Roblox mesh v7 stores its geometry as a Draco stream. If textures appear upside
// down on v7 hair but not on older accessories, flip this to true.
const FLIP_V = false;

// The two corrections below were tuned for v7 HAIR. They are applied only to hair (and to body
// part meshes, which don't pass an item kind), never to hats, face accessories, neck items, etc.

// v7 hair came out facing backwards. This turns the mesh 180 degrees around the
// vertical axis, around the mesh's own center (so it stays in place on the head).
// Set to false to disable.
const ROTATE_Y_180 = true;

// Nudge the converted mesh. Units are the same as the mesh's own units (studs).
// OFFSET_Z: positive moves the hair backward (toward the back of the head), negative moves it forward.
// OFFSET_Y: positive moves it up, negative moves it down.
// OFFSET_X: positive/negative moves it sideways.
// Re-upload the hair after changing these.
const OFFSET_X = 0;
const OFFSET_Y = 0;
const OFFSET_Z = 0.4;

let loader: DRACOLoader | null = null;
function getLoader() {
  if (!loader) {
    loader = new DRACOLoader();
    // Same decoder host that @react-three/drei uses for GLTF files.
    loader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
  }
  return loader;
}

function decodeDraco(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Draco decoder timed out (could not load the decoder from gstatic.com).")),
      20000,
    );
    try {
      getLoader().decodeDracoFile(
        buffer,
        (geo: THREE.BufferGeometry) => {
          clearTimeout(timer);
          resolve(geo);
        },
        undefined,
        undefined,
      );
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

async function parseV7(bytes: Uint8Array, applyHairFix: boolean): Promise<MeshData> {
  const { draco, lod0Faces } = readV7Container(bytes);
  // decodeDracoFile transfers the buffer to a worker, so hand it a copy.
  const geo = await decodeDraco(draco.slice().buffer);

  const pos = geo.getAttribute("position");
  if (!pos) throw new Error("Mesh v7: Draco stream has no position data.");
  const positions = Float32Array.from(pos.array as ArrayLike<number>);
  const nVerts = positions.length / 3;

  const normAttr = geo.getAttribute("normal");
  const normals = normAttr ? Float32Array.from(normAttr.array as ArrayLike<number>) : new Float32Array(nVerts * 3);

  const uvAttr = geo.getAttribute("uv");
  if (!uvAttr) console.warn("Mesh v7: no UV attribute found, texture will not map.");
  const uvs = uvAttr ? Float32Array.from(uvAttr.array as ArrayLike<number>) : new Float32Array(nVerts * 2);
  if (FLIP_V) for (let i = 1; i < uvs.length; i += 2) uvs[i] = 1 - uvs[i];

  if (!geo.index) throw new Error("Mesh v7: Draco stream has no triangle indices.");
  let indices = Uint32Array.from(geo.index.array as ArrayLike<number>);
  // The stream holds every level of detail back to back; keep only the highest quality
  // one, otherwise the lower-detail copies would be drawn on top of it.
  if (lod0Faces && lod0Faces * 3 < indices.length) indices = indices.slice(0, lod0Faces * 3);

  if (!normAttr) {
    geo.computeVertexNormals();
    const n = geo.getAttribute("normal");
    if (n) normals.set(n.array as ArrayLike<number>);
  }

  if (applyHairFix && ROTATE_Y_180) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      maxX = Math.max(maxX, positions[i]);
      minZ = Math.min(minZ, positions[i + 2]);
      maxZ = Math.max(maxZ, positions[i + 2]);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = 2 * cx - positions[i]; // x, mirrored around the mesh's center
      positions[i + 2] = 2 * cz - positions[i + 2]; // z, mirrored around the mesh's center
      normals[i] = -normals[i];
      normals[i + 2] = -normals[i + 2];
    }
  }

  if (applyHairFix && (OFFSET_X !== 0 || OFFSET_Y !== 0 || OFFSET_Z !== 0)) {
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += OFFSET_X;
      positions[i + 1] += OFFSET_Y;
      positions[i + 2] += OFFSET_Z;
    }
  }

  geo.dispose();
  return { positions, normals, uvs, indices };
}

/**
 * Call this on the raw mesh bytes at upload time, before storing them.
 * v7 meshes are decoded and re-encoded as a v2 mesh; every other version is
 * returned unchanged. The existing synchronous parseRobloxMesh then reads the result.
 *
 * kind: the item's kind (hat, hair, back, ...). The hair-specific rotation and offset are applied
 * only when kind is "hair", or when no kind is given (body part uploads, which keep the old behaviour).
 */
export async function normalizeMeshBytes(bytes: Uint8Array, kind?: string): Promise<Uint8Array> {
  const version = getMeshVersion(bytes);
  if (!version) throw new Error("Not a Roblox .mesh file.");
  if (parseInt(version[0], 10) < 6) return bytes;
  if (!version.startsWith("7")) throw new Error(`Mesh version ${version} is not supported.`);
  const applyHairFix = kind === undefined || kind === "hair";
  return meshDataToV2Bytes(await parseV7(bytes, applyHairFix));
}
