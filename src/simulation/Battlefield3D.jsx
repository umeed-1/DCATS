/**
 * DCATS — Battlefield3D.jsx
 * Real-time Three.js battlefield: procedural skyline terrain + per-type drone
 * models (spinning rotors, nav lamps, engine glow, flight trails) + engagement
 * FX (interceptor streak → shockwave / fireball / smoke) + radar sweep.
 * Props: threats, selectedThreat, onSelect, onUnavailable, onReady, environment,
 * timeOfDay, simTime.
 * Plain three.js (no R3F) for minimal bundle/dependency risk.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createBattlefield, createThreatModel, makeGlowTexture, simToWorld, TYPE_TINT } from './SceneManager';
import { createVRViewer } from './VRViewer';

/** Feature-detect WebGL without constructing a renderer (never throws). */
export function webglAvailable() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function Battlefield3D({
  threats = [], selectedThreat = null, onSelect, onUnavailable = null, onReady = null,
  environment = 'urban', timeOfDay = 'night', simTime = 0,
  cameraView = 'free', onCameraViewChange = null, cameraRequest = null,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({ threats, selectedThreat, onSelect, simTime, onUnavailable, onReady });
  stateRef.current = { threats, selectedThreat, onSelect, simTime, onUnavailable, onReady };
  const presetRequestRef = useRef(null);
  /* The camera dock lives in the page's feed overlay (beside the REC stamp),
   * so the picked preset arrives as a prop. A fresh request object per pick
   * means re-selecting the active preset still re-centres the camera. */
  useEffect(() => {
    if (cameraRequest?.id) presetRequestRef.current = cameraRequest.id;
  }, [cameraRequest]);
  /* Presets can drop back to Orbit from inside the render loop — keep the
   * latest callback in a ref so that loop never holds a stale setter. */
  const viewChangeRef = useRef(onCameraViewChange);
  viewChangeRef.current = onCameraViewChange;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Graceful degradation: no WebGL (weak VM, RDP, old GPU) → tell the parent
    // the feed is unavailable instead of crashing the whole view.
    if (!webglAvailable()) {
      stateRef.current.onUnavailable?.();
      return;
    }

    const { scene, camera, tickers, glow: glowBase } = createBattlefield({ environment, timeOfDay });
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      stateRef.current.onUnavailable?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = timeOfDay === 'night' ? 0.9 : timeOfDay === 'dusk' ? 1.05 : 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    try { renderer.xr.setReferenceSpaceType('local-floor'); } catch { /* browser decides */ }

    const resize = () => {
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 420;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    // Containers can change size without a window resize event — entering
    // Full View stretches the viewport to the whole screen — so observe the
    // mount itself on top of the window listener.
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';

    // YouTube-VR-style immersive view: stereo rendering + head tracking from
    // the current desktop camera pose. The orbit rig is paused while the XR
    // session is presenting so the headset owns the view. The button stays
    // visible on desktop too, and explains when no headset is available.
    const vrViewer = createVRViewer({ renderer, mount });

    // Navigation hint pill — collapses to a small "?" chip on first
    // interaction or after 20 s; clicking the chip re-opens the cheatsheet.
    const HINT_TEXT = 'Drag to orbit  ·  Right-drag / Shift-drag to pan  ·  Scroll to zoom';
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(7, 17, 32, 0.78)', border: '1px solid rgba(0, 212, 255, 0.28)',
      color: '#9fd8ff', fontSize: '12px', letterSpacing: '0.02em',
      transition: 'opacity 0.7s ease', opacity: '0', whiteSpace: 'nowrap',
      fontFamily: 'inherit',
    });
    let hintTimer = null;
    let hintCollapsed = false;
    const expandHint = () => {
      if (!hintCollapsed) return;
      hintCollapsed = false;
      hint.textContent = HINT_TEXT;
      hint.title = '';
      Object.assign(hint.style, {
        padding: '6px 14px', width: 'auto', height: 'auto',
        borderRadius: '999px', pointerEvents: 'none', cursor: 'default',
      });
      hint.style.opacity = '1';
      clearTimeout(hintTimer);
      hintTimer = setTimeout(collapseHint, 20000);
    };
    const collapseHint = () => {
      hintCollapsed = true;
      hint.textContent = '?';
      hint.title = HINT_TEXT;
      Object.assign(hint.style, {
        padding: '0', width: '26px', height: '26px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        borderRadius: '50%', pointerEvents: 'auto', cursor: 'pointer',
      });
      clearTimeout(hintTimer);
    };
    hint.textContent = HINT_TEXT;
    Object.assign(hint.style, {
      padding: '6px 14px', borderRadius: '999px', pointerEvents: 'none', cursor: 'default',
    });
    hint.addEventListener('click', expandHint);
    mount.appendChild(hint);
    const showTimer = setTimeout(() => { hint.style.opacity = '1'; }, 60);
    const hideHint = () => collapseHint();
    hintTimer = setTimeout(collapseHint, 20000);

    // Radar sweep arm — starts due north (-Z) so it stays in phase with the 2D
    // PPI. It is a HUD overlay: depth testing would bury it under the relief.
    const sweepGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, -480),
    ]);
    const sweep = new THREE.Line(sweepGeo, new THREE.LineBasicMaterial({
      color: 0x00d4ff, transparent: true, opacity: 0.5,
      depthTest: false, depthWrite: false,
    }));
    sweep.renderOrder = 2;
    scene.add(sweep);

    // ---------------------------------------------------------------- FX system
    const fx = [];
    const runFx = (dt, now) => {
      for (let i = fx.length - 1; i >= 0; i--) {
        if (fx[i].update(dt, now)) {
          try { fx[i].dispose?.(); } catch { /* noop */ }
          fx.splice(i, 1);
        }
      }
    };

    const spawnParticles = (pos, color, { count = 24, speed = [10, 40], size = 5, life = 0.9, gravity = 22, drag = 0.99 } = {}) => {
      const positions = new Float32Array(count * 3);
      const vels = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const s = speed[0] + Math.random() * (speed[1] - speed[0]);
        vels[i * 3] = Math.sin(ph) * Math.cos(th) * s;
        vels[i * 3 + 1] = Math.abs(Math.cos(ph)) * s * 0.9;
        vels[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color, size, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      scene.add(pts);
      let age = 0;
      fx.push({
        update(dt) {
          age += dt;
          const arr = geo.attributes.position.array;
          for (let i = 0; i < count; i++) {
            vels[i * 3 + 1] -= gravity * dt;
            vels[i * 3] *= drag; vels[i * 3 + 1] *= drag; vels[i * 3 + 2] *= drag;
            arr[i * 3] += vels[i * 3] * dt;
            arr[i * 3 + 1] += vels[i * 3 + 1] * dt;
            arr[i * 3 + 2] += vels[i * 3 + 2] * dt;
          }
          geo.attributes.position.needsUpdate = true;
          mat.opacity = Math.max(0, 1 - age / life);
          return age >= life;
        },
        dispose() { scene.remove(pts); geo.dispose(); mat.dispose(); },
      });
    };

    const spawnSmoke = (pos) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(), color: 0x8b95a3, transparent: true, opacity: 0, depthWrite: false,
      }));
      const s0 = 12 + Math.random() * 10;
      sprite.scale.setScalar(s0);
      sprite.position.copy(pos);
      scene.add(sprite);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 18, 10 + Math.random() * 14, (Math.random() - 0.5) * 18);
      let age = 0;
      const life = 2.2 + Math.random() * 0.8;
      fx.push({
        update(dt) {
          age += dt;
          sprite.position.addScaledVector(vel, dt);
          sprite.scale.setScalar(s0 + age * 26);
          sprite.material.opacity = 0.24 * Math.max(0, Math.min(1, (age - 0.12) / 0.3)) * Math.max(0, 1 - age / life);
          return age >= life;
        },
        dispose() { scene.remove(sprite); sprite.material.dispose(); },
      });
    };

    const impactFX = (pos, color) => {
      // Flash
      const light = new THREE.PointLight(0xffa04a, 6000, 420, 2);
      light.position.copy(pos);
      scene.add(light);
      let lightAge = 0;
      fx.push({
        update(dt) { lightAge += dt; light.intensity = 6000 * Math.max(0, 1 - lightAge / 0.14); return lightAge >= 0.14; },
        dispose() { scene.remove(light); },
      });
      // Shockwave ring
      const ringGeo = new THREE.RingGeometry(6, 11, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffd9a0, transparent: true, opacity: 1,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pos);
      scene.add(ring);
      let ringAge = 0;
      fx.push({
        update(dt) {
          ringAge += dt;
          const k = ringAge / 0.75;
          ring.scale.setScalar(1 + k * 10);
          ringMat.opacity = Math.max(0, 1 - k);
          return k >= 1;
        },
        dispose() { scene.remove(ring); ringGeo.dispose(); ringMat.dispose(); },
      });
      // Fireball (bright core + hot cloud + amber cloud)
      spawnParticles(pos, new THREE.Color(0xfff3d8), {
        count: 18, speed: [8, 40], size: 15, life: 0.42, gravity: 10, drag: 0.98,
      });
      spawnParticles(pos, color.clone().lerp(new THREE.Color(0xffffff), 0.35), {
        count: 44, speed: [35, 110], size: 9, life: 1.0, gravity: 55, drag: 0.985,
      });
      spawnParticles(pos, new THREE.Color(0xff8a3c), {
        count: 50, speed: [12, 60], size: 11, life: 1.35, gravity: 40, drag: 0.99,
      });
      for (let i = 0; i < 7; i++) spawnSmoke(pos);
    };

    /* Interceptor flight: a homing shot that tracks the live marker for the
     * whole engage window. Progress is measured in sim seconds, so pausing the
     * training freezes the shot and the store resolves the kill on the same
     * tick the shot lands — the drone is only removed on impact. */
    const launchInterceptor = (threatId, color, startSim, duration) => {
      const from = new THREE.Vector3(0, 26, 0);
      const target = from.clone();
      const flight = Math.max(0.5, duration || 5);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(), color: 0xfff0c8, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sprite.scale.setScalar(18);
      sprite.position.copy(from);
      scene.add(sprite);
      const trailGeo = new THREE.BufferGeometry().setFromPoints([from.clone(), from.clone()]);
      const trailMat = new THREE.LineBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.9 });
      const trail = new THREE.Line(trailGeo, trailMat);
      trail.frustumCulled = false;
      scene.add(trail);
      fx.push({
        update() {
          // Re-home every frame: the target keeps flying until the kill tick.
          const live = markers.get(threatId);
          if (live) {
            target.set(live.position.x, live.position.y + (live.userData.cageLift ?? 0), live.position.z);
          }
          const st = stateRef.current.simTime ?? 0;
          const p = Math.min(1, Math.max(0, (st - startSim) / flight));
          const pos = from.clone().lerp(target, p);
          sprite.position.copy(pos);
          const arr = trailGeo.attributes.position.array;
          arr[3] = pos.x; arr[4] = pos.y; arr[5] = pos.z;
          trailGeo.attributes.position.needsUpdate = true;
          if (p < 1) return false;
          impactFX(target.clone(), color);
          // Fade the shot trail out on its own timeline.
          fx.push({
            update(dt) { trailMat.opacity -= dt * 1.6; return trailMat.opacity <= 0; },
            dispose() { scene.remove(trail); trailGeo.dispose(); trailMat.dispose(); },
          });
          return true;
        },
        dispose() { scene.remove(sprite); sprite.material.dispose(); },
      });
    };

    // ---------------------------------------------------------------- trails
    const TRAIL_MAX = 48;
    const createTrail = (color) => {
      const geo = new THREE.BufferGeometry();
      const arr = new Float32Array(TRAIL_MAX * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      geo.setDrawRange(0, 0);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.62, depthWrite: false,
      }));
      line.frustumCulled = false;
      scene.add(line);
      return { geo, arr, line, count: 0, lastT: -1 };
    };
    const pushTrail = (tr, p, st) => {
      // Sim time rewound ⇒ a new mission started: reset the trail instead of
      // drawing a line from the previous run's last point.
      const rewound = tr.lastT >= 0 && st < tr.lastT;
      if (rewound && tr.count) {
        tr.count = 0;
        tr.geo.setDrawRange(0, 0);
      }
      // Same-frame / frozen-clock (paused) guard — avoids pushing duplicate
      // points every render frame while the simulation is not advancing. The
      // rewind case above must still push the new mission's first point.
      if (!rewound && tr.lastT >= 0 && st - tr.lastT < 0.16) return;
      tr.lastT = st;
      if (tr.count < TRAIL_MAX) {
        tr.arr[tr.count * 3] = p.x; tr.arr[tr.count * 3 + 1] = p.y; tr.arr[tr.count * 3 + 2] = p.z;
        tr.count++;
      } else {
        tr.arr.copyWithin(0, 3);
        tr.arr[(TRAIL_MAX - 1) * 3] = p.x;
        tr.arr[(TRAIL_MAX - 1) * 3 + 1] = p.y;
        tr.arr[(TRAIL_MAX - 1) * 3 + 2] = p.z;
      }
      tr.geo.setDrawRange(0, tr.count);
      tr.geo.attributes.position.needsUpdate = true;
    };

    // ---------------------------------------------------------------- markers
    const markers = new Map();
    const seen = new Set();
    const engagementLaunched = new Set(); // threat ids whose interceptor is away

    const getMarker = (t) => {
      if (markers.has(t.id)) return markers.get(t.id);
      const tint = TYPE_TINT[t.type] || t.color || '#ff5348';
      const color = new THREE.Color(tint);
      const model = createThreatModel(t.type, tint, { glow: glowBase });
      model.group.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      // Visual centre of the airframe (meshes only — the engine-glow sprite
      // would inflate the box by its scale). The HUD capture square centres on
      // this point, not on the marker origin below the model, so the drone
      // sits mid-square instead of riding the top edge.
      model.group.updateMatrixWorld(true);
      const bodyBox = new THREE.Box3();
      model.group.traverse((object) => {
        if (object.isMesh) bodyBox.expandByObject(object);
      });
      const cageLift = bodyBox.isEmpty() ? 0 : (bodyBox.min.y + bodyBox.max.y) / 2;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(6, model.meta.ring - 1.8), model.meta.ring, 40),
        new THREE.MeshBasicMaterial({ color: 0x00e0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      const g = new THREE.Group();
      g.add(model.group, ring);
      g.userData = {
        rotors: model.rotors,
        lamps: model.lamps,
        glow: model.glow,
        glowBase,
        ring,
        trail: createTrail(color),
        cage: Math.max(6, model.meta.ring), // HUD capture-square radius (world units)
        cageLift, // world-Y offset of the airframe's visual centre vs. g.position
        __threatId: t.id,
      };
      scene.add(g);
      markers.set(t.id, g);
      return g;
    };

    const removeMarker = (id, g) => {
      scene.remove(g);
      const tr = g.userData.trail;
      if (tr) { scene.remove(tr.line); tr.geo.dispose(); tr.line.material.dispose(); }
      g.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      markers.delete(id);
      seen.delete(id);
      engagementLaunched.delete(id);
    };

    // ------------------------------------------------------------- HUD tags
    // Capture square + readout per visible track, projected from world to
    // screen and mirroring the 2D radar readout block. The transparent square
    // frames ("captures") the drone; the BRG/ALT/SPD/RNG block floats above
    // it, outside the square. Pure DOM (pointer-events off) so it plays with
    // the orbit camera for free.
    const tagLayer = document.createElement('div');
    Object.assign(tagLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    mount.appendChild(tagLayer);
    const tags = new Map(); // id -> { cage, box, row1, row2, tint }
    const tmpTag = new THREE.Vector3();
    const tmpTag2 = new THREE.Vector3();
    const tmpRight = new THREE.Vector3();
    const placedRects = []; // this frame's label rects (collision pass)
    const hideTag = (tag) => {
      tag.cage.style.display = 'none';
      tag.box.style.display = 'none';
      tag.rect = null;
      tag.hovered = false;
    };
    const removeTag = (id) => {
      const tag = tags.get(id);
      if (!tag) return;
      tagLayer.removeChild(tag.cage);
      tagLayer.removeChild(tag.box);
      tags.delete(id);
    };
    const getTag = (t) => {
      let tag = tags.get(t.id);
      if (tag) return tag;
      // Transparent white capture square that frames the drone itself.
      const cage = document.createElement('div');
      Object.assign(cage.style, {
        position: 'absolute', left: '0', top: '0',
        width: '46px', height: '46px', borderRadius: '3px',
        background: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.72)',
        display: 'none', willChange: 'left, top, width, height',
      });
      // Plain white readout (no background box) floating above the square.
      const box = document.createElement('div');
      const row1 = document.createElement('div');
      const row2 = document.createElement('div');
      Object.assign(box.style, {
        position: 'absolute', left: '0', top: '0',
        fontFamily: "ui-monospace, 'Roboto Mono', Consolas, monospace",
        fontSize: '10px', letterSpacing: '0.05em',
        color: 'rgba(255, 255, 255, 0.96)', whiteSpace: 'nowrap',
        // Dark halo instead of a panel — keeps white text legible over sky.
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.92), 0 0 7px rgba(0, 0, 0, 0.55)',
        display: 'none', willChange: 'left, top',
      });
      box.append(row1, row2);
      tagLayer.append(cage, box);
      tag = { cage, box, row1, row2, rect: null, hovered: false };
      tags.set(t.id, tag);
      return tag;
    };
    const updateTag = (t, g, hidden, selected) => {
      const tag = tags.get(t.id);
      if (hidden) { if (tag) hideTag(tag); return; }
      const tg = getTag(t);
      // Centre the square on the airframe's visual centre, not the marker
      // origin (which sits at the drone's feet / ground ring).
      const lift = g.userData.cageLift ?? 0;
      tmpTag.copy(g.position);
      tmpTag.y += lift;
      tmpTag.project(camera);
      // Off-screen or behind the camera → drop the tag this frame.
      if (Math.abs(tmpTag.x) > 1.05 || Math.abs(tmpTag.y) > 1.05 || tmpTag.z > 1) {
        hideTag(tg);
        return;
      }
      const w = mount.clientWidth || renderer.domElement.clientWidth || 640;
      const h = mount.clientHeight || renderer.domElement.clientHeight || 420;
      const px = (tmpTag.x * 0.5 + 0.5) * w;
      const py = (-tmpTag.y * 0.5 + 0.5) * h;

      // Capture square sized to the drone's projected extent (its ring radius
      // + margin), so the airframe stays framed at any zoom or distance.
      const cageR = g.userData.cage ?? 22;
      tmpTag2.copy(g.position);
      tmpTag2.y += lift;
      tmpTag2.addScaledVector(tmpRight.setFromMatrixColumn(camera.matrixWorld, 0), cageR);
      tmpTag2.project(camera);
      const rx = (tmpTag2.x * 0.5 + 0.5) * w - px;
      const ry = (-tmpTag2.y * 0.5 + 0.5) * h - py;
      const side = Math.round(Math.max(44, Math.hypot(rx, ry) * 2 + 16));
      const cx = Math.max(2, Math.min(w - side - 2, px - side / 2));
      const cy = Math.max(2, Math.min(h - side - 2, py - side / 2));
      tg.cage.style.display = 'block';
      tg.cage.style.width = `${side}px`;
      tg.cage.style.height = `${side}px`;
      tg.cage.style.left = `${cx.toFixed(1)}px`;
      tg.cage.style.top = `${cy.toFixed(1)}px`;
      tg.cage.style.boxShadow = selected ? '0 0 12px rgba(255, 255, 255, 0.42)' : 'none';
      tg.rect = { x1: cx, y1: cy, x2: cx + side, y2: cy + side };

      // Readout is cursor-driven: visible only while the console's pointer is
      // over this square, or once it is the selected (clicked) track.
      const showInfo = tg.hovered || selected;
      tg.box.style.display = showInfo ? 'block' : 'none';
      if (!showInfo) return;

      // Readout centered ABOVE the square, outside it (below when the square
      // is pinned to the top edge).
      const brg = String(Math.round((Math.atan2(t.x, -t.y) * 180 / Math.PI + 360) % 360)).padStart(3, '0');
      tg.row1.textContent = `BRG ${brg}°  ALT ${Math.max(0, Math.round(t.z))}M`;
      tg.row2.textContent = `SPD ${Math.round(Math.hypot(t.vx || 0, t.vy || 0) * 36)}KM/H  RNG ${Math.round(Math.hypot(t.x, t.y))}M  SIG ${Math.round((t.signal ?? 0) * 100)}%`;
      tg.box.style.display = 'block';
      const bw = tg.box.offsetWidth;
      const bh = tg.box.offsetHeight;
      let bx = Math.max(4, Math.min(w - bw - 4, px - bw / 2));
      let by = cy - bh - 6;
      if (by < 4) by = cy + side + 6;
      // Collision pass: labels between tracks can overlap; nudge upward (and
      // clamp in-frame) so every readout stays legible. Rects are per-frame
      // state, cleared just before the threat loop in animate().
      const overlaps = (x1, y1) => placedRects.some((r) => (
        x1 < r.x2 && x1 + bw > r.x1 && y1 < r.y2 && y1 + bh > r.y1
      ));
      let tries = 0;
      while (overlaps(bx, by) && tries < 5) { by -= bh + 6; tries += 1; }
      by = Math.max(4, Math.min(h - bh - 4, by));
      placedRects.push({ x1: bx, y1: by, x2: bx + bw, y2: by + bh });
      tg.box.style.left = `${bx.toFixed(1)}px`;
      tg.box.style.top = `${by.toFixed(1)}px`;
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickThreatAt = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...markers.values()], true);
      if (!hits.length) return;
      let obj = hits[0].object;
      while (obj && obj.userData.__threatId === undefined) obj = obj.parent;
      if (obj) stateRef.current.onSelect?.(obj.userData.__threatId);
    };

    // ------------------------------------------------- real 3D navigation
    // Blender/Unity-style feel: left-drag orbits (scene follows the cursor),
    // right-drag or Shift-drag pans, middle-drag orbits, wheel zooms with a
    // short damp. The cinematic auto-orbit resumes after 8 s of no input.
    // Preset views reuse the same spherical rig, so switching views is a
    // smooth damped move rather than a camera cut.
    const nav = {
      theta: 0, phi: 1.218, radius: 724, rTarget: 724,
      target: new THREE.Vector3(0, 80, 0), lastNav: -1e9,
      goalTheta: 0, goalPhi: 1.218, goalRadius: 724,
      goalTarget: new THREE.Vector3(0, 80, 0),
      mode: 'free',
      transitioning: false,
    };
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const shortestAngle = (from, to) => {
      const tau = Math.PI * 2;
      return ((to - from + Math.PI) % tau + tau) % tau - Math.PI;
    };
    const chaseThreat = () => {
      const { threats: ths = [], selectedThreat: sel } = stateRef.current;
      let fallback = null;
      for (const t of ths) {
        if (t.neutralised || t.visible === false) continue;
        if (t.id === sel) return t;
        if (!fallback || Math.hypot(t.x, t.y) < Math.hypot(fallback.x, fallback.y)) fallback = t;
      }
      return fallback;
    };
    const chasePoint = (t) => {
      const p = simToWorld(t);
      return new THREE.Vector3(p.x, p.y + 8, p.z);
    };
    const finishTransition = () => {
      nav.transitioning = false;
    };
    const applyCameraView = (view) => {
      let theta = nav.theta;
      let phi = nav.phi;
      let radius = nav.radius;
      const target = new THREE.Vector3(0, 80, 0);

      if (view === 'top') {
        theta = 0;
        phi = 0.22;
        radius = 920;
        target.set(0, 60, 0);
      } else if (view === 'chase') {
        const t = chaseThreat();
        phi = 1.36;
        radius = 220;
        if (t) {
          target.copy(chasePoint(t));
          const speed = Math.hypot(t.vx || 0, t.vy || 0);
          if (speed > 1) theta = Math.atan2(t.vx, t.vy) + Math.PI;
        }
      } else if (view === 'ground') {
        // Low oblique over the forward base — close enough that the base and
        // terrain fill the frame instead of the distant mountain silhouette.
        theta = 0.35;
        phi = 1.38;
        radius = 520;
        target.set(0, 60, 0);
      } else {
        // Free / default orbit. Selecting it from a preset restores the
        // overview before handing control back to the operator.
        theta = 0;
        phi = 1.218;
        radius = 724;
      }

      nav.mode = view;
      nav.transitioning = true;
      nav.goalTheta = nav.theta + shortestAngle(nav.theta, theta);
      nav.goalPhi = phi;
      nav.goalRadius = radius;
      nav.rTarget = radius;
      nav.goalTarget.copy(target);
      nav.lastNav = performance.now() / 1000;
    };
    const releaseCameraToFree = () => {
      nav.mode = 'free';
      nav.transitioning = false;
      nav.rTarget = nav.radius;
      viewChangeRef.current?.('free');
    };
    if (!presetRequestRef.current) viewChangeRef.current?.('free');
    const canvas = renderer.domElement;
    let drag = null;

    const onPointerDown = (e) => {
      const panMode = e.button === 2 || (e.button === 0 && e.shiftKey);
      const orbitMode = e.button === 0 || e.button === 1;
      if (!panMode && !orbitMode) return;
      e.preventDefault();
      drag = { id: e.pointerId, mode: panMode ? 'pan' : 'orbit', x: e.clientX, y: e.clientY, moved: 0 };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      clearTagHover(); // camera moves during a drag — hover rects go stale
      hideHint();
    };
    const clearTagHover = () => { for (const [, tg] of tags) tg.hovered = false; };
    const onPointerMove = (e) => {
      // HUD hover: which capture square (if any) holds the cursor. Rects come
      // from the last projected frame, so this costs a few viewport checks.
      if (!drag) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        for (const [, tg] of tags) {
          const r = tg.rect;
          tg.hovered = !!r && mx >= r.x1 && mx <= r.x2 && my >= r.y1 && my <= r.y2;
        }
      }
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 2) {
        nav.lastNav = performance.now() / 1000;
        if (nav.mode !== 'free' || nav.transitioning) releaseCameraToFree();
      }
      if (drag.mode === 'orbit') {
        nav.theta -= dx * 0.005;
        nav.phi = clamp(nav.phi - dy * 0.0035, 0.61, 1.5);
      } else {
        const h = mount.clientHeight || 420;
        const k = (nav.radius * 0.9) / h;
        const right = new THREE.Vector3(Math.cos(nav.theta), 0, -Math.sin(nav.theta));
        const fwd = new THREE.Vector3(-Math.sin(nav.theta), 0, -Math.cos(nav.theta));
        nav.target.addScaledVector(right, -dx * k);
        nav.target.addScaledVector(fwd, dy * k);
        nav.target.x = clamp(nav.target.x, -520, 520);
        nav.target.z = clamp(nav.target.z, -520, 520);
      }
    };
    const onPointerUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const wasClick = drag.mode === 'orbit' && drag.moved < 5;
      drag = null;
      canvas.style.cursor = 'grab';
      if (wasClick) pickThreatAt(e.clientX, e.clientY);
    };
    const onPointerCancel = () => { drag = null; canvas.style.cursor = 'grab'; };
    const onWheel = (e) => {
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      releaseCameraToFree();
      nav.rTarget = clamp(nav.rTarget * Math.exp(d * 0.0012), 280, 1600);
      nav.lastNav = performance.now() / 1000;
      hideHint();
    };
    const onContextMenu = (e) => e.preventDefault();

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', clearTagHover);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    // Mid-session GPU context loss (driver reset, RDP reconnect) → same fallback.
    const handleContextLost = (e) => {
      e.preventDefault();
      stateRef.current.onUnavailable?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    // ---------------------------------------------------------------- loop
    let lastNow = performance.now() / 1000;
    let prevSimTime = 0;
    /* Announce readiness after the first real frame — not when the renderer is
     * constructed — so the boot overlay never uncovers a blank canvas. */
    let readyAnnounced = false;

    const animate = () => {
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, Math.max(0, now - lastNow));
      lastNow = now;
      const { threats: ths, selectedThreat: sel, simTime: st } = stateRef.current;

      // Sim-time rewind ⇒ the mission was re-run. Track ids (t-0…t-N) are
      // reused, so per-run maps (seen cues, spawn FX edge, trails) must reset
      // or the new run inherits the previous run's state.
      if (st < prevSimTime) {
        seen.clear();
        engagementLaunched.clear();
        for (const [, g] of markers) {
          const tr = g.userData.trail;
          if (tr) { tr.count = 0; tr.geo.setDrawRange(0, 0); tr.lastT = -1; }
        }
      }
      prevSimTime = st;

      // The headset owns the camera while an immersive session is presenting.
      // Keep the desktop orbit rig frozen at its last pose so head tracking
      // behaves like a YouTube VR view instead of fighting the orbit controls.
      if (!renderer.xr.isPresenting) {
        // Camera presets requested by the overlay dock.
        if (presetRequestRef.current) {
          const requested = presetRequestRef.current;
          presetRequestRef.current = null;
          applyCameraView(requested);
        }

        // Chase keeps its look-at point and heading pinned to the selected
        // drone, so the camera follows the aircraft rather than the map.
        if (nav.mode === 'chase') {
          const t = chaseThreat();
          if (t) {
            nav.goalTarget.copy(chasePoint(t));
            const speed = Math.hypot(t.vx || 0, t.vy || 0);
            if (speed > 1) {
              const desired = Math.atan2(t.vx, t.vy) + Math.PI;
              nav.goalTheta += shortestAngle(nav.goalTheta, desired);
            }
          }
        }

        // Damped preset / follow move. Free mode stops damping once the
        // transition lands so pointer navigation has direct control.
        if (nav.transitioning || nav.mode === 'chase') {
          const k = 1 - Math.exp(-dt * 8);
          nav.theta += shortestAngle(nav.theta, nav.goalTheta) * k;
          nav.phi += (nav.goalPhi - nav.phi) * k;
          nav.target.lerp(nav.goalTarget, 1 - Math.exp(-dt * 6));
          if (
            nav.transitioning
            && Math.abs(shortestAngle(nav.theta, nav.goalTheta)) < 0.002
            && Math.abs(nav.goalPhi - nav.phi) < 0.002
            && Math.abs(nav.rTarget - nav.radius) < 0.6
            && nav.target.distanceToSquared(nav.goalTarget) < 0.6
          ) {
            finishTransition();
          }
        }
        // Cinematic auto-orbit only in Free mode, after 8 s of no input.
        if (nav.mode === 'free' && !nav.transitioning && now - nav.lastNav > 8) {
          nav.theta += dt * 0.036;
        }
        nav.radius += (nav.rTarget - nav.radius) * Math.min(1, dt * 12);
        const sp = Math.sin(nav.phi);
        camera.position.set(
          nav.target.x + nav.radius * sp * Math.sin(nav.theta),
          nav.target.y + nav.radius * Math.cos(nav.phi),
          nav.target.z + nav.radius * sp * Math.cos(nav.theta),
        );
        camera.lookAt(nav.target);
      }
      // The HUD tags project against fresh camera matrices, not the last frame.
      camera.updateMatrixWorld();

      for (const fn of tickers) fn(now);
      // 12 RPM (0.2 rev/s) — matches the 2D PPI sweep speed exactly.
      sweep.rotation.y = -(st * 1.2566) % (Math.PI * 2);

      const alive = new Set();
      placedRects.length = 0; // tag collision rects are per-frame state
      for (const t of ths) {
        if (t.neutralised) continue;
        alive.add(t.id);
        const p = simToWorld(t);
        const g = getMarker(t);
        const u = g.userData;
        const hidden = t.visible === false;
        g.position.set(p.x, hidden ? -60 : p.y, p.z);

        // Engage order in state ⇒ the homing shot is away. The marker keeps
        // flying and is only removed when the store resolves the kill.
        if (t.engaging && !engagementLaunched.has(t.id)) {
          engagementLaunched.add(t.id);
          launchInterceptor(
            t.id,
            new THREE.Color(t.color || '#FF3B3B'),
            t.engageStartedAt ?? st,
            (t.engageResolveAt ?? (st + 5)) - (t.engageStartedAt ?? st),
          );
        }

        // Selection ring pulse
        u.ring.material.opacity = sel === t.id ? 0.65 + 0.35 * Math.sin(now * 5) : 0;
        // Heading from velocity (models face +Z; world z = sim y)
        if (t.vx || t.vy) g.rotation.y = Math.atan2(t.vx, t.vy);
        // Nav lamps: steady or blinking
        for (const lamp of u.lamps) {
          const wave = lamp.rate ? 0.5 + 0.5 * Math.sin(st * lamp.rate + lamp.phase) : 1;
          lamp.mesh.material.emissiveIntensity = 0.3 + 0.9 * wave;
        }
        // Engine glow — dim pulse until the track is acquired
        u.glow.material.opacity = u.glowBase * (t.tracked ? 1 : 0.55 + 0.45 * Math.sin(st * 5 + p.x * 0.13));
        // Spinning rotors
        u.rotors.forEach((r, i) => { r.rotation.y = st * 46 * (i % 2 ? -1 : 1); });
        // Flight trail (reset on sensor dropout so the line reads "track lost")
        if (hidden) {
          if (u.trail.count) { u.trail.count = 0; u.trail.geo.setDrawRange(0, 0); }
        } else {
          pushTrail(u.trail, g.position, st);
        }
        // Spawn cue — fired on the drone's first *visible* frame, so tracks
        // that are still parked underground before their spawn time (or in a
        // sensor dropout) do not emit particles below the terrain.
        if (!hidden && !seen.has(t.id)) {
          seen.add(t.id);
          spawnParticles(g.position.clone(), new THREE.Color(t.color || '#FF3B3B'), {
            count: 24, speed: [14, 46], size: 4.5, life: 0.8, gravity: 16, drag: 0.97,
          });
        }
        updateTag(t, g, hidden, sel === t.id);
      }

      // Drop markers for threats gone from state
      for (const [id, g] of markers) {
        if (!alive.has(id)) { removeMarker(id, g); removeTag(id); }
      }

      runFx(dt, now);
      renderer.render(scene, camera);
      if (!readyAnnounced) {
        readyAnnounced = true;
        stateRef.current.onReady?.();
      }
    };
    renderer.setAnimationLoop(animate);

    window.addEventListener('resize', resize);
    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', clearTagHover);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      clearTimeout(showTimer);
      clearTimeout(hintTimer);
      hint.remove();
      tagLayer.remove();
      vrViewer.dispose();
      for (const f of fx) { try { f.dispose?.(); } catch { /* noop */ } }
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    };
  }, [environment, timeOfDay]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', minHeight: 420, borderRadius: 12, overflow: 'hidden', position: 'relative' }}
    />
  );
}
