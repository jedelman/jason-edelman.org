// ec-gpu-fields.js — WebGL2 field pipeline for Eastside Commons
// Seven semantic buffers: SOCIAL(r), COMFORT(g), WILD(b), BUILT_HEIGHT(a)  → F0
//                         MOVEMENT.x(r), MOVEMENT.y(g), WALL(b), spare(a)  → F1
//                         INTEREST.x(r), INTEREST.y(g), INTEREST.z(b), spare(a) → F2
// Plus: WALL_DIST (R32F), EDA_MASK/SPONGE_MASK (R8), NODE_PROX (R32F),
//       PID (R32F) — tracks which pattern last wrote BUILT_HEIGHT (for domPid)
// Per-pattern R32F debug buffers allocated on demand.

'use strict';

class ECGpuFields {
  constructor(canvas, width, height) {
    this.canvas = canvas;
    this.W = width;
    this.H = height;
    this.gl = null;
    this.progs = {};
    this.textures = {};
    this.fbos = {};
    this._patternBufs = {};
    this._vao = null;
    this._ready = false;
    this._log = [];
  }

  // ── Init: allocate textures, compile core shaders, paint ICs ──────────
  init(icUniforms) {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false, depth: false, stencil: false,
      antialias: false, preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;

    if (!gl.getExtension('EXT_color_buffer_float'))
      throw new Error('EXT_color_buffer_float not available');

    this.canvas.width  = this.W;
    this.canvas.height = this.H;
    gl.viewport(0, 0, this.W, this.H);

    // Ping-pong pairs for the three field textures
    for (const name of ['F0','F1','F2']) {
      this.textures[name+'_A'] = this._makeRGBA32F();
      this.textures[name+'_B'] = this._makeRGBA32F();
    }
    // PID texture: tracks which pattern last wrote BUILT_HEIGHT
    this.textures['PID_A'] = this._makeR32F();
    this.textures['PID_B'] = this._makeR32F();

    // Static single-pass textures
    this.textures['WALL_DIST']   = this._makeR32F();
    this.textures['EDA_MASK']    = this._makeR8();
    this.textures['SPONGE_MASK'] = this._makeR8();
    this.textures['NODE_PROX']   = this._makeR32F();

    // MRT FBO: writes F0_B, F1_B, F2_B, PID_B simultaneously
    this._setupMRT();
    // Wall-dist FBO
    this.fbos['WALL_DIST'] = this._makeFBO1(this.textures['WALL_DIST']);

    this._compileCore();
    // NOTE: _paintIC is called separately after uploadMask/uploadFloat
    // so that EDA_MASK/SPONGE_MASK/NODE_PROX are present when IC runs.
    this._icUniforms = icUniforms; // stash for paintIC()
    this._ready = true;
    this._log.push(`ECGpuFields ${this.W}×${this.H} ready (IC pending)`);
    return this;
  }

  // Call after all uploadMask / uploadFloat calls.
  paintIC() {
    this._paintIC(this._icUniforms || {});
  }

  // ── Run one pattern: detector → modulator → (caller runs invariant) ───
  runPattern(patternId, detectSrc, modulateSrc, uniforms = {}) {
    const gl = this.gl;

    if (!this._patternBufs[patternId]) {
      const tex = this._makeR32F();
      const fbo = this._makeFBO1(tex);
      this._patternBufs[patternId] = { tex, fbo };
    }
    const { tex: patTex, fbo: patFbo } = this._patternBufs[patternId];

    // ── Detector: reads _A fields, writes to pattern R32F buffer ──
    const detectProg = this._getProgram('detect_' + patternId, detectSrc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, patFbo);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(detectProg);
    this._bindAll(detectProg, uniforms, null);
    this._quad();

    // ── Modulator: copy _A→_B, then additive delta from pattern ──
    // Step 1: copy _A → _B (preserves all channels not touched by this pattern)
    const copyProg = this.progs['copy'];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(copyProg);
    this._bindAll(copyProg, {}, null);
    gl.disable(gl.BLEND);
    this._quad();

    // Step 2: additive modulator delta on top of the copy
    const modulateProg = this._getProgram('modulate_' + patternId, modulateSrc);
    gl.useProgram(modulateProg);
    this._bindAll(modulateProg, uniforms, patTex);
    gl.enable(gl.BLEND);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    this._quad();
    gl.disable(gl.BLEND);

    // ── Swap _B → _A ──
    this._swap();
  }

