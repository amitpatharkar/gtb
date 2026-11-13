// "Credits" panel: OpenStreetMap, open-source code, and every shipped asset.
// Asset credits come from media/manifest.json, written by the asset pipeline.

const SOFTWARE = [
  ['three.js', 'https://threejs.org', 'MIT licence'],
  ['earcut', 'https://github.com/mapbox/earcut', 'ISC licence'],
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
      const res = await fetch(`${baseUrl}media/manifest.json`);
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
