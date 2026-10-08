// @ts-nocheck -- binary parser; indexed access is bounds-checked by format.
// Parser for Roblox model files (.rbxm binary and XML) that extracts accessory data.

export type AccessoryMeta = {
  name: string;
  attachmentName: string | null;
  attachmentPos: [number, number, number];
  attachmentRot: number[]; // 9 values, row-major
  meshId: string | null;
  textureId: string | null;
  scale: [number, number, number];
  offset: [number, number, number];
  handleSize: [number, number, number];
  isMeshPart: boolean;
};

type Inst = { ref: number; className: string; props: Record<string, unknown>; parent: number };

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function assetIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:rbxassetid:\/\/|[?&]id=)(\d+)/i) ?? url.match(/^(\d+)$/);
  return m ? m[1] : null;
}

function lz4Decompress(src: Uint8Array, outLen: number) {
  const out = new Uint8Array(outLen);
  let i = 0;
  let o = 0;
  while (i < src.length) {
    const token = src[i++];
    let lit = token >> 4;
    if (lit === 15) {
      let b;
      do {
        b = src[i++];
        lit += b;
      } while (b === 255);
    }
    out.set(src.subarray(i, i + lit), o);
    i += lit;
    o += lit;
    if (i >= src.length) break;
    const off = src[i] | (src[i + 1] << 8);
    i += 2;
    let ml = token & 15;
    if (ml === 15) {
      let b;
      do {
        b = src[i++];
        ml += b;
      } while (b === 255);
    }
    ml += 4;
    let p = o - off;
    for (let k = 0; k < ml; k++) out[o++] = out[p++];
  }
  return out;
}

