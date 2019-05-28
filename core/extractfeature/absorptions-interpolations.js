"use strict";

const { adjacent, adjacentZ } = require("../types/point");

function BY_YORI(p, q) {
	return p.y - q.y;
}
let STEPS = 32;
function shortAbsorptionPointByKeys(targets, strategy, pt, keys, accept, priority) {
	if (pt.touched || pt.donttouch || !pt.on || !strategy.DO_SHORT_ABSORPTION) return;
	let minDist = 0xffff,
		minKey = null;
	for (let m = 0; m < keys.length; m++) {
		let key = keys[m];
		const dist = Math.hypot(pt.y - key.y, pt.x - key.x);
		if (key.yStrongExtrema && dist <= strategy.ABSORPTION_LIMIT && key.id !== pt.id) {
			if (dist < minDist) {
				minDist = dist;
				minKey = key;
			}
		}
	}
	if (minKey) {
		while (minKey.linkedKey) minKey = minKey.linkedKey;
		if (accept.ip) {
			if (
				minKey.upperK0 &&
				minKey.lowerK0 &&
				pt.y >= minKey.lowerK0.y &&
				pt.y <= minKey.upperK0.y
			) {
				targets.interpolations.push([
					minKey.upperK.id,
					minKey.lowerK.id,
					pt.id,
					minKey.ipPri
				]);
				pt.touched = true;
				return;
			}
		}
		if (accept.direct) {
			targets.shortAbsorptions.push([minKey.id, pt.id, priority + (pt.yExtrema ? 1 : 0)]);
			pt.touched = true;
			return;
		}
	}
}
function shortAbsorptionByKeys(targets, strategy, pts, keys, accept, priority) {
	for (let k = 0; k < pts.length; k++) {
		shortAbsorptionPointByKeys(targets, strategy, pts[k], keys, accept, priority);
	}
}

function compareZ(key, pt, f, aux) {
	if (!f(key, pt, aux)) return false;
	while (key.linkedKey) key = key.linkedKey;
	return f(key, pt, aux);
}
function cLT(key, pt, aux) {
	return key.y + aux < pt.y;
}
function cGT(key, pt, aux) {
	return key.y - aux > pt.y;
}
function cEq(key, pt, aux) {
	return Math.abs(pt.y - key.y) < aux;
}

function ipWeight(key, pt) {
	const xw = key.phantom ? (pt.x < key.xmin || pt.x > key.xmax ? 1000 : 0.1) : 10;
	return Math.hypot(xw * (key.x - pt.x), key.y - pt.y);
}

function interpolateByKeys(targets, pts, keys, priority, fuzz) {
	for (let k = 0; k < pts.length; k++) {
		let pt = pts[k];
		if (pt.touched || pt.donttouch) continue;

		let upperK = null,
			upperdist = 0xffff;
		let lowerK = null,
			lowerdist = 0xffff;
		for (let m = keys.length - 1; m >= 0; m--) {
			// adjancy exclusion
			if (!compareZ(keys[m], pt, cEq, fuzz)) continue;
			if (!adjacent(keys[m], pt) && !adjacentZ(keys[m], pt)) continue;
			pt.donttouch = true;
		}

		if (pt.touched || pt.donttouch) continue;
		for (let m = keys.length - 1; m >= 0; m--)
			if (compareZ(keys[m], pt, cLT, fuzz)) {
				if (!lowerK || ipWeight(keys[m], pt) < lowerdist) {
					lowerK = keys[m];
					lowerdist = ipWeight(keys[m], pt);
				}
			}
		for (let m = keys.length - 1; m >= 0; m--)
			if (compareZ(keys[m], pt, cGT, fuzz)) {
				if (!upperK || ipWeight(keys[m], pt) < upperdist) {
					upperK = keys[m];
					upperdist = ipWeight(keys[m], pt);
				}
			}
		if (!lowerK || !upperK) continue;

		const upperK0 = upperK,
			lowerK0 = lowerK;

		while (upperK.linkedKey) upperK = upperK.linkedKey;
		while (lowerK.linkedKey) lowerK = lowerK.linkedKey;
		if (!upperK.phantom && !lowerK.phantom) {
			if (upperK.y > lowerK.y + fuzz) {
				pt.upperK0 = upperK0;
				pt.lowerK0 = lowerK0;
				pt.upperK = upperK;
				pt.lowerK = lowerK;
				pt.ipPri = priority;
				targets.interpolations.push([upperK.id, lowerK.id, pt.id, priority]);
			} else if (upperK.id != pt.id) {
				targets.shortAbsorptions.push([upperK.id, pt.id, priority]);
			}
		}
		pt.touched = true;
	}
}

