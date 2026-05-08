import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qriDir = path.join(__dirname, '..', 'qri');
const rendersDir = path.join(qriDir, 'renders');
const qriOutDir = path.join(__dirname, '..', 'qri');

// Find latest System_Doc files
const files = fs.readdirSync(rendersDir);
const pdfFile = files.find(f => f.startsWith('QRI_System_Doc') && f.endsWith('.pdf'));
const htmlFile = files.find(f => f.startsWith('QRI_System_Doc') && f.endsWith('.html'));

if (!pdfFile || !htmlFile) {
  console.error('Error: No QRI_System_Doc files found in renders/');
  process.exit(1);
}

const pdfPath = path.join(rendersDir, pdfFile);
const htmlPath = path.join(rendersDir, htmlFile);

// Symlink or copy latest renders
const targetPdf = path.join(qriOutDir, 'system-doc.pdf');
const targetHtml = path.join(qriOutDir, 'system-doc.html');

if (fs.existsSync(targetPdf)) fs.unlinkSync(targetPdf);
if (fs.existsSync(targetHtml)) fs.unlinkSync(targetHtml);

try {
  fs.symlinkSync(pdfPath, targetPdf, 'file');
  fs.symlinkSync(htmlPath, targetHtml, 'file');
} catch (e) {
  fs.copyFileSync(pdfPath, targetPdf);
  fs.copyFileSync(htmlPath, targetHtml);
}

// Generate index.html
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ORI — Optical Resonator Inference</title>
  <meta name="description" content="A coherent all-optical resonator that learns and executes token inference from first principles. PTR glass holographic weight encoding at 850nm, 75M tok/s, 40dB SNR.">
  <link rel="stylesheet" href="../style.css">
  <style>
    #ori-header {
      margin-bottom: 2.5rem;
    }
    #ori-header h1 {
      font-size: clamp(2rem, 5vw, 2.8rem);
      margin-bottom: 0.5rem;
    }
    .ori-meta {
      color: var(--muted);
      font-family: var(--font-mono);
      font-size: 0.82rem;
      letter-spacing: 0.02em;
    }
    .ori-meta span {
      display: inline-block;
      margin-right: 1.5rem;
    }
    #ori-intro {
      max-width: 62ch;
      margin-bottom: 2rem;
    }
    #ori-intro p {
      margin-bottom: 1rem;
    }
    .doc-links {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }
    .doc-link {
      font-family: var(--font-display);
      font-size: 0.97rem;
      font-weight: 600;
      color: var(--link);
      text-decoration: none;
      padding: 0.6rem 1.25rem;
      border: 1px solid var(--accent-dim);
      border-radius: 3px;
      transition: color 0.15s, border-color 0.15s, background-color 0.15s;
    }
    .doc-link:hover {
      color: var(--link-hover);
      border-color: var(--accent);
      background: oklch(18% 0.007 145);
    }
    .specs {
      margin-top: 2.5rem;
      padding: 1.5rem;
      border: 1px solid var(--border);
      background: var(--surface);
      max-width: 62ch;
    }
    .specs h3 {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: var(--accent);
    }
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1.5rem;
    }
    .spec-item {
      display: flex;
      flex-direction: column;
    }
    .spec-label {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
      margin-bottom: 0.25rem;
    }
    .spec-value {
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--link);
    }
    @media (max-width: 480px) {
      #ori-header h1 { font-size: 1.8rem; }
      .doc-links { flex-direction: column; }
      .doc-link { width: 100%; text-align: center; }
      .specs-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <nav class="breadcrumb" style="margin-bottom: 2rem;">
        <a href="/" style="color: var(--muted); text-decoration: none; font-size: 0.9rem;">← Jason Edelman</a>
      </nav>
    </header>

    <section id="ori-header">
      <h1>ORI</h1>
      <h2 style="font-family: var(--font-mono); font-size: 0.9rem; font-weight: 400; color: var(--muted); margin: 0 0 0.75rem;">Optical Resonator Inference</h2>
      <div class="ori-meta">
        <span>Photonics</span>
        <span>Computing</span>
        <span>In Progress</span>
      </div>
    </section>

    <section id="ori-intro">
      <p>
        A Fabry-Perot holographic resonator is an exact physical RNN. The refractive index
        distribution of a PTR glass medium encodes model weights as holographic gratings.
        T=100 round trips through the cavity compute the T-th power of the round-trip
        operator — a weight-tied recurrent network derived from Maxwell's equations, not
        by analogy to digital systems.
      </p>
      <p>
        Architecture locked through ARCH-17. Full theoretical derivations complete.
        Phase 1 lab validation pending.
      </p>
      <div class="doc-links">
        <a href="./system-doc.pdf" class="doc-link">System Document (PDF)</a>
        <a href="./system-doc.html" class="doc-link">System Document (HTML)</a>
      </div>
    </section>

    <section class="specs">
      <h3>Locked Specifications</h3>
      <div class="specs-grid">
        <div class="spec-item">
          <span class="spec-label">Throughput</span>
          <span class="spec-value">75M tok/s</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Round Trips</span>
          <span class="spec-value">T = 100</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">SNR</span>
          <span class="spec-value">40 dB</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Spatial Modes</span>
          <span class="spec-value">512</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Wavelength</span>
          <span class="spec-value">850 nm</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Params / Expert</span>
          <span class="spec-value">1.254M</span>
        </div>
      </div>
    </section>

  </main>
</body>
</html>`;

fs.writeFileSync(path.join(qriOutDir, 'index.html'), indexHtml);
console.log('✓ ORI build complete');
console.log('  - Symlinked latest PDF:', pdfFile);
console.log('  - Symlinked latest HTML:', htmlFile);
console.log('  - Generated index.html');
