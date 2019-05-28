"use strict";

const { leftmostZ_SS: leftmostZ, rightmostZ_SS: rightmostZ, expandZ } = require("../si-common/seg");

function pointBelowStem(point, stem, fuzz) {
	return point.y < stem.y - stem.width - fuzz;
}

function analyzeRadicalPointsToStemRelationships(radical, stem, sameRadical, strategy) {
	stem.promixityUp = 0;
	stem.promixityDown = 0;
	const blueFuzz = strategy.BLUEZONE_WIDTH || 15;
	const a0 = stem.low[0][0].x,
		az = stem.low[stem.low.length - 1][stem.low[stem.low.length - 1].length - 1].x;
	const b0 = stem.high[0][0].x,
		bz = stem.high[stem.high.length - 1][stem.high[stem.high.length - 1].length - 1].x;
	const xmin = Math.min(a0, b0, az, bz),
		xmax = Math.max(a0, b0, az, bz);
	const radicalParts = [radical.outline].concat(radical.holes);
	for (let j = 0; j < radicalParts.length; j++)
		for (let k = 0; k < radicalParts[j].points.length - 1; k++) {
			const point = radicalParts[j].points[k];
			if (point.y > stem.y && point.x < xmax - blueFuzz && point.x > xmin + blueFuzz) {
				stem.hasGlyphPointAbove = true;
				stem.glyphCenterRise = Math.max(stem.glyphCenterRise || 0, point.y - stem.y);
				if (sameRadical) {
					stem.hasRadicalPointAbove = true;
					stem.radicalCenterRise = Math.max(
						stem.radicalCenterRise || 0,
						point.y - stem.y
					);
				}
			}
			if (point.y > stem.y && point.x >= xmax - blueFuzz && point.x <= xmax + blueFuzz) {
				stem.hasGlyphRightAdjacentPointAbove = true;
				stem.glyphRightAdjacentRise = Math.max(
					stem.glyphRightAdjacentRise || 0,
					point.y - stem.y
				);
				if (sameRadical) {
					stem.hasRadicalRightAdjacentPointAbove = true;
					stem.radicalRightAdjacentRise = Math.max(
						stem.radicalRightAdjacentRise || 0,
						point.y - stem.y
					);
				}
			}
			if (point.y > stem.y && point.x <= xmin + blueFuzz && point.x >= xmin - blueFuzz) {
				stem.hasGlyphLeftAdjacentPointAbove = true;
				stem.glyphLeftAdjacentRise = Math.max(
					stem.glyphLeftAdjacentRise || 0,
					point.y - stem.y
				);
				if (sameRadical) {
					stem.hasRadicalLeftAdjacentPointAbove = true;
					stem.radicalLeftAdjacentRise = Math.max(
						stem.radicalLeftAdjacentRise || 0,
						point.y - stem.y
					);
				}
			}
			if (point.y > stem.y && point.x >= xmax + blueFuzz) {
				stem.hasGlyphRightDistancedPointAbove = true;
				stem.glyphRightDistancedRise = Math.max(
					stem.glyphRightDistancedRise || 0,
					point.y - stem.y
				);
				if (sameRadical) {
					stem.hasRadicalRightDistancedPointAbove = true;
					stem.radicalRightDistancedRise = Math.max(
						stem.radicalRightDistancedRise || 0,
						point.y - stem.y
					);
				}
			}
			if (point.y > stem.y && point.x <= xmin - blueFuzz) {
				stem.hasGlyphLeftDistancedPointAbove = true;
				stem.glyphLeftDistancedRise = Math.max(
					stem.glyphLeftDistancedRise || 0,
					point.y - stem.y
				);
				if (sameRadical) {
					stem.hasRadicalLeftDistancedPointAbove = true;
					stem.radicalLeftDistancedRise = Math.max(
						stem.radicalLeftDistancedRise || 0,
						point.y - stem.y
					);
				}
			}
			// upper 匚-like shapes
			if (point.prev && point.prev.prev && point.prev.prev.prev) {
				let z1 = point,
					z2 = point.prev,
					z3 = point.prev.prev,
					z4 = point.prev.prev.prev;
				if (
					z2.x === z3.x &&
					z1.x < z2.x === z4.x < z3.x &&
					((z2.y > stem.y + blueFuzz && z3.y >= stem.y && z2.x < xmax && z2.x > xmin) ||
						(z3.y > stem.y + blueFuzz && z2.y >= stem.y && z3.x < xmax && z3.x > xmin))
				) {
					if (
						(!z2.atleft && z2.x > xmin + (xmax - xmin) * 0.2) ||
						(z2.atleft && z2.x < xmax - (xmax - xmin) * 0.2)
					) {
						stem.hasGlyphFoldAbove = true;
						if (sameRadical) {
							stem.hasRadicalFoldAbove = true;
						}
					} else if (
						z2.x < xmax - (xmax - xmin) * 0.2 &&
						z2.x > xmin + (xmax - xmin) * 0.2
					) {
						stem.hasGlyphSideFoldAbove = true;
						if (sameRadical) {
							stem.hasRadicalSideFoldAbove = true;
						}
					}
				}
			}
			if (
				pointBelowStem(point, stem, blueFuzz) &&
				point.x < xmax - blueFuzz &&
				point.x > xmin + blueFuzz
			) {
				stem.hasGlyphPointBelow = true;
				stem.glyphCenterDescent = Math.max(
					stem.glyphCenterDescent || 0,
					stem.y - stem.width - point.y
				);
				if (sameRadical) {
					stem.hasRadicalPointBelow = true;
					stem.radicalCenterDescent = Math.max(
						stem.radicalCenterDescent || 0,
						stem.y - stem.width - point.y
					);
				}
				if (point.yStrongExtrema) {
					stem.hasGlyphVFoldBelow = true;
					if (sameRadical) {
						stem.hasRadicalVFoldBelow = true;
					}
				}
			}
			if (
				pointBelowStem(point, stem, blueFuzz) &&
				point.xStrongExtrema &&
				!(point.yExtrema && !point.yStrongExtrema) &&
				point.x < xmax + Math.min((xmax - xmin) / 3, stem.width) &&
				point.x > xmin - Math.min((xmax - xmin) / 3, stem.width)
			) {
				if (
					(!point.atleft && point.x > xmin + (xmax - xmin) * 0.2) ||
					(point.atleft && point.x < xmax - (xmax - xmin) * 0.2)
				) {
					stem.hasGlyphFoldBelow = true;
					if (sameRadical) {
						stem.hasRadicalFoldBelow = true;
					}
				} else if (
					point.x < xmax - (xmax - xmin) * 0.2 &&
					point.x > xmin + (xmax - xmin) * 0.2
				) {
					stem.hasGlyphSideFoldBelow = true;
					if (sameRadical) {
						stem.hasRadicalSideFoldBelow = true;
					}
				}
			}
			if (
				pointBelowStem(point, stem, blueFuzz) &&
				point.x >= xmax - blueFuzz &&
				point.x <= xmax + blueFuzz
			) {
				stem.hasGlyphRightAdjacentPointBelow = true;
				stem.glyphRightAdjacentDescent = Math.max(
					stem.glyphRightAdjacentDescent || 0,
					stem.y - stem.width - point.y
				);
				if (sameRadical) {
					stem.hasRadicalRightAdjacentPointBelow = true;
					stem.radicalRightAdjacentDescent = Math.max(
						stem.radicalRightAdjacentDescent || 0,
						stem.y - stem.width - point.y
					);
				}
			}
			if (
				pointBelowStem(point, stem, blueFuzz) &&
				point.x <= xmin + blueFuzz &&
				point.x >= xmin - blueFuzz
			) {
				stem.hasGlyphLeftAdjacentPointBelow = true;
				stem.glyphLeftAdjacentDescent = Math.max(
					stem.glyphLeftAdjacentDescent || 0,
					stem.y - stem.width - point.y
				);
				if (sameRadical) {
					stem.hasRadicalLeftAdjacentPointBelow = true;
					stem.radicalLeftAdjacentDescent = Math.max(
						stem.radicalLeftAdjacentDescent || 0,
						stem.y - stem.width - point.y
					);
				}
			}
			if (pointBelowStem(point, stem, blueFuzz) && point.x >= xmax + blueFuzz) {
				stem.hasGlyphRightDistancedPointBelow = true;
				stem.glyphRightDistancedDescent = Math.max(
					stem.glyphRightDistancedDescent || 0,
					stem.y - stem.width - point.y
				);
				if (sameRadical) {
					stem.hasRadicalRightDistancedPointBelow = true;
					stem.radicalRightDistancedDescent = Math.max(
						stem.radicalRightDistancedDescent || 0,
						stem.y - stem.width - point.y
					);
				}
			}
			if (pointBelowStem(point, stem, blueFuzz) && point.x <= xmin - blueFuzz) {
				stem.hasGlyphLeftDistancedPointBelow = true;
				stem.glyphLeftDistancedDescent = Math.max(
					stem.glyphLeftDistancedDescent || 0,
					stem.y - stem.width - point.y
				);
				if (sameRadical) {
					stem.hasRadicalLeftDistancedPointBelow = true;
					stem.radicalLeftDistancedDescent = Math.max(
						stem.radicalLeftDistancedDescent || 0,
						stem.y - stem.width - point.y
					);
				}
			}
		}
}

