import { useEffect, useRef } from 'react';

/**
 * Glowing particle field rendered with raw WebGL. All motion is computed in the
 * vertex shader from a per-particle seed, so the CPU only uploads one uniform set per frame.
 * Falls back silently (renders nothing) when WebGL is unavailable.
 */
const VERT = `
attribute vec4 aSeed;      // x, y: home position (0..1) · z: speed · w: phase
attribute vec2 aLook;      // x: size · y: color mix
uniform float uTime;
uniform vec2 uMouse;       // -1..1, y up
uniform vec2 uAspect;
uniform float uDpr;
varying float vAlpha;
varying float vMix;
void main() {
  float t = uTime * (0.02 + aSeed.z * 0.05);
  vec2 p = aSeed.xy;
  p.y = fract(p.y + t);                                   // slow rise, wrapping
  p.x += sin(uTime * 0.25 * aSeed.z + aSeed.w * 6.2831) * 0.035
       + sin(p.y * 6.2831 * 1.5 + aSeed.w * 9.0) * 0.012;  // lateral sway
  vec2 clip = p * 2.0 - 1.0;
  vec2 d = (clip - uMouse) * uAspect;
  float dist = length(d);
  float push = smoothstep(0.55, 0.0, dist);
  clip += normalize(d + 1e-4) * push * 0.16 * (0.4 + aSeed.z);  // swirl away from pointer
  gl_Position = vec4(clip, 0.0, 1.0);
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed.z * 1.6) + aSeed.w * 12.0);
  float edge = smoothstep(0.0, 0.12, p.y) * smoothstep(1.0, 0.82, p.y);  // fade at wrap seam
  vAlpha = twinkle * edge * (0.6 + push * 0.9);
  vMix = aLook.y;
  gl_PointSize = aLook.x * uDpr * (1.0 + push * 0.9);
}`;

const FRAG = `
precision mediump float;
varying float vAlpha;
varying float vMix;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float halo = pow(1.0 - d, 2.4);
  float core = smoothstep(0.28, 0.0, d);
  vec3 lime = vec3(0.80, 1.00, 0.48);
  vec3 mint = vec3(0.37, 0.88, 0.71);
  vec3 col = mix(lime, mint, vMix) + core * 0.6;
  gl_FragColor = vec4(col * (halo + core) * vAlpha, (halo + core) * vAlpha);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
  return sh;
}

export default function ParticleField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = window.innerWidth < 900 ? 600 : 1900;
    const seed = new Float32Array(count * 4), look = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
      const big = Math.random() < 0.08;
      look.set([big ? 10 + Math.random() * 10 : 3 + Math.random() * 5.5, Math.random()], i * 2);
    }
    const buffers: (WebGLBuffer | null)[] = [];
    const bind = (name: string, data: Float32Array, size: number) => {
      const buf = gl.createBuffer();
      buffers.push(buf);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    bind('aSeed', seed, 4); bind('aLook', look, 2);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uTime = u('uTime'), uMouse = u('uMouse'), uAspect = u('uAspect'), uDpr = u('uDpr');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);   // additive glow
    gl.clearColor(0, 0, 0, 0);

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uAspect, w / Math.max(w, h), h / Math.max(w, h));
      gl.uniform1f(uDpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const target = { x: 2, y: 2 }, cur = { x: 2, y: 2 };   // start off-screen: no push until the pointer moves
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const onLeave = () => { target.x = 2; target.y = 2; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    let raf = 0, start = performance.now(), running = true;
    const draw = (now: number) => {
      cur.x += (target.x - cur.x) * 0.08; cur.y += (target.y - cur.y) * 0.08;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, reduced ? 40 : (now - start) / 1000 + 40);
      gl.uniform2f(uMouse, cur.x, cur.y);
      gl.drawArrays(gl.POINTS, 0, count);
      if (running && !reduced) raf = requestAnimationFrame(draw);
    };
    const onVisibility = () => {
      running = !document.hidden;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      // Release GL objects but keep the context alive: StrictMode remounts reuse the same canvas.
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
