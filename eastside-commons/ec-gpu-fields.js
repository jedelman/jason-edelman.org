// ec-gpu-fields.js
// WebGL2 field pipeline for the Eastside Commons solver.
// Seven semantic buffers: SOCIAL, COMFORT, WILD, BUILT_HEIGHT (F0),
//                         MOVEMENT.xy, WALL (F1),
//                         INTEREST.xyz (F2)
// Each pattern has its own per-pattern buffer (trace/debug).
//
// Usage:
//   const gpu = new ECGpuFields(offscreenCanvas, width, height);
//   gpu.init(icUniforms);          // paint initial conditions
//   gpu.runPattern(shaderSrc, uniforms); // detector + modulator
//   gpu.runInvariant();            // re-assert constraints
//   const snap = gpu.readback();   // Float32Array per channel

'use strict';

class ECGpuFields {
  constructor(canvas, width, height) {
    this.canvas = canvas;
    this.W = width;   // cells
    this.H = height;  // cells
    this.gl = null;
    this.progs = {};   // compiled shader programs, keyed by source hash
    this.textures = {};
    this.fbos = {};
    this._ready = false;
    this._log = [];
  }

  // ── Initialise WebGL2 context and allocate all textures ────────────────
  init(icUniforms) {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false, depth: false, stencil: false,
      antialias: false, preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;

    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) throw new Error('EXT_color_buffer_float not available');

    // Resize canvas
    this.canvas.width  = this.W;
    this.canvas.height = this.H;
    gl.viewport(0, 0, this.W, this.H);

    // Allocate field textures (ping-pong pairs for F0, F1, F2)
    // F0: SOCIAL(r), COMFORT(g), WILD(b), BUILT_HEIGHT(a)
    // F1: MOVEMENT.x(r), MOVEMENT.y(g), WALL(b), spare(a)
    // F2: INTEREST.x(r), INTEREST.y(g), INTEREST.z(b), spare(a)
    for (const name of ['F0','F1','F2']) {
      this.textures[name+'_A'] = this._makeRGBA32F();
      this.textures[name+'_B'] = this._makeRGBA32F();
      this.fbos[name+'_B']     = this._makeFBO(this.textures[name+'_B']);
    }

    // Wall-distance texture (single channel, precomputed each pass)
    this.textures['WALL_DIST'] = this._makeR32F();
    this.fbos['WALL_DIST']     = this._makeFBO(this.textures['WALL_DIST']);

    // EDA mask and sponge mask (R8, static)
    this.textures['EDA_MASK']    = this._makeR8();
    this.textures['SPONGE_MASK'] = this._makeR8();
    this.textures['SDF']         = this._makeR32F(); // signed distance to EDA edge

    // Activity node proximity (R32F, static) — for four-story limit invariant
    this.textures['NODE_PROX']   = this._makeR32F();

    // Per-pattern buffers (one per pattern id, R32F)
    // Allocated on demand in runPattern()
    this._patternBufs = {}; // id → {tex, fbo}

    // Compile core shaders
    this._compileCore();

    // Paint initial conditions
    this._paintIC(icUniforms);

