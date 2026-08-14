/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The landing hero's centrepiece: the item bank as an object you can turn.
 *
 * A brass wireframe core with the four domains orbiting it, linked back to the
 * centre by hairlines that carry a travelling pulse, inside a dust shell of
 * individual items. Hovering a domain node lifts it and reports that domain's
 * real figures in the panel underneath.
 *
 * Two things keep it honest. The node labels and counts come from
 * `domainBankProfiles()`, so the graph is drawn from the bank the placement
 * test will actually administer — if an item is added to the bank, this changes.
 * And the hues are the four domain colours the rest of the product uses, so a
 * node here and a topic tag in the app are the same colour rather than nearly.
 *
 * ---------------------------------------------------------------------------
 * On cost.
 *
 * This is the only WebGL on the site and it is deliberately bounded: named
 * imports so the bundler can drop the ~80% of three.js that is unused, a device
 * pixel ratio capped at 2, and — most importantly — a render loop gated on an
 * IntersectionObserver. Scrolled past, it stops requesting frames entirely
 * rather than spinning an invisible scene, which is what otherwise makes a hero
 * canvas cost battery for the whole visit.
 *
 * It also declines to run at all when it should not: `prefers-reduced-motion`
 * drops it to a still, readable pose, and a machine without WebGL gets the SVG
 * plot instead of a blank rectangle.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WireframeGeometry,
  type Material,
  type Object3D,
} from 'three';
import { domainBankProfiles } from '../../lib/skillGraph';
import { TOPIC_META } from '../../lib/topics';
import type { Topic } from '../../types';
import { ItemCurvesPlot } from './plots';

interface SkillGraphStageProps {
  /** Raised with the hovered domain, or null on leave. Drives the readout panel. */
  onActiveChange: (domain: Topic | null) => void;
  /** Honour prefers-reduced-motion. Passed in so the page resolves it once. */
  still: boolean;
}

/** Brass. The core, the orbital rings and the dust are all this one colour. */
const BRASS = 0xb68235;

const PROFILES = domainBankProfiles();

/**
 * Is WebGL actually available?
 *
 * Constructing the renderer inside a try/catch is not enough on its own: some
 * environments hand back a context that fails on first draw rather than on
 * creation. A throwaway probe context is the cheap, reliable check, and it is
 * done once before any of the scene is built.
 */
function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
    );
  } catch {
    return false;
  }
}

/**
 * The soft halo behind each node, as a canvas-drawn radial gradient.
 *
 * A sprite with an additive-blended gradient rather than a bloom pass: the
 * whole post-processing pipeline would be several times the size of the rest of
 * this scene to produce a glow on four small objects.
 */