function analyzePointToStemSpatialRelationships(stem, radicals, strategy) {
	for (let rad = 0; rad < radicals.length; rad++) {
		let radical = radicals[rad];
		let sameRadical = radical === radicals[stem.belongRadical];
		analyzeRadicalPointsToStemRelationships(radical, stem, sameRadical, strategy);
	}
	stem.calculateMinmax(radicals, strategy);
}

const SHARED_BOOL_PROPS = [
	"hasGlyphStemAbove",
	"hasSameRadicalStemAbove",
	"hasRadicalPointAbove",
	"hasGlyphPointAbove",
	"hasRadicalLeftAdjacentPointAbove",
	"hasRadicalRightAdjacentPointAbove",
	"hasGlyphLeftAdjacentPointAbove",
	"hasGlyphRightAdjacentPointAbove",
	"hasRadicalLeftDistancedPointAbove",
	"hasRadicalRightDistancedPointAbove",
	"hasGlyphLeftDistancedPointAbove",
	"hasGlyphRightDistancedPointAbove",
	"hasGlyphStemBelow",
	"hasSameRadicalStemBelow",
	"hasRadicalPointBelow",
	"hasGlyphPointBelow",
	"hasRadicalLeftAdjacentPointBelow",
	"hasRadicalRightAdjacentPointBelow",
	"hasGlyphLeftAdjacentPointBelow",
	"hasGlyphRightAdjacentPointBelow",
	"hasRadicalLeftDistancedPointBelow",
	"hasRadicalRightDistancedPointBelow",
	"hasGlyphLeftDistancedPointBelow",
	"hasGlyphRightDistancedPointBelow",
	"hasGlyphFoldAbove",
	"hasRadicalFoldAbove",
	"hasGlyphSideFoldAbove",
	"hasRadicalSideFoldAbove",
	"hasGlyphFoldBelow",
	"hasRadicalFoldBelow",
	"hasGlyphSideFoldBelow",
	"hasRadicalSideFoldBelow",
	"hasGlyphVFoldBelow",
	"hasRadicalVFoldBelow",
	"hasEntireContourAbove",
	"hasEntireContourBelow"
];
const SHARED_NUM_PROPS = [
	"radicalCenterRise",
	"glyphCenterRise",
	"radicalRightAdjacentRise",
	"radicalLeftAdjacentRise",
	"glyphRightAdjacentRise",
	"glyphLeftAdjacentRise",
	"radicalRightDistancedRise",
	"radicalLeftDistancedRise",
	"glyphRightDistancedRise",
	"glyphLeftDistancedRise",
	"radicalCenterDescent",
	"glyphCenterDescent",
	"radicalLeftAdjacentDescent",
	"radicalRightAdjacentDescent",
	"glyphLeftAdjacentDescent",
	"glyphRightAdjacentDescent",
	"radicalLeftDistancedDescent",
	"radicalRightDistancedDescent",
	"glyphLeftDistancedDescent",
	"glyphRightDistancedDescent"
];

