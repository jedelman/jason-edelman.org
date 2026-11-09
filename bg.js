// Dappled light through conifers: a very faint WebGL background for the homepage.
// Drawn only where WebGL runs; one still frame under prefers-reduced-motion.
// No dependencies. The canvas sits behind everything (style.css, #bg).
(() => {
  const STRENGTH = 0.15; // peak opacity of the warm light (Jason picked 0.15; 0.06 was invisible on real screens)
  const SCALE = 0.3;     // the light is soft, so a small buffer the browser upscales is enough
  const FPS = 30;

  const canvas = document.createElement('canvas');
  canvas.id = 'bg';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', {
    alpha: true, premultipliedAlpha: true, antialias: false,
    depth: false, stencil: false, powerPreference: 'low-power',
  });
  if (!gl) return;

  const vertex = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const fragment = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_strength;

    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = mat2(1.6, 1.2, -1.2, 1.6) * p;
        a *= 0.5;
      }
      return v;
    }
    vec2 hash2(vec2 p) {
      return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
    }

    // Sunflecks: each gap in the canopy throws a soft, roughly round image of the sun,
    // a little stretched because the light comes in at an angle. One per grid cell at
    // most; its centre drifts with the wind and it twinkles as needles cross it.
    float flecks(vec2 p, float t, vec2 sway) {
      vec2 i = floor(p), f = fract(p);
      float v = 0.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 h = hash2(i + g);
          vec2 c = g + 0.5 + 0.3 * sin(6.2831 * h + t * 0.25 * (0.5 + h)) + sway;
          float r = mix(0.14, 0.36, h.x);
          float d = length((f - c) * vec2(1.0, 1.35));
          float twinkle = 0.7 + 0.3 * sin(t * (0.7 + h.x) + 6.2831 * h.y);
          float present = step(0.42, h.y);
          v = max(v, present * smoothstep(r, r * 0.3, d) * twinkle * mix(0.55, 1.0, h.y));
        }
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res.y;
      float t = u_time;
      // Wind: a slow sway made of two unrelated periods, so it never visibly loops.
      vec2 sway = vec2(sin(t * 0.21) + 0.5 * sin(t * 0.53 + 1.3),
                       cos(t * 0.17) + 0.5 * sin(t * 0.41)) * 0.02;
      // Where the canopy thins, light gets through; elsewhere it's dense and dark.
      float thin = smoothstep(0.38, 0.62, fbm(uv * 1.3 + vec2(0.0, t * 0.003)));
      float small = flecks(uv * 10.0, t, sway * 3.0);
      float large = flecks(uv * 4.6 + 7.3, t * 0.7, sway * 1.5);
      // Fine needle sprays, stretched sideways like hanging fir boughs, break the light up.
      float needles = smoothstep(0.32, 0.62, fbm(uv * vec2(13.0, 24.0) + sway * 4.0));
      float light = thin * max(small * 0.8, large) * mix(0.5, 1.0, needles);
      // A passing cloud now and then.
      float clouds = 0.8 + 0.2 * sin(t * 0.045);
      float a = light * clouds * u_strength;
      gl_FragColor = vec4(vec3(1.0, 0.93, 0.76) * a, a);
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

  // One triangle that covers the screen.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  gl.uniform1f(gl.getUniformLocation(prog, 'u_strength'), STRENGTH);

  function draw(seconds) {
    const w = Math.max(1, Math.round(innerWidth * SCALE));
    const h = Math.max(1, Math.round(innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const STILL_AT = 40; // the moment a still frame shows
  const t0 = performance.now();
  let raf = 0, last = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    last = now;
    draw(STILL_AT + (now - t0) / 1000);
  }

  function start() {
    cancelAnimationFrame(raf);
    draw(STILL_AT);
    if (!still.matches) raf = requestAnimationFrame(frame);
  }

  document.body.prepend(canvas);
  start();
  if (still.addEventListener) still.addEventListener('change', start);
  addEventListener('resize', () => { if (still.matches) draw(STILL_AT); });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    canvas.remove();
  });
  requestAnimationFrame(() => canvas.classList.add('on'));
})();