function glowTexture(hex: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, hex);
  gradient.addColorStop(0.35, `${hex}66`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

export default function SkillGraphStage({ onActiveChange, still }: SkillGraphStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [supported] = useState(webglAvailable);

  /*
   * `onActiveChange` is held in a ref rather than listed as an effect
   * dependency. The parent re-creates the callback on every render — and it
   * renders on every hover, because the hover is what it is storing — so
   * depending on it directly would tear down and rebuild the entire WebGL
   * scene each time the pointer crossed a node.
   */
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supported) return;

    const width = host.clientWidth || 520;
    const height = host.clientHeight || 460;

    const scene = new Scene();
    const camera = new PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 10.2);

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const world = new Group();
    scene.add(world);

    /* Everything allocated below is registered here and disposed on unmount.
       A WebGL context is not garbage collected on its own, and this component
       unmounts every time someone signs in. */
    const geometries: BufferGeometry[] = [];
    const materials: Material[] = [];
    const textures: CanvasTexture[] = [];
    const track = <T extends Object3D>(obj: T): T => obj;

    // ---- Core: a wireframe over a dark solid, so the lines read -------------
    const coreSolidGeo = new IcosahedronGeometry(1.28, 1);
    const coreSolidMat = new MeshBasicMaterial({ color: 0x1d1812 });
    const coreSolid = track(new Mesh(coreSolidGeo, coreSolidMat));
    geometries.push(coreSolidGeo);
    materials.push(coreSolidMat);

    const coreWireSrc = new IcosahedronGeometry(1.3, 1);
    const coreWireGeo = new WireframeGeometry(coreWireSrc);
    const coreWireMat = new LineBasicMaterial({ color: BRASS, transparent: true, opacity: 0.62 });
    const coreWire = track(new LineSegments(coreWireGeo, coreWireMat));
    geometries.push(coreWireSrc, coreWireGeo);
    materials.push(coreWireMat);

    const haloSrc = new IcosahedronGeometry(1.62, 0);
    const haloGeo = new WireframeGeometry(haloSrc);
    const haloMat = new LineBasicMaterial({ color: BRASS, transparent: true, opacity: 0.2 });
    const coreHalo = track(new LineSegments(haloGeo, haloMat));
    geometries.push(haloSrc, haloGeo);
    materials.push(haloMat);

    world.add(coreSolid, coreWire, coreHalo);

    // ---- Two orbital hairlines, tilted against each other -------------------
    const rings: Mesh[] = [];
    ([[2.55, 0.42, 0], [2.95, -0.3, 0.55]] as const).forEach(([r, rx, rz]) => {
      const geo = new TorusGeometry(r, 0.006, 6, 180);
      const mat = new MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0.34 });
      const ring = new Mesh(geo, mat);
      ring.rotation.set(rx, 0, rz);
      geometries.push(geo);
      materials.push(mat);
      world.add(ring);
      rings.push(ring);
    });

    // ---- Four domain nodes on a tilted ring ---------------------------------
    interface Node {
      group: Group;
      base: Vector3;
      wire: LineSegments;
      glow: Sprite;
    }
    const nodes: Node[] = [];
    const links: { line: Line; from: Vector3; to: Vector3 }[] = [];
    const pulses: { mesh: Mesh; phase: number }[] = [];
    const hits: Mesh[] = [];
    const R = 3.9;

    PROFILES.forEach((profile, i) => {
      const hue = TOPIC_META[profile.domain as Topic].vars['--cx-hue'];
      const angle = (i / PROFILES.length) * Math.PI * 2 + Math.PI / 4;
      const base = new Vector3(
        Math.cos(angle) * R,
        (i % 2 === 0 ? 1 : -1) * 1.05,
        Math.sin(angle) * R * 0.62,
      );

      const group = new Group();
      group.position.copy(base);

      const wireSrc = new IcosahedronGeometry(0.44, 0);
      const wireGeo = new WireframeGeometry(wireSrc);
      const wireMat = new LineBasicMaterial({ color: hue, transparent: true, opacity: 0.85 });
      const wire = new LineSegments(wireGeo, wireMat);
      geometries.push(wireSrc, wireGeo);
      materials.push(wireMat);

      const beadGeo = new SphereGeometry(0.12, 16, 16);
      const beadMat = new MeshBasicMaterial({ color: hue });
      const bead = new Mesh(beadGeo, beadMat);
      geometries.push(beadGeo);
      materials.push(beadMat);

      const texture = glowTexture(hue);
      const glowMat = new SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const glow = new Sprite(glowMat);
      glow.scale.set(2.4, 2.4, 1);
      textures.push(texture);
      materials.push(glowMat);

      group.add(wire, bead, glow);

      /* An invisible sphere far larger than the node itself. Raycasting the
         wireframe directly means the pointer has to land on a drawn edge, which
         at this size is a few pixels of hit area. */
      const hitGeo = new SphereGeometry(0.95, 8, 8);
      const hitMat = new MeshBasicMaterial({ visible: false });
      const hit = new Mesh(hitGeo, hitMat);
      hit.userData.index = i;
      geometries.push(hitGeo);
      materials.push(hitMat);
      group.add(hit);
      hits.push(hit);

      world.add(group);
      nodes.push({ group, base, wire, glow });

      /* The link is trimmed at both ends so it emerges from the core's surface
         and stops short of the node, rather than disappearing under both. */
      const dir = base.clone().normalize();
      const from = dir.clone().multiplyScalar(1.55);
      const to = base.clone().sub(dir.clone().multiplyScalar(0.62));
      const lineGeo = new BufferGeometry().setFromPoints([from, to]);
      const lineMat = new LineBasicMaterial({ color: hue, transparent: true, opacity: 0.24 });
      const line = new Line(lineGeo, lineMat);
      geometries.push(lineGeo);
      materials.push(lineMat);
      world.add(line);
      links.push({ line, from, to });

      const pulseGeo = new SphereGeometry(0.055, 10, 10);
      const pulseMat = new MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.9 });
      const pulse = new Mesh(pulseGeo, pulseMat);
      geometries.push(pulseGeo);
      materials.push(pulseMat);
      world.add(pulse);
      pulses.push({ mesh: pulse, phase: i * 0.25 });
    });

    // ---- The item bank as dust around the core ------------------------------
    const count = 360;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4.4 + Math.random() * 3.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.5;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    }
    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', new BufferAttribute(positions, 3));
    const dustMat = new PointsMaterial({
      color: BRASS, size: 0.038, transparent: true, opacity: 0.5,
      sizeAttenuation: true, depthWrite: false,
    });
    const dust = new Points(dustGeo, dustMat);
    geometries.push(dustGeo);
    materials.push(dustMat);
    world.add(dust);

    // ---- Pointer: parallax tilt, and raycast onto the hit spheres -----------
    const pointer = new Vector2(-2, -2);
    const target = { x: 0, y: 0 };
    const raycaster = new Raycaster();
    let hovered = -1;

    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      pointer.set(nx * 2 - 1, -(ny * 2 - 1));
      target.x = (ny - 0.5) * 0.28;
      target.y = (nx - 0.5) * 0.5;
    };
    const onPointerLeave = () => {
      pointer.set(-2, -2);
      target.x = 0;
      target.y = 0;
      if (hovered !== -1) {
        hovered = -1;
        onActiveRef.current(null);
      }
    };
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerleave', onPointerLeave);

    // ---- Frame gating and resize -------------------------------------------
    let visible = true;
    const io = new IntersectionObserver(
      (entries) => { visible = entries[0].isIntersecting; },
      { threshold: 0.02 },
    );
    io.observe(host);

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(host);

    const clock = new Clock();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const t = clock.getElapsedTime();

      if (!still) {
        world.rotation.y += 0.0022;
        coreWire.rotation.y -= 0.0016;
        coreWire.rotation.x += 0.0008;
        coreHalo.rotation.z += 0.0011;
        rings[0].rotation.z += 0.0013;
        rings[1].rotation.x -= 0.0009;
        dust.rotation.y -= 0.0004;
      }

      world.rotation.x += (target.x - world.rotation.x) * 0.045;

      nodes.forEach((node, i) => {
        const bob = still ? 0 : Math.sin(t * 0.7 + i * 1.6) * 0.14;
        node.group.position.y = node.base.y + bob;

        /* Hover response is a lerp rather than a transition, so a pointer
           crossing three nodes quickly leaves each one settling on its own
           rather than snapping between states. */
        const on = hovered === i;
        const glowMaterial = node.glow.material as SpriteMaterial;
        const wireMaterial = node.wire.material as LineBasicMaterial;
        glowMaterial.opacity += ((on ? 0.95 : 0.42) - glowMaterial.opacity) * 0.12;
        wireMaterial.opacity += ((on ? 1 : 0.78) - wireMaterial.opacity) * 0.12;
        const scale = on ? 1.25 : 1;
        node.group.scale.x += (scale - node.group.scale.x) * 0.12;
        node.group.scale.y = node.group.scale.z = node.group.scale.x;
      });

      links.forEach((link, i) => {
        const on = hovered === i;
        const mat = link.line.material as LineBasicMaterial;
        mat.opacity += ((on ? 0.7 : 0.22) - mat.opacity) * 0.12;
      });

      pulses.forEach((pulse, i) => {
        const link = links[i];
        /* Held at the midpoint when still: the pulse is what says the link is
           a channel rather than a rule, and freezing it at zero would read as
           a rendering fault. */
        const k = still ? 0.5 : (t * 0.42 + pulse.phase) % 1;
        pulse.mesh.position.lerpVectors(link.from, link.to, k);
        (pulse.mesh.material as MeshBasicMaterial).opacity =
          0.15 + Math.sin(k * Math.PI) * 0.8;
        const end = nodes[i].group.position;
        link.to.set(end.x, end.y, end.z).sub(end.clone().normalize().multiplyScalar(0.62));
      });

      if (pointer.x > -1.5) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects<Mesh>(hits, false)[0];
        const index = hit ? (hit.object.userData.index as number) : -1;
        if (index !== hovered) {
          hovered = index;
          onActiveRef.current(index === -1 ? null : (PROFILES[index].domain as Topic));
        }
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [supported, still]);

  /*
   * No WebGL: the SVG item-characteristic curve instead.
   *
   * A fallback rather than an empty box, and specifically this fallback — it is
   * drawn from the same bank and makes the same argument, so the hero still has
   * a subject on a machine that cannot render the graph.
   */
  if (!supported) return <ItemCurvesPlot />;

  return (
    <div
      ref={hostRef}
      className="relative h-[clamp(23.75rem,46vw,35rem)] w-full"
      role="img"
      aria-label={`The item bank as a graph: a central core linked to ${PROFILES.length} domains — ${PROFILES.map((p) => `${p.domain}, ${p.itemCount} items`).join('; ')}.`}
    />
  );
}