exports.analyzeStemSpatialRelationships = function(stems, radicals, overlaps, strategy) {
	for (let k = 0; k < stems.length; k++) {
		analyzePointToStemSpatialRelationships(stems[k], radicals, strategy);
		for (let j = 0; j < stems.length; j++) {
			if (
				overlaps[j][k] > strategy.COLLISION_MIN_OVERLAP_RATIO &&
				stems[j].y > stems[k].y &&
				!(stems[j].rid && stems[j].rid === stems[k].rid)
			) {
				stems[k].hasGlyphStemAbove = true;
				stems[j].hasGlyphStemBelow = true;
				if (stems[j].belongRadical === stems[k].belongRadical) {
					stems[j].hasSameRadicalStemBelow = true;
					stems[k].hasSameRadicalStemAbove = true;
				}
			}
		}
	}
	// share stat data between two halfs of diagonal stems
	for (let j = 0; j < stems.length; j++) {
		for (let k = 0; k < j; k++) {
			const sj = stems[j],
				sk = stems[k];
			if (!(sj.rid && sj.rid === sk.rid)) continue;
			for (let p of SHARED_BOOL_PROPS) sj[p] = sk[p] = !!sj[p] || !!sk[p];
			for (let p of SHARED_NUM_PROPS) sj[p] = sk[p] = Math.max(sj[p] || 0, sk[p] || 0);
		}
	}
};

