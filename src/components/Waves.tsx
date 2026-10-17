"use client";

import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

/*
 * Nappe de particules de la maquette : à gauche, l'onde de la voix (réagit au
 * niveau du micro) ; à droite, les lignes du « document » qui s'écrit.
 */

const VERTEX = `
  attribute float aRand;
  attribute float aLen;
  uniform float uTime;
  uniform float uLevel;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uGain;
  varying float vAlpha;
  varying vec3 vColor;

  vec3 teal = vec3(0.055, 0.627, 0.714);
  vec3 mint = vec3(0.655, 0.914, 0.655);
  vec3 lime = vec3(0.796, 0.910, 0.588);

  void main() {
    vec3 p = position;
    float x = p.x;
    float z = p.z;
    // 1 = voix (gauche), 0 = document (droite)
    float voice = smoothstep(0.45, -0.55, x);
    float env = 0.55 + 0.45 * sin(z * 3.1 + uTime * 0.4);
    float amp = (0.22 + uLevel * 0.95) * env;
    float w = sin(x * 5.5 + uTime * 1.5 + z * 2.4) * 0.55
            + sin(x * 12.0 - uTime * 2.2 + aRand * 6.28) * 0.28 * (0.6 + uLevel)
            + sin(x * 23.0 + uTime * 3.4 + z * 5.0) * 0.12 * uLevel;
    p.y += w * amp * voice;
    // lignes du « document » : légère respiration
    p.y += (1.0 - voice) * sin(uTime * 0.6 + z * 4.0) * 0.006;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (1.0 + voice * 0.35 + uLevel * voice * 0.8) / -mv.z;

    // couper chaque ligne de texte à sa propre longueur
    float cut = 1.0 - smoothstep(aLen - 0.02, aLen + 0.02, x);
    float fadeEdge = smoothstep(-1.15, -0.85, x);
    float depth = smoothstep(-1.4, 0.4, z);
    vAlpha = uGain * cut * fadeEdge * (0.25 + 0.75 * depth) * (0.55 + 0.45 * voice + 0.25 * uLevel * voice);

    float t = clamp((x + 1.0) * 0.5, 0.0, 1.0);
    vColor = mix(teal, mint, smoothstep(0.0, 0.55, t));
    vColor = mix(vColor, lime, smoothstep(0.55, 1.0, t));
  }
`;

const FRAGMENT = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.15, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

interface Props {
  level?: number;
  density?: number;
  tilt?: number;
  zoom?: number;
  gain?: number;
  size?: number;
  offsetX?: number;
  offsetY?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Waves({
  level = 0,
  density = 1,
  tilt = 0.32,
  zoom = 1,
  gain = 1,
  size = 9,
  offsetX = 0,
  offsetY = 0,
  className,
  style,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // pas de WebGL : le fond reste uni
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setClearColor(0, 0);
    el.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.1, 50);
    const cols = Math.round(200 * density);
    const rows = Math.round(34 * density);
    const n = cols * rows;
    const pos = new Float32Array(n * 3);
    const rand = new Float32Array(n);
    const len = new Float32Array(n);
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const z = -1.4 + (r / (rows - 1)) * 1.8;
      const lineLen = r % 7 === 6 ? 0.25 + Math.random() * 0.2 : 0.62 + Math.random() * 0.48;
      for (let c = 0; c < cols; c++) {
        pos[k * 3] = -1.2 + (c / (cols - 1)) * 2.4;
        pos[k * 3 + 1] = 0;
        pos[k * 3 + 2] = z;
        rand[k] = Math.random();
        len[k] = lineLen;
        k++;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aRand", new BufferAttribute(rand, 1));
    geo.setAttribute("aLen", new BufferAttribute(len, 1));
    const uniforms = {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uPixelRatio: { value: ratio },
      uSize: { value: size },
      uGain: { value: gain },
    };
    const mat = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const points = new Points(geo, mat);
    points.position.x = offsetX;
    points.position.y = offsetY;
    scene.add(points);

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const a = w / h;
      const dist = (a < 1 ? 3.6 : a > 3 ? 1.55 : 2.6) / zoom;
      camera.position.set(0, dist * Math.sin(tilt) + 0.15, dist * Math.cos(tilt) + 0.6);
      camera.lookAt(0, -0.05, -0.35);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(el);

    const mouse = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      mouse.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const dispose = () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };

    if (reduced) {
      uniforms.uTime.value = 2.2;
      uniforms.uLevel.value = 0.25;
      renderer.render(scene, camera);
      ro.disconnect();
      const ro2 = new ResizeObserver(() => {
        resize();
        renderer.render(scene, camera);
      });
      ro2.observe(el);
      return () => {
        ro2.disconnect();
        dispose();
      };
    }

    let raf = 0;
    let last = performance.now();
    let time = 0;
    let smooth = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (visible && !document.hidden) {
        time += dt;
        smooth += (levelRef.current - smooth) * Math.min(1, dt * 8);
        uniforms.uTime.value = time;
        uniforms.uLevel.value = smooth;
        points.rotation.y += (mouse.x * 0.08 - points.rotation.y) * 0.03;
        points.rotation.x += (mouse.y * 0.03 - points.rotation.x) * 0.03;
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      dispose();
    };
  }, [density, tilt, zoom, gain, size, offsetX, offsetY]);

  return <div ref={host} className={className} style={{ position: "absolute", inset: 0, zIndex: -1, ...style }} aria-hidden="true" />;
}
