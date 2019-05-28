"use strict";

let slopeOf = require("../types/").slopeOf;
let segmentsPromixity = require("../si-common/seg").segmentsPromixity;

const {
	atRadicalTop,
	atRadicalBottom,
	atGlyphTop,
	atGlyphBottom,
	isCapShape
} = require("../../support/stem-spatial");

exports.computePQ = function(strategy, stems, flipMatrix) {
	// A : Annexation operator
	// C : Collision operator
	// S
	let P = [],
		Q = [],
		n = stems.length;
	for (let j = 0; j < n; j++) {
		P[j] = [];
		Q[j] = [];
		for (let k = 0; k < n; k++) {
			P[j][k] = Q[j][k] = 0;
		}
	}
	for (let j = 0; j < n; j++) {
		for (let k = 0; k < j; k++) {
			const nothingInBetween = flipMatrix[j][k] <= 3;
			// Overlap weight
			const tb =
				(atGlyphTop(stems[j], strategy) && !stems[j].diagLow) ||
				(atGlyphBottom(stems[k], strategy) && !stems[j].diagHigh);

			let structuralPromixity =
				segmentsPromixity(stems[j].low, stems[k].high) +
				segmentsPromixity(stems[j].high, stems[k].low) +
				segmentsPromixity(stems[j].low, stems[k].low) +
				segmentsPromixity(stems[j].high, stems[k].high);
			let spatialPromixity = structuralPromixity;

			// PBS
			if (
				(!nothingInBetween || !stems[j].hasGlyphStemAbove || !stems[k].hasGlyphStemBelow) &&
				spatialPromixity < strategy.COEFF_PBS_MIN_PROMIX
			) {
				spatialPromixity = strategy.COEFF_PBS_MIN_PROMIX;
			}
			if (!nothingInBetween && spatialPromixity < strategy.COEFF_PBS_MIN_PROMIX) {
				structuralPromixity = strategy.COEFF_PBS_MIN_PROMIX;
			}
			// Top/bottom
			if (tb) {
				spatialPromixity *= strategy.COEFF_STRICT_TOP_BOT_PROMIX;
			} else if (!stems[j].hasGlyphStemAbove || !stems[k].hasGlyphStemBelow) {
				spatialPromixity *= strategy.COEFF_TOP_BOT_PROMIX;
			}
			P[j][k] = Math.round(structuralPromixity + (!nothingInBetween ? 1 : 0));
			Q[j][k] = spatialPromixity;
		}
	}
	return { P, Q };
};

