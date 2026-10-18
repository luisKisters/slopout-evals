// Builds the static site into public/ from runs/, tasks/, contestants.json and ratings.json.
// No dependencies: node build.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'public');
const REPO = 'https://github.com/luisKisters/slopout-evals';
const WEIGHTS = { feel: 35, takedown: 20, looks: 20, hud: 10, trailer: 15 };
const PARTS = Object.keys(WEIGHTS);
const TEXT = /\.(html?|m?js|css|json|svg|txt)$/i;

const read = (p, fallback) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : fallback);
const json = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const contestants = Object.fromEntries(json(path.join(ROOT, 'contestants.json'), []).map((c) => [c.id, c]));
const ratings = json(path.join(ROOT, 'ratings.json'), {});
const label = (id) => contestants[id]?.label ?? id;

// Copy one game build to public/play/<slug>/ and make it work under that path. Vite builds with base "/"
// point at /assets/...; every root path that names a top-level entry of the build gets the prefix.
function exportGame(src, slug) {
  const dest = path.join(OUT, 'play', slug);
  const prefix = `/play/${slug}/`;
  fs.cpSync(src, dest, { recursive: true });
  const top = fs.readdirSync(src).filter((e) => e !== '.DS_Store');
  const absolute = new RegExp(`(^|["'\`(=,\\s])/(${top.map(reEsc).join('|')})(?=[/"'\`)?#,\\s]|$)`, 'gm');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    if (!TEXT.test(d.name)) return;
    let s = fs.readFileSync(p, 'utf8');
    const before = s;
    s = s.replace(absolute, (_, a, b) => `${a}${prefix}${b}`);
    if (p === path.join(dest, 'index.html')) s = s.replace(/(["'(])\.\//g, `$1${prefix}`); // works with or without a trailing slash
    if (s !== before) fs.writeFileSync(p, s);
  });
  walk(dest);
  return prefix;
}

function loadRun(task, name) {
  const dir = path.join(ROOT, 'runs', task, name);
  const score = json(path.join(dir, 'score.json'));
  const meta = json(path.join(dir, 'meta.json'), {});
  const cost = json(path.join(dir, 'cost.json'), {});
  const checks = json(path.join(dir, 'checks.json'), {});
  const minutes = Math.round((meta.prior_min ?? 0) + (meta.seconds ?? 0) / 60);
  const play = exportGame(path.join(dir, 'dist'), name);
  const fixed = fs.existsSync(path.join(dir, 'fixed')) ? exportGame(path.join(dir, 'fixed'), `${name}-fixed`) : null;
  let preview = null;
  if (fs.existsSync(path.join(dir, 'preview.jpg'))) {
    fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
    fs.copyFileSync(path.join(dir, 'preview.jpg'), path.join(OUT, 'img', `${name}.jpg`));
    preview = `/img/${name}.jpg`;
  }
  const usd = cost.usd ?? cost.provider_usd ?? null;
  return {
    name, task, score, meta, cost, checks, minutes, play, fixed, preview, usd,
    id: score.contestant, c: contestants[score.contestant] ?? { label: score.contestant },
    wall: (meta.wall_min ?? 45) + (meta.prior_min ?? 0),
    fixedNote: read(path.join(dir, 'fixed-note.txt'), 'fixed by us').trim(),
    brief: read(path.join(dir, 'brief.md'), '').trim(),
    rating: ratings[name] ?? null,
    failed: Object.entries(score.hard ?? {}).filter(([, v]) => !v).map(([k]) => k),
  };
}

const tasks = fs.readdirSync(path.join(ROOT, 'runs')).filter((t) => fs.statSync(path.join(ROOT, 'runs', t)).isDirectory())
  .map((t) => {
    const runs = fs.readdirSync(path.join(ROOT, 'runs', t)).filter((r) => fs.existsSync(path.join(ROOT, 'runs', t, r, 'score.json')));
    return { id: t, runs: runs.map((r) => r) };
  })
  .filter((t) => t.runs.length)
  .sort((a, b) => Math.max(...b.runs.map((r) => +r.slice(0, 8))) - Math.max(...a.runs.map((r) => +r.slice(0, 8))));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'site', 'style.css'), path.join(OUT, 'style.css'));
