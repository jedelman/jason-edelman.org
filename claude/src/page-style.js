/**
 * Shared stylesheet for the essays this worker serves, so every page
 * reads as one site. Embedded verbatim inside each page's <style> tag.
 */
export const PAGE_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,400;0,600;0,700;0,900;1,400&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:          oklch(11% 0.006 145);
  --surface:     oklch(16% 0.007 145);
  --border:      oklch(23% 0.008 145);
  --text:        oklch(85% 0.010 145);
  --muted:       oklch(52% 0.010 145);
  --accent:      oklch(64% 0.12  145);
  --link:        oklch(72% 0.10  145);
  --link-hover:  oklch(82% 0.09  145);
  --max-w:       680px;
  --font-display: 'Epilogue', 'Arial Narrow', sans-serif;
  --font-body:    'Lora', Georgia, serif;
}
html { font-size: 17px; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
body { font-family: var(--font-body); line-height: 1.72; padding: 4rem 1.5rem 6rem; }
main { max-width: var(--max-w); margin: 0 auto; }
header { margin-bottom: 2.5rem; }
header h1 {
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 5vw, 2.6rem);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -0.02em;
  margin-bottom: 0.75rem;
}
header p { color: var(--muted); font-family: var(--font-display); font-size: 0.95rem; }
h2 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.4rem;
  letter-spacing: -0.01em;
  color: var(--accent);
  margin: 3rem 0 1.1rem;
}
p { margin-bottom: 1.3rem; }
em { font-style: italic; }
strong { color: var(--text); font-weight: 600; }
a { color: var(--link); text-decoration: underline; text-decoration-color: var(--border); text-underline-offset: 2px; }
a:hover { color: var(--link-hover); }
hr { border: none; border-top: 1px solid var(--border); margin: 3rem 0; }
main > p:first-of-type {
  color: var(--muted);
  font-size: 0.98rem;
  padding: 1.2rem 1.4rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}
main > p:last-of-type {
  color: var(--muted);
  font-size: 0.92rem;
  border-top: 1px solid var(--border);
  padding-top: 1.5rem;
  margin-top: 1rem;
}
footer { margin-top: 3rem; text-align: center; }
footer a { color: var(--muted); font-family: var(--font-display); font-size: 0.85rem; }`;
