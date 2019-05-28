"use strict";

function approSlope(z1, z2, strategy) {
	const slope = (z1.y - z2.y) / (z1.x - z2.x);
	return slope >= 0 ? slope <= strategy.SLOPE_FUZZ_POS : slope >= -strategy.SLOPE_FUZZ_NEG;
}

function eqSlopeA(z1, z2) {
	return z1.y === z2.y && ((z1.on && z2.on) || (!z1.on && !z2.on));
}

function approSlopeA(z1, z2, strategy) {
	const slope = (z1.y - z2.y) / (z1.x - z2.x);
	return (
		Math.abs(z2.x - z1.x) >= strategy.Y_FUZZ * 2 &&
		(slope >= 0 ? slope <= strategy.SLOPE_FUZZ : slope >= -strategy.SLOPE_FUZZ_NEG)
	);
}

function approSlopeT(z1, z2, strategy) {
	const slope = (z1.y - z2.y) / (z1.x - z2.x);
	return slope >= 0 ? slope <= strategy.SLOPE_FUZZ_POST : slope >= -strategy.SLOPE_FUZZ_NEG;
}

function tryPushSegment(s, ss, approSlopeA, coupled, strategy) {
	while (s.length > 1) {
		if (approSlopeA(s[0], s[s.length - 1], strategy)) {
			for (let z of s) {
				coupled[z.id] = true;
			}
			ss.push(s);
			return;
		} else {
			s = s.shift();
		}
	}
}

const SEGMENT_STRATEGIES = [[eqSlopeA, eqSlopeA, eqSlopeA], [approSlope, approSlopeT, approSlopeA]];

function findHSegInContour(r, segments, contour, strategy) {
	function restart(z) {
		lastPoint = z;
		segment = [lastPoint];
		segment.radical = r;
	}
	let coupled = {};
	let z0 = contour.points[0];
	let lastPoint = z0;
	let segment = [lastPoint];
	for (let [as1, as1t, as2] of SEGMENT_STRATEGIES) {
		restart(z0);
		let tores = false;
		for (let k = 1; k < contour.points.length - 1; k++) {
			const z = contour.points[k];
			if (tores || z.interpolated || coupled[lastPoint.id]) {
				restart(z);
				tores = false;
			} else if (!coupled[z.id] && as1t(z, lastPoint, strategy)) {
				segment.push(z);
				if (segment.length > 2 && !as1(z, lastPoint, strategy)) {
					tryPushSegment(segment, segments, as2, coupled, strategy);
					tores = true;
				} else {
					lastPoint = z;
					tores = false;
				}
			} else {
				tryPushSegment(segment, segments, as2, coupled, strategy);
				restart(z);
				tores = false;
			}
		}
		if (!coupled[z0.id] && as1(z0, lastPoint, strategy)) {
			if (segments[0] && segments[0][0] === z0) {
				const firstSeg = segment.concat(segments.shift());
				firstSeg.radical = r;
				tryPushSegment(firstSeg, segments, as2, coupled, strategy);
				segment = [z0];
				segment.radical = r;
			} else {
				segment.push(z0);
			}
		}
		tryPushSegment(segment, segments, as2, coupled, strategy);
	}
}

// Stemfinding
module.exports = function findHorizontalSegments(radicals, strategy) {
	let segments = [];
	for (let r = 0; r < radicals.length; r++) {
		let radicalParts = [radicals[r].outline].concat(radicals[r].holes);
		for (let j = 0; j < radicalParts.length; j++) {
			findHSegInContour(r, segments, radicalParts[j], strategy);
		}
	}

	segments = segments.sort(function(p, q) {
		return p[0].x - q[0].x;
	});
	// Join segments
	for (let j = 0; j < segments.length; j++) {
		if (!segments[j]) continue;
		let pivotRadical = segments[j].radical;
		radicals[pivotRadical].segments.push(segments[j]);
	}
};