  // ── Invariant: overwrite _B from _A with constraints applied, swap ────
  runInvariant(uniforms = {}) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.progs['invariant']);
    this._bindAll(this.progs['invariant'], uniforms, null);
    gl.disable(gl.BLEND);
    this._quad();
    this._swap();
  }

  // ── Diffuse: Gaussian spread of fields, respects EDA mask, swap ───────
  runDiffuse(uniforms = {}) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.progs['diffuse']);
    this._bindAll(this.progs['diffuse'], uniforms, null);
    gl.disable(gl.BLEND);
    this._quad();
    this._swap();
  }

  // ── Wall-distance: 7×7 kernel scan from current WALL channel ──────────
  runWallDistance(uniforms = {}) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['WALL_DIST']);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.progs['wall_dist']);
    this._bindAll(this.progs['wall_dist'], uniforms, null);
    gl.disable(gl.BLEND);
    this._quad();
    // WALL_DIST doesn't ping-pong — written in place, read next pass
  }

  // ── Upload static mask (Uint8Array, single channel) ───────────────────
  uploadMask(name, data) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.textures[name]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.W, this.H, 0,
                  gl.RED, gl.UNSIGNED_BYTE, data);
  }

  // Upload float texture (Float32Array, single channel)
  uploadFloat(name, data) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.textures[name]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.W, this.H, 0,
                  gl.RED, gl.FLOAT, data);
  }

  // ── Readback all field values ──────────────────────────────────────────
  readback() {
    const gl = this.gl;
    const buf = new Float32Array(this.W * this.H * 4);
    const R = {};

    const readTex = (tex, dst) => {
      const fbo = this._makeFBO1(tex);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, buf);
      gl.deleteFramebuffer(fbo);
      const n = this.W * this.H;
      dst[0] = new Float32Array(n); dst[1] = new Float32Array(n);
      dst[2] = new Float32Array(n); dst[3] = new Float32Array(n);
      for (let i=0; i<n; i++) {
        dst[0][i]=buf[i*4]; dst[1][i]=buf[i*4+1];
        dst[2][i]=buf[i*4+2]; dst[3][i]=buf[i*4+3];
      }
    };

    const f0=[]; readTex(this.textures['F0_A'], f0);
    R.social=f0[0]; R.comfort=f0[1]; R.wild=f0[2]; R.built_height=f0[3];

    const f1=[]; readTex(this.textures['F1_A'], f1);
    R.movement_x=f1[0]; R.movement_y=f1[1]; R.wall=f1[2];

    const f2=[]; readTex(this.textures['F2_A'], f2);
    R.interest_x=f2[0]; R.interest_y=f2[1]; R.interest_z=f2[2];

    // PID readback (single channel)
    const pidbuf = new Float32Array(this.W * this.H);
    const pidfbo = this._makeFBO1(this.textures['PID_A']);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pidfbo);
    gl.readPixels(0, 0, this.W, this.H, gl.RED, gl.FLOAT, pidbuf);
    gl.deleteFramebuffer(pidfbo);
    R.pid = pidbuf;

    return R;
  }

  // Readback a single per-pattern detector buffer
  readbackPattern(patternId) {
    const gl = this.gl;
    if (!this._patternBufs[patternId]) return null;
    const buf = new Float32Array(this.W * this.H);
    const fbo = this._makeFBO1(this._patternBufs[patternId].tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.readPixels(0, 0, this.W, this.H, gl.RED, gl.FLOAT, buf);
    gl.deleteFramebuffer(fbo);
    return buf;
  }

  get log() { return this._log; }

  // ── Private: texture factories ─────────────────────────────────────────
  _makeRGBA32F() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.W, this.H, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  _makeR32F() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.W, this.H, 0, gl.RED, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  _makeR8() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.W, this.H, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  // Single-attachment FBO (for detector buffers and WALL_DIST)
  _makeFBO1(tex) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return fbo;
  }

  // ── Private: MRT FBO (F0_B, F1_B, F2_B, PID_B) ────────────────────────
  _setupMRT() {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures['F0_B'],  0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.textures['F1_B'],  0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.textures['F2_B'],  0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, this.textures['PID_B'], 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error('MRT FBO incomplete: 0x' + st.toString(16));
    this.fbos['MRT'] = fbo;
  }

  // ── Private: swap _A ↔ _B, re-attach MRT to new _B ────────────────────
  _swap() {
    for (const name of ['F0','F1','F2','PID']) {
      [this.textures[name+'_A'], this.textures[name+'_B']] =
      [this.textures[name+'_B'], this.textures[name+'_A']];
    }
    // Re-attach MRT to the new _B textures and re-declare draw buffers.
    // drawBuffers() is FBO state and some drivers reset it on framebufferTexture2D.
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures['F0_B'],  0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.textures['F1_B'],  0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.textures['F2_B'],  0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, this.textures['PID_B'], 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]);
  }

  // ── Private: compile shaders ───────────────────────────────────────────
  _compileCore() {
    const S = self.EC_GPU_SHADERS;
    if (!S) throw new Error('EC_GPU_SHADERS not loaded');
    try {
      this.progs['ic'] = this._compile(S.VERT, S.IC_FRAG);
      this._log.push('ic shader: OK');
    } catch(e) {
      this._log.push('ic shader FAILED: ' + e.message);
      throw e; // IC failure is fatal — rethrow so GPU path aborts cleanly
    }
    this.progs['invariant'] = this._compile(S.VERT, S.INVARIANT_FRAG);
    this.progs['wall_dist'] = this._compile(S.VERT, S.WALL_DIST_FRAG);
    this.progs['copy']      = this._compile(S.VERT, S.COPY_FRAG);
    this.progs['diffuse']   = this._compile(S.VERT, S.DIFFUSE_FRAG);
    try {
      this.progs['gain'] = this._compile(S.VERT, S.GAIN_FRAG);
      this._log.push('gain shader: OK');
    } catch(e) {
      this._log.push('gain shader FAILED: ' + e.message);
      this.progs['gain'] = null;
    }
    try {
      this.progs['decay'] = this._compile(S.VERT, S.DECAY_FRAG);
      this._log.push('decay shader: OK');
    } catch(e) {
      this._log.push('decay shader FAILED: ' + e.message);
      this.progs['decay'] = null;
    }
    // Log all compiled shader statuses for debugging
    this._log.push('shaders: ' + Object.entries(this.progs)
      .filter(([,v])=>v!==null&&typeof v!=='undefined')
      .map(([k])=>k).join(' '));
  }

  _getProgram(key, fragSrc) {
    if (!this.progs[key]) this.progs[key] = this._compile(self.EC_GPU_SHADERS.VERT, fragSrc);
    return this.progs[key];
  }

  _compile(vertSrc, fragSrc) {
    const gl = this.gl;
    const mkShader = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const err = gl.getShaderInfoLog(sh);
        // Include first 3 lines of source for context
        const lines = src.split('\n').slice(0,3).join(' | ');
        throw new Error(`Shader compile: ${err}\n  src[0:3]: ${lines}`);
      }
      return sh;
    };
    const vert = mkShader(gl.VERTEX_SHADER, vertSrc);
    const frag = mkShader(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vert); gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error('Link: ' + gl.getProgramInfoLog(prog));
    gl.deleteShader(vert); gl.deleteShader(frag);
    return prog;
  }

  // ── Private: bind all textures + uniforms ─────────────────────────────
  // Handles scalars, vec2, vec3, and typed arrays (float[], vec2[])
  _bindAll(prog, extras, patternTex) {
    const gl = this.gl;
    const slots = [
      ['uF0',         this.textures['F0_A']],
      ['uF1',         this.textures['F1_A']],
      ['uF2',         this.textures['F2_A']],
      ['uPID',        this.textures['PID_A']],
      ['uEdaMask',    this.textures['EDA_MASK']],
      ['uSpongeMask', this.textures['SPONGE_MASK']],
      ['uWallDist',   this.textures['WALL_DIST']],
      ['uNodeProx',   this.textures['NODE_PROX']],
    ];
    if (patternTex) slots.push(['uPattern', patternTex]);

    slots.forEach(([name, tex], unit) => {
      const loc = gl.getUniformLocation(prog, name);
      if (loc !== null) {
        gl.uniform1i(loc, unit);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
      }
    });

    // Resolution
    const res = gl.getUniformLocation(prog, 'uResolution');
    if (res) gl.uniform2f(res, this.W, this.H);

    // Extra uniforms — handle scalars, small vecs, and typed/plain arrays
    for (const [k, v] of Object.entries(extras)) {
      const loc = gl.getUniformLocation(prog, k);
      if (loc === null) continue;
      if (typeof v === 'number') {
        // Integer uniforms (uNumSeeds etc.) must use uniform1i
        if (k === 'uNumSeeds' || k.startsWith('uNum') || k.startsWith('uInt')) {
          gl.uniform1i(loc, Math.round(v));
        } else {
          gl.uniform1f(loc, v);
        }
      } else if (typeof v === 'boolean') {
        gl.uniform1i(loc, v ? 1 : 0);
      } else if (typeof v === 'object' && v !== null) {
        const arr = v instanceof Float32Array ? v : new Float32Array(v);
        const len = arr.length;
        // Detect type from uniform name suffix or length
        if (k === 'uNumSeeds' || k.startsWith('uNum')) {
          gl.uniform1i(loc, Math.round(arr[0] ?? v));
        } else if (k === 'uSeedPos' || (len % 2 === 0 && k.includes('Pos'))) {
          gl.uniform2fv(loc, arr);
        } else if (len === 2) {
          gl.uniform2fv(loc, arr);
        } else if (len === 3) {
          gl.uniform3fv(loc, arr);
        } else if (len === 4) {
          gl.uniform4fv(loc, arr);
        } else {
          gl.uniform1fv(loc, arr); // float array
        }
      }
    }
  }

  // ── Private: fullscreen quad ───────────────────────────────────────────
  _quad() {
    const gl = this.gl;
    if (!this._vao) {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1,-1, 1,-1, -1,1,
         1,-1, 1, 1, -1,1,
      ]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this._vao = vao;
    }
    gl.bindVertexArray(this._vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Gain/compression: normalize fields by JS-computed p95 gain ────────
  runGain(uniforms = {}) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.progs['gain']);
    this._bindAll(this.progs['gain'], uniforms, null);
    gl.disable(gl.BLEND);
    this._quad();
    this._swap();
  }

  // ── Per-pass decay: exponential decay of choice fields (social/movement/interest_z) ──
  // Call once at the top of each pass, before patterns fire.
  // uDecaySocial/Movement/Interest control how much prior history survives.
  runDecay(uniforms = {}) {
    if (!this.progs['decay']) return; // shader failed to compile — skip silently
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.progs['decay']);
    this._bindAll(this.progs['decay'], uniforms, null);
    gl.disable(gl.BLEND);
    this._quad();
    this._swap();
  }
  // ── Inject painted values additively into a field channel ─────────────
  // channel: 'social'|'wild'|'comfort'|'interest_z'|'built_height'
  // data: Float32Array gw*gh of values to ADD (clamped to [0,1])
  injectChannel(channel, data) {
    const gl = this.gl;
    const channelMap = {
      social:       { tex: 'F0_A', comp: 0 },
      comfort:      { tex: 'F0_A', comp: 1 },
      wild:         { tex: 'F0_A', comp: 2 },
      built_height: { tex: 'F0_A', comp: 3 },
      interest_z:   { tex: 'F2_A', comp: 2 },
    };
    const cm = channelMap[channel];
    if (!cm) return;
    // Read current RGBA, add data to component, re-upload
    const readFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, readFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[cm.tex], 0);
    const fullBuf = new Float32Array(this.W * this.H * 4);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, fullBuf);
    gl.deleteFramebuffer(readFbo);
    for (let i = 0; i < this.W * this.H; i++) {
      fullBuf[i*4 + cm.comp] = Math.min(1, fullBuf[i*4 + cm.comp] + (data[i]||0));
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textures[cm.tex]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.W, this.H, 0, gl.RGBA, gl.FLOAT, fullBuf);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  _paintIC(u) {
    const gl = this.gl;
    // Clear _B to zero
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Verify FBO is complete before drawing
    const fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (fboStatus !== gl.FRAMEBUFFER_COMPLETE) {
      this._log.push(`IC FBO incomplete before draw: 0x${fboStatus.toString(16)}`);
    }
    // Run IC shader
    gl.useProgram(this.progs['ic']);
    this._bindAll(this.progs['ic'], u, null);
    gl.disable(gl.BLEND);
    this._quad();
    // Check for WebGL errors immediately after draw
    const err = gl.getError();
    if (err !== gl.NO_ERROR) {
      this._log.push(`IC draw gl.getError: 0x${err.toString(16)}`);
    }
    this._swap(); // _B (IC result) → _A (read-ready for first pattern)
    this._log.push(`IC painted (${u.uNumSeeds ?? 0} seeds)`);
  }
}

if (typeof self   !== 'undefined') self.ECGpuFields = ECGpuFields;
if (typeof module !== 'undefined') module.exports   = ECGpuFields;
