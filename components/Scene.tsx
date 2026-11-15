"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { beatClock, BPM } from "@/lib/audio";
import { ARTISTS, BEAT_COUNT } from "@/lib/event";
import { stage } from "@/lib/stage";
import { artistCanvas, brickCanvases, dotCanvas, plateCanvas, seeded, signCanvas } from "@/lib/textures";

/*
 * World layout, walking in the -Z direction:
 *   z  > 0        the street outside the warehouse
 *   z  = 0        brick facade with the doorway
 *   0 to -40      brick corridor with neon hoops and the lineup frames
 *   -40 to -68    the hall: crowd, DJ booth, light wall
 */
const CORRIDOR_END = -40;
const HALL_END = -68;
const HALF_CORRIDOR = 2.5;
const HALF_HALL = 11;
const BOOTH_Z = -60.5;
const SIGN_Z = ARTISTS.map((_, i) => -11 - i * 6);
// One hoop at the entrance, one 3m in front of each frame (the camera stops just
// inside it, so no tube crosses the frame) and one closing off the far end.
const HOOP_Z = [-4, ...SIGN_Z.map((z) => z + 3), SIGN_Z[SIGN_Z.length - 1] - 3];
/** Left wall first, then alternating. */
const signSide = (i: number) => (i % 2 === 0 ? -1 : 1);

const NEON = new THREE.Color(0.25, 1, 0.12);
const LIGHT = new THREE.Color(0.4, 1, 0.28);

// Glowing materials are module-level so one driver can dim, flicker and
// pulse all of them each frame without touching React state.
const glowMaterial = () => new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
const doorGlow = glowMaterial();
const trimGlow = glowMaterial();
const hoopGlow = HOOP_Z.map(glowMaterial);
const barGlow = [glowMaterial(), glowMaterial(), glowMaterial()];
const signGlow: THREE.MeshBasicMaterial[] = [];
const laserGlow = new THREE.MeshBasicMaterial({
  color: NEON,
  toneMapped: false,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  fog: false,
});
const dustMaterial = new THREE.PointsMaterial({
  color: new THREE.Color(0.5, 1, 0.4),
  map: new THREE.CanvasTexture(dotCanvas()),
  size: 0.05,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const dark = new THREE.MeshStandardMaterial({ color: "#060806", roughness: 0.7 });
const signBoard = new THREE.MeshBasicMaterial({ color: "#020402" });
const floorMaterial = new THREE.MeshStandardMaterial({ color: "#0b0e0b", roughness: 0.32, metalness: 0.55 });
const streetMaterial = new THREE.MeshStandardMaterial({ color: "#0a0b0a", roughness: 0.45, metalness: 0.3 });

const brick = (() => {
  const { color, bump } = brickCanvases();
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bump);
  for (const t of [map, bumpMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  return { map, bumpMap };
})();

/** One texture tile covers 2m of wall. */
function brickMaterial(width: number, height: number) {
  const tile = (source: THREE.Texture) => {
    const t = source.clone();
    t.repeat.set(width / 2, height / 2);
    t.needsUpdate = true;
    return t;
  };
  return new THREE.MeshStandardMaterial({
    map: tile(brick.map),
    bumpMap: tile(brick.bumpMap),
    bumpScale: 2,
    roughness: 0.9,
  });
}

type Vec3 = [number, number, number];

function BrickBox({ size, position }: { size: Vec3; position: Vec3 }) {
  const material = useMemo(() => brickMaterial(Math.max(size[0], size[2]), size[1]), [size]);
  return (
    <mesh position={position} material={material}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function BrickWall({ size, position, rotationY = 0 }: { size: [number, number]; position: Vec3; rotationY?: number }) {
  const material = useMemo(() => brickMaterial(size[0], size[1]), [size]);
  return (
    <mesh position={position} rotation-y={rotationY} material={material}>
      <planeGeometry args={size} />
    </mesh>
  );
}

function Tube({ size, position, material }: { size: Vec3; position: Vec3; material: THREE.Material }) {
  return (
    <mesh position={position} material={material}>
      <boxGeometry args={size} />
    </mesh>
  );
}

/** A wall with a doorway cut into it, built from two sides and a lintel. */
function WallWithOpening({ z, halfWidth, height, halfDoor, doorHeight, depth }: {
  z: number; halfWidth: number; height: number; halfDoor: number; doorHeight: number; depth: number;
}) {
  const side = halfWidth - halfDoor;
  return (
    <>
      <BrickBox size={[side, height, depth]} position={[-(halfDoor + side / 2), height / 2, z]} />
      <BrickBox size={[side, height, depth]} position={[halfDoor + side / 2, height / 2, z]} />
      <BrickBox size={[halfDoor * 2, height - doorHeight, depth]} position={[0, doorHeight + (height - doorHeight) / 2, z]} />
    </>
  );
}

function Street() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 12]} material={streetMaterial}>
        <planeGeometry args={[60, 24]} />
      </mesh>
      <WallWithOpening z={0} halfWidth={16} height={12} halfDoor={1.6} doorHeight={3.6} depth={0.6} />
      {/* Neon frame around the doorway */}
      <Tube size={[0.08, 3.6, 0.08]} position={[-1.72, 1.8, 0.36]} material={doorGlow} />
      <Tube size={[0.08, 3.6, 0.08]} position={[1.72, 1.8, 0.36]} material={doorGlow} />
      <Tube size={[3.52, 0.08, 0.08]} position={[0, 3.72, 0.36]} material={doorGlow} />
    </>
  );
}

function Corridor() {
  const length = -CORRIDOR_END;
  const mid = CORRIDOR_END / 2;
  const height = 4.5;
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, mid]} material={floorMaterial}>
        <planeGeometry args={[HALF_CORRIDOR * 2, length]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, height, mid]} material={dark}>
        <planeGeometry args={[HALF_CORRIDOR * 2, length]} />
      </mesh>
      <BrickWall size={[length, height]} position={[-HALF_CORRIDOR, height / 2, mid]} rotationY={Math.PI / 2} />
      <BrickWall size={[length, height]} position={[HALF_CORRIDOR, height / 2, mid]} rotationY={-Math.PI / 2} />
      {hoopGlow.map((material, i) => {
        const z = HOOP_Z[i];
        return (
          <group key={i}>
            <Tube size={[0.06, height, 0.06]} position={[-HALF_CORRIDOR + 0.08, height / 2, z]} material={material} />
            <Tube size={[0.06, height, 0.06]} position={[HALF_CORRIDOR - 0.08, height / 2, z]} material={material} />
            <Tube size={[HALF_CORRIDOR * 2 - 0.1, 0.06, 0.06]} position={[0, height - 0.08, z]} material={material} />
          </group>
        );
      })}
    </>
  );
}

