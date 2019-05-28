"use strict";

const { overlapInfo, overlapRatio } = require("../si-common/overlap");
const slopeOf = require("../types/").slopeOf;
const { leftmostZ_SS: leftmostZ, rightmostZ_SS: rightmostZ, expandZ } = require("../si-common/seg");
const { xclamp, mix, mixz, toVQ } = require("../../support/common");

const Stem = require("./couplestem");

// substeps
const findHorizontalSegments = require("./segments");
//const pairSymmetricStems = require("./pair-symmetric-stems");
const { splitDiagonalStems } = require("./split-diagonal-stems");

function by_yori(a, b) {
	if (a[0].y !== b[0].y) return a[0].y - b[0].y;
	return a[0].x - b[0].x;
}
function by_xori(a, b) {
	if (a[0].x !== b[0].x) return a[0].x - b[0].x;
	return a[0].y - b[0].y;
}

const PROPORTION = 1.25;
const PROBES = 8;

const MATCH_OPPOSITE = 1;
const MATCH_SAME_SIDE = 2;

function testExpandRho(rho, p, q, coP, coQ, slope1, slope2, radical, upm) {
	const left = expandZ(radical, mixz(p, q, rho), -1, -mix(slope1, slope2, rho), upm);
	const right = expandZ(radical, mixz(coP, coQ, rho), 1, mix(slope1, slope2, rho), upm);
	return right.x - left.x < Math.abs(p.y - q.y) * PROPORTION;
}

function stemShapeIsIncorrect(radical, strategy, u, v, mh) {
	const p = leftmostZ(u);
	const q = leftmostZ(v);
	const coP = rightmostZ(u);
	const coQ = rightmostZ(v);
	const upm = strategy.UPM;
	const sprop = xclamp(0, Math.max(coP.x - p.x, coQ.x - q.x) / strategy.UPM * 2, 1);

	const slope1 = slopeOf(u),
		slope2 = slopeOf(v),
		slope = (slope1 + slope2) / 2;
	if (
		slope >= 0
			? slope1 > strategy.SLOPE_FUZZ * sprop && slope2 > strategy.SLOPE_FUZZ * sprop
			: slope1 < -strategy.SLOPE_FUZZ_NEG * sprop && slope2 < -strategy.SLOPE_FUZZ_NEG * sprop
	) {
		return true;
	}
	if (Math.abs(p.y - q.y) > mh) {
		return true;
	}

	if (
		coP.x - p.x >= Math.abs(p.y - q.y) * PROPORTION &&
		coQ.x - q.x >= Math.abs(p.y - q.y) * PROPORTION
	)
		return false;
	// do some expansion
	if (testExpandRho(0, p, q, coP, coQ, slope1, slope2, radical, upm)) return true;
	if (testExpandRho(1, p, q, coP, coQ, slope1, slope2, radical, upm)) return true;
	for (let rho = 1; rho < PROBES; rho++) {
		if (testExpandRho(rho / PROBES, p, q, coP, coQ, slope1, slope2, radical, upm)) return true;
	}
}

function uuCouplable(sj, sk, radical, strategy) {
	let slope = (slopeOf([sj]) + slopeOf([sk])) / 2;
	let ref = leftmostZ([sj]);
	let focus = leftmostZ([sk]);
	let desired = ref.y + (focus.x - ref.x) * slope;
	let delta = Math.abs(focus.x - ref.x) * strategy.SLOPE_FUZZ_P + strategy.Y_FUZZ;
	return Math.abs(focus.y - desired) <= delta && segmentJoinable(sj, sk, radical);
}
function segmentJoinable(pivot, segment, radical) {
	for (let k = 0; k < pivot.length; k++) {
		for (let j = 0; j < segment.length; j++) {
			if (!radical.includesSegmentEdge(segment[j], pivot[k], 2, 2, 1, 1)) continue;
			return true;
		}
	}
	return false;
}

function udMatchable(sj, sk, radical, strategy) {
	if (!radical.includesTetragon(sj, sk, strategy.X_FUZZ)) return false;
	const slopeJ = slopeOf([sj]);
	const slopeK = slopeOf([sk]);
	if (!!slopeJ !== !!slopeK && Math.abs(slopeJ - slopeK) >= strategy.SLOPE_FUZZ / 2) return false;
	return true;
}

function segOverlapIsValid(highEdge, lowEdge, strategy, radical) {
	const segOverlap = overlapInfo(highEdge, lowEdge, radical, radical);
	const segOverlap0 = overlapInfo(highEdge, lowEdge);

	const ovlExt = Math.min(segOverlap.len / segOverlap.la, segOverlap.len / segOverlap.lb);
	const ovlOri = Math.min(segOverlap0.len / segOverlap0.la, segOverlap0.len / segOverlap0.lb);

	return ovlExt * ovlOri >= strategy.STROKE_SEGMENTS_MIN_OVERLAP;
}

