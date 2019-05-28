"use strict";

/// Overlap analysis

const { leftmostZ_S: leftmostZ, rightmostZ_S: rightmostZ, expandZ } = require("./seg");
const slopeOf = require("../types/").slopeOf;

function byAt(p, q) {
	return p.at - q.at;
}
function pushEvents(events, seg, radical, s, isA) {
	let z0 = leftmostZ(seg),
		zm = rightmostZ(seg);
	// once radical is present we would expand the segments
	// so that the overlapping factor would be more accurate
	if (radical) {
		z0 = expandZ(radical, z0, -1, -s, 1000);
		zm = expandZ(radical, zm, 1, s, 1000);
	}
	if (z0.x < zm.x) {
		events.push({ at: z0.x, on: true, a: isA });
		events.push({ at: zm.x, on: false, a: isA });
	}
}

function overlapInfo(a, b, ra, rb) {
	const slopeA = slopeOf(a),
		slopeB = slopeOf(b);
	let events = [];
	for (let j = 0; j < a.length; j++) {
		pushEvents(events, a[j], ra, slopeA, true);
	}
	for (let j = 0; j < b.length; j++) {
		pushEvents(events, b[j], rb, slopeB, false);
	}
	events.sort(byAt);
	let len = 0,
		la = 0,
		lb = 0;
	let st = 0,
		sa = 0,
		sb = 0;
	let ac = 0;
	let bc = 0;
	for (let j = 0; j < events.length; j++) {
		const e = events[j];
		const intersectBefore = ac * bc;
		const ab = ac,
			bb = bc;
		if (e.a) {
			if (e.on) ac += 1;
			else ac -= 1;
		} else {
			if (e.on) bc += 1;
			else bc -= 1;
		}
		if (ac * bc && !intersectBefore) st = e.at;
		if (!(ac * bc) && intersectBefore) len += e.at - st;
		if (ac && !ab) sa = e.at;
		if (!ac && ab) la += e.at - sa;
		if (bc && !bb) sb = e.at;
		if (!bc && bb) lb += e.at - sb;
	}
	return {
		len: len,
		la: la,
		lb: lb
	};
}

function overlapRatio(a, b, op) {
	const i = overlapInfo(a, b);
	return op(i.len / i.la, i.len / i.lb);
}

function stemOverlapRatio(a, b, op) {
	const ovr = Math.max(
		overlapRatio(a.lowExp, b.lowExp, op),
		overlapRatio(a.highExp, b.lowExp, op),
		overlapRatio(a.lowExp, b.highExp, op),
		overlapRatio(a.highExp, b.highExp, op)
	);
	const lenRaw = Math.max(
		overlapInfo(a.low, b.low).len,
		overlapInfo(a.high, b.low).len,
		overlapInfo(a.low, b.high).len,
		overlapInfo(a.high, b.high).len
	);
	if (!lenRaw) {
		return 0;
	} else {
		return ovr;
	}
}
function stemOverlapLength(a, b) {
	const len = Math.max(
		overlapInfo(a.lowExp, b.lowExp).len,
		overlapInfo(a.highExp, b.lowExp).len,
		overlapInfo(a.lowExp, b.highExp).len,
		overlapInfo(a.highExp, b.highExp).len
	);
	const lenRaw = Math.max(
		overlapInfo(a.low, b.low).len,
		overlapInfo(a.high, b.low).len,
		overlapInfo(a.low, b.high).len,
		overlapInfo(a.high, b.high).len
	);

	if (!lenRaw) {
		return 0;
	} else {
		return len;
	}
}

exports.overlapInfo = overlapInfo;
exports.overlapRatio = overlapRatio;
exports.stemOverlapRatio = stemOverlapRatio;
exports.stemOverlapLength = stemOverlapLength;

//////

function edgetouch(s, t) {
	if (s.xmax - s.xmin < t.xmax - t.xmin) return edgetouch(t, s);
	return (
		(s.xmin < t.xmin &&
			t.xmin < s.xmax &&
			s.xmax < t.xmax &&
			(s.xmax - t.xmin) / (s.xmax - s.xmin) <= 0.2) ||
		(t.xmin < s.xmin &&
			s.xmin < t.xmax &&
			t.xmax < s.xmax &&
			(t.xmax - s.xmin) / (s.xmax - s.xmin) <= 0.2)
	);
}

exports.analyzeDirectOverlaps = function(glyph, strategy, loose) {
	var d = [];
	for (var j = 0; j < glyph.stemOverlaps.length; j++) {
		d[j] = [];
		for (var k = 0; k < j; k++) {
			d[j][k] =
				glyph.stemOverlaps[j][k] > strategy.COLLISION_MIN_OVERLAP_RATIO &&
				!edgetouch(glyph.stems[j], glyph.stems[k]);
			if (loose && glyph.collisionMatrices.collision[j][k] <= 0) d[j][k] = false;
			if (glyph.stems[j].rid && glyph.stems[j].rid === glyph.stems[k].rid) d[j][k] = false;
		}
	}
	for (var x = 0; x < d.length; x++)
		for (var y = 0; y < d.length; y++)
			for (var z = 0; z < d.length; z++) {
				if (d[x][y] && d[y][z]) d[x][z] = false;
			}
	return d;
};

exports.transitionClosure = function(d) {
	let o = [];
	for (let j = 0; j < d.length; j++) {
		o[j] = d[j].slice(0);
	}
	for (let m = 0; m < o.length; m++)
		for (let j = 0; j < o.length; j++)
			for (let k = 0; k < o.length; k++) o[j][k] = o[j][k] || (o[j][m] && o[m][k]);
	return o;
};
