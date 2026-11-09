// Ripples on a pond inside the "Write to me" button.
// The button's face is dark water. Moving the pointer over it drops rings that
// spread and fade; when nobody's there, a gentle swell and the odd stray drop
// keep it alive. Only the slopes of the ripples catch a soft light. WebGL only:
// without it the button keeps its plain style. A still frame under
// prefers-reduced-motion.
(() => {
  const btn = document.querySelector('.contact-open');
  if (!btn) return;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power',
  });
  if (!gl) return;

  const MAX = 10; // ripples alive at once
  const vertex = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const fragment = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec3 u_drops[${MAX}]; // x, y in canvas pixels (y up), age in seconds (< 0: unused)

    float height(vec2 p) {
      float s = u_res.y;
      vec2 q = p / s;
      // A slow swell, barely there.
      float h = 0.06 * sin(q.x * 2.7 + u_time * 0.55) * sin(q.y * 2.1 - u_time * 0.4);
      for (int i = 0; i < ${MAX}; i++) {
        vec3 d = u_drops[i];
        if (d.z < 0.0) continue;
        float r = length(p - d.xy) / s;      // distance, in button heights
        float front = d.z * 0.75;            // the ring travels 0.75 heights a second
        float x = r - front;
        float ring = exp(-x * x * 9.0);      // a narrow band around the wavefront
        float fade = exp(-d.z * 1.1) / (1.0 + r * 1.5);
        h += ring * fade * sin(x * 22.0);
      }
      return h;
    }

    void main() {
      vec2 p = gl_FragCoord.xy;
      float h = height(p);
      float hx = height(p + vec2(1.0, 0.0)) - h;
      float hy = height(p + vec2(0.0, 1.0)) - h;
      vec3 n = normalize(vec3(-hx * 3.0, -hy * 3.0, 1.0));
      vec3 l = normalize(vec3(-0.4, 0.6, 0.7));
      float spec = pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 70.0);
      float tilt = dot(n, l) - l.z;            // 0 on flat water
      vec3 water = vec3(0.045, 0.075, 0.062);  // close to the cards' surface colour
      vec3 col = water + tilt * vec3(0.15, 0.29, 0.22) + spec * vec3(0.55, 0.78, 0.68);
      gl_FragColor = vec4(col, 1.0);
    }`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  const vs = shader(gl.VERTEX_SHADER, vertex);
  const fs = shader(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uDrops = gl.getUniformLocation(prog, 'u_drops');

  btn.prepend(canvas);
  btn.classList.add('liquid');

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 1, H = 1;
  function resize() {
    const r = btn.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W;   // resizing clears the canvas, so draw again
    canvas.height = H;
    gl.viewport(0, 0, W, H);
    kick();
  }

  // Ripples: where (in CSS pixels from the button's top left) and when they started.
  const drops = [];
  const now = () => performance.now() / 1000;
  function drop(x, y, at = now()) {
    drops.push({ x, y, at });
    if (drops.length > MAX) drops.shift();
  }

  let last = null;
  btn.addEventListener('pointermove', (e) => {
    if (still.matches) return;
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const t = now();
    // A new ring when the pointer has moved a little, at most every 140 ms.
    if (!last || (t - last.t > 0.14 && Math.hypot(x - last.x, y - last.y) > 6)) {
      drop(x, y, t);
      last = { x, y, t };
    }
    kick();
  });

  let onScreen = true;
  if (window.IntersectionObserver) {
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; kick(); }).observe(btn);
  }

  const data = new Float32Array(MAX * 3);
  const t0 = now();
  let raf = 0, nextStray = 0;

  function frame() {
    raf = 0;
    if (btn.hidden || document.hidden || !onScreen) return;
    const r = btn.getBoundingClientRect();
    let t = now();
    if (still.matches) {
      // One fixed moment: two rings, mid-spread.
      t = 100;
      drops.length = 0;
      drop(r.width * 0.3, r.height * 0.45, 99.1);
      drop(r.width * 0.72, r.height * 0.6, 98.4);
    } else if (t > nextStray) {
      // Now and then a stray drop lands somewhere on its own.
      if (nextStray) drop(r.width * (0.1 + 0.8 * Math.random()), r.height * (0.2 + 0.6 * Math.random()), t);
      nextStray = t + 1.8 + Math.random() * 2.2;
    }
    data.fill(-1);
    drops.forEach((d, i) => {
      data[i * 3] = d.x * dpr;
      data[i * 3 + 1] = (r.height - d.y) * dpr;
      data[i * 3 + 2] = t - d.at < 4.5 ? t - d.at : -1;
    });
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uTime, (t - t0) % 1000);
    gl.uniform3fv(uDrops, data);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!still.matches) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(btn);
  if (still.addEventListener) still.addEventListener('change', kick);
  document.addEventListener('visibilitychange', kick);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    canvas.remove();
    btn.classList.remove('liquid');
  });
})();
