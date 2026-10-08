import * as THREE from "three";

export const CLOTHING_KINDS = ["shirt", "pants", "tshirt"] as const;
export type ClothingKind = (typeof CLOTHING_KINDS)[number];
export const CLOTHING_LABEL: Record<ClothingKind, string> = {
  shirt: "Classic Shirt",
  pants: "Classic Pants",
  tshirt: "Classic T-Shirt",
};
export const TEMPLATE_W = 585;
export const TEMPLATE_H = 559;

export function isClothingKind(k: string): k is ClothingKind {
  return (CLOTHING_KINDS as readonly string[]).includes(k);
}

export type Layer = { kind: ClothingKind; img: HTMLImageElement };
export type BodyPart = "torso" | "left_arm" | "right_arm" | "left_leg" | "right_leg";
type Rect = [number, number, number, number];
// BoxGeometry face order: +x, -x, +y, -y, +z (back), -z (front). Character's right is +x.
type FaceRects = [Rect, Rect, Rect, Rect, Rect, Rect];

const TORSO: FaceRects = [
  [165, 74, 64, 128], // right side
  [361, 74, 64, 128], // left side
  [231, 8, 128, 64], // up
  [231, 204, 128, 64], // down
  [427, 74, 128, 128], // back
  [231, 74, 128, 128], // front
];
const RIGHT_LIMB: FaceRects = [
  [19, 355, 64, 128], // outer (+x)
  [151, 355, 64, 128], // inner
  [217, 289, 64, 64],
  [217, 485, 64, 64],
  [85, 355, 64, 128],
  [217, 355, 64, 128],
];
const LEFT_LIMB: FaceRects = [
  [506, 355, 64, 128], // inner (+x)
  [374, 355, 64, 128], // outer (-x)
  [308, 289, 64, 64],
  [308, 485, 64, 64],
  [440, 355, 64, 128],
  [308, 355, 64, 128],
];

function partRects(part: BodyPart): FaceRects {
  if (part === "torso") return TORSO;
  if (part === "right_arm" || part === "right_leg") return RIGHT_LIMB;
  return LEFT_LIMB;
}

function layersFor(part: BodyPart, layers: Layer[]) {
  const pants = layers.filter((l) => l.kind === "pants");
  const shirt = layers.filter((l) => l.kind === "shirt");
  if (part === "torso") return [...pants, ...shirt];
  if (part.endsWith("arm")) return shirt;
  return pants;
}

/** Returns 6 materials for a body part, or null when nothing is worn on it. */
export function buildPartMaterials(part: BodyPart, color: string, layers: Layer[]) {
  const use = layersFor(part, layers);
  const tshirt = part === "torso" ? layers.find((l) => l.kind === "tshirt") : undefined;
  if (use.length === 0 && !tshirt) return null;
  const rects = partRects(part);
  return rects.map((r, face) => {
    const scale = 2;
    const c = document.createElement("canvas");
    c.width = r[2] * scale;
    c.height = r[3] * scale;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    for (const l of use) ctx.drawImage(l.img, r[0], r[1], r[2], r[3], 0, 0, c.width, c.height);
    if (tshirt && face === 5) ctx.drawImage(tshirt.img, r[0], r[1], r[2], r[3], 0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  });
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

/** Renders a Roblox-style catalog thumbnail of a plain avatar wearing one clothing item. */
export async function renderClothingThumb(
  layer: Layer,
  headGeo: THREE.BufferGeometry | null,
  face: HTMLImageElement | null,
  size = 420,
): Promise<string> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const dir = new THREE.DirectionalLight(0xffffff, 1.8);
  dir.position.set(-4, 8, -8);
  scene.add(dir);
  const body = "#e3e3e3";
  const layers = [layer];
  const add = (part: BodyPart, s: [number, number, number], p: [number, number, number]) => {
    const mats = buildPartMaterials(part, body, layers) ?? new THREE.MeshStandardMaterial({ color: body, roughness: 0.55 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(...s), mats);
    m.position.set(...p);
    scene.add(m);
  };
  add("torso", [2, 2, 1], [0, 3, 0]);
  add("left_arm", [1, 2, 1], [-1.5, 3, 0]);
  add("right_arm", [1, 2, 1], [1.5, 3, 0]);
  add("left_leg", [0.98, 2, 1], [-0.5, 1, 0]);
  add("right_leg", [0.98, 2, 1], [0.5, 1, 0]);
  const headMat = new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.55 });
  const head = new THREE.Mesh(headGeo ?? new THREE.BoxGeometry(1.2, 1.2, 1.2), headMat);
  head.position.set(0, 4.53, 0);
  scene.add(head);
  if (face) {
    const ft = new THREE.Texture(face);
    ft.colorSpace = THREE.SRGBColorSpace;
    ft.needsUpdate = true;
    const fm = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshStandardMaterial({ map: ft, transparent: true, roughness: 0.55 }),
    );
    fm.position.set(0, 4.53, -0.601);
    fm.rotation.y = Math.PI;
    scene.add(fm);
  }
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(-4.5, 4.8, -10.5);
  cam.lookAt(0, 2.75, 0);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL("image/png");
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry !== headGeo && o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((mm: THREE.MeshStandardMaterial) => {
        mm.map?.dispose();
        mm.dispose();
      });
    }
  });
  renderer.dispose();
  renderer.forceContextLoss();
  return url;
}

export async function loadHeadAndFace() {
  const [{ parseRobloxMesh }, head, face] = await Promise.all([
    import("@/lib/robloxMesh"),
    import("@/assets/classic-head.mesh.asset.json"),
    import("@/assets/classic-face.png.asset.json"),
  ]);
  let geo: THREE.BufferGeometry | null = null;
  try {
    const buf = await (await fetch(head.default.url)).arrayBuffer();
    const m = parseRobloxMesh(new Uint8Array(buf));
    geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
  } catch {
    geo = null;
  }
  const faceImg = await loadImage(face.default.url).catch(() => null);
  return { geo, faceImg };
}
