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

// Remove old symlinks if they exist
if (fs.existsSync(targetPdf)) fs.unlinkSync(targetPdf);
if (fs.existsSync(targetHtml)) fs.unlinkSync(targetHtml);

// Create symlinks (or copy if on Windows)
try {
  fs.symlinkSync(pdfPath, targetPdf, 'file');
  fs.symlinkSync(htmlPath, targetHtml, 'file');
} catch (e) {
  // Fallback to copy on Windows or if symlink fails
  fs.copyFileSync(pdfPath, targetPdf);
  fs.copyFileSync(htmlPath, targetHtml);
}

// Generate index.html
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QRI — Quantum Resonance Inference</title>
  <meta name="description" content="Photonic inference engine using PTR glass holographic plates. 78ns per-token latency, 405K tok/J efficiency.">
  <link rel="stylesheet" href="../style.css">
  <style>
    #qri-header {
      margin-bottom: 2.5rem;
    }
    #qri-header h1 {
      font-size: clamp(2rem, 5vw, 2.8rem);
      margin-bottom: 0.5rem;
    }
    .qri-meta {
      color: var(--muted);
      font-family: var(--font-mono);
      font-size: 0.82rem;
      letter-spacing: 0.02em;
    }
    .qri-meta span {
      display: inline-block;
      margin-right: 1.5rem;
    }
    #qri-intro {
      max-width: 62ch;
      margin-bottom: 2rem;
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
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
      #qri-header h1 { font-size: 1.8rem; }
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

    <section id="qri-header">
      <h1>QRI</h1>
      <h2 style="font-family: var(--font-mono); font-size: 0.9rem; font-weight: 400; color: var(--muted); margin: 0;">Quantum Resonance Inference</h2>
      <div class="qri-meta">
        <span>📋 Photonics</span>
        <span>⚡ Computing</span>
        <span>🔬 In Progress</span>
      </div>
    </section>

    <section id="qri-intro">
      <p>
        A photonic inference engine using PTR glass holographic plates at 850nm with CMOS electronic interposer.
        The architecture targets token-level inference latency in the 78ns range with 12.7M tok/s conditional throughput,
        operating at 31.5W system power for 405K tok/J efficiency.
      </p>
      <p>
        Adversarial architecture review completed. Locked specifications committed. Full system documentation
        and technical derivations available below.
      </p>
      <div class="doc-links">
        <a href="./system-doc.pdf" class="doc-link">📄 System Document (PDF)</a>
        <a href="./system-doc.html" class="doc-link">🌐 System Document (HTML)</a>
      </div>
    </section>

    <section class="specs">
      <h3>Locked Specifications</h3>
      <div class="specs-grid">
        <div class="spec-item">
          <span class="spec-label">Per-Token Latency</span>
          <span class="spec-value">78.14 ns</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Pipelined Throughput</span>
          <span class="spec-value">12.7M tok/s</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">System Power</span>
          <span class="spec-value">31.5W</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Efficiency</span>
          <span class="spec-value">405K tok/J</span>
        </div>
      </div>
    </section>

  </main>
</body>
</html>`;

fs.writeFileSync(path.join(qriOutDir, 'index.html'), indexHtml);
console.log('✓ QRI build complete');
console.log('  - Symlinked latest PDF:', pdfFile);
console.log('  - Symlinked latest HTML:', htmlFile);
console.log('  - Generated index.html');
