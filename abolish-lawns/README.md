# Abolish Lawns

Served at https://jason-edelman.org/abolish-lawns/ from the jason-edelman.org repo, where it has lived since
2026-11-18 (it was jedelman/abolish-lawns, a SvelteKit app; its history came along).

It's plain files now, built by the repo's own `scripts/build.mjs` like everything else:

- `site/`: what's served. One HTML file per page, `app.css` (the shared design tokens and type), the favicon,
  `robots.txt` and the zine PDFs. Each page carries its own `<style>`.
- `data/bibliography.mjs`: every source, with its claims and status. `node abolish-lawns/scripts/bibliography.mjs`
  writes the entries into `site/bibliography.html` (between the `generated:bibliography` markers); `--check`
  fails when the page is behind the data.
- `zines/`: the Python scripts that make the zine PDFs in `site/zines/`.
- `polemic/`: Polemic, the argument-mapping engine (Prolog knowledge base, Python reasoning; see its README). Not served.
- `.impeccable.md`: the design context.