exports.computeACS = function(strategy, stems, overlapRatios, overlapLengths, Q, F, dov) {
	// A : Annexation operator
	// C : Collision operator
	// S : Swap operator
	let A = [],
		C = [],
		S = [],
		D = [],
		n = stems.length;
	for (let j = 0; j < n; j++) {
		A[j] = [];
		C[j] = [];
		S[j] = [];
		D[j] = [];
		for (let k = 0; k < n; k++) {
			A[j][k] = C[j][k] = S[j][k] = D[j][k] = 0;
		}
	}
	let slopes = stems.map(function(s) {
		return (slopeOf(s.high) + slopeOf(s.low)) / 2;
	});
	for (let j = 0; j < n; j++) {
		const jrbot = atRadicalBottom(stems[j], strategy) && !isCapShape(stems[j], strategy);
		for (let k = 0; k < j; k++) {
			const krtop = atRadicalTop(stems[k], strategy);
			const nothingInBetween = F[j][k] <= 3 || (dov && !dov[j][k]);
			// Overlap weight
			let ovr = overlapLengths[j][k];
			const tb =
				(atGlyphTop(stems[j], strategy) && !stems[j].diagLow) ||
				(atGlyphBottom(stems[k], strategy) && !stems[j].diagHigh);
			let strong =
				overlapRatios[j][k] > 0.85 ||
				overlapRatios[k][j] > 0.85 ||
				ovr > 1 / 3 ||
				(tb && (overlapRatios[j][k] > 0.4 || overlapRatios[k][j] > 0.4));
			let isSideTouch =
				(stems[j].xmin < stems[k].xmin && stems[j].xmax < stems[k].xmax) ||
				(stems[j].xmin > stems[k].xmin && stems[j].xmax > stems[k].xmax);
			// For side touches witn low overlap, drop it.
			if (ovr < strategy.SIDETOUCH_LIMIT && isSideTouch) {
				ovr = 0;
			}

			let slopesCoeff =
				nothingInBetween && stems[j].belongRadical !== stems[k].belongRadical
					? Math.max(0.25, 1 - Math.abs(slopes[j] - slopes[k]) * 10)
					: 1;

			let promixityCoeff = 1 + (Q[j][k] > 2 ? 5 : 1) * Q[j][k];
			// Annexation coefficients
			let coeffA = 1;

			if (!nothingInBetween || tb) {
				coeffA *= strategy.COEFF_A_SHAPE_LOST_XX;
			}
			if (!stems[j].hasGlyphStemAbove || !stems[k].hasGlyphStemBelow) {
				if (stems[j].belongRadical === stems[k].belongRadical) {
					coeffA *= strategy.COEFF_A_TOPBOT_MERGED_SR;
				} else {
					coeffA *= strategy.COEFF_A_TOPBOT_MERGED;
				}
				if (
					(!stems[j].hasGlyphStemAbove && !atRadicalBottom(stems[j], strategy)) ||
					(!stems[k].hasGlyphStemBelow && !atRadicalTop(stems[k], strategy))
				) {
					coeffA *= strategy.COEFF_A_SHAPE_LOST_XX;
				}
			}
			if (stems[j].belongRadical === stems[k].belongRadical) {
				coeffA *= strategy.COEFF_A_SAME_RADICAL;
				if (!stems[j].hasSameRadicalStemAbove && !stems[k].hasSameRadicalStemBelow) {
					coeffA *= strategy.COEFF_A_SHAPE_LOST_XX;
				} else if (!stems[j].hasSameRadicalStemAbove || !stems[k].hasSameRadicalStemBelow) {
					coeffA *= strategy.COEFF_A_SHAPE_LOST;
				} else if (
					Math.abs(stems[j].xmin - stems[k].xmin) < strategy.Y_FUZZ &&
					Math.abs(stems[j].xmax - stems[k].xmax) < strategy.Y_FUZZ &&
					!(
						(stems[j].promixityDown > stems[j].promixityUp &&
							stems[k].promixityUp >= stems[k].promixityDown) ||
						(stems[j].promixityDown >= stems[j].promixityUp &&
							stems[k].promixityUp > stems[k].promixityDown)
					)
				) {
					coeffA /= strategy.COEFF_A_SAME_RADICAL * strategy.COEFF_A_SHAPE_LOST;
				}
			} else if (jrbot && krtop) {
				coeffA *= strategy.COEFF_A_RADICAL_MERGE;
			} else if (krtop) {
				// n-case
				// for u-case, it is less severe
				coeffA *= strategy.COEFF_A_SHAPE_LOST_XR;
			} else if (jrbot) {
				//coeffA *= strategy.COEFF_A_FEATURE_LOSS_XR;
			}

			// Collision coefficients
			let coeffC = 1;
			if (stems[j].belongRadical === stems[k].belongRadical && strong) {
				coeffC *= strategy.COEFF_C_SAME_RADICAL;
			} else if (stems[j].belongRadical !== stems[k].belongRadical && krtop && !jrbot) {
				coeffC *= strategy.COEFF_C_SHAPE_LOST_XX;
			}

			if (!nothingInBetween || (tb && strong)) {
				coeffC *= strategy.COEFF_C_SHAPE_LOST_XX;
			}
			if (
				strong &&
				(!stems[j].hasGlyphStemAbove || !stems[k].hasGlyphStemBelow) &&
				!(jrbot && krtop)
			) {
				coeffC *= strategy.COEFF_C_SHAPE_LOST_XX * Math.pow(ovr, 3);
			}
			let symmetryCoeff = 1;
			if (Math.abs(stems[j].xmin - stems[k].xmin) <= strategy.BLUEZONE_WIDTH) {
				symmetryCoeff += 2;
			}
			if (Math.abs(stems[j].xmax - stems[k].xmax) <= strategy.BLUEZONE_WIDTH) {
				symmetryCoeff += 2;
			}

			A[j][k] = strategy.COEFF_A_MULTIPLIER * ovr * coeffA * promixityCoeff * slopesCoeff;
			if (!isFinite(A[j][k])) A[j][k] = 0;
			C[j][k] = strategy.COEFF_C_MULTIPLIER * ovr * coeffC * symmetryCoeff * slopesCoeff;
			if (!ovr) C[j][k] = 0;
			if (stems[j].rid && stems[j].rid === stems[k].rid) {
				C[j][k] = 0;
			}
			if (!C[j][k] || !A[j][k]) {
				C[j][k] = A[j][k] = 0;
			}
			S[j][k] = strategy.COEFF_S;
			D[j][k] = D[k][j] = ovr;
		}
	}
	for (let j = 0; j < n; j++) {
		let isBottomMost = true;
		for (let k = 0; k < j; k++) {
			if (C[j][k] > 0) isBottomMost = false;
		}
		if (!isBottomMost) continue;
		for (let k = j + 1; k < n; k++) {
			const isSideTouch =
				(stems[j].xmin < stems[k].xmin && stems[j].xmax < stems[k].xmax) ||
				(stems[j].xmin > stems[k].xmin && stems[j].xmax > stems[k].xmax);
			const mindiff = Math.abs(stems[j].xmax - stems[k].xmin);
			const maxdiff = Math.abs(stems[j].xmin - stems[k].xmax);
			const unbalance =
				mindiff + maxdiff <= 0 ? 0 : Math.abs(mindiff - maxdiff) / (mindiff + maxdiff);
			if (!isSideTouch && unbalance >= strategy.TBST_LIMIT)
				A[k][j] *= strategy.COEFF_A_FEATURE_LOSS;
		}
	}
	for (let j = 0; j < n; j++) {
		let isTopMost = true;
		for (let k = j + 1; k < n; k++) {
			if (C[k][j] > 0) isTopMost = false;
		}
		if (!isTopMost) continue;
		for (let k = 0; k < j; k++) {
			const isSideTouch =
				(stems[j].xmin < stems[k].xmin && stems[j].xmax < stems[k].xmax) ||
				(stems[j].xmin > stems[k].xmin && stems[j].xmax > stems[k].xmax);
			const mindiff = Math.abs(stems[j].xmax - stems[k].xmin);
			const maxdiff = Math.abs(stems[j].xmin - stems[k].xmax);
			const unbalance =
				mindiff + maxdiff <= 0 ? 0 : Math.abs(mindiff - maxdiff) / (mindiff + maxdiff);
			if (!isSideTouch && unbalance >= strategy.TBST_LIMIT)
				A[j][k] *= strategy.COEFF_A_FEATURE_LOSS;
		}
	}
	for (let j = 0; j < n; j++) {
		for (let k = j + 1; k < n; k++) {
			A[j][k] = A[k][j] = Math.min(Math.max(A[j][k], A[k][j]), Math.max(S[j][k], S[k][j]));
			C[j][k] = C[k][j] = Math.min(Math.max(C[j][k], C[k][j]), Math.max(S[j][k], S[k][j]));
		}
	}
	return {
		annexation: A,
		collision: C,
		swap: S,
		darkness: D,
		flips: F
	};
};