type SignArt = { material: THREE.MeshBasicMaterial; aspect: number };
type Art = { signs: SignArt[]; title: SignArt; plate: THREE.MeshBasicMaterial };

/** Neon lettering needs the page's display font, so it is drawn once that has loaded. */
function useArt() {
  const [art, setArt] = useState<Art | null>(null);
  useEffect(() => {
    let cancelled = false;
    const family =
      getComputedStyle(document.documentElement).getPropertyValue("--font-anton").trim() || "Impact, sans-serif";
    const sign = (text: string): SignArt => glow(signCanvas(text, family));
    const glow = ({ canvas, aspect }: { canvas: HTMLCanvasElement; aspect: number }): SignArt => {
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
      const material = new THREE.MeshBasicMaterial({
        map,
        color: 0x000000,
        toneMapped: false,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      signGlow.push(material);
      return { material, aspect };
    };
    const photo = (src: string | null) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    Promise.all([document.fonts.load(`200px ${family}`).catch(() => undefined), ...ARTISTS.map((a) => photo(a.image))])
      .then(([, ...photos]) => {
        if (cancelled) return;
        const plateMap = new THREE.CanvasTexture(plateCanvas(family));
        plateMap.colorSpace = THREE.SRGBColorSpace;
        setArt({
          signs: photos.map((p) => glow(artistCanvas(family, p as HTMLImageElement | null))),
          title: sign("NEON NIGHT"),
          plate: new THREE.MeshBasicMaterial({ map: plateMap, color: "#8a8a8a", transparent: true }),
        });
      });
    return () => {
      cancelled = true;
      signGlow.length = 0;
    };
  }, []);
  return art;
}

function ArtistSigns({ signs }: { signs: SignArt[] }) {
  return (
    <>
      {signs.map(({ material, aspect }, i) => {
        const side = signSide(i);
        // Big enough to show an artist photo; the corridor fits about 2.2m at this angle.
        const height = 2.2;
        const width = Math.min(2.4, height * aspect);
        return (
          // Angled out from the wall to face people walking in.
          <group key={i} position={[side * 1.55, 2.4, SIGN_Z[i]]} rotation-y={-side * 0.95}>
            {/* Backing board, so tubes further down the corridor do not show through the letters */}
            <mesh position-z={-0.03} material={signBoard}>
              <planeGeometry args={[width + 0.1, width / aspect + 0.05]} />
            </mesh>
            <mesh material={material}>
              <planeGeometry args={[width, width / aspect]} />
            </mesh>
            {[-0.4, 0.4].map((x) => (
              <mesh key={x} position={[x * width, 1.25, -0.02]} material={dark}>
                <boxGeometry args={[0.025, 1.9, 0.025]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

const rand = seeded(99);
const PEOPLE = Array.from({ length: 110 }, () => ({
  x: (rand() * 2 - 1) * 8.5,
  z: -49 - rand() * 9.5,
  scale: 0.9 + rand() * 0.22,
  phase: rand(),
  handsUp: rand() > 0.35,
  lean: (rand() - 0.5) * 0.5,
}));
const DUST = (() => {
  const count = 700;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const inHall = i > count * 0.55;
    positions[i * 3] = (rand() * 2 - 1) * (inHall ? HALF_HALL : 3);
    positions[i * 3 + 1] = rand() * (inHall ? 8 : 4.4);
    positions[i * 3 + 2] = inHall ? CORRIDOR_END - rand() * 26 : 10 - rand() * 50;
  }
  return positions;
})();
const LASERS = Array.from({ length: 12 }, (_, i) => ({ spread: (i - 5.5) * 0.13, seed: rand() * 6 }));
const dummy = new THREE.Object3D();

/**
 * 2 = desktop, 1 = phones and modest laptops, 0 = struggling devices.
 * Devices start at 1 or 2 and step down if they cannot hold the frame rate.
 */
type Tier = 0 | 1 | 2;
const CROWD_SIZE = [50, 70, PEOPLE.length] as const;
const MAX_DPR = [1, 1.5, 1.5] as const;
/** Glow strength. Softer on phones, where the same halo covers more of a small screen. */
const BLOOM = [0, 0.8, 1.15] as const;

/** Which parts of the building are worth drawing from where the camera is. */
const zone = { street: true, corridor: true, hall: false };

/** Beats since the music started, or a silent clock at the same tempo. */
const beats = (elapsed: number) => beatClock() ?? (elapsed * BPM) / 60;

function Crowd({ size }: { size: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    if (!zone.hall || !bodies.current || !heads.current || !arms.current) return;
    const beat = beats(clock.elapsedTime);
    PEOPLE.slice(0, size).forEach((p, i) => {
      const hop = 0.11 * Math.abs(Math.sin(Math.PI * (beat + p.phase * 0.25))) * p.scale;
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(p.scale);
      dummy.position.set(p.x, hop + 0.92 * p.scale, p.z);
      dummy.updateMatrix();
      bodies.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.y = hop + 1.7 * p.scale;
      dummy.updateMatrix();
      heads.current!.setMatrixAt(i, dummy.matrix);
      for (const hand of [-1, 1]) {
        const wave = Math.sin(beat * Math.PI + p.phase * 6 + hand) * 0.12;
        dummy.position.set(p.x + hand * 0.27 * p.scale, hop + (p.handsUp ? 1.95 : 1.15) * p.scale, p.z);
        dummy.rotation.set(0, 0, p.handsUp ? -hand * (0.25 + p.lean * 0.4) + wave : hand * 0.12);
        dummy.updateMatrix();
        arms.current!.setMatrixAt(i * 2 + (hand + 1) / 2, dummy.matrix);
      }
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    arms.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={bodies} args={[undefined, undefined, PEOPLE.length]} count={size} material={dark} frustumCulled={false}>
        <capsuleGeometry args={[0.21, 0.85, 3, 8]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, PEOPLE.length]} count={size} material={dark} frustumCulled={false}>
        <sphereGeometry args={[0.15, 10, 8]} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, PEOPLE.length * 2]} count={size * 2} material={dark} frustumCulled={false}>
        <boxGeometry args={[0.075, 0.62, 0.075]} />
      </instancedMesh>
    </>
  );
}

function Lasers() {
  const pivots = useRef<(THREE.Group | null)[]>([]);
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.018, 0.018, 46, 5, 1, true);
    g.translate(0, 23, 0); // beams start at the rig rather than straddling it
    return g;
  }, []);

  useFrame(({ clock }) => {
    if (!zone.hall) return;
    const t = clock.elapsedTime;
    pivots.current.forEach((pivot, i) => {
      if (!pivot) return;
      const { spread, seed } = LASERS[i];
      pivot.rotation.y = spread + Math.sin(t * 0.5 + seed) * 0.22;
      pivot.children[0].rotation.x = Math.PI / 2 + 0.16 + Math.sin(t * 0.8 + seed * 2) * 0.12;
    });
  });

  return (
    <group position={[0, 8.4, -64]}>
      {LASERS.map((_, i) => (
        <group key={i} ref={(node) => void (pivots.current[i] = node)}>
          <mesh geometry={geometry} material={laserGlow} />
        </group>
      ))}
    </group>
  );
}

function Hall({ art, crowd }: { art: Art | null; crowd: number }) {
  const depth = CORRIDOR_END - HALL_END;
  const mid = (CORRIDOR_END + HALL_END) / 2;
  const height = 10;
  const titleWidth = 10;
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, mid]} material={floorMaterial}>
        <planeGeometry args={[HALF_HALL * 2, depth]} />
      </mesh>
      <WallWithOpening z={CORRIDOR_END - 0.2} halfWidth={HALF_HALL} height={height} halfDoor={HALF_CORRIDOR} doorHeight={4.5} depth={0.4} />
      <BrickWall size={[depth, height]} position={[-HALF_HALL, height / 2, mid]} rotationY={Math.PI / 2} />
      <BrickWall size={[depth, height]} position={[HALF_HALL, height / 2, mid]} rotationY={-Math.PI / 2} />
      <BrickWall size={[HALF_HALL * 2, height]} position={[0, height / 2, HALL_END]} />

      {/* Light wall behind the booth */}
      {Array.from({ length: 15 }, (_, i) => (
        <Tube key={i} size={[0.1, 5.2, 0.1]} position={[(i - 7) * 1.25, 3.4, HALL_END + 0.15]} material={barGlow[i % 3]} />
      ))}
      {art && (
        <mesh position={[0, 7.7, HALL_END + 0.2]} material={art.title.material}>
          <planeGeometry args={[titleWidth, titleWidth / art.title.aspect]} />
        </mesh>
      )}

      {/* Stage, booth and DJ */}
      <mesh position={[0, 0.35, BOOTH_Z - 1]} material={dark}>
        <boxGeometry args={[10, 0.7, 4.4]} />
      </mesh>
      <mesh position={[0, 1.2, BOOTH_Z]} material={dark}>
        <boxGeometry args={[4.6, 1, 1.1]} />
      </mesh>
      <Tube size={[4.6, 0.05, 0.05]} position={[0, 1.7, BOOTH_Z + 0.56]} material={trimGlow} />
      <Tube size={[10, 0.05, 0.05]} position={[0, 0.68, BOOTH_Z + 1.21]} material={trimGlow} />
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.74, BOOTH_Z]} material={floorMaterial}>
          <cylinderGeometry args={[0.36, 0.36, 0.06, 24]} />
        </mesh>
      ))}
      <mesh position={[0, 2.1, BOOTH_Z - 0.9]} material={dark}>
        <capsuleGeometry args={[0.24, 0.95, 3, 8]} />
      </mesh>
      <mesh position={[0, 2.95, BOOTH_Z - 0.9]} material={dark}>
        <sphereGeometry args={[0.17, 12, 10]} />
      </mesh>
      {art && (
        <mesh position={[0, 1.18, BOOTH_Z + 0.56]} rotation-z={-0.05} material={art.plate}>
          <planeGeometry args={[1.5, 0.75]} />
        </mesh>
      )}

      <Lasers />
      <Crowd size={crowd} />
    </>
  );
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** One camera stop per scroll beat: where it stands and what it looks at. */
function cameraStops(portrait: boolean) {
  const stops = [
    { position: v(0, 1.7, portrait ? 12 : 9.5), target: v(0, portrait ? 3.4 : 4.1, 0) },
    { position: v(0, 1.7, -1.5), target: v(0, 1.9, -14) },
    ...SIGN_Z.map((z, i) => {
      const side = signSide(i);
      return portrait
        ? { position: v(-side * 0.9, 1.7, z + 2.8), target: v(side * 1.5, 1.95, z) }
        : { position: v(-side * 0.6, 1.75, z + 2.8), target: v(side * 0.45, 2.2, z) };
    }),
    { position: v(0, 2, CORRIDOR_END - 1.5), target: v(0, 3.4, BOOTH_Z) },
    { position: v(0, 3.4, CORRIDOR_END - 6), target: v(0, portrait ? 4.2 : 3.2, BOOTH_Z) },
  ];
  if (stops.length !== BEAT_COUNT) throw new Error("Camera stops and scroll beats are out of step");
  return stops;
}

