<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}} — Mithlond</title>
  <meta name="description" content="{{DESCRIPTION}}">
  <link rel="stylesheet" href="../css/style.css">
  <link rel="alternate" type="application/atom+xml" title="Mithlond watch" href="./feed.xml">
  <style>
    /* The research watch, in Mithlond's own tokens (css/style.css). */
    .w-meta { font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.08em; color: var(--horizon); margin-bottom: 0.5rem; text-transform: uppercase; }
    .w-meta a { color: inherit; }
    .w-summary { font-size: 1.05rem; margin-bottom: 2rem; }
    .w-intro p { margin-bottom: 1rem; }
    .w-entry { border-bottom: 1px solid var(--mist); padding: 1.4rem 0; }
    .w-entry h3 { margin-top: 0; }
    .w-item { background: var(--mist); border-left: 3px solid var(--horizon); padding: 1.2rem 1.5rem; margin: 1.5rem 0; font-size: 0.95rem; }
    .w-item h3 { margin-top: 0; }
    .w-src { font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.04em; color: var(--tide); margin-bottom: 0.8rem; }
    .w-quote { border-left: 2px solid var(--salt); margin: 0 0 0.8rem; padding: 0.2rem 0 0.2rem 1rem; font-style: italic; color: var(--ink); }
    .w-note { margin-bottom: 0.6rem; }
    .w-claims, .w-sources { list-style: none; padding: 0; margin: 0.4rem 0 0; font-size: 0.88rem; }
    .w-claims li, .w-sources li { margin: 0.35rem 0; }
    .w-status { display: inline-block; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.1rem 0.45rem; border-radius: 2px; vertical-align: 0.1em; }
    .w-status--provisional { background: var(--paper); color: var(--tide); border: 1px solid var(--fog); }
    .w-status--corroborated { background: var(--tide); color: var(--paper); border: 1px solid var(--tide); }
    .w-status--disputed { background: #fff5ed; color: var(--signal); border: 1px solid var(--signal); }
    a.w-cite { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; padding: 0 0.35rem; border-radius: 2px; vertical-align: 0.15em; }
    a.w-cite.w-status--provisional { border: 1px solid var(--fog); color: var(--tide); }
    a.w-cite.w-status--corroborated { background: var(--tide); color: var(--paper); }
    a.w-cite.w-status--disputed { border: 1px solid var(--signal); color: var(--signal); }
    .w-claim { border-bottom: 1px solid var(--mist); padding: 1.2rem 0; scroll-margin-top: 1rem; }
    .w-claim:target { background: #fff5ed; }
    .w-claim h3 { margin-top: 0; }
    .w-stance { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--horizon); }
    .w-stance--disputes { color: var(--signal); }
    .w-group h2 .w-status { margin-right: 0.4rem; }
    .w-unreachable { margin-top: 2.5rem; font-size: 0.9rem; }
    .w-unreachable li { margin: 0.3rem 0; overflow-wrap: anywhere; }
    .w-analysis p, .w-analysis li { margin-bottom: 1.1rem; }
    .w-analysis ul { padding-left: 1.2rem; }
    .w-analysis blockquote { border-left: 2px solid var(--salt); padding-left: 1rem; font-style: italic; margin: 0 0 1.2rem; }
    .w-legend { font-size: 0.85rem; color: var(--tide); border-top: 1px solid var(--mist); padding-top: 1rem; margin-top: 2rem; }
    .w-pager { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2.5rem; font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.06em; }
    .w-flag { display: inline-block; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.1rem 0.45rem; border: 1px dashed var(--horizon); color: var(--horizon); background: var(--paper); border-radius: 2px; vertical-align: 0.1em; }
    .w-unrelated { font-size: 0.88rem; color: var(--tide); margin-bottom: 0.8rem; }
    .w-item--unrelated { background: var(--paper); border-left: 3px dashed var(--fog); }
    .w-claim--unrelated h3 { color: var(--tide); }
    .w-group--unrelated { border-top: 1px dashed var(--fog); padding-top: 1.5rem; }
    .w-request { border-bottom: 1px solid var(--mist); padding: 1rem 0; }
    .w-request h3 { margin-top: 0; }
    q { quotes: "\201C" "\201D"; font-style: italic; }
  </style>
</head>
<body>

<nav>
  <a class="nav-brand" href="../index.html">MITHLOND</a>
  <a href="../index.html">About</a>
  <a href="../blog/index.html">Research Log</a>
  <a href="./" class="active">Watch</a>
  <a href="../links.html">Links</a>
</nav>

<div class="hero">
  <div class="hero-inner">
    <div class="hero-label">// {{LABEL}}</div>
    <h1>{{H1}}</h1>
    <p class="hero-sub">{{DECK}}</p>
  </div>
</div>

<main>
{{BODY}}
</main>

<footer>
  <p>
    MITHLOND &nbsp;·&nbsp; Hampton Roads, Virginia &nbsp;·&nbsp;
    Research under Creative Commons BY 4.0 &nbsp;·&nbsp;
    <a href="https://github.com/jedelman/jason-edelman.org/tree/main/mithlond">Source</a>
  </p>
</footer>

</body>
</html>
