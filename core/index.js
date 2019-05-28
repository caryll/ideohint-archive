"use strict";

const { findStems } = require("../core/findstem");
const { extractFeature } = require("../core/extractfeature");
const hintForSize = require("../core/hinter");
const { parseOTD } = require("./otdParser");
const { xclamp, toVQ } = require("../support/common");
const roundings = require("../support/roundings");

exports.version = 1017003;

exports.hintSingleGlyph = function(contours, strategy) {
	return exports.decideHints(
		exports.extractFeature(exports.parseOTD(contours), strategy),
		strategy
	);
};
exports.parseOTD = function(contours) {
	return parseOTD(contours);
};
exports.extractFeature = function(g, strategy) {
	return extractFeature(findStems(g, strategy), strategy);
};

// all-size hinter

function by_rp(a, b) {
	return a[0] - b[0] || a[1] - b[1];
}
function getIpsaCalls(glyph) {
	let ip = [];
	let sa = [];
	for (let j = 0; j < glyph.interpolations.length; j++) {
		if (!ip[glyph.interpolations[j][3]]) ip[glyph.interpolations[j][3]] = [];
		ip[glyph.interpolations[j][3]].push(glyph.interpolations[j]);
	}
	for (let j = 0; j < glyph.shortAbsorptions.length; j++) {
		if (!sa[glyph.shortAbsorptions[j][2]]) sa[glyph.shortAbsorptions[j][2]] = [];
		sa[glyph.shortAbsorptions[j][2]].push(glyph.shortAbsorptions[j]);
	}
	let ipsacalls = [];
	let maxpri = Math.max(ip.length - 1, sa.length - 1);
	for (let j = maxpri; j >= 0; j--) {
		ipsacalls = ipsacalls.concat(
			ip[j] ? ip[j].sort(by_rp).map(slicelast) : [],
			sa[j] ? sa[j].sort(by_rp).map(slicelast) : []
		);
	}
	return ipsacalls.filter(x => !!x);
}
function slicelast(x) {
	return x.slice(0, -1);
}

class SizeIndependentStem {
	constructor(s) {
		this.posKeyAtTop = s.posKeyAtTop;
		this.posKey = s.posKey;
		this.advKey = s.advKey;
		this.posAlign = s.posAlign;
		this.advAlign = s.advAlign;
		this.diagHigh = s.diagHigh;
		this.diagLow = s.diagLow;
		this.slope = s.slope;
		this.rid = s.rid;
		this.atLeft = s.atLeft;
		this.atRight = s.atRight;
		this.xmin = s.xmin;
		this.xmax = s.xmax;
		this.hasGlyphStemBelow = s.hasGlyphStemBelow;
		this.hasGlyphFoldBelow = s.hasGlyphFoldBelow;
		this.hasGlyphSideFoldBelow = s.hasGlyphSideFoldBelow;
		this.hasGlyphStemAbove = s.hasGlyphStemAbove;
		this.hasGlyphFoldAbove = s.hasGlyphFoldAbove;
	}
}
class SizeIndependentHints {
	constructor(featData, strategy) {
		this.upm = strategy.UPM;
		this.blue = featData.blueZoned;
		this.blue.topPos = strategy.BLUEZONE_TOP_CENTER;
		this.blue.bottomPos = strategy.BLUEZONE_BOTTOM_CENTER;
		this.ipsacalls = getIpsaCalls(featData);
		this.diagAligns = featData.diagAligns;
		this.xIP = featData.xIP;
		this.overlaps = featData.overlaps;
		this.directOverlaps = featData.directOverlaps;
		this.stems = featData.stems.map(s => new SizeIndependentStem(s));
	}
}
class SizeDependentHints {
	constructor(h) {
		this.x = h.x;
		this.y = h.y;
	}
}

function topbotOf(strategy, upm, ppem) {
	const uppx = upm / ppem;
	const b = Math.round(roundings.rtg(strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem) / uppx);
	const t =
		b +
		Math.round(
			roundings.rtg(
				strategy.BLUEZONE_TOP_CENTER - strategy.BLUEZONE_BOTTOM_CENTER,
				upm,
				ppem
			) / uppx
		);
	return [b, t];
}

function swapProp(o, a, b) {
	const t = o[a];
	o[a] = o[b];
	o[b] = t;
}