fs.copyFileSync(path.join(ROOT, 'site', 'favicon.svg'), path.join(OUT, 'favicon.svg'));
for (const t of tasks) {
  t.runs = t.runs.map((r) => loadRun(t.id, r)).sort((a, b) => b.score.score - a.score.score || b.score.raw - a.score.raw);
  t.brief = read(path.join(ROOT, 'tasks', t.id, 'brief.md'), t.runs[0].brief).trim();
  const d = t.runs.map((r) => r.name.slice(0, 8)).sort().at(-1);
  t.date = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const fmtUsd = (r) => (r.usd == null ? '?' : r.usd === 0 ? '$0' : `$${r.usd.toFixed(2)}`);
const costSub = (r) => (r.cost.weekly_pct != null && r.cost.plan_usd_week ? `${r.cost.weekly_pct}% of a ${r.cost.plan} week` : r.cost.plan ?? '');
const bar = (v) => `<td class="part" style="--v:${Math.max(0, Math.min(10, v)) * 10}%">${Number(v).toFixed(1)}</td>`;
const state = (r) => (r.score.working
  ? '<span class="pill ok">working</span>'
  : `<span class="pill bad" title="failed: ${esc(r.failed.join(', ') || 'a hard check')}">broken</span>`);
const rating = (r) => (r.rating?.score != null ? `<span class="luis" title="${esc(r.rating.note ?? '')}">${esc(r.rating.score)}</span>` : '<span class="dim">–</span>');
const fixedLink = (r, cls = 'fixlink') => (r.fixed ? `<a class="${cls}" href="${r.fixed}">${esc(r.fixedNote)}</a>` : '');

function table(t) {
  const rows = t.runs.map((r, i) => `
      <tr>
        <td class="num dim">${i + 1}</td>
        <td class="model"><a href="#${r.name}">${esc(r.c.label)}</a><span class="sub">${esc(r.c.harness_label ?? r.meta.harness ?? '')}</span></td>
        <td class="score">${r.score.score.toFixed(1)}</td>
        <td>${state(r)}</td>
        ${PARTS.map((p) => bar(r.score.parts?.[p] ?? 0)).join('')}
        <td class="num">${rating(r)}</td>
        <td class="num" title="${esc(r.cost.summary ?? '')}">${fmtUsd(r)}<span class="sub">${esc(costSub(r))}</span></td>
        <td class="num">${r.minutes}<span class="dim"> / ${r.wall} min</span></td>
        <td class="play"><a class="btn sm" href="${r.play}">Play</a>${fixedLink(r)}</td>
      </tr>`).join('');
  return `
    <div class="tablewrap"><table>
      <thead><tr>
        <th>#</th><th class="model">Model</th><th>Score</th><th>State</th>
        ${PARTS.map((p) => `<th class="part" title="${WEIGHTS[p]} % of the score">${p === 'hud' ? 'HUD' : p}</th>`).join('')}
        <th title="Luis's own rating, 0-10">Luis</th><th>Cost</th><th>Time</th><th></th>
      </tr></thead>
      <tbody>${rows}
      </tbody>
    </table></div>`;
}

function card(r, i) {
  const votes = Object.entries(r.score.votes ?? {});
  const judges = votes.map(([j, v]) => `
          <li><div class="jhead"><b>${esc(label(j))}</b><span class="mono dim">${PARTS.map((p) => `${p === 'takedown' ? 'td' : p} ${v[p]}`).join(' · ')}</span></div>
            <p>“${esc(v.one_line)}”</p></li>`).join('');
  const notes = [
    r.rating?.note ? `<p class="note"><b>Luis${r.rating.score != null ? ` · ${esc(r.rating.score)}/10` : ''}:</b> ${esc(r.rating.note)}</p>` : '',
    r.meta.note ? `<p class="note dim">${esc(r.meta.note)}</p>` : '',
    !r.score.working ? `<p class="note dim">Broken: ${esc(r.failed.join(', ') || 'a hard check failed')}. Score capped at 3 (raw ${r.score.raw}).</p>` : '',
  ].join('');
  return `
    <article class="card" id="${r.name}">
      <a class="thumb" href="${r.play}" aria-label="Play the ${esc(r.c.label)} game">
        ${r.preview ? `<img src="${r.preview}" alt="" loading="lazy" width="640" height="360">` : ''}
        <span class="rank">${i + 1}</span><span class="go">Play ▸</span>
      </a>
      <div class="body">
        <div class="head"><h3>${esc(r.c.label)}</h3><span class="big">${r.score.score.toFixed(1)}</span></div>
        <div class="sub">${esc(r.c.harness_label ?? '')} · ${fmtUsd(r)} · ${r.minutes} min ${state(r)}</div>
        <div class="actions"><a class="btn" href="${r.play}">Play</a>${fixedLink(r, 'btn ghost')}</div>
        ${notes}
        ${votes.length ? `<details><summary>What the judges said <span class="dim">(${votes.length})</span></summary><ul class="judges">${judges}
        </ul></details>` : ''}
      </div>
    </article>`;
}

function page(t, isHome) {
  const current = tasks[0].id;
  const tabs = tasks.map((x) => `<a class="tab${x.id === t.id ? ' on' : ''}" href="${x.id === current ? '/' : `/${x.id}/`}">${esc(x.id)}<span class="dim"> · ${esc(x.date)}</span></a>`).join('');
  const odd = t.runs.filter((r) => r.brief && r.brief !== t.brief);
  const title = isHome ? 'slopout · which coding agent builds the best Burnout?' : `slopout · ${t.id}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Coding agents get one short prompt and 45 minutes to build a Burnout 3 style racer in Three.js. Play every game and see how the models judged each other.">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="Play every AI-built racer and see the scores.">
${t.runs[0].preview ? `<meta property="og:image" content="${t.runs[0].preview}">` : ''}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<nav class="nav" aria-label="Sections">
  <a href="#leaderboard">Leaderboard</a><a href="#games">Games</a><a href="#how">How</a><a href="${REPO}">GitHub</a>
</nav>
<main>
  <header>
    <h1>slopout</h1>
    <p class="lede">Which coding agent builds the best <b>Burnout</b>? Every model gets the same short prompt and 45 minutes in a clean box to build a racer with Three.js. Then a script drives each game, automatic checks test it, and the other models judge it. A model never judges itself. You can play every game here.</p>
    <details class="prompt" id="prompt"><summary><span class="label">Prompt ·</span> ${esc(t.brief.split('\n\n')[0])} <span class="more">show all</span></summary>${esc(t.brief.split('\n\n').slice(1).join('\n\n'))}</details>
    <p class="byline dim">By Luis Kisters · <a href="${REPO}">builds and scores on GitHub</a> · ${t.runs.length} runs · updated ${esc(t.date)}</p>
  </header>
  <div class="tabs" role="navigation" aria-label="Tasks">${tabs}</div>

  <section id="leaderboard">
    <div class="sechead"><h2>Leaderboard</h2><span class="dim">${esc(t.id)} · keyboard needed to play</span></div>
    ${table(t)}
  </section>

  <section id="games">
    <div class="sechead"><h2>Play the games</h2><span class="dim">W/↑ gas · S/↓ brake · A D steer · space boost · shift drift</span></div>
    <div class="grid">${t.runs.map(card).join('')}
    </div>
  </section>

  ${odd.length ? `<section><h2>Other prompts</h2>${odd.map((r) => `<div class="prompt"><span class="dim">${esc(r.c.label)} ·</span> ${esc(r.brief)}</div>`).join('')}</section>` : ''}

  <section id="how" class="how">
    <h2>How it is scored</h2>
    <ul>
      <li><b>Hard checks.</b> It builds, loads, has no console errors, renders an image, holds 30 fps, and drives forward, reverse, left and right. One fail means <span class="pill bad">broken</span> and the score is capped at 3. A control passes on the motion check or the judge majority.</li>
      <li><b>Judges.</b> The other models see contact sheets of a filmed key script and the agent's own trailer. Score = ${PARTS.map((p) => `${p === 'hud' ? 'HUD' : p} ${WEIGHTS[p]} %`).join(', ')}.</li>
      <li><b>Cost.</b> For subscription plans: the share of the weekly limit the run used, priced at the plan. For APIs: the real spend.</li>
      <li><b>Luis.</b> My own rating after playing each game. Taste, not a formal score.</li>
      <li><b>Fixed builds.</b> Some games had one obvious bug, like reversed steering. The leaderboard always uses the graded build. The extra link plays our one-line fix.</li>
    </ul>
  </section>
</main>
<footer class="dim">slopout · <a href="${REPO}">${REPO.replace('https://', '')}</a></footer>
</body>
</html>
`;
}

for (const [i, t] of tasks.entries()) {
  fs.mkdirSync(path.join(OUT, t.id), { recursive: true });
  fs.writeFileSync(path.join(OUT, t.id, 'index.html'), page(t, false));
  if (i === 0) fs.writeFileSync(path.join(OUT, 'index.html'), page(t, true));
}
fs.writeFileSync(path.join(OUT, 'games.json'), JSON.stringify(tasks.flatMap((t) => t.runs.flatMap((r) => [r.play, r.fixed].filter(Boolean))), null, 1));
console.log(`built ${tasks.map((t) => `${t.id}: ${t.runs.length}`).join(', ')} into public/`);