function identifyStem(radical, _used, segs, graph, ove, up, j, strategy) {
	let candidate = { high: [], low: [] };
	const maxh =
		toVQ(strategy.CANONICAL_STEM_WIDTH, strategy.PPEM_MAX) *
		strategy.CANONICAL_STEM_WIDTH_LIMIT_X;
	if (up[j]) {
		candidate.high.push(j);
	} else {
		candidate.low.push(j);
	}
	let used = [..._used];
	used[j] = true;
	let rounds = 0;
	while (rounds < 3) {
		rounds += 1;
		let expandingU = false;
		let expandingD = true;
		let pass = 0;
		while (expandingU || expandingD) {
			pass += 1;
			if (pass % 2) {
				expandingD = false;
			} else {
				expandingU = false;
			}
			let maxOve = -1;
			let sk = null;
			for (let k = 0; k < segs.length; k++) {
				if ((used[k] && (used[k] || 0) - 0 <= pass) || (up[k] !== up[j]) !== !!(pass % 2))
					continue;
				let sameSide, otherSide;
				if (up[k]) {
					sameSide = candidate.high;
					otherSide = candidate.low;
				} else {
					sameSide = candidate.low;
					otherSide = candidate.high;
				}
				let matchD = true;
				let matchU = !sameSide.length;
				for (let s = 0; s < sameSide.length; s++) {
					let hj = sameSide[s];
					if (graph[k][hj] === MATCH_SAME_SIDE || graph[hj][k] === MATCH_SAME_SIDE)
						matchU = true;
				}
				for (let s = 0; s < otherSide.length; s++) {
					let hj = otherSide[s];
					if (graph[k][hj] !== MATCH_OPPOSITE && graph[hj][k] !== MATCH_OPPOSITE)
						matchD = false;
				}
				if (matchU && matchD) {
					let oveK = 0;
					for (let j of otherSide) oveK = Math.max(oveK, ove[j][k]);

					if (oveK > maxOve) {
						sk = { sid: k, ove: oveK, sameSide, otherSide };
						maxOve = oveK;
					}
				}
			}
			if (sk) {
				sk.sameSide.push(sk.sid);
				if (pass % 2) {
					expandingD = true;
				} else {
					expandingU = true;
				}
				used[sk.sid] = pass;
			}
		}
		if (candidate.high.length && candidate.low.length) {
			let highEdge = [];
			let lowEdge = [];
			for (let m = 0; m < candidate.high.length; m++) {
				highEdge[m] = segs[candidate.high[m]];
			}
			for (let m = 0; m < candidate.low.length; m++) {
				lowEdge[m] = segs[candidate.low[m]];
			}
			highEdge = highEdge.sort(by_xori);
			lowEdge = lowEdge.sort(by_xori).reverse();

			if (!segOverlapIsValid(highEdge, lowEdge, strategy, radical)) continue;
			if (stemShapeIsIncorrect(radical, strategy, highEdge, lowEdge, maxh)) continue;

			for (let s of candidate.high) _used[s] = true;
			for (let s of candidate.low) _used[s] = true;
			return { high: highEdge, low: lowEdge };
		}
	}
	return null;
}

function pairSegmentsForRadical(radicals, r, strategy) {
	const radical = radicals[r];
	let graph = [],
		ove = [],
		up = [];
	let segs = radical.segments.sort(by_yori);
	for (let j = 0; j < segs.length; j++) {
		graph[j] = [];
		ove[j] = [];
		for (let k = 0; k < segs.length; k++) {
			graph[j][k] = 0;
			ove[j][k] = 0;
		}
	}
	for (let j = 0; j < segs.length; j++) {
		let sj = segs[j];
		let upperEdgeJ = radical.outline.ccw !== sj[0].x < sj[sj.length - 1].x;
		up[j] = upperEdgeJ;
		for (let k = 0; k < j; k++) {
			let sk = segs[k];
			let upperEdgeK = radical.outline.ccw !== sk[0].x < sk[sk.length - 1].x;
			if (upperEdgeJ === upperEdgeK) {
				// Both upper
				graph[j][k] = graph[k][j] = uuCouplable(sj, sk, radical, strategy)
					? MATCH_SAME_SIDE
					: 0;
			} else {
				graph[j][k] = graph[k][j] = udMatchable(sj, sk, radical, strategy)
					? MATCH_OPPOSITE
					: 0;
			}
			ove[j][k] = ove[k][j] = overlapRatio([sj], [sk], Math.min);
		}
	}
	let candidates = [];
	let used = [];
	for (let j = 0; j < segs.length; j++) {
		if (used[j]) continue;
		const stroke = identifyStem(radical, used, segs, graph, ove, up, j, strategy);
		if (stroke) candidates.push(stroke);
	}
	return candidates.map(s => new Stem(s.high, s.low, r).calculateMinmax(radicals, strategy));
}

function pairSegments(radicals, strategy) {
	let stems = [];
	for (let r = 0; r < radicals.length; r++) {
		let radicalStems = pairSegmentsForRadical(radicals, r, strategy);
		stems = stems.concat(radicalStems);
		radicals[r].stems = radicalStems;
	}
	return stems;
}

function byY(a, b) {
	if (a.y < b.y) return -1;
	if (a.y > b.y) return 1;
	if (a.width > b.width) return -1;
	if (a.width < b.width) return 1;
	return 0;
}

module.exports = function(radicals, strategy) {
	findHorizontalSegments(radicals, strategy);
	let ss = pairSegments(radicals, strategy).sort(byY);
	//	ss = pairSymmetricStems(ss, strategy);
	ss = splitDiagonalStems(ss, strategy);
	for (let s of ss) {
		s
			.calculateYW(strategy)
			.calculateMinmax(radicals, strategy)
			.calculateExp(radicals[s.belongRadical]);
	}
	return ss.sort(byY);
};
