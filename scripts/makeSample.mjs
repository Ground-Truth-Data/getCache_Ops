// Builds public/sample.sqlite: one planter's spring season on a real v57 schema, every row invented.
// Seeded, so a rerun writes the same file. The schema's own FKs, CHECKs and triggers vet every insert.
// Run: node scripts/makeSample.mjs
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const OUT = new URL('../public/sample.sqlite', import.meta.url).pathname;
const SCHEMA = new URL('../schema/v57.sql', import.meta.url);
const SCHEMA_VERSION = 57;

let seed = 20260504;
const rand = () => {
	// mulberry32: a plain LCG's consecutive draws correlate, and the season never got a two-day break.
	let t = (seed = (seed + 0x6d2b79f5) >>> 0);
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
};
const between = (lo, hi) => lo + rand() * (hi - lo);
const int = (lo, hi) => Math.floor(between(lo, hi + 1));
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const weighted = (pairs) => {
	let r = rand() * pairs.reduce((s, [, w]) => s + w, 0);
	for (const [v, w] of pairs) if ((r -= w) < 0) return v;
	return pairs.at(-1)[0];
};
const normal = (mean, sd) => mean + sd * Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const uuid = () => {
	const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
	h[12] = '4';
	h[16] = '89ab'[Math.floor(rand() * 4)];
	const s = h.join('');
	return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
};
const key = (prefix) => (prefix ? `${prefix}-${uuid()}` : uuid());

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
rmSync(OUT, { force: true });
const db = new DatabaseSync(OUT);
db.exec(readFileSync(SCHEMA, 'utf8'));
db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}; PRAGMA foreign_keys = ON; BEGIN`);

function insert(table, row) {
	const cols = Object.keys(row);
	db.prepare(`INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(
		...Object.values(row),
	);
}
/** An entity row plus its first (and only) version. */
function born(kind, entityKey, at, by, fields) {
	insert(`${kind}Entity`, { [`${kind}Key`]: entityKey, createdAt: at, createdByKey: by });
	insert(`${kind}Table`, { versionKey: key('op'), [`${kind}Key`]: entityKey, createdAt: at, editedByKey: by, ...fields });
}

// People: the planter whose phone this is, and the checker who lays the pay plots.
const SEASON_START = '2026-05-04T13:00:00.000Z';
const planter = key();
const checker = key();
for (const [p, username, color] of [
	[planter, 'Sam Planter', '#e8c53a'],
	[checker, 'Jo Checker', '#4a90d9'],
]) {
	insert('personEntity', { personKey: p, createdAt: SEASON_START });
	insert('personTable', { versionKey: key('op'), personKey: p, username, color, createdAt: SEASON_START });
}
// Sam owns the phone, so "my" and "me" in a request mean Sam.
insert('personIdTable', { personId: 'sample-owner', personKey: planter, createdAt: SEASON_START });
insert('userProfile', { userProfileId: 'singleton', displayName: 'Sam Planter', personId: 'sample-owner' });

const mapKey = key('map');
born('map', mapKey, SEASON_START, planter, { mapName: 'Sample contract — spring 2026' });

// Seedlots: interior lodgepole pine and spruce, 400-tree boxes in bundles of 20.
const PRICE = 0.18;
const seedlots = [
	['PLI', '63412'], ['PLI', '63418'], ['PLI', '62087'], ['PLI', '64001'],
	['SX', '61210'], ['SX', '61377'], ['SX', '60954'], ['FDI', '42230'],
].map(([speciesCode, seedlot], i) => {
	const boxKey = key('box');
	const bagKey = key();
	// The fir is a cross-border lot paid in US dollars, so CAD and USD sit side by side.
	const [price, currency] = speciesCode === 'FDI' ? [0.15, 'USD'] : [PRICE, 'CAD'];
	born('box', boxKey, SEASON_START, planter, { boxTag: seedlot, speciesCode, seedlot, boxSizeQty: 400, bundleSizeQty: 20 });
	born('bag', bagKey, SEASON_START, planter, {
		boxKey, isBox: 0, pricePerTree: price, currency, sortOrder: `a${i}`,
	});
	return { boxKey, bagKey, speciesCode, seedlot, price, currency };
});

