import { useEffect, useRef } from "react";

/**
 * Shader WebGL "nebula / marmo" Street League (ispirato agli Animated Shader Background di 21st.dev).
 * - Tema notte: nebula scura con venature magenta luminose.
 * - Tema chiaro: marmo rosa su carta, coerente con lo sfondo originale.
 * Prestazioni: risoluzione ridotta, 30 fps, pausa fuori schermo / tab nascosta,
 * un solo frame statico con prefers-reduced-motion, fallback all'immagine se WebGL manca.
 */

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_night;
uniform float u_intensity;
uniform float u_octaves;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}
float fbm(vec2 p) {
  float f = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    if (float(i) >= u_octaves) break;
    f += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return f;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float t = u_time * 0.045;
  vec2 m = (u_mouse - 0.5) * 0.35;

  vec2 q = vec2(fbm(p * 0.85 + vec2(0.0, t)), fbm(p * 0.85 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(
    fbm(p * 0.95 + 2.2 * q + vec2(1.7, 9.2) + t * 1.2 + m),
    fbm(p * 0.95 + 2.2 * q + vec2(8.3, 2.8) - t)
  );
  float f = fbm(p * 0.8 + 2.4 * r);
  float veins = pow(1.0 - abs(f), 9.0);
  float cloud = smoothstep(-0.5, 0.8, f + 0.35 * length(r));

  vec3 ink = vec3(0.004, 0.039, 0.031);
  vec3 pink = vec3(0.894, 0.133, 0.471);
  vec3 pink2 = vec3(0.929, 0.482, 0.671);
  vec3 blush = vec3(0.961, 0.827, 0.867);
  vec3 paper = vec3(0.976);

  vec3 night = mix(ink, vec3(0.16, 0.02, 0.10), cloud);
  night = mix(night, pink * 0.85, clamp(veins * 1.1 + cloud * cloud * 0.28, 0.0, 1.0));
  night += pink2 * pow(veins, 3.0) * 0.5;

  vec3 light = mix(paper, blush, cloud * 0.65);
  light = mix(light, pink, clamp(veins * 0.75, 0.0, 1.0));

  vec3 col = mix(light, night, u_night);
  vec3 base = mix(paper, ink, u_night);
  float vig = smoothstep(1.25, 0.2, length(uv - 0.5) * 1.3);
  col = mix(col, base, (1.0 - vig) * 0.35);
  col = mix(base, col, u_intensity);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const isNightTheme = () => document.documentElement.dataset.theme === "night";

export function ShaderCanvas({
  className = "",
  intensity = 1,
  forceNight = false,
}: {
  className?: string;
  intensity?: number;
  forceNight?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      canvas.dataset.state = "unsupported";
      return undefined;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      canvas.dataset.state = "unsupported";
      return undefined;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      canvas.dataset.state = "unsupported";
      return undefined;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uMouse = gl.getUniformLocation(program, "u_mouse");
    const uNight = gl.getUniformLocation(program, "u_night");
    const uIntensity = gl.getUniformLocation(program, "u_intensity");
    const uOctaves = gl.getUniformLocation(program, "u_octaves");

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const small = window.matchMedia("(max-width: 760px)").matches;
    const finePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    const scale = small ? 0.33 : 0.45;
    gl.uniform1f(uIntensity, intensity);
    gl.uniform1f(uOctaves, small ? 3 : 4);

    let night = forceNight || isNightTheme() ? 1 : 0;
    let nightTarget = night;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const seed = Math.random() * 40;
    let visible = false;
    let frame = 0;
    let last = 0;
    const startedAt = performance.now();

    const resize = () => {
      const width = Math.max(1, Math.round(canvas.clientWidth * scale));
      const height = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const draw = (now: number) => {
      resize();
      night += (nightTarget - night) * 0.12;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, seed + (now - startedAt) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uNight, night);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (canvas.dataset.state !== "ready") canvas.dataset.state = "ready";
    };

    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      draw(now);
    };
    const start = () => {
      if (reduced) {
        night = nightTarget;
        draw(performance.now());
        return;
      }
      if (!frame && visible && !document.hidden)
        frame = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);

    const ro = new ResizeObserver(() => {
      if (reduced || !frame) draw(performance.now());
    });
    ro.observe(canvas);

    const themeObserver = new MutationObserver(() => {
      nightTarget = forceNight || isNightTheme() ? 1 : 0;
      if (reduced) draw(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const onPointer = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      mouse.tx = Math.min(
        1,
        Math.max(0, (event.clientX - box.left) / box.width),
      );
      mouse.ty =
        1 - Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    };
    if (finePointer && !reduced)
      window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [forceNight, intensity]);

  return (
    <canvas ref={ref} className={`sl-shader ${className}`} aria-hidden="true" />
  );
}
