// @ts-nocheck -- binary parser; indexed access is bounds-checked by format.
// Converts Roblox .mesh files (versions 1.x - 5.x) to plain geometry arrays.
// Version 7.x (Draco-compressed) is handled in robloxMeshV7.ts, which decodes the
// geometry and re-encodes it as a v2 mesh so everything else can stay synchronous.

export type MeshData = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
};

export function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Returns e.g. "2.00" or "7.00", or null if this isn't a Roblox .mesh file. */
export function getMeshVersion(bytes: Uint8Array): string | null {
  const header = new TextDecoder().decode(bytes.subarray(0, 12));
  const m = header.match(/^version (\d\.\d\d)/);
  return m ? m[1] : null;
}

/**
 * Reads the chunk container of a v7 mesh. v7 is a list of chunks:
 *   8-byte name, uint32 chunk version, uint32 size, then `size` bytes of data.
 * COREMESH holds uint32 dracoSize + the Draco stream.
 * LODS holds the face offsets of each level of detail; LOD 0 is [offsets[0], offsets[1]).
 */
export function readV7Container(bytes: Uint8Array): { draco: Uint8Array; lod0Faces: number | null } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  let p = 13; // "version 7.00\n"
  let draco: Uint8Array | null = null;
  let lodOffsets: number[] = [];
  while (p + 16 <= bytes.length) {
    const name = dec.decode(bytes.subarray(p, p + 8)).replace(/\0+$/, "");
    const size = dv.getUint32(p + 12, true);
    const body = p + 16;
    if (body + size > bytes.length) break;
    if (name === "COREMESH") {
      const dracoSize = dv.getUint32(body, true);
      draco = bytes.subarray(body + 4, body + 4 + dracoSize);
    } else if (name === "LODS" && size >= 7) {
      const n = dv.getUint32(body + 3, true);
      if (n > 0 && n <= 32 && body + 7 + n * 4 <= body + size) {
        for (let i = 0; i < n; i++) lodOffsets.push(dv.getUint32(body + 7 + i * 4, true));
      }
    }
    p = body + size;
  }
  if (!draco) throw new Error("Mesh v7 file has no COREMESH chunk.");
  const lod0Faces = lodOffsets.length > 1 ? lodOffsets[1] - lodOffsets[0] : null;
  return { draco, lod0Faces };
}

/** Writes plain geometry as a version 2.00 mesh, which parseRobloxMesh below reads. */
export function meshDataToV2Bytes(m: MeshData): Uint8Array {
  const nV = m.positions.length / 3;
  const nF = m.indices.length / 3;
  const out = new Uint8Array(13 + 12 + nV * 40 + nF * 12);
  out.set(new TextEncoder().encode("version 2.00\n"), 0);
  const dv = new DataView(out.buffer);
  let p = 13;
  dv.setUint16(p, 12, true); // header size
  dv.setUint8(p + 2, 40); // vertex size
  dv.setUint8(p + 3, 12); // face size
  dv.setUint32(p + 4, nV, true);
  dv.setUint32(p + 8, nF, true);
  p += 12;
  for (let i = 0; i < nV; i++) {
    const b = p + i * 40;
    for (let k = 0; k < 3; k++) dv.setFloat32(b + k * 4, m.positions[i * 3 + k], true);
    for (let k = 0; k < 3; k++) dv.setFloat32(b + 12 + k * 4, m.normals[i * 3 + k], true);
    dv.setFloat32(b + 24, m.uvs[i * 2], true);
    dv.setFloat32(b + 28, m.uvs[i * 2 + 1], true);
    // bytes 32-35: tangent (unused), 36-39: vertex color (white)
    dv.setUint32(b + 36, 0xffffffff, true);
  }
  p += nV * 40;
  for (let i = 0; i < nF * 3; i++) dv.setUint32(p + i * 4, m.indices[i], true);
  return out;
}

