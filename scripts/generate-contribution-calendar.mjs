import { mkdir, writeFile } from 'node:fs/promises';

const USERNAME = process.env.GITHUB_USERNAME || 'zhanpeng001';
const YEAR = Number(process.env.CONTRIBUTION_YEAR || '2026');
const OUTPUT = process.env.OUTPUT || 'assets/github-contributions-2026.svg';
const API_URL = `https://github-contributions-api.jogruber.de/v4/${USERNAME}?y=${YEAR}`;

const COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL = 11;
const GAP = 3;
const LEFT = 34;
const TOP = 34;
const WIDTH = LEFT + 53 * (CELL + GAP) + 18;
const HEIGHT = TOP + 7 * (CELL + GAP) + 44;

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function startOfCalendar(year) {
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date;
}

function contributionMap(contributions) {
  const map = new Map();
  for (const item of contributions) {
    map.set(item.date, item);
  }
  return map;
}

function buildSvg(data) {
  const contributions = contributionMap(data.contributions || []);
  const start = startOfCalendar(YEAR);
  const total = data.total?.[YEAR] ?? 0;
  const rects = [];
  const monthLabels = [];
  const seenMonths = new Set();

  for (let week = 0; week < 53; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      const current = new Date(start);
      current.setUTCDate(start.getUTCDate() + week * 7 + day);
      const inYear = current.getUTCFullYear() === YEAR;
      const key = dateKey(current);
      const contribution = contributions.get(key);
      const level = inYear ? contribution?.level ?? 0 : 0;
      const count = inYear ? contribution?.count ?? 0 : 0;
      const x = LEFT + week * (CELL + GAP);
      const y = TOP + day * (CELL + GAP);
      const opacity = inYear ? '1' : '0.35';
      const label = inYear ? `${count} contributions on ${key}` : `Outside ${YEAR}`;

      rects.push(
        `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${COLORS[level]}" opacity="${opacity}"><title>${escapeXml(label)}</title></rect>`,
      );

      if (inYear && current.getUTCDate() <= 7 && !seenMonths.has(current.getUTCMonth())) {
        seenMonths.add(current.getUTCMonth());
        monthLabels.push(
          `<text x="${x}" y="20" class="label">${MONTHS[current.getUTCMonth()]}</text>`,
        );
      }
    }
  }

  const legendX = WIDTH - 150;
  const legendY = HEIGHT - 22;
  const legend = COLORS.map((color, index) => {
    const x = legendX + 36 + index * (CELL + 3);
    return `<rect x="${x}" y="${legendY - 10}" width="${CELL}" height="${CELL}" rx="2" fill="${color}" />`;
  }).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">${USERNAME}'s ${YEAR} GitHub contributions</title>
  <desc id="desc">GitHub-style contribution calendar from January 1 to December 31, ${YEAR}.</desc>
  <style>
    .title { fill: #24292f; font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .label { fill: #57606a; font: 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  </style>
  <rect width="100%" height="100%" rx="8" fill="#ffffff" />
  <text x="${LEFT}" y="${HEIGHT - 18}" class="title">${total} contributions in ${YEAR}</text>
  ${monthLabels.join('\n  ')}
  <text x="8" y="${TOP + 25}" class="label">Mon</text>
  <text x="8" y="${TOP + 53}" class="label">Wed</text>
  <text x="8" y="${TOP + 81}" class="label">Fri</text>
  ${rects.join('\n  ')}
  <text x="${legendX}" y="${legendY}" class="label">Less</text>
  ${legend}
  <text x="${legendX + 112}" y="${legendY}" class="label">More</text>
</svg>
`;
}

const response = await fetch(API_URL, {
  headers: {
    accept: 'application/json',
    'user-agent': `${USERNAME}-profile-readme`,
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch contributions: ${response.status} ${response.statusText}`);
}

const data = await response.json();
await mkdir(OUTPUT.split('/').slice(0, -1).join('/'), { recursive: true });
await writeFile(OUTPUT, buildSvg(data), 'utf8');
console.log(`Generated ${OUTPUT} from ${API_URL}`);