function Rig() {
  const progress = useRef(0);
  const target = useRef(new THREE.Vector3(0, 4, 0));
  const landscape = useMemo(() => cameraStops(false), []);
  const portrait = useMemo(() => cameraStops(true), []);

  useFrame(({ camera, size, clock }, delta) => {
    const isPortrait = size.width / size.height < 0.8;
    const stops = isPortrait ? portrait : landscape;
    progress.current = THREE.MathUtils.damp(progress.current, stage.progress, 3.2, delta);
    const f = progress.current * (stops.length - 1);
    const i = Math.min(Math.floor(f), stops.length - 2);
    const t = THREE.MathUtils.smoothstep(f - i, 0, 1);
    camera.position.lerpVectors(stops[i].position, stops[i + 1].position, t);
    // A little handheld drift so it never sits perfectly still.
    camera.position.x += Math.sin(clock.elapsedTime * 0.6) * 0.03;
    camera.position.y += Math.sin(clock.elapsedTime * 1.1) * 0.015;
    target.current.lerpVectors(stops[i].target, stops[i + 1].target, t);
    camera.lookAt(target.current);
    const fov = isPortrait ? 76 : 58;
    const perspective = camera as THREE.PerspectiveCamera;
    if (perspective.fov !== fov) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
  });
  return null;
}

