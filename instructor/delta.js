"use strict";

const roundings = require("../support/roundings");
const { xclamp, toVQ } = require("../support/common");

const STRICT_CUTOFF = 1 / 8;

function decideDelta(gear, original, target, upm, ppem) {
	return Math.round(gear * (target - original) / (upm / ppem));
}

const GAMMA = 2;
function corSW(x) {
	const integral = Math.floor(x);
	const fraction = x - integral;
	const corrected =
		integral > 1 || fraction > 1 / 2 ? fraction : 1 / 2 * Math.pow(fraction * 2, 1 / GAMMA);
	return integral + corrected;
}

/**
 * Decide the delta of a link
 * @param {number} gear
 * @param {number} sign
 * @param {boolean} isHard
 * @param {boolean} isStacked
 * @param {number} base0
 * @param {number} dist0
 * @param {number} base1
 * @param {number} dist1
 * @param {number} upm
 * @param {number} ppem
 * @param {number} addpxs
 */
function decideDeltaShift(
	gear,
	sign,
	isHard,
	isStacked,
	base0,
	dist0,
	base1,
	dist1,
	upm,
	ppem,
	swcfg
) {
	const { minSW, maxOverflow, maxShrink } = swcfg || {};
	const uppx = upm / ppem;
	const y1 = base0 + sign * dist0;
	const y2 = base1 + sign * dist1;
	const origPixels = corSW(dist0 / uppx);
	const desiredWidthPixels = Math.min(
		origPixels,
		isStacked ? Math.max(0, Math.floor((origPixels - uppx / 2) / uppx)) + 3 / 4 : origPixels,
		Math.max(isStacked ? 3 / 8 : 0, origPixels * (isStacked ? 5 / 8 : 1))
	);
	const yDesired = base1 + desiredWidthPixels * sign * uppx;
	const deltaStart = Math.round(gear * (y2 - y1) / uppx);
	const deltaDesired = Math.round(gear * (yDesired - y1) / uppx);
	let delta = deltaStart - deltaDesired;
	// We will try to reduce delta to 0 when there is "enough space".
	while (delta) {
		const delta1 = delta > 0 ? delta - 1 : delta + 1;
		const y2a = y1 + (deltaDesired + delta1) * uppx / gear;
		const d = Math.abs(base1 - y2a);
		if (!isStacked && d < (minSW || 0) * uppx) break;
		if (isStacked && dist1 < uppx * 1.01) {
			// pass
		} else {
			if (
				roundings.rtgDiff(y2, base1, upm, ppem) !== roundings.rtgDiff(y2a, base1, upm, ppem)
			)
				break; // wrong pixel!
			if (!isStacked) {
				if (
					isHard &&
					(sign > 0 ||
						Math.abs(y2a - roundings.rtg(y2, upm, ppem)) > STRICT_CUTOFF * uppx)
				)
					break;
				if (Math.abs(y2a - base1) - Math.abs(y2 - base1) > (maxOverflow || 1 / 2) * uppx)
					break;
				if (Math.abs(y2 - base1) - Math.abs(y2a - base1) > (maxShrink || 1 / 2) * uppx)
					break;
			}
		}
		delta = delta > 0 ? delta - 1 : delta + 1;
	}
	return delta + deltaDesired;
}

exports.decideDelta = decideDelta;
exports.decideDeltaShift = decideDeltaShift;

exports.getSWCFG = function(ctx, darkness, ppem) {
	return {
		minSW: toVQ(ctx.minSW || 3 / 4, ppem) * darkness,
		maxOverflow: xclamp(1 / 32, toVQ(ctx.maxSWOverflowCpxs || 50, ppem) / 100, 1 / 2),
		maxShrink: xclamp(1 / 32, toVQ(ctx.maxSWShrinkCpxs || 50, ppem) / 100, 1 / 2)
	};
};
