async function boot() {
  const params = new URLSearchParams(window.location.search);
  const star = params.get('star');
  const director = params.get('director');

  if ((!star && !director) || (star && director)) {
    window.location.replace('/404.html?env-guard=person');
    return;
  }

  const mode = star ? 'star' : 'director';
  const target = decodeURIComponent(star || director).trim().toLowerCase();

  try {
    const [metaResponse, scenesResponse] = await Promise.all([
      fetch('../data/metadata.csv'),
      fetch('../data/scenes.csv')
    ]);

    const metaText = await metaResponse.text();
    const scenesText = await scenesResponse.text();

    const metadata = Papa.parse(metaText, {
      header: true,
      skipEmptyLines: true
    }).data;

    const scenes = Papa.parse(scenesText, {
      header: true,
      skipEmptyLines: true
    }).data;

    const field = mode === 'star' ? 'Stars' : 'Director';

    const matches = metadata.filter(item => {
      const raw = item[field] || '';

      return raw
        .split(',')
        .map(value => value.trim().toLowerCase())
        .includes(target);
    });

    if (!matches.length) {
      window.location.replace('/404.html?env-guard=person');
      return;
    }

    const sceneCounts = new Map();

    scenes.forEach(scene => {
      const title = (scene.Title || '').trim();
      if (!title) return;

      sceneCounts.set(title, (sceneCounts.get(title) || 0) + 1);
    });

    matches.sort((a, b) => {
      const aCount = sceneCounts.get(a.title) || 0;
      const bCount = sceneCounts.get(b.title) || 0;
      return bCount - aCount;
    });

    document.title = `${star || director} | Find That Scene`;

    document.getElementById('personKicker').textContent = mode === 'star'
      ? 'Star'
      : 'Director';

    document.getElementById('personTitle').textContent = star || director;

    document.getElementById('personCopy').textContent = mode === 'star'
      ? `${matches.length} title${matches.length === 1 ? '' : 's'} featuring ${(star || '').trim()}.`
      : `${matches.length} title${matches.length === 1 ? '' : 's'} directed by ${(director || '').trim()}.`;

    const grid = document.getElementById('personGrid');

    matches.forEach(item => {
      const card = document.createElement('a');
      card.className = 'person-card';
      card.href = `../title/?fl=${encodeURIComponent(item.title || '')}`;

      const poster = item.poster || '';

      card.innerHTML = `
        <div class="poster-card">
          ${poster
            ? `<img src="${poster}" alt="${item.title || ''}">`
            : `<div class="poster-fallback">${item.title || ''}</div>`}
        </div>
        <div class="person-card-title">${item.title || ''}</div>
      `;

      grid.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    window.location.replace('/404.html?env-guard=person');
  }
}

const papaScript = document.createElement('script');
papaScript.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
papaScript.onload = boot;
document.head.appendChild(papaScript);