const DOOR_LIGHT = v(0, 3.2, 2.2);
const HALL_LIGHT = v(0, 7, -52);
/** Where the key light sits when there is no backlight: behind the booth, so the crowd still reads as silhouettes. */
const HALL_LIGHT_SOLO = v(0, 4.5, HALL_END + 3);

/**
 * Drives every light and glowing material from the power switch and the beat.
 * Each live light is paid for on every pixel, so there are only two or three:
 * one that travels with the camera, one "key" light that serves the doorway
 * and later the hall, and (top tier only) a backlight behind the booth.
 */
function Lights({ tier }: { tier: Tier }) {
  const power = useRef(0);
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.PointLight>(null);
  const follow = useRef<THREE.PointLight>(null);
  const back = useRef<THREE.PointLight>(null);

  useFrame(({ camera, clock }, delta) => {
    const t = clock.elapsedTime;
    power.current = THREE.MathUtils.damp(power.current, stage.power, 1.4, delta);
    const p = power.current;
    // While warming up, the tubes stutter before they hold.
    const catching = p > 0.02 && p < 0.9;
    const stutter = catching && Math.sin(t * 37) + Math.sin(t * 61) < 0.2 ? 0.12 : 1;
    const on = p * stutter;
    const beat = beats(t);
    const kick = Math.exp(-(beat % 1) * 4);

    doorGlow.color.copy(NEON).multiplyScalar(3 * on);
    trimGlow.color.copy(NEON).multiplyScalar(2.6 * on);
    hoopGlow.forEach((m, i) => m.color.copy(NEON).multiplyScalar((1.5 + 1.1 * Math.sin(t * 4 - i * 0.8)) * on));
    barGlow.forEach((m, i) =>
      m.color.copy(NEON).multiplyScalar((0.5 + 2.6 * kick * (Math.floor(beat) % 3 === i ? 1 : 0.25)) * on),
    );
    // Kept just above the glow threshold: any brighter and the halo swallows the letters on phones.
    signGlow.forEach((m, i) => m.color.setScalar((1.3 + 0.08 * Math.sin(t * 23 + i * 2)) * on));
    laserGlow.opacity = 0.42 * on;
    dustMaterial.opacity = 0.55 * on;

    if (ambient.current) ambient.current.intensity = 0.05 + 0.2 * on;
    if (follow.current) {
      follow.current.intensity = 16 * on;
      follow.current.position.set(camera.position.x, 3.4, camera.position.z - 2.5);
    }
    if (key.current) {
      // Halfway down the corridor both spots are out of range, so the swap is invisible.
      const atDoor = camera.position.z > -20;
      const solo = !back.current;
      key.current.position.copy(atDoor ? DOOR_LIGHT : solo ? HALL_LIGHT_SOLO : HALL_LIGHT);
      key.current.distance = atDoor ? 22 : 34;
      key.current.intensity = (atDoor ? 26 : (solo ? 190 : 90) + 110 * kick) * on;
    }
    if (back.current) back.current.intensity = 160 * on;
  });

  return (
    <>
      <ambientLight ref={ambient} color={LIGHT} intensity={0.05} />
      <pointLight ref={key} color={LIGHT} intensity={0} />
      <pointLight ref={follow} color={LIGHT} distance={16} intensity={0} />
      {tier === 2 && (
        <pointLight ref={back} color={LIGHT} position={[0, 4, HALL_END + 2.5]} distance={30} intensity={0} />
      )}
    </>
  );
}

