"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";

const VERT = /* glsl */ `
  attribute float aRand;
  uniform float uTime, uScan, uSize, uDpr;
  varying float vRand, vBand, vSeen;
  void main() {
    vec3 p = position * (1.0 + 0.025 * sin(uTime * 0.9 + aRand * 6.2831));
    vec4 world = modelMatrix * vec4(p, 1.0);
    vBand = smoothstep(0.32, 0.0, abs(world.y - uScan));
    vSeen = step(uScan, world.y);
    vRand = aRand;
    vec4 mv = viewMatrix * world;
    gl_PointSize = uSize * uDpr * (1.0 + vBand * 1.6) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const FRAG = /* glsl */ `
  uniform vec3 uInk, uFalse, uTrue;
  varying float vRand, vBand, vSeen;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    vec3 c = uInk;
    float a = 0.38;
    if (vSeen > 0.5) { c = vRand < 0.3 ? uFalse : uTrue; a = vRand < 0.3 ? 0.95 : 0.55; }
    c = mix(c, uFalse, vBand * 0.8);
    a = max(a, vBand);
    gl_FragColor = vec4(c, a * smoothstep(0.5, 0.25, d));
  }`;

const css = (name: string) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());

/** "A forward spreading through a network, scanned claim by claim." Points above the scan line are revealed true/false. */
export default function ForwardGlobe({ className = "" }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = innerWidth < 768;
    const N = small ? 900 : 1700;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const dpr = Math.min(devicePixelRatio, 1.75);
    renderer.setPixelRatio(dpr);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0, 9.2);

    // Fibonacci sphere with jitter: evenly spread "people" in a network.
    const pos = new Float32Array(N * 3), rand = new Float32Array(N);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      const R = 2.3 + (Math.random() - 0.5) * 0.18;
      pos.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
      rand[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));

    const uniforms = {
      uTime: { value: 0 }, uScan: { value: 3 }, uSize: { value: small ? 34 : 30 }, uDpr: { value: dpr },
      uInk: { value: css("--ink") }, uFalse: { value: css("--signal") }, uTrue: { value: css("--ok") },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false });
    const group = new THREE.Group();
    group.add(new THREE.Points(geo, mat));

    // Share edges: M random nodes each link to their 2 nearest neighbours.
    // ponytail: O(M²) nearest search once at mount; fine for M=360.
    const M = 360, pick = Array.from({ length: M }, () => Math.floor(Math.random() * N)), seg: number[] = [];
    const at = (k: number) => pos.slice(pick[k] * 3, pick[k] * 3 + 3);
    for (let i = 0; i < M; i++) {
      const a = at(i), best = [[Infinity, -1], [Infinity, -1]];
      for (let j = 0; j < M; j++) {
        if (i === j) continue;
        const b = at(j), d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
        if (d < best[1][0]) { best[1] = [d, j]; best.sort((x, y) => x[0] - y[0]); }
      }
      for (const [, j] of best) seg.push(...a, ...at(j));
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: uniforms.uInk.value, transparent: true, opacity: 0.12 });
    group.add(new THREE.LineSegments(lineGeo, lineMat));
    group.rotation.z = 0.18;
    scene.add(group);

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      // Back the camera off when the box is narrower than tall, so the sphere (radius ~2.6 incl. wobble) never clips sideways.
      camera.position.z = Math.max(9.2, 2.9 / (Math.tan(THREE.MathUtils.degToRad(19)) * camera.aspect));
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Scan sweeps down (reveal) then back up (reset), forever.
    const scan = gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
      .to(uniforms.uScan, { value: -2.7, duration: 4.5, ease: "power1.inOut" })
      .to(uniforms.uScan, { value: 2.7, duration: 2.4, ease: "power2.inOut", delay: 1.4 });

    const tiltX = gsap.quickTo(group.rotation, "x", { duration: 1.2, ease: "power3" });
    const tiltZ = gsap.quickTo(group.rotation, "z", { duration: 1.2, ease: "power3" });
    const onMove = (e: PointerEvent) => {
      tiltX((e.clientY / innerHeight - 0.5) * 0.5);
      tiltZ(0.18 - (e.clientX / innerWidth - 0.5) * 0.3);
    };
    addEventListener("pointermove", onMove);

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);

    const render = (t: number) => {
      if (!visible) return;
      uniforms.uTime.value = t;
      group.rotation.y = t * 0.12;
      renderer.render(scene, camera);
    };
    if (reduce) {
      scan.pause();
      uniforms.uScan.value = 0.4;
      renderer.render(scene, camera);
    } else {
      gsap.ticker.add(render);
    }
    gsap.fromTo(renderer.domElement, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 1.8, ease: "expo.out" });

    return () => {
      gsap.ticker.remove(render);
      scan.kill();
      removeEventListener("pointermove", onMove);
      ro.disconnect();
      io.disconnect();
      geo.dispose(); lineGeo.dispose(); mat.dispose(); lineMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} aria-hidden className={`[&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full ${className}`} />;
}
