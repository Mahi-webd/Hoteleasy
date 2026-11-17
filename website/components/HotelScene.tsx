"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import type { MotionValue } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * An architect's study model of a hotel: ivory card, smoked glass, warm-lit rooms.
 * Scroll progress (0..1) moves the camera through five chapters and lifts the
 * floors apart; the floor that belongs to the current chapter takes a brass tint.
 */

const IVORY = "#ece6da";
const CARD = "#e3dccd";
const GLASS = "#3b4655";
const BRASS = new THREE.Color("#b07f3c");
const NONE = new THREE.Color("#000000");

type V3 = [number, number, number];
type Key = { cam: V3; look: V3; ex: number; hi: number };

// one key per chapter: hero, front office, payments, restaurant, rooms, owner
const KEYS: Key[] = [
  { cam: [31, 19, 38], look: [0, 5, 0], ex: 0, hi: -1 },
  { cam: [17, 8, 29], look: [2, 3.4, 1], ex: 0.12, hi: 0 },
  { cam: [23, 10, 24], look: [2, 3.4, 0], ex: 0.12, hi: 0 },
  { cam: [-15, 9, 27], look: [-4, 3, 1], ex: 0.12, hi: 1 },
  { cam: [27, 16, 25], look: [1, 9, -1], ex: 1, hi: 2 },
  { cam: [4, 52, 19], look: [0, 3, 0], ex: 0.25, hi: 3 },
];

const FLOORS = 7;
const FH = 1.2; // floor height
const PODIUM = 2.8;
const TW = 8.4; // tower width
const TD = 5.6; // tower depth
const ROOMS_FRONT = 7;
const ROOMS_SIDE = 4;

const smooth = (t: number) => t * t * (3 - 2 * t);

const NARROW_HERO: Key = { cam: [32, 30, 44], look: [-1, 23, 0], ex: 0, hi: -1 };

function useKey(progress: MotionValue<number>, narrow: boolean) {
  const k0 = narrow ? NARROW_HERO : KEYS[0];
  const out = useRef<Key>({ ...k0, cam: [...k0.cam], look: [...k0.look] });
  return (dt: number) => {
    const p = Math.min(Math.max(progress.get(), 0), 1) * (KEYS.length - 1);
    const i = Math.min(Math.floor(p), KEYS.length - 2);
    const f = smooth(p - i);
    const a = i === 0 && narrow ? NARROW_HERO : KEYS[i];
    const b = KEYS[i + 1];
    const k = out.current;
    const d = 1 - Math.exp(-dt * 4);
    for (let j = 0; j < 3; j++) {
      k.cam[j] += (a.cam[j] + (b.cam[j] - a.cam[j]) * f - k.cam[j]) * d;
      k.look[j] += (a.look[j] + (b.look[j] - a.look[j]) * f - k.look[j]) * d;
    }
    k.ex += (a.ex + (b.ex - a.ex) * f - k.ex) * d;
    k.hi = f < 0.5 ? a.hi : b.hi;
    return k;
  };
}

function Tree({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 1.4, 8]} />
        <meshStandardMaterial color="#cfc6b6" roughness={1} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <sphereGeometry args={[0.8, 32, 16]} />
        <meshStandardMaterial color="#c8cdbd" roughness={1} />
      </mesh>
    </group>
  );
}