    this._ready = true;
    this._log.push('ECGpuFields ready');
    return this;
  }

  // ── Run one pattern (detector pass → modulator pass) ──────────────────
  // patternId: number
  // detectSrc: GLSL fragment source for detector
  // modulateSrc: GLSL fragment source for modulator
  // uniforms: { name: value } — floats, vec2s, etc.
  runPattern(patternId, detectSrc, modulateSrc, uniforms = {}) {
    const gl = this.gl;

    // Ensure per-pattern buffer exists
    if (!this._patternBufs[patternId]) {
      const tex = this._makeR32F();
      const fbo = this._makeFBO(tex);
      this._patternBufs[patternId] = { tex, fbo };
    }
    const { tex: patTex, fbo: patFbo } = this._patternBufs[patternId];

    // ── Detector pass: reads F0/F1/F2 _A, writes to pattern buffer ──
    const detectProg = this._getProgram('detect_' + patternId, detectSrc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, patFbo);
    gl.useProgram(detectProg);
    this._bindFieldUniforms(detectProg, uniforms, null); // no pattern tex needed
    this._fullscreenQuad();

    // ── Modulator pass: reads F0/F1/F2 _A + pattern buf, writes _B ──
    const modulateProg = this._getProgram('modulate_' + patternId, modulateSrc);
    // Write all three field outputs simultaneously via MRT
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.useProgram(modulateProg);
    this._bindFieldUniforms(modulateProg, uniforms, patTex);
    // Copy _A → _B first (so unmodified channels persist)
    this._copyFields();
    // Then run modulator (additive into _B via gl.blendEquation(gl.FUNC_ADD))
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE); // additive blend
    this._fullscreenQuad();
    gl.disable(gl.BLEND);

    // Swap _B → _A for next pattern
    this._swapFields();
  }

  // ── Run invariant constraints ─────────────────────────────────────────
  runInvariant() {
    const gl = this.gl;
    const prog = this.progs['invariant'];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.useProgram(prog);
    this._bindFieldUniforms(prog, {}, null);
    // Invariant overwrites (no blend)
    gl.disable(gl.BLEND);
    this._fullscreenQuad();
    this._swapFields();
  }

  // ── Recompute wall-distance texture from current WALL channel ─────────
  // Uses iterative flood-fill (jump flooding algorithm approximation)
  runWallDistance() {
    const gl = this.gl;
    const prog = this.progs['wall_dist'];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['WALL_DIST']);
    gl.useProgram(prog);
    this._bindStdUniforms(prog);
    const loc = gl.getUniformLocation(prog, 'uF1');
    gl.uniform1i(loc, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures['F0_A']); // F1 is in slot 1
    this._fullscreenQuad();
  }

  // ── Read back all field values (for JS-side use) ──────────────────────
  readback() {
    const gl = this.gl;
    const buf = new Float32Array(this.W * this.H * 4);
    const result = {};

    // Readback F0
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._makeReadFBO(this.textures['F0_A']));
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, buf);
    result.social       = buf.filter((_,i) => i%4===0);
    result.comfort      = buf.filter((_,i) => i%4===1);
    result.wild         = buf.filter((_,i) => i%4===2);
    result.built_height = buf.filter((_,i) => i%4===3);

    // Readback F1
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._makeReadFBO(this.textures['F1_A']));
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, buf);
    result.movement_x = buf.filter((_,i) => i%4===0);
    result.movement_y = buf.filter((_,i) => i%4===1);
    result.wall       = buf.filter((_,i) => i%4===2);

    // Readback F2
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._makeReadFBO(this.textures['F2_A']));
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, buf);
    result.interest_x = buf.filter((_,i) => i%4===0);
    result.interest_y = buf.filter((_,i) => i%4===1);
    result.interest_z = buf.filter((_,i) => i%4===2);

    return result;
  }

  // Read back a single per-pattern buffer
  readbackPattern(patternId) {
    const gl = this.gl;
    if (!this._patternBufs[patternId]) return null;
    const buf = new Float32Array(this.W * this.H);
    const fbo = this._makeReadFBO(this._patternBufs[patternId].tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.readPixels(0, 0, this.W, this.H, gl.RED, gl.FLOAT, buf);
    return buf;
  }

  // Upload a static mask texture (Uint8Array, single channel)
  uploadMask(name, data) {
    const gl = this.gl;
    const tex = this.textures[name];
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.W, this.H, 0,
                  gl.RED, gl.UNSIGNED_BYTE, data);
  }

  // ── Private: texture factories ─────────────────────────────────────────
  _makeRGBA32F() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.W, this.H, 0,
                  gl.RGBA, gl.FLOAT, null);
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.W, this.H, 0,
                  gl.RED, gl.FLOAT, null);
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.W, this.H, 0,
                  gl.RED, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  _makeFBO(tex) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, tex, 0);
    return fbo;
  }

  _makeReadFBO(tex) {
    // Ephemeral FBO for readback — not cached
    return this._makeFBO(tex);
  }

  // ── Private: shader compilation ────────────────────────────────────────
  _compileCore() {
    // Core shaders are imported from ec-gpu-shaders.js via self.EC_GPU_SHADERS
    const S = self.EC_GPU_SHADERS;
    if (!S) throw new Error('ec-gpu-shaders.js not loaded');
    this.progs['ic']        = this._compile(S.VERT, S.IC_FRAG);
    this.progs['invariant'] = this._compile(S.VERT, S.INVARIANT_FRAG);
    this.progs['wall_dist'] = this._compile(S.VERT, S.WALL_DIST_FRAG);
    this.progs['copy']      = this._compile(S.VERT, S.COPY_FRAG);
    // MRT FBO: attaches F0_B, F1_B, F2_B as draw buffers 0,1,2
    this._setupMRT();
  }

  _setupMRT() {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures['F0_B'], 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.textures['F1_B'], 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.textures['F2_B'], 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error('MRT FBO incomplete: ' + status.toString(16));
    this.fbos['MRT'] = fbo;
  }

  _getProgram(key, fragSrc) {
    if (!this.progs[key]) {
      this.progs[key] = this._compile(self.EC_GPU_SHADERS.VERT, fragSrc);
    }
    return this.progs[key];
  }

  _compile(vertSrc, fragSrc) {
    const gl = this.gl;
    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, vertSrc);
    gl.compileShader(vert);
    if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS))
      throw new Error('Vert shader: ' + gl.getShaderInfoLog(vert));

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, fragSrc);
    gl.compileShader(frag);
    if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS))
      throw new Error('Frag shader: ' + gl.getShaderInfoLog(frag));

    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error('Link: ' + gl.getProgramInfoLog(prog));

    // Set up fullscreen quad VAO once per program
    // (shared VAO actually — all programs use same geometry)
    return prog;
  }

  // ── Private: bind field textures + uniforms ────────────────────────────
  _bindFieldUniforms(prog, extras, patternTex) {
    const gl = this.gl;
    // Bind F0_A, F1_A, F2_A as textures 0,1,2
    const slots = [
      ['uF0', this.textures['F0_A']],
      ['uF1', this.textures['F1_A']],
      ['uF2', this.textures['F2_A']],
      ['uEdaMask',    this.textures['EDA_MASK']],
      ['uSpongeMask', this.textures['SPONGE_MASK']],
      ['uWallDist',   this.textures['WALL_DIST']],
      ['uNodeProx',   this.textures['NODE_PROX']],
    ];
    if (patternTex) slots.push(['uPattern', patternTex]);

    slots.forEach(([name, tex], i) => {
      const loc = gl.getUniformLocation(prog, name);
      if (loc !== null) {
        gl.uniform1i(loc, i);
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, tex);
      }
    });

    this._bindStdUniforms(prog);

    // Extra uniforms
    for (const [k, v] of Object.entries(extras)) {
      const loc = gl.getUniformLocation(prog, k);
      if (loc === null) continue;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (v instanceof Array && v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else if (v instanceof Array && v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
    }
  }

  _bindStdUniforms(prog) {
    const gl = this.gl;
    const res = gl.getUniformLocation(prog, 'uResolution');
    if (res) gl.uniform2f(res, this.W, this.H);
  }

  // ── Private: fullscreen quad ───────────────────────────────────────────
  _initQuad() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    // Two triangles covering clip space
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,  1,-1,  -1,1,
       1,-1,  1, 1,  -1,1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this._vao = vao;
  }

  _fullscreenQuad() {
    const gl = this.gl;
    if (!this._vao) this._initQuad();
    gl.bindVertexArray(this._vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Private: copy _A → _B for all three field textures ────────────────
  _copyFields() {
    const gl = this.gl;
    const prog = this.progs['copy'];
    gl.useProgram(prog);
    this._bindFieldUniforms(prog, {}, null);
    gl.disable(gl.BLEND);
    this._fullscreenQuad();
  }

  // ── Private: swap _A ↔ _B ─────────────────────────────────────────────
  _swapFields() {
    for (const name of ['F0','F1','F2']) {
      [this.textures[name+'_A'], this.textures[name+'_B']] =
      [this.textures[name+'_B'], this.textures[name+'_A']];
      // FBO always points to _B, so also remap
      if (this.fbos[name+'_B']) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[name+'_B']);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                gl.TEXTURE_2D, this.textures[name+'_B'], 0);
      }
    }
    // Also re-attach MRT to new _B textures
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures['F0_B'], 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.textures['F1_B'], 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.textures['F2_B'], 0);
  }

  // ── Private: paint initial conditions ─────────────────────────────────
  _paintIC(u) {
    const gl = this.gl;
    const prog = this.progs['ic'];
    // Clear all fields to zero first
    for (const name of ['F0_B','F1_B','F2_B']) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[name] || this._makeFBO(this.textures[name]));
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // Run IC shader into MRT _B
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos['MRT']);
    gl.useProgram(prog);
    this._bindFieldUniforms(prog, u, null);
    this._fullscreenQuad();
    this._swapFields(); // _B → _A so IC is now in _A
  }

  get log() { return this._log; }
}

// Export
if (typeof self !== 'undefined') self.ECGpuFields = ECGpuFields;
if (typeof module !== 'undefined') module.exports = ECGpuFields;