function parseV1(text: string, version: string): MeshData {
  const lines = text.split(/\r?\n/);
  const nFaces = parseInt(lines[1], 10);
  const nums = (lines[2] ?? "").match(/-?[\d.]+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
  const scale = version === "1.00" ? 0.5 : 1;
  const nVerts = nFaces * 3;
  const positions = new Float32Array(nVerts * 3);
  const normals = new Float32Array(nVerts * 3);
  const uvs = new Float32Array(nVerts * 2);
  for (let v = 0; v < nVerts; v++) {
    const b = v * 9;
    positions.set([nums[b] * scale, nums[b + 1] * scale, nums[b + 2] * scale], v * 3);
    normals.set([nums[b + 3], nums[b + 4], nums[b + 5]], v * 3);
    uvs.set([nums[b + 6], nums[b + 7]], v * 2);
  }
  return { positions, normals, uvs, indices: Uint32Array.from({ length: nVerts }, (_, i) => i) };
}

export function parseRobloxMesh(bytes: Uint8Array): MeshData {
  const header = new TextDecoder().decode(bytes.subarray(0, 12));
  const m = header.match(/^version (\d\.\d\d)/);
  if (!m) throw new Error("Not a Roblox .mesh file.");
  const version = m[1];
  if (version.startsWith("1")) return parseV1(new TextDecoder().decode(bytes), version);
  const major = parseInt(version[0], 10);
  if (major > 5)
    throw new Error(
      `Mesh version ${version} must be converted first (call normalizeMeshBytes from robloxMeshV7.ts before parsing).`,
    );
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 13; // "version x.xx\n"
  const hStart = p;
  const hSize = dv.getUint16(p, true);
  let vSize = 40, nVerts = 0, nFaces = 0, nLods = 0, nBones = 0, lodSize = 4;
  if (major === 2) {
    vSize = dv.getUint8(p + 2);
    nVerts = dv.getUint32(p + 4, true);
    nFaces = dv.getUint32(p + 8, true);
  } else if (major === 3) {
    vSize = dv.getUint8(p + 2);
    lodSize = dv.getUint16(p + 4, true);
    nLods = dv.getUint16(p + 6, true);
    nVerts = dv.getUint32(p + 8, true);
    nFaces = dv.getUint32(p + 12, true);
  } else {
    nVerts = dv.getUint32(p + 4, true);
    nFaces = dv.getUint32(p + 8, true);
    nLods = dv.getUint16(p + 12, true);
    nBones = dv.getUint16(p + 14, true);
  }
  p = hStart + hSize;
  const positions = new Float32Array(nVerts * 3);
  const normals = new Float32Array(nVerts * 3);
  const uvs = new Float32Array(nVerts * 2);
  for (let i = 0; i < nVerts; i++) {
    const b = p + i * vSize;
    positions[i * 3] = dv.getFloat32(b, true);
    positions[i * 3 + 1] = dv.getFloat32(b + 4, true);
    positions[i * 3 + 2] = dv.getFloat32(b + 8, true);
    normals[i * 3] = dv.getFloat32(b + 12, true);
    normals[i * 3 + 1] = dv.getFloat32(b + 16, true);
    normals[i * 3 + 2] = dv.getFloat32(b + 20, true);
    uvs[i * 2] = dv.getFloat32(b + 24, true);
    uvs[i * 2 + 1] = dv.getFloat32(b + 28, true);
  }
  p += nVerts * vSize;
  if (major >= 4 && nBones > 0) p += nVerts * 8;
  const faceStart = p;
  p += nFaces * 12;
  let faceCount = nFaces;
  if (nLods > 1) {
    const lod1 = dv.getUint32(p + lodSize, true);
    if (lod1 > 0 && lod1 <= nFaces) faceCount = lod1;
  }
  const indices = new Uint32Array(faceCount * 3);
  for (let i = 0; i < faceCount * 3; i++) indices[i] = dv.getUint32(faceStart + i * 4, true);
  return { positions, normals, uvs, indices };
}