/** Lit windows as one instanced mesh; colours change slowly like a real night. */
function Windows({ floor }: { floor: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = ROOMS_FRONT * 2 + ROOMS_SIDE * 2;
  const palette = useMemo(
    () => [new THREE.Color("#f2c58c"), new THREE.Color("#2f3a48"), new THREE.Color("#c9d2dc"), new THREE.Color("#2f3a48"), new THREE.Color("#344050")],
    [],
  );
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let n = 0;
    const w = TW / ROOMS_FRONT;
    const d = TD / ROOMS_SIDE;
    for (const side of [1, -1]) {
      for (let i = 0; i < ROOMS_FRONT; i++) {
        o.position.set(-TW / 2 + w * (i + 0.5), 0, side * (TD / 2 + 0.012));
        o.rotation.set(0, side > 0 ? 0 : Math.PI, 0);
        o.scale.set(w * 0.6, FH * 0.56, 1);
        o.updateMatrix();
        m.setMatrixAt(n++, o.matrix);
      }
      for (let i = 0; i < ROOMS_SIDE; i++) {
        o.position.set(side * (TW / 2 + 0.012), 0, -TD / 2 + d * (i + 0.5));
        o.rotation.set(0, side * (Math.PI / 2), 0);
        o.scale.set(d * 0.6, FH * 0.56, 1);
        o.updateMatrix();
        m.setMatrixAt(n++, o.matrix);
      }
    }
    for (let i = 0; i < count; i++) m.setColorAt(i, palette[(i * 7 + floor * 5) % palette.length]);
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count, floor, palette]);

  const next = useRef(Math.random() * 3);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m || clock.elapsedTime < next.current) return;
    next.current = clock.elapsedTime + 1.5 + Math.random() * 4;
    m.setColorAt((Math.random() * count) | 0, palette[(Math.random() * palette.length) | 0]);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Building({ progress, reduced, narrow }: { progress: MotionValue<number>; reduced: boolean; narrow: boolean }) {
  const key = useKey(progress, narrow);
  const { camera, pointer } = useThree();
  const look = useRef(new THREE.Vector3(...KEYS[0].look));
  const root = useRef<THREE.Group>(null);
  const floors = useRef<(THREE.Group | null)[]>([]);
  const roof = useRef<THREE.Group>(null);
  const terrace = useRef<THREE.Group>(null);

  // one slab material per zone so the active zone can glow brass
  const zone = useMemo(
    () => [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: IVORY, roughness: 0.85 })),
    [],
  );
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: GLASS, roughness: 0.22, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2 }), []);
  const card = useMemo(() => new THREE.MeshStandardMaterial({ color: CARD, roughness: 0.95 }), []);

  useFrame((state, dt) => {
    const k = key(Math.min(dt, 0.05));
    const t = state.clock.elapsedTime;
    const px = reduced ? 0 : pointer.x * 1.6;
    const py = reduced ? 0 : pointer.y * 0.8;
    camera.position.set(k.cam[0] + px, k.cam[1] + py, k.cam[2]);
    look.current.set(...k.look);
    camera.lookAt(look.current);
    if (root.current) root.current.rotation.y = reduced ? 0 : Math.sin(t * 0.12) * 0.06;
    floors.current.forEach((g, i) => {
      if (g) g.position.y = PODIUM + i * FH + k.ex * (i + 1) * 0.85;
    });
    if (roof.current) roof.current.position.y = PODIUM + FLOORS * FH + k.ex * (FLOORS + 1) * 0.85;
    if (terrace.current) terrace.current.position.x = -k.ex * 1.2;
    zone.forEach((m, z) => {
      const target = z === k.hi ? 0.32 : 0;
      const cur = m.userData.e ?? 0;
      const e = cur + (target - cur) * (1 - Math.exp(-dt * 5));
      m.userData.e = e;
      m.emissive.copy(BRASS).lerp(NONE, 1 - e);
      m.emissiveIntensity = 1;
    });
  });

  const fins = useMemo(() => Array.from({ length: ROOMS_FRONT + 1 }, (_, i) => -TW / 2 + (TW / ROOMS_FRONT) * i), []);
  const trees: [V3, number][] = [
    [[-12.5, 0.3, 6.5], 1.1], [[-10.6, 0.3, 8.2], 0.8], [[11.8, 0.3, 7], 1.2], [[13, 0.3, -2], 0.9],
    [[-13, 0.3, -6], 1], [[9.5, 0.3, -7.6], 1.1], [[-6, 0.3, -8.5], 0.8], [[5.5, 0.3, 8.8], 0.7],
  ];

  return (
    <group ref={root}>
      {/* the model's base board */}
      <RoundedBox args={[32, 0.6, 22]} radius={0.12} position={[0, 0, 0]} receiveShadow material={card} />
      <mesh position={[3, 0.31, 7.4]} receiveShadow material={zone[0]}>
        <boxGeometry args={[4, 0.03, 7.2]} />
      </mesh>
      {trees.map(([p, s], i) => (
        <Tree key={i} p={p} s={s} />
      ))}

      {/* lobby & front office (zone 0) */}
      <group position={[3, 0.3, 1]}>
        <mesh position={[0, PODIUM / 2, 0]} castShadow receiveShadow material={glass}>
          <boxGeometry args={[9, PODIUM - 0.3, 7.6]} />
        </mesh>
        <mesh position={[0, PODIUM - 0.1, 0.4]} castShadow receiveShadow material={zone[0]}>
          <boxGeometry args={[10, 0.3, 8.8]} />
        </mesh>
        {[-4, -2, 0, 2, 4].map((x) => (
          <mesh key={x} position={[x, PODIUM / 2, 3.95]} castShadow material={zone[0]}>
            <boxGeometry args={[0.16, PODIUM - 0.3, 0.3]} />
          </mesh>
        ))}
        <mesh position={[0, 1.05, 3.83]}>
          <planeGeometry args={[3.2, 1.6]} />
          <meshBasicMaterial color={new THREE.Color("#f3cf9c")} toneMapped={false} />
        </mesh>
      </group>

      {/* restaurant wing with terrace (zone 1) */}
      <group ref={terrace} position={[-6.2, 0.3, 1.6]}>
        <mesh position={[0, 1.1, 0]} castShadow receiveShadow material={glass}>
          <boxGeometry args={[7.4, 2.2, 6.4]} />
        </mesh>
        <mesh position={[0, 2.3, 0]} castShadow receiveShadow material={zone[1]}>
          <boxGeometry args={[8.2, 0.26, 7.2]} />
        </mesh>
        <mesh position={[0, 0.05, 5.2]} receiveShadow material={zone[1]}>
          <boxGeometry args={[7.4, 0.1, 3.6]} />
        </mesh>
        {[-3, -1, 1, 3].map((x) =>
          [4, 6.4].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 1.1, z]} castShadow material={zone[1]}>
              <boxGeometry args={[0.1, 2.2, 0.1]} />
            </mesh>
          )),
        )}
        {[3.6, 4.4, 5.2, 6, 6.8].map((z) => (
          <mesh key={z} position={[0, 2.2, z]} castShadow material={zone[1]}>
            <boxGeometry args={[7.2, 0.08, 0.12]} />
          </mesh>
        ))}
        <mesh position={[0, 1.1, 3.21]}>
          <planeGeometry args={[6.6, 1.5]} />
          <meshBasicMaterial color={new THREE.Color("#efc58f")} toneMapped={false} />
        </mesh>
      </group>

      {/* guest-room floors (zone 2) */}
      {Array.from({ length: FLOORS }, (_, i) => (
        <group key={i} ref={(g) => { floors.current[i] = g; }} position={[1.4, PODIUM + i * FH, -1.6]}>
          <mesh position={[0, 0.06, 0]} castShadow receiveShadow material={zone[2]}>
            <boxGeometry args={[TW + 0.5, 0.14, TD + 0.5]} />
          </mesh>
          <mesh position={[0, FH / 2 + 0.07, 0]} castShadow receiveShadow material={glass}>
            <boxGeometry args={[TW, FH - 0.14, TD]} />
          </mesh>
          <group position={[0, FH / 2 + 0.07, 0]}>
            <Windows floor={i} />
          </group>
          {fins.map((x) => (
            <mesh key={x} position={[x, FH / 2 + 0.07, TD / 2 + 0.1]} castShadow material={zone[2]}>
              <boxGeometry args={[0.07, FH - 0.14, 0.24]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* roof: the owner's vantage point (zone 3) */}
      <group ref={roof} position={[1.4, PODIUM + FLOORS * FH, -1.6]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow material={zone[3]}>
          <boxGeometry args={[TW + 0.5, 0.2, TD + 0.5]} />
        </mesh>
        <mesh position={[-1.6, 0.27, 0.6]}>
          <boxGeometry args={[4, 0.12, 2.6]} />
          <meshPhysicalMaterial color="#8fbcc2" roughness={0.05} metalness={0.1} clearcoat={1} />
        </mesh>
        <mesh position={[2.6, 0.75, -1]} castShadow material={zone[3]}>
          <boxGeometry args={[2.2, 1.1, 2.4]} />
        </mesh>
        {[-3.6, -0.2].map((x) => (
          <mesh key={x} position={[x, 0.55, 2.4]} castShadow material={zone[3]}>
            <boxGeometry args={[0.08, 0.7, 0.08]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ViewOffset({ layout }: { layout: "wide" | "narrow" }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (layout === "wide") cam.setViewOffset(size.width, size.height, -size.width * 0.2, 0, size.width, size.height);
    else cam.setViewOffset(size.width, size.height, 0, size.height * 0.16, size.width, size.height);
    cam.fov = layout === "wide" ? 30 : 42;
    cam.updateProjectionMatrix();
  }, [camera, size, layout]);
  return null;
}

export default function HotelScene({
  progress,
  layout,
  active,
  reduced,
}: {
  progress: MotionValue<number>;
  layout: "wide" | "narrow";
  active: boolean;
  reduced: boolean;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: KEYS[0].cam, fov: 30, near: 0.5, far: 200 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <ViewOffset layout={layout} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[-14, 22, 12]}
        intensity={2.1}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 8, 10]} scale={[20, 6, 1]} color="#fff6e8" />
        <Lightformer intensity={1.2} position={[-12, 4, -4]} rotation-y={Math.PI / 2} scale={[14, 4, 1]} color="#dfe8f2" />
        <Lightformer intensity={0.8} position={[12, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} color="#f5d9b0" />
      </Environment>
      <Building progress={progress} reduced={reduced} narrow={layout === "narrow"} />
      <ContactShadows position={[0, -0.31, 0]} opacity={0.35} scale={60} blur={2.6} far={6} frames={1} />
    </Canvas>
  );
}
