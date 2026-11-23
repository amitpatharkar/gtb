// "Credits" panel: OpenStreetMap, open-source code, and every shipped asset.
// Asset credits come from media/manifest.json, written by the asset pipeline (the deploy
// trims it to the files the game uses: scripts/ship-media.mjs); the owner's own models are
// listed in art/CREDITS.md (one "- file — tools — licence — date" line each).

const SOFTWARE = [
  ['three.js', 'https://threejs.org', 'MIT licence'],
  ['earcut', 'https://github.com/mapbox/earcut', 'ISC licence'],
  ['Basis Universal transcoder (textures, in basis/)', 'https://github.com/BinomialLLC/basis_universal', 'Apache License 2.0'],
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;

export function setupCredits(baseUrl) {
  const panel = document.getElementById('credits-panel');
  const body = panel.querySelector('.body');
  let loaded = false;

  async function fill() {
    const parts = [
      `<h3>Map</h3><p>Map data © ${link('https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors')}, available under the Open Database License.</p>`,
      `<h3>Software</h3><ul>${SOFTWARE.map(([n, u, l]) => `<li>${link(u, n)} — ${l}</li>`).join('')}</ul>`,
    ];
    try {
      const res = await fetch(`${baseUrl}media/manifest.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const { assets } = await res.json();
      const group = (title, list, fmt) => list.length && parts.push(`<h3>${title}</h3><ul>${list.map(fmt).join('')}</ul>`);
      group('Creative Commons Attribution', assets.filter((a) => a.licence.startsWith('CC-BY')),
        (a) => `<li>${esc(a.attribution || `"${a.title}" by ${a.author}`)} ${link(a.source_page, '(source)')}</li>`);
      group('Fonts (SIL Open Font License)', assets.filter((a) => a.licence === 'OFL-1.1'),
        (a) => `<li>${link(a.source_page, a.title)} by ${esc(a.author)}</li>`);
      group('Public domain (CC0) — thank you', assets.filter((a) => a.licence === 'CC0-1.0'),
        (a) => `<li>${link(a.source_page, a.title)} by ${esc(a.author)}</li>`);
    } catch {
      parts.push('<p>No third-party assets in this build yet.</p>');
    }
    try {
      // People: built from MakeHuman (scripts/people/); every hair and clothing asset is listed
      // with its author, and the CC BY ones are credited as their licence asks.
      const res = await fetch(`${baseUrl}people/index.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const { credits = [] } = await res.json();
      const name = (c) => c.asset.replace(/_/g, ' ');
      const packs = link('https://static.makehumancommunity.org/assets/assetpacks/index.html', 'MakeHuman asset packs');
      parts.push(`<h3>People</h3><p>Bodies, faces, eyes and skins made with ${link('https://static.makehumancommunity.org', 'MakeHuman')} (CC0) and its plugin for Blender (MPFB 2); hair and clothes from the ${packs}. Motion: ${link('https://quaternius.com/packs/universalanimationlibrary.html', 'Universal Animation Library 1 and 2')} by Quaternius (CC0), retargeted for this game.</p>`);
      const hero = await fetch(`${baseUrl}people/hero/info.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (hero?.credit) parts.push(`<p>Main character: ${link(hero.credit.source, '"Indian Man In Casuals"')} by ${esc(hero.credit.author)} — ${link('https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0')}, re-rigged to the game skeleton with the game's animations.</p>`);
      const by = credits.filter((c) => c.license === 'CC-BY');
      if (by.length) parts.push(`<ul>${by.map((c) => `<li>"${esc(name(c))}" by ${esc(c.author)} — ${link('https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0')}, fitted and recoloured</li>`).join('')}</ul>`);
      const zero = credits.filter((c) => c.license !== 'CC-BY');
      if (zero.length) parts.push(`<p>Public domain (CC0): ${zero.map((c) => `${esc(name(c))} (${esc(c.author)})`).join(', ')}.</p>`);
    } catch { /* no people in this build */ }
    try {
      const res = await fetch(`${baseUrl}art/CREDITS.md`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const lines = (await res.text()).split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
      if (lines.length) parts.push(`<h3>Made for this game</h3><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`);
    } catch { /* no owner-made models in this build */ }
    parts.push(`<h3>Icons</h3><p>Interface icons from ${link('https://lucide.dev', 'Lucide')} (ISC licence). Fonts: Damion (SIL Open Font License).</p>`);
    body.innerHTML = parts.join('');
  }

  document.getElementById('credits-open').addEventListener('click', (e) => {
    e.preventDefault();
    panel.hidden = false;
    if (!loaded) { loaded = true; fill(); }
  });
  panel.querySelector('.close').addEventListener('click', () => { panel.hidden = true; });
  addEventListener('keydown', (e) => { if (e.code === 'Escape') panel.hidden = true; });
}