function analyzePBS(u, v, radical, strategy) {
	let blueFuzz = strategy.BLUEZONE_WIDTH || 15;
	let radicalParts = [radical.outline].concat(radical.holes);
	let ans = 0;
	for (let j = 0; j < radicalParts.length; j++)
		for (let k = 0; k < radicalParts[j].points.length - 1; k++) {
			let point = radicalParts[j].points[k];
			if (
				(!u.hasGlyphPointAbove ||
					!v.hasGlyphPointBelow ||
					point.xExtrema ||
					point.yExtrema) &&
				point.y > v.y + blueFuzz &&
				point.y < u.y - u.width - blueFuzz &&
				point.x > v.xmin + blueFuzz &&
				point.x < v.xmax - blueFuzz &&
				point.x > u.xmin + blueFuzz &&
				point.x < u.xmax - blueFuzz
			) {
				if (ans < 1) ans = 1;
				if (point.xStrongExtrema && ans < 2) {
					ans = 2;
				}
			}
		}
	return ans;
}

exports.analyzePointBetweenStems = function(stems, radicals, strategy) {
	let res = [];
	for (let sj = 0; sj < stems.length; sj++) {
		res[sj] = [];
		for (let sk = 0; sk < sj; sk++) {
			res[sj][sk] = 0;
			for (let rad = 0; rad < radicals.length; rad++) {
				res[sj][sk] += analyzePBS(stems[sj], stems[sk], radicals[rad], strategy);
			}
		}
	}
	return res;
};

exports.analyzeEntireContorBetweenStems = function(glyph, stems) {
	let ans = [];
	for (let j = 0; j < stems.length; j++) {
		ans[j] = [];
		for (let k = 0; k < stems.length; k++) {
			ans[j][k] = 0;
			if (!(stems[j].y > stems[k].y)) continue;
			for (let c = 0; c < glyph.contours.length; c++) {
				let cr = glyph.contours[c];
				let sj = stems[j];
				let sk = stems[k];
				if (
					cr.xmin >= sj.xmin &&
					cr.xmax <= sj.xmax &&
					cr.xmin >= sk.xmin &&
					cr.xmax <= sk.xmax &&
					cr.ymax <= sj.y &&
					cr.ymin >= sk.y
				) {
					ans[j][k] += 1;
				}
			}
		}
	}
	return ans;
};

exports.analyzeEntireContourAboveBelow = function(glyph, stems) {
	for (let j = 0; j < stems.length; j++) {
		let sj = stems[j];
		for (let c = 0; c < glyph.contours.length; c++) {
			let cr = glyph.contours[c];
			if (cr.xmin >= sj.xmin && cr.xmax <= sj.xmax && cr.ymin >= sj.y) {
				sj.hasEntireContourAbove = true;
			}
			if (cr.xmin >= sj.xmin && cr.xmax <= sj.xmax && cr.ymax <= sj.y - sj.width) {
				sj.hasEntireContourBelow = true;
			}
		}
	}
};