exports.decideHints = function(featData, strategy) {
	const upm = strategy.UPM;

	let actions = [];
	let sd = [];

	// Cross-PPEM consistency parameters
	// Initial stroke positions for this PPEM
	let initialY = null;
	// Required marins
	let margins = null;
	// Collide multiplers (to keep annexeation from (ppem+1) to (ppem))
	let colMultipliers = [];
	// Annex multiplers (to keep annexeation from (ppem+1) to (ppem))
	let annexMultipliers = [];
	// Maximum stroke width at this ppem
	let maxStrokeWidths = [];

	for (let j = 0; j < featData.stems.length; j++) {
		annexMultipliers[j] = [];
		colMultipliers[j] = [];
		maxStrokeWidths[j] = strategy.PPEM_MAX * 8;
		for (let k = 0; k < featData.stems.length; k++) {
			annexMultipliers[j][k] = 1;
			colMultipliers[j][k] = 1;
		}
	}

	for (let ppem = strategy.PPEM_MAX; ppem >= strategy.PPEM_MIN; ppem--) {
		const actions = hintForSize(featData, ppem, strategy, {
			y0: initialY,
			margins: margins,
			colMultipliers,
			annexMultipliers,
			maxStrokeWidths
		});
		actions[ppem] = actions;
		sd[ppem] = new SizeDependentHints(actions);

		const thatPPEM = ppem - 1;
		const [bottomThis, topThis] = topbotOf(strategy, upm, ppem);
		const [bottomThat, topThat] = topbotOf(strategy, upm, thatPPEM);

		// Update maxStrokeWidths
		for (let j = 0; j < featData.stems.length; j++) {
			maxStrokeWidths[j] = actions.y[j][1];
		}

		// Update colMultipliers
		for (let j = 0; j < featData.stems.length; j++) {
			for (let k = 0; k < featData.stems.length; k++) {
				if (!featData.directOverlaps[j][k] && !featData.directOverlaps[k][j]) continue;
				if (actions.y[j][0] === actions.y[k][0]) {
					annexMultipliers[j][k] = annexMultipliers[k][j] = 1 / 1000;
					colMultipliers[j][k] = colMultipliers[k][j] = 1000;
				}
			}
		}

		// Update margins

		margins = actions.y.map(([y, w]) => ({
			bottom: y - w - bottomThis - 1,
			top: topThis - y - 1
		}));

		// Update initialY
		initialY = actions.y.map(function(a) {
			const y = a[0];
			const w = a[1];
			const w1 = Math.round(
				w *
					Math.max(
						1,
						Math.round(toVQ(strategy.CANONICAL_STEM_WIDTH, thatPPEM) / (upm / thatPPEM))
					) /
					Math.max(
						1,
						Math.round(toVQ(strategy.CANONICAL_STEM_WIDTH, ppem) / (upm / ppem))
					)
			);
			const spaceBelow = y - w - bottomThis,
				spaceAbove = topThis - y;
			if (spaceBelow < spaceAbove) {
				const spaceBelow1 =
					spaceBelow * (topThat - bottomThat - w1) / (spaceBelow + spaceAbove);
				if (spaceBelow > 1 / 2) {
					return xclamp(
						bottomThat,
						bottomThat + Math.max(1, Math.round(spaceBelow1)) + w1,
						topThat
					);
				} else {
					return xclamp(
						bottomThat,
						bottomThat + Math.max(0, Math.round(spaceBelow1)) + w1,
						topThat
					);
				}
			} else {
				const spaceAbove1 =
					spaceAbove * (topThat - bottomThat - w1) / (spaceBelow + spaceAbove);
				if (spaceAbove > 1 / 2) {
					return xclamp(
						bottomThat,
						topThat - Math.max(1, Math.round(spaceAbove1)),
						topThat
					);
				} else {
					return xclamp(
						bottomThat,
						topThat - Math.max(0, Math.round(spaceAbove1)),
						topThat
					);
				}
			}
		});
	}

	if (actions[strategy.PPEM_MAX] && actions[strategy.PPEM_MAX].symmetry) {
		for (let j = 0; j < featData.stems.length; j++) {
			for (let k = 0; k < j; k++) {
				if (!actions[strategy.PPEM_MAX].symmetry[j][k]) continue;
				const pat = featData.stems[j].posKeyAtTop || featData.stems[k].posKeyAtTop;
				for (let stem of [featData.stems[j], featData.stems[k]]) {
					if (stem.posKeyAtTop === pat) continue;
					stem.posKeyAtTop = pat;
					swapProp(stem, "posKey", "advKey");
					swapProp(stem, "posAlign", "advAlign");
				}
			}
		}
	}

	return {
		si: new SizeIndependentHints(featData, strategy),
		sd: sd,
		pmin: strategy.PPEM_MIN,
		pmax: strategy.PPEM_MAX
	};
};