function linkRadicalSoleStemPoints(shortAbsorptions, strategy, radical, radicalStems, priority) {
	let radicalParts = [radical.outline].concat(radical.holes);
	let radicalPoints = [].concat.apply(
		[],
		radicalParts.map(function(c) {
			return c.points.slice(0, -1);
		})
	);
	for (let k = 0; k < radicalPoints.length; k++) {
		const z = radicalPoints[k];
		if (z.keypoint || z.touched || z.donttouch) continue;
		if (!z.xExtrema && !z.yExtrema) continue;
		let candidate = null;
		for (const stem of radicalStems) {
			let reject = false;
			let sc = null;
			const highpts = [].concat.apply([], stem.high);
			const lowpts = [].concat.apply([], stem.low);
			const keyPoints = highpts.concat(lowpts);
			for (let j = 0; j < keyPoints.length; j++) {
				let zkey = keyPoints[j];
				if (zkey.id === z.id || !(zkey.id >= 0) || zkey.donttouch) continue;
				if (adjacent(zkey, z) || adjacentZ(zkey, z)) {
					reject = true;
					continue;
				}
				if (
					Math.abs(z.y - zkey.y) <= strategy.Y_FUZZ &&
					Math.abs(z.x - zkey.x) <= strategy.Y_FUZZ
				) {
					continue;
				}
				if (stem.atLeft && z.x > zkey.x) continue;
				if (stem.atRight && z.x < zkey.x) continue;

				// detect whether this sole point is attached to the stem edge.
				// in most cases, absorbing a lower point should be stricter due to the topology of ideographs
				// so we use asymmetric condition for "above" and "below" cases.
				let yDifference = z.y - (zkey.y + (z.x - zkey.x) * (zkey.slope || 0));
				if (
					!(yDifference > 0
						? yDifference < strategy.Y_FUZZ * 2
						: -yDifference < strategy.Y_FUZZ)
				)
					continue;
				if (
					sc &&
					Math.hypot(z.y - sc.y, z.x - sc.x) <= Math.hypot(z.y - zkey.y, z.x - zkey.x)
				)
					continue;
				if (!radical.includesSegmentEdge(z, zkey, 1, strategy.SLOPE_FUZZ_K, 1, 1)) continue;
				sc = zkey;
			}
			if (
				!reject &&
				sc &&
				(!candidate ||
					Math.hypot(z.y - candidate.y, z.x - candidate.x) >=
						Math.hypot(z.y - sc.y, z.x - sc.x))
			) {
				candidate = sc;
			}
		}
		// And it should have at least one segment in the glyph's outline.'
		if (candidate) {
			let key = candidate;
			while (key.linkedKey) key = key.linkedKey;
			shortAbsorptions.push([key.id, z.id, priority + (z.yExtrema ? 1 : 0)]);
			z.touched = true;
		}
	}
}
function linkSoleStemPoints(shortAbsorptions, strategy, glyph, priority) {
	for (let j = 0; j < glyph.radicals.length; j++) {
		let radical = glyph.radicals[j];
		let radicalStems = glyph.stems.filter(function(s) {
			return s.belongRadical === j;
		});
		linkRadicalSoleStemPoints(shortAbsorptions, strategy, radical, radicalStems, priority);
	}
}
module.exports = function(glyph, blues, strategy) {
	let interpolations = [];
	let shortAbsorptions = [];

	const targets = { interpolations, shortAbsorptions };

	const contours = glyph.contours;
	let glyphKeypoints = [];
	for (let j = 0; j < contours.length; j++)
		for (let k = 0; k < contours[j].points.length; k++) {
			let z = contours[j].points[k];
			if ((z.touched && z.keypoint) || z.linkedKey) {
				glyphKeypoints.push(z);
			}
		}

	for (let s of glyph.stems) {
		if (s.ipHigh) {
			for (let g of s.ipHigh) {
				const [z1, z2, z] = g;
				if (z.touched || z.donttouch) continue;
				interpolations.push([z1.id, z2.id, z.id, 20]);
				z.touched = true;
				z.keypoint = true;
			}
			for (let g of s.ipLow) {
				const [z1, z2, z] = g;
				if (z.touched || z.donttouch) continue;
				interpolations.push([z1.id, z2.id, z.id, 20]);
				z.touched = true;
				z.keypoint = true;
			}
		}
	}

	// blue zone phantom points
	for (let zoneid in blues) {
		const zone = blues[zoneid];
		if (!zone.length) continue;
		for (let z of zone) {
			for (let step = -STEPS; step <= 2 * STEPS; step++) {
				glyphKeypoints.push({
					x: strategy.UPM * step / STEPS,
					xmin: strategy.UPM * (step - 1 / 2) / STEPS,
					xmax: strategy.UPM * (step - 1 / 2) / STEPS,
					y: z.y,
					linkedKey: z,
					phantom: true
				});
			}
		}
	}
	// stem phantom points
	for (let s = 0; s < glyph.stems.length; s++) {
		let stem = glyph.stems[s];
		for (let j = 0; j < stem.high.length; j++) {
			let l = stem.high[j][0];
			let r = stem.high[j][stem.high[j].length - 1];
			for (let step = 1; step < STEPS; step++) {
				glyphKeypoints.push({
					x: l.x + step / STEPS * (r.x - l.x),
					xmin: l.x + (step - 1 / 2) / STEPS * (r.x - l.x),
					xmax: l.x + (step + 1 / 2) / STEPS * (r.x - l.x),
					y: l.y + step / STEPS * (r.y - l.y),
					linkedKey: l.linkedKey || r.linkedKey,
					phantom: true
				});
			}
		}
		for (let j = 0; j < stem.low.length; j++) {
			let l = stem.low[j][0];
			let r = stem.low[j][stem.low[j].length - 1];
			for (let step = 1; step < STEPS; step++) {
				glyphKeypoints.push({
					x: l.x + step / STEPS * (r.x - l.x),
					xmin: l.x + (step - 1 / 2) / STEPS * (r.x - l.x),
					xmax: l.x + (step + 1 / 2) / STEPS * (r.x - l.x),
					y: l.y + step / STEPS * (r.y - l.y),
					linkedKey: l.linkedKey || r.linkedKey,
					phantom: true
				});
			}
		}
	}
	glyphKeypoints = glyphKeypoints.sort(BY_YORI);
	let records = [];

	for (let j = 0; j < contours.length; j++) {
		let contourpoints = contours[j].points.slice(0, -1);
		let contourAlignPoints = contourpoints
			.filter(function(p) {
				return p.touched;
			})
			.sort(BY_YORI);
		let contourExtrema = contourpoints
			.filter(function(p) {
				return p.xExtrema || p.yExtrema;
			})
			.sort(BY_YORI);

		let pmin = null,
			pmax = null;
		for (let z of contourpoints) {
			if (!pmin || z.y < pmin.y) pmin = z;
			if (!pmax || z.y > pmax.y) pmax = z;
		}

		if (contourExtrema.length > 1) {
			let extrema = contourExtrema.filter(function(z) {
				return (
					z.id !== pmin.id &&
					z.id !== pmax.id &&
					!z.touched &&
					!z.donttouch &&
					(z.yExtrema || (z.xStrongExtrema && z.turn))
				);
			});
			let midex = [];
			for (let m = 0; m < extrema.length; m++) {
				if (extrema[m].y === pmin.y) {
					if (!adjacent(pmin, extrema[m])) {
						shortAbsorptions.push([pmin.id, extrema[m].id, 1]);
					}
					extrema[m].touched = true;
					extrema[m].donttouch = true;
				} else if (extrema[m].y === pmax.y) {
					if (!adjacent(pmax, extrema[m])) {
						shortAbsorptions.push([pmax.id, extrema[m].id, 1]);
					}
					extrema[m].touched = true;
					extrema[m].donttouch = true;
				} else if (extrema[m].id !== pmin.id) {
					midex.push(extrema[m]);
				}
			}
			let blues = contourpoints.filter(function(p) {
				return p.blued;
			});
			let midexl = contourExtrema.filter(function(p) {
				return p.xExtrema || p.yExtrema;
			});
			records.push({
				topbot: [pmin, pmax],
				midex: midex,
				midexl: midexl,
				blues: blues,
				cka: contourAlignPoints
			});
		} else {
			records.push({
				topbot: [pmin, pmax],
				midex: [],
				midexl: [],
				blues: [],
				cka: contourAlignPoints
			});
		}
	}
	for (let j = 0; j < contours.length; j++) {
		shortAbsorptionByKeys(
			targets,
			strategy,
			records[j].topbot.filter(pt => pt.xStrongExtrema),
			records[j].cka.filter(k => k.blued),
			{ direct: true },
			11
		);
		shortAbsorptionByKeys(
			targets,
			strategy,
			records[j].midexl.filter(pt => pt.xStrongExtrema),
			records[j].blues.filter(k => k.blued),
			{ direct: true },
			9
		);
	}
	linkSoleStemPoints(shortAbsorptions, strategy, glyph, 7);
	let b = [];
	for (let j = 0; j < contours.length; j++) {
		interpolateByKeys(targets, records[j].topbot, glyphKeypoints, 5, strategy.Y_FUZZ);
		interpolateByKeys(targets, records[j].topbot, glyphKeypoints, 5, 1);
		b = b.concat(records[j].topbot.filter(z => z.touched));
	}
	glyphKeypoints = glyphKeypoints.concat(b).sort(BY_YORI);
	for (let j = 0; j < contours.length; j++) {
		interpolateByKeys(targets, records[j].midex, glyphKeypoints, 3, strategy.Y_FUZZ);
		interpolateByKeys(targets, records[j].midex, glyphKeypoints, 3, 1);
		shortAbsorptionByKeys(
			targets,
			strategy,
			records[j].midexl,
			records[j].midex.filter(z => z.touched || z.keypoint),
			{ ip: true },
			1
		);
	}
	interpolations = interpolations.sort(function(u, v) {
		return glyph.indexedPoints[u[2]].x - glyph.indexedPoints[v[2]].x;
	});
	// cleanup
	for (let j = 0; j < interpolations.length; j++) {
		if (!interpolations[j]) continue;
		for (let k = j + 1; k < interpolations.length; k++) {
			if (
				interpolations[k] &&
				interpolations[j][0] === interpolations[k][0] &&
				interpolations[j][1] === interpolations[k][1] &&
				interpolations[j][3] === interpolations[k][3] &&
				interpolations[j][3] !== 9 &&
				Math.abs(
					glyph.indexedPoints[interpolations[j][2]].y -
						glyph.indexedPoints[interpolations[k][2]].y
				) <= strategy.Y_FUZZ
			) {
				shortAbsorptions.push([
					interpolations[j][2],
					interpolations[k][2],
					interpolations[j][3] - 1
				]);
				interpolations[k] = null;
			}
		}
	}
	return {
		interpolations: interpolations.filter(x => x),
		shortAbsorptions: shortAbsorptions.filter(a => a[0] !== a[1]),
		diagAligns: []
	};
};