// Blocks: ~30 ha irregular polygons near Vanderhoof, BC, strung along a haul road.
const M_PER_DEG_LAT = 111320;
const ORIGIN = { lat: 53.95, lng: -124.25 };
const mPerDegLng = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toLngLat = ([x, y], c) => [+(c.lng + x / mPerDegLng).toFixed(6), +(c.lat + y / M_PER_DEG_LAT).toFixed(6)];
const shoelace = (pts) => Math.abs(pts.reduce((s, [x, y], i) => {
	const [x2, y2] = pts[(i + 1) % pts.length];
	return s + x * y2 - x2 * y;
}, 0)) / 2;
const inside = ([x, y], pts) => {
	let hit = false;
	for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
		const [xi, yi] = pts[i], [xj, yj] = pts[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
	}
	return hit;
};

const blocks = Array.from({ length: 8 }, (_, i) => {
	const targetHa = between(22, 38);
	const n = int(8, 12);
	let ring = Array.from({ length: n }, (_, k) => {
		const a = (k / n) * 2 * Math.PI + between(-0.15, 0.15);
		const r = between(0.75, 1.25);
		return [Math.cos(a) * r * 1.3, Math.sin(a) * r]; // a little wider than tall, like a cutblock
	});
	const scale = Math.sqrt((targetHa * 10000) / shoelace(ring));
	ring = ring.map(([x, y]) => [x * scale, y * scale]);
	const center = { lat: ORIGIN.lat + between(-0.004, 0.004), lng: ORIGIN.lng + (i * 1100) / mPerDegLng };
	const areaHa = shoelace(ring) / 10000;
	const name = `VAN-${String(int(100, 799))}`;
	const polygonKey = key('ftr');
	const blockKey = key('land');
	born('mapFeature', polygonKey, SEASON_START, planter, {
		featureName: name, featureType: 'polygon', featureOrigin: 'imported', mapKey, fillOpacity: 0.4, isTitleShown: 1,
		geometryJson: JSON.stringify({ type: 'Polygon', coordinates: [[...ring, ring[0]].map((p) => toLngLat(p, center))] }),
	});
	born('block', blockKey, SEASON_START, planter, {
		blockName: name, allocatedQty: Math.round(areaHa * 1600), mapFeatureKey: polygonKey,
	});
	const cacheKey = key('pin');
	born('mapFeature', cacheKey, SEASON_START, planter, {
		featureName: `${name} cache`, featureType: 'point', pinIcon: 'cache', mapKey, linkedBlockKey: blockKey,
		geometryJson: JSON.stringify({ type: 'Point', coordinates: toLngLat([0, 0], center) }),
	});
	const lots = [pick(seedlots.slice(0, 4)), pick(seedlots.slice(4))];
	if (rand() < 0.4) lots.push(pick(seedlots.filter((s) => !lots.includes(s))));
	return { name, blockKey, polygonKey, cacheKey, ring, center, areaHa, lots };
});

// The season: mostly four on, one off — but crews slip to three, five or six on, and two off.
const days = [];
let date = new Date('2026-05-04T12:00:00Z');
while (date < new Date('2026-07-10T12:00:00Z')) {
	const on = weighted([[4, 60], [5, 15], [6, 12], [3, 13]]);
	for (let d = 0; d < on; d++, date = new Date(+date + 864e5)) days.push(date.toISOString().slice(0, 10));
	date = new Date(+date + weighted([[1, 75], [2, 25]]) * 864e5);
}

const isoAt = (day, localMinutes) => new Date(Date.parse(`${day}T07:00:00Z`) + localMinutes * 6e4).toISOString(); // PDT = UTC-7
let blockIdx = 0;
let daysOnBlock = 0;
const blockDays = int(5, 8);
const daysOn = new Map();
for (const [n, day] of days.entries()) {
	if (daysOnBlock >= blockDays + (blockIdx % 2) && blockIdx < blocks.length - 1) (blockIdx++, (daysOnBlock = 0));
	const block = blocks[blockIdx];
	daysOnBlock++;
	(daysOn.get(block) ?? daysOn.set(block, []).get(block)).push(day);

	// A rookie-to-highballer curve: ~1500 a day in week one, ~2300 by mid-season, clamped 1000–4000.
	const skill = Math.min(1, n / 25);
	const target = Math.max(1000, Math.min(4000, normal(1500 + 800 * skill, 450)));
	const bagUps = Math.max(4, Math.min(16, Math.round(target / 240)));
	let minute = 7 * 60 + 30 + int(-20, 20); // first bag-up around 7:30
	for (let b = 0; b < bagUps; b++, minute += Math.round((9 * 60) / bagUps) + int(-8, 8)) {
		const at = isoAt(day, minute);
		const bagUpKey = key('bag');
		// The first bag-up of the day is filed at the cache, the rest on the piece — the app lets a bag-up sit on either.
		born('bagUp', bagUpKey, at, planter, { plantedDt: day, blockKey: block.blockKey, mapFeatureKey: b ? block.polygonKey : block.cacheKey });
		const lots = rand() < 0.12 ? [pick(block.lots)] : block.lots.slice().sort(() => rand() - 0.5).slice(0, 2);
		for (const lot of lots) {
			const bundles = lots.length === 1 ? int(10, 14) : int(5, 7);
			born('tally', key('tly'), at, planter, {
				bagUpKey, bagKey: lot.bagKey, boxKey: lot.boxKey, boxTag: lot.seedlot, speciesCode: lot.speciesCode,
				plantedQty: bundles * 20, pricePerTree: lot.price, currency: lot.currency,
			});
		}
	}
}