function Dust() {
  const points = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (!points.current) return;
    points.current.position.y = Math.sin(clock.elapsedTime * 0.15) * 0.25;
    points.current.position.x = Math.sin(clock.elapsedTime * 0.09) * 0.3;
  });
  return (
    <points ref={points} material={dustMaterial} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[DUST, 3]} />
      </bufferGeometry>
    </points>
  );
}

function World({ tier }: { tier: Tier }) {
  const art = useArt();
  const street = useRef<THREE.Group>(null);
  const corridor = useRef<THREE.Group>(null);
  const hall = useRef<THREE.Group>(null);

  // The camera only ever faces forward, so whatever is behind it, or still
  // lost in the haze far ahead, is skipped entirely.
  useFrame(({ camera }) => {
    const z = camera.position.z;
    zone.street = z > -1.5;
    zone.corridor = z > CORRIDOR_END - 1;
    zone.hall = z < -4;
    if (street.current) street.current.visible = zone.street;
    if (corridor.current) corridor.current.visible = zone.corridor;
    if (hall.current) hall.current.visible = zone.hall;
  });

  return (
    <>
      <color attach="background" args={["#010302"]} />
      <fogExp2 attach="fog" args={["#020a03", 0.042]} />
      <Lights tier={tier} />
      <Rig />
      <group ref={street}>
        <Street />
      </group>
      <group ref={corridor}>
        <Corridor />
        {art && <ArtistSigns signs={art.signs} />}
      </group>
      <group ref={hall} visible={false}>
        <Hall art={art} crowd={CROWD_SIZE[tier]} />
      </group>
      <Dust />
    </>
  );
}

function startingTier(): Tier {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  return touch || cores <= 4 || memory <= 4 ? 1 : 2;
}

/** `active` is false until the lights are switched on; until then one still frame is enough. */
export default function Scene({ active, onReady }: { active: boolean; onReady?: () => void }) {
  const [tier, setTier] = useState<Tier>(startingTier);
  return (
    <Canvas
      frameloop={active ? "always" : "demand"}
      dpr={[1, MAX_DPR[tier]]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 58, near: 0.1, far: 120, position: [0, 1.7, 9.5] }}
      // Fires once the renderer and scene exist, which is when the lights can come on.
      onCreated={() => onReady?.()}
    >
      {/* Step down a tier whenever the device cannot hold its frame rate. */}
      <PerformanceMonitor onDecline={() => setTier((t) => (t > 0 ? ((t - 1) as Tier) : t))} />
      <World tier={tier} />
      {tier > 0 && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={BLOOM[tier]} luminanceThreshold={1} luminanceSmoothing={0.15} />
          <Vignette offset={0.25} darkness={0.7} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
