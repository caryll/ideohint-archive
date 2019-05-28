"use strict";

const roundings = require("../../support/roundings");

function table(min, max, f) {
	let a = [];
	for (let j = min; j <= max; j++) {
		a[j] = f(j);
	}
	return a;
}

function yAnchoredPositions(r, upm, pmin, pmax) {
	return table(pmin, pmax, ppem => roundings.rtg(r.pOrg, upm, ppem));
}

function iphintedPositions(bottomStem, r, topStem, pmin, pmax) {
	return table(pmin, pmax, ppem => {
		const org_dist = r.pOrg - bottomStem.pOrg;
		const org_range = topStem.pOrg - bottomStem.pOrg;
		const cur_range = topStem.hintedPositions[ppem] - bottomStem.hintedPositions[ppem];
		return bottomStem.hintedPositions[ppem] + cur_range * org_dist / org_range;
	});
}

function distHintedPositions(rp0, r, upm, pmin, pmax) {
	return table(pmin, pmax, ppem => {
		return roundings.rtg(
			rp0.hintedPositions[ppem] +
				roundings.toF26D6P(r.pOrg, upm, ppem) * (upm / ppem) -
				roundings.toF26D6P(rp0.pOrg, upm, ppem) * (upm / ppem),
			upm,
			ppem
		);
		//return rp0.hintedPositions[ppem] + roundings.rtgDiff(r.pOrg, rp0.pOrg, upm, ppem);
	});
}

exports.table = table;
exports.iphintedPositions = iphintedPositions;
exports.distHintedPositions = distHintedPositions;
exports.yAnchoredPositions = yAnchoredPositions;