// Each block's cache: every lot allocated, delivered the first morning, and what's left counted the last evening.
for (const block of blocks.filter((b) => daysOn.has(b))) {
	const [first, last] = [daysOn.get(block)[0], daysOn.get(block).at(-1)];
	const [lng, lat] = toLngLat([0, 0], block.center);
	for (const [i, lot] of block.lots.entries()) {
		const row = { mapFeatureKey: block.cacheKey, boxKey: lot.boxKey };
		insert('allocationTable', { versionKey: key('op'), blockKey: block.blockKey, boxKey: lot.boxKey, treesQty: Math.round((block.areaHa * 1600) / block.lots.length), sortOrder: i, createdAt: SEASON_START, allocatedByKey: checker });
		insert('deliveryTable', { ...row, versionKey: key('op'), kind: 'delivered', lat, lng, accuracyM: int(3, 12), distanceM: int(0, 25), createdAt: isoAt(first, 6 * 60 + i), deliveredByKey: checker });
		insert('stockTable', { ...row, versionKey: key('op'), boxQty: int(0, 4), createdAt: isoAt(last, 17 * 60 + i), countedByKey: planter });
	}
}

// Pay plots: the checker lays one per hectare on a 100 m grid, the day after the planter leaves the block.
for (const block of blocks.filter((b) => daysOn.has(b))) {
	const lastDay = daysOn.get(block).at(-1);
	const surveyDay = new Date(Date.parse(lastDay) + 864e5).toISOString().slice(0, 10);
	const qaSurveyKey = key('srv');
	born('qaSurvey', qaSurveyKey, isoAt(surveyDay, 8 * 60), checker, {
		surveyName: block.name, areaHa: +block.areaHa.toFixed(1), treesPerHa: 1600, pricePerTree: PRICE,
		currency: 'CAD', speciesChoicesJson: JSON.stringify([...new Set(block.lots.map((l) => l.speciesCode))]),
		mapKey, blockKey: block.blockKey,
	});
	const xs = block.ring.map(([x]) => x), ys = block.ring.map(([, y]) => y);
	const [ox, oy] = [between(0, 100), between(0, 100)];
	let plotNo = 0;
	for (let x = Math.min(...xs) + ox; x < Math.max(...xs); x += 100)
		for (let y = Math.min(...ys) + oy; y < Math.max(...ys); y += 100) {
			if (!inside([x, y], block.ring)) continue;
			const at = isoAt(surveyDay, 8 * 60 + 12 * ++plotNo);
			const pinKey = key('pin');
			born('mapFeature', pinKey, at, checker, {
				featureName: `${block.name} plot ${plotNo}`, featureType: 'plot', mapKey,
				geometryJson: JSON.stringify({ type: 'Point', coordinates: toLngLat([x, y], block.center) }),
			});
			const spots = weighted([[8, 55], [7, 20], [9, 15], [6, 10]]);
			const planted = Math.max(0, spots - weighted([[0, 70], [1, 22], [2, 8]]));
			const qaPlotKey = key('plt');
			insert('qaPlotEntity', { qaPlotKey, plotNo, qaSurveyKey, createdAt: at, createdByKey: checker });
			insert('qaPlotTable', {
				versionKey: key('op'), qaPlotKey, plantedQty: planted, plantableSpotsQty: spots, qaSurveyKey,
				mapFeatureKey: pinKey, faultsJson: JSON.stringify(rand() < 0.08 ? ['B1'] : []), createdAt: at, editedByKey: checker,
			});
		}
}

db.exec('COMMIT');
const fkErrors = db.prepare('PRAGMA foreign_key_check').all();
if (fkErrors.length) throw new Error(`foreign_key_check: ${JSON.stringify(fkErrors.slice(0, 3))}`);
db.exec('VACUUM');
db.close();
console.log(`wrote ${OUT}`);