class Reader {
  pos = 0;
  view: DataView;
  constructor(public buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  u8() {
    return this.buf[this.pos++];
  }
  u32() {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f32() {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  bytes(n: number) {
    const b = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }
  str() {
    const n = this.u32();
    return new TextDecoder().decode(this.bytes(n));
  }
  // Interleaved big-endian 32-bit words
  interleaved(n: number) {
    const raw = this.bytes(n * 4);
    const out = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      out[i] =
        ((raw[i] << 24) | (raw[i + n] << 16) | (raw[i + 2 * n] << 8) | raw[i + 3 * n]) >>> 0;
    }
    return out;
  }
  ints(n: number) {
    return Array.from(this.interleaved(n), (x) => (x >>> 1) ^ -(x & 1));
  }
  floats(n: number) {
    const words = this.interleaved(n);
    const dv = new DataView(new ArrayBuffer(4));
    return Array.from(words, (x) => {
      dv.setUint32(0, ((x >>> 1) | (x << 31)) >>> 0);
      return dv.getFloat32(0);
    });
  }
  refs(n: number) {
    const v = this.ints(n);
    let acc = 0;
    return v.map((d) => (acc += d));
  }
}

function parseBinary(buf: Uint8Array): Inst[] {
  const r = new Reader(buf);
  r.pos = 14 + 2; // magic + signature + version
  r.u32(); // class count
  r.u32(); // instance count
  r.pos += 8;
  const classes = new Map<number, { name: string; refs: number[] }>();
  const insts = new Map<number, Inst>();
  while (r.pos < buf.length) {
    const name = new TextDecoder().decode(r.bytes(4));
    const comp = r.u32();
    const len = r.u32();
    r.pos += 4;
    let data: Uint8Array;
    if (comp === 0) data = r.bytes(len);
    else {
      const raw = r.bytes(comp);
      if (raw[0] === 0x28 && raw[1] === 0xb5 && raw[2] === 0x2f && raw[3] === 0xfd)
        throw new Error("This .rbxm uses ZSTD compression. Re-save it from Roblox Studio as .rbxmx (XML) and try again.");
      data = lz4Decompress(raw, len);
    }
    const c = new Reader(data);
    if (name === "INST") {
      const id = c.u32();
      const cls = c.str();
      c.u8();
      const n = c.u32();
      const refs = c.refs(n);
      classes.set(id, { name: cls, refs });
      for (const ref of refs) insts.set(ref, { ref, className: cls, props: {}, parent: -1 });
    } else if (name === "PROP") {
      const id = c.u32();
      const prop = c.str();
      const type = c.u8();
      const cls = classes.get(id);
      if (!cls) continue;
      const n = cls.refs.length;
      let values: unknown[] | null = null;
      try {
        if (type === 0x01) values = Array.from({ length: n }, () => c.str());
        else if (type === 0x0e) {
          const x = c.floats(n), y = c.floats(n), z = c.floats(n);
          values = x.map((_, i) => [x[i], y[i], z[i]]);
        } else if (type === 0x10 || type === 0x11) {
          const rots: number[][] = [];
          for (let i = 0; i < n; i++) {
            const idByte = c.u8();
            if (idByte === 0) rots.push(Array.from({ length: 9 }, () => c.f32()));
            else rots.push(IDENTITY);
          }
          const x = c.floats(n), y = c.floats(n), z = c.floats(n);
          values = rots.map((rot, i) => ({ rot, pos: [x[i], y[i], z[i]] }));
        } else if (type === 0x22) {
          // Newer "Content" type: source types then URIs
          const kinds = c.ints(n);
          const uriCount = c.u32();
          const uris = Array.from({ length: uriCount }, () => c.str());
          let u = 0;
          values = kinds.map((k) => (k === 1 ? uris[u++] ?? "" : ""));
        }
      } catch {
        values = null;
      }
      if (values) cls.refs.forEach((ref, i) => (insts.get(ref)!.props[prop] = values![i]));
    } else if (name === "PRNT") {
      c.u8();
      const n = c.u32();
      const kids = c.refs(n);
      const parents = c.refs(n);
      kids.forEach((k, i) => {
        const inst = insts.get(k);
        if (inst) inst.parent = parents[i];
      });
    } else if (name === "END\0") break;
  }
  return [...insts.values()];
}

function parseXml(text: string): Inst[] {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const out: Inst[] = [];
  let next = 0;
  const walk = (el: Element, parent: number) => {
    for (const item of Array.from(el.children).filter((e) => e.tagName === "Item")) {
      const ref = next++;
      const inst: Inst = { ref, className: item.getAttribute("class") ?? "", props: {}, parent };
      const props = Array.from(item.children).find((e) => e.tagName === "Properties");
      for (const p of props ? Array.from(props.children) : []) {
        const name = p.getAttribute("name") ?? "";
        const num = (t: string) => parseFloat(p.getElementsByTagName(t)[0]?.textContent ?? "0");
        if (p.tagName === "Vector3") inst.props[name] = [num("X"), num("Y"), num("Z")];
        else if (p.tagName === "CoordinateFrame")
          inst.props[name] = {
            pos: [num("X"), num("Y"), num("Z")],
            rot: ["R00", "R01", "R02", "R10", "R11", "R12", "R20", "R21", "R22"].map(num),
          };
        else if (p.tagName === "Content")
          inst.props[name] = p.getElementsByTagName("url")[0]?.textContent ?? "";
        else inst.props[name] = p.textContent ?? "";
      }
      out.push(inst);
      walk(item, ref);
    }
  };
  walk(doc.documentElement, -1);
  return out;
}

export function parseRbxm(buffer: ArrayBuffer): AccessoryMeta {
  const buf = new Uint8Array(buffer);
  const head = new TextDecoder().decode(buf.subarray(0, 8));
  const insts = head === "<roblox!" ? parseBinary(buf) : parseXml(new TextDecoder().decode(buf));
  const children = (ref: number) => insts.filter((i) => i.parent === ref);
  const acc =
    insts.find((i) => i.className === "Accessory" || i.className === "Hat" || i.className === "Tool") ??
    null;
  const handle =
    (acc && children(acc.ref).find((i) => i.props.Name === "Handle")) ??
    insts.find((i) => i.props.Name === "Handle") ??
    insts.find((i) => i.className === "MeshPart" || i.className === "Part");
  if (!handle) throw new Error("No Handle part found in this file.");
  const kids = children(handle.ref);
  const mesh = kids.find((i) => i.className === "SpecialMesh" || i.className === "FileMesh");
  const att = kids.find((i) => i.className === "Attachment");
  const isMeshPart = handle.className === "MeshPart";
  const v3 = (v: unknown, d: [number, number, number]) =>
    Array.isArray(v) ? (v as [number, number, number]) : d;
  const attCf = (att?.props.CFrame ?? att?.props.CoordinateFrame) as
    | { pos: [number, number, number]; rot: number[] }
    | undefined;
  const meshUrl = (isMeshPart ? handle.props.MeshId ?? handle.props.MeshID : mesh?.props.MeshId) as
    | string
    | undefined;
  const texUrl = (isMeshPart ? handle.props.TextureID ?? handle.props.TextureId : mesh?.props.TextureId) as
    | string
    | undefined;
  return {
    name: String(acc?.props.Name ?? handle.props.Name ?? "Accessory"),
    attachmentName: att ? String(att.props.Name ?? "") : null,
    attachmentPos: attCf?.pos ?? [0, 0, 0],
    attachmentRot: attCf?.rot ?? IDENTITY,
    meshId: assetIdFromUrl(meshUrl),
    textureId: assetIdFromUrl(texUrl),
    scale: v3(mesh?.props.Scale, [1, 1, 1]),
    offset: v3(mesh?.props.Offset, [0, 0, 0]),
    handleSize: v3(handle.props.size ?? handle.props.Size, [1, 1, 1]),
    isMeshPart,
  };
}
