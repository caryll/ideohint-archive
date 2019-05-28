"use strict";

// Width allocator

const { mix, xclamp } = require("../../support/common");
function edgetouch(s, t) {
	return (
		(s.xmin < t.xmin &&
			t.xmin < s.xmax &&
			s.xmax < t.xmax &&
			(s.xmax - t.xmin) / (s.xmax - s.xmin) <= 0.26) ||
		(t.xmin < s.xmin &&
			s.xmin < t.xmax &&
			t.xmax < s.xmax &&
			(t.xmax - s.xmin) / (s.xmax - s.xmin) <= 0.26)
	);
}
function cover(s, t) {
	return t.xmin > mix(s.xmin, s.xmax, 0.05) && t.xmax < mix(s.xmin, s.xmax, 0.95);
}

function dominate(aj, ak) {
	return aj.xminX < ak.xminX && aj.xmaxX > ak.xmaxX;
}

function atValidPosition(top, bot, y, w, avail) {
	return (
		y - w >= avail.lowW - avail.properWidth &&
		y <= avail.highW &&
		y <= top &&
		y >= w + avail.lowLimitW
	);
}

const ANY = 0;
const LESS = 1;
const SUFF = 2;

function allocateWidth(y0, env) {
	const N = y0.length;
	let allocated = new Array(N),
		y = new Array(N),
		w = new Array(N),
		properWidths = new Array(N);
	const avails = env.avails,
		directOverlaps = env.directOverlaps,
		triplets = env.triplets;

	const onePixelMatter = env.onePixelMatter;
	for (let j = 0; j < y0.length; j++) {
		properWidths[j] = Math.round(avails[j].properWidth);
		y[j] = Math.round(y0[j]);
		w[j] = 1;
	}

	let pixelTop = Math.round(env.glyphTop / env.uppx);
	let pixelBottom = Math.round(env.glyphBottom / env.uppx);

	function allocateDown(j) {
		let sb = env.spaceBelow(y, w, j, pixelBottom - 1);
		let wr = properWidths[j];
		let wx = Math.min(wr, w[j] + sb - 1);
		if (wx <= 1) return;
		if (
			(sb + w[j] >= wr + 1 || (avails[j].atGlyphBottom && y[j] - wr >= pixelBottom)) &&
			y[j] - wr >= avails[j].lowLimitW
		) {
			w[j] = wr;
			allocated[j] = true;
		} else if (y[j] - wx >= avails[j].lowLimitW) {
			w[j] = wx;
			if (w >= wr) allocated[j] = true;
		}
	}
	function relationSat(w, p, op) {
		if (op === LESS) return w < p;
		else if (op === SUFF) return p > 1 && w >= p;
		else return true;
	}
	function tripletSatisifiesPattern(j, k, m, w1, djk, w2, dkm, w3, j1, j2, j3) {
		return (
			(!w1 || (w[j] === w1 && relationSat(w[j], properWidths[j], j1))) &&
			(!w2 || (w[k] === w2 && relationSat(w[k], properWidths[k], j2))) &&
			(!w3 || (w[m] === w3 && relationSat(w[m], properWidths[m], j3))) &&
			y[j] - w[j] - y[k] === djk &&
			y[k] - w[k] - y[m] === dkm
		);
	}

	for (let allocPass = 0; allocPass < 5; allocPass++) {
		// Allocate top and bottom stems
		for (let j = 0; j < N; j++)
			if ((avails[j].atGlyphTop || avails[j].atGlyphBottom) && !allocated[j]) {
				allocateDown(j);
			}
		// Allocate middle stems
		for (let subpass = 0; subpass < env.strategy.WIDTH_ALLOCATION_PASSES; subpass++) {
			for (let j = 0; j < N; j++)
				if (!allocated[j]) {
					allocateDown(j);
				}
		}
	}

	function avoidThinStroke(y0, applyToLowerOnly) {
		// push stems down to avoid thin strokes.
		for (let j = N - 1; j >= 0; j--) {
			if (avails[j].lowLimitW + w[j] <= y[j]) continue;
			if (!(applyToLowerOnly || !avails[j].hasGlyphStemAbove)) continue;
			if (w[j] >= (!avails[j].hasGlyphStemAbove ? properWidths[j] : 2)) continue;
			let able = true;
			// Prevent increasing width of a stroke being stacked
			for (let k = j + 1; k < N; k++) {
				if (directOverlaps[k][j] && y[k] - w[k] - y[j] <= 0) {
					able = false;
				}
			}
			if (!able) continue;
			// We search for strokes below,
			for (let k = 0; k < j; k++) {
				if (
					directOverlaps[j][k] &&
					y[j] - w[j] - y[k] <= 1 + env.requiredSpaceBetween(j, k) &&
					(onePixelMatter || // shifting strokes modifies glyph too much
					y[k] <= avails[k].lowP || // the stroke is low enough
					(onePixelMatter && y[k] <= y0[k] - 1) || // the stroke is low enough
					y[k] <= pixelBottom + w[k] || // or it is thin enough
						w[k] < 2)
				) {
					able = false;
				}
			}
			if (!able) continue;
			for (let k = 0; k < j; k++)
				if (
					directOverlaps[j][k] &&
					y[j] - w[j] - y[k] <= 1 + env.requiredSpaceBetween(j, k)
				) {
					y[k] -= 1;
					w[k] -= 1;
				}
			w[j] += 1;
		}
		for (let j = N - 1; j >= 0; j--) {
			if (avails[j].lowLimitW + w[j] <= y[j]) continue;
			if (w[j] >= (!avails[j].hasGlyphFoldBelow ? properWidths[j] : 2)) continue;
			if (y[j] >= avails[j].highP) continue;
			if (onePixelMatter && y[j] >= y0[j] + 1) continue;
			if (!avails[j].hasGlyphStemAbove && y[j] >= pixelTop - 2) continue;

			let able = true;
			// We search for strokes above,
			for (let k = j + 1; k < N; k++) {
				if (
					directOverlaps[k][j] &&
					y[k] - w[k] - y[j] <= 1 + env.requiredSpaceBetween(k, j) && // there is no stem below satisifies:
					// with one pixel space, and prevent upward adjustment, if
					(onePixelMatter || // shifting strokes modifies glyph too much
					!cover(avails[j], avails[k]) || // it is not dominated with stroke J
					w[k] < properWidths[k] || // or it is thin enough
						w[k] < 2) // or it is thin enough
				) {
					able = false;
				}
			}
			if (!able) continue;
			for (let k = j + 1; k < N; k++)
				if (
					directOverlaps[k][j] &&
					y[k] - w[k] - y[j] <= 1 + env.requiredSpaceBetween(k, j)
				) {
					w[k] -= 1;
				}
			y[j] += 1;
			w[j] += 1;
		}
	}
	function doubletBalance(j, k, pass) {
		// Doublet balancing
		let y1 = y.slice(0),
			w1 = w.slice(0);
		// [1][2] -> [1] 1 [1]
		if (w[j] === 1 && w[k] === 2 && w[k] >= properWidths[k] && y[j] - y[k] === w[j]) {
			(w[k] -= 1), (y[k] -= 1);
		} else if (w[j] === 2 && w[k] === 1 && w[j] >= properWidths[j] && y[j] - y[k] === w[j]) {
			// [2][1] -> [1] 1 [1]
			w[j] -= 1;
		} else if (w[j] === 2 && w[k] === 2 && w[k] >= properWidths[k] && y[j] - y[k] === w[j]) {
			// [2][2] -> [1] 1 [2]
			if (pass % 2) {
				w[j] -= 1;
			} else {
				w[k] -= 1;
				y[k] -= 1;
			}
		} else if (
			w[j] === 3 &&
			w[k] === 1 &&
			w[j] >= properWidths[j] &&
			y[j] - y[k] === w[j] + 1
		) {
			// [3] 1 [1] -> [2] 1 [2]
			(w[j] -= 1), (w[k] += 1), (y[k] += 1);
		} else if (
			w[j] === 1 &&
			w[k] === 3 &&
			w[k] >= properWidths[k] &&
			y[j] - y[k] === w[j] + 1
		) {
			// [1] 1 [3] -> [2] 1 [2]
			(w[j] += 1), (w[k] -= 1), (y[k] -= 1);
		}
		if (
			env.spaceBelow(y, w, j, pixelBottom - 2) < 1 ||
			env.spaceAbove(y, w, k, pixelTop + 2) < 1 ||
			(j < N - 1 && y[j] > y[j + 1]) ||
			(j > 0 && y[j] < y[j - 1]) ||
			(k < N - 1 && y[k] > y[k + 1]) ||
			(k > 0 && y[k] < y[k - 1]) ||
			!atValidPosition(pixelTop, pixelBottom, y[k], w[k], avails[k])
		) {
			y = y1;
			w = w1;
		}
	}
	function tripletBalance(pass, j, k, m) {
		// Triplet balancing

		let y1 = y.slice(0),
			w1 = w.slice(0);
		if (tripletSatisifiesPattern(j, k, m, 1, 0, 1, 1, 2, ANY, ANY, ANY)) {
			// [1] 0 [1] 1 [2] -> [1] 1 [1] 1 [1]
			y[k] -= 1;
			y[m] -= 1;
			w[m] -= 1;
		} else if (tripletSatisifiesPattern(j, k, m, 2, 1, 1, 0, 1, ANY, ANY, ANY)) {
			// [2] 1 [1] 0 [1] -> [1] 1 [1] 1 [1]
			w[j] -= 1;
			y[k] += 1;
		} else if (tripletSatisifiesPattern(j, k, m, 3, 2, 3, 1, 2, SUFF, SUFF, LESS)) {
			// [3] 2 [3] 1 [2] -> [3] 1 [3] 1 [3]
			(y[k] += 1), (y[m] += 1), (w[m] += 1);
		} else if (tripletSatisifiesPattern(j, k, m, 2, 2, 3, 1, 3, LESS, SUFF, SUFF)) {
			// [2] 2 [3] 1 [3] -> [3] 1 [3] 1 [3]
			w[j] += 1;
		} else if (tripletSatisifiesPattern(j, k, m, 3, 1, 3, 2, 2, SUFF, SUFF, LESS)) {
			// [3] 1 [3] 2 [2] -> [3] 1 [3] 1 [3]
			(y[m] += 1), (w[m] += 1);
		} else if (tripletSatisifiesPattern(j, k, m, 2, 1, 3, 2, 3, LESS, SUFF, SUFF)) {
			// [2] 1 [3] 2 [3] -> [3] 1 [3] 1 [3]
			(w[j] += 1), (y[k] -= 1);
		} else if (tripletSatisifiesPattern(j, k, m, 3, 1, 1, 1, 3, SUFF, LESS, SUFF)) {
			// [3] 1 [1] 1 [3] -> [2] 1 [2] 1 [3] or [3] 1 [2] 1 [2]
			if (env.P[j][k] > env.P[k][m]) {
				(w[j] -= 1), (y[k] += 1), (w[k] += 1);
			} else {
				(w[k] += 1), (y[m] -= 1), (w[m] -= 1);
			}
		} else if (tripletSatisifiesPattern(j, k, m, 3, 1, 2, 1, 1, SUFF, ANY, LESS)) {
			// [3] 1 [2] 1 [1] -> [2] 1 [2] 1 [2]
			(w[j] -= 1), (y[k] += 1), (y[m] += 1), (w[m] += 1);
		} else if (tripletSatisifiesPattern(j, k, m, 1, 1, 3, 1, 2, LESS, SUFF, ANY)) {
			// [1] 1 [3] 1 [2] -> [2] 1 [2] 1 [2]
			(w[j] += 1), (y[k] -= 1), (w[k] -= 1);
		} else if (tripletSatisifiesPattern(j, k, m, 1, 1, 3, 1, 3, LESS, SUFF, ANY)) {
			// [1] 1 [3] 1 [3] -> [2] 1 [2] 1 [3]
			(w[j] += 1), (y[k] -= 1), (w[k] -= 1);
		} else if (tripletSatisifiesPattern(j, k, m, 2, 1, 1, 1, 3, ANY, LESS, SUFF)) {
			// [2] 1 [1] 1 [3] -> [2] 1 [2] 1 [2]
			(w[k] += 1), (w[m] -= 1), (y[m] -= 1);
		} else if (tripletSatisifiesPattern(j, k, m, 2, 1, 3, 1, 1, ANY, SUFF, LESS)) {
			// [2] 1 [3] 1 [1] -> [2] 1 [2] 1 [2]
			(w[k] -= 1), (w[m] += 1), (y[m] += 1);
		} else if (tripletSatisifiesPattern(j, k, m, 3, 1, 3, 1, 1, ANY, SUFF, LESS)) {
			// [3] 1 [3] 1 [1] -> [2] 1 [2] 1 [2]
			(w[k] -= 1), (w[m] += 1), (y[m] += 1);
		} else if (tripletSatisifiesPattern(j, k, m, 3, 1, 1, 1, 2, SUFF, LESS, ANY)) {
			// [3] 1 [1] 1 [2] -> [2] 1 [2] 1 [2]
			(w[j] -= 1), (y[k] += 1), (w[k] += 1);
		} else if (tripletSatisifiesPattern(j, k, m, 1, 1, 2, 1, 3, LESS, ANY, SUFF)) {
			// [1] 1 [2] 1 [3] -> [2] 1 [2] 1 [2]
			(w[j] += 1), (w[m] -= 1), (y[k] -= 1), (y[m] -= 1);
		} else if (tripletSatisifiesPattern(j, k, m, 1, 1, 2, 2, 2, LESS, SUFF, SUFF)) {
			// [1] 1 [2] 2 [2] -> [2] 1 [2] 1 [2]
			(w[j] += 1), (y[k] -= 1);
		} else if (tripletSatisifiesPattern(j, k, m, 2, 2, 2, 1, 1, SUFF, ANY, LESS)) {
			// [2] 2 [2] 1 [1] -> [2] 1 [2] 1 [2]
			(y[k] += 1), (y[m] += 1), (w[m] += 1);
		} else if (
			(tripletSatisifiesPattern(j, k, m, 2, 1, 1, 1, 2, SUFF, ANY, ANY) ||
				tripletSatisifiesPattern(j, k, m, 2, 1, 1, 1, 2, ANY, ANY, SUFF)) &&
			dominate(avails[k], avails[j]) &&
			dominate(avails[k], avails[m])
		) {
			// [2] 1 [1D] 1 [2] -> [1] 1 [2] 1 [2] or [2] 1 [2] 1 [1]
			if (pass % 2) {
				(w[j] -= 1), (y[k] += 1), (w[k] += 1);
			} else {
				(w[k] += 1), (w[m] -= 1), (y[m] -= 1);
			}
		} else if (
			avails[j].atGlyphTop &&
			tripletSatisifiesPattern(j, k, m, 1, 1, 1, 1, 2, LESS, ANY, SUFF)
		) {
			// [1T] 1 [1] 1 [2] -> [2] 1 [1] 1 [1]
			(w[m] -= 1), (w[j] += 1), (y[m] -= 1), (y[k] -= 1);
		} else if (
			avails[j].atGlyphTop &&
			w[j] < properWidths[j] &&
			w[k] >= properWidths[k] &&
			properWidths[k] > 1 &&
			y[j] - w[j] - y[k] === 1
		) {
			// [1T] 1 [2] 1 [*] -> [2] 1 [1] 1 [*]
			(w[k] -= 1), (y[k] -= 1), (w[j] += 1);
		}

		// rollback when no space
		if (
			env.spaceBelow(y, w, j, pixelBottom - 1) < 1 ||
			env.spaceAbove(y, w, k, pixelTop + 1) < 1 ||
			env.spaceAbove(y, w, m, pixelTop + 1) < 1 ||
			env.spaceBelow(y, w, k, pixelBottom - 1) < 1 ||
			(j < N - 1 && y[j] > y[j + 1]) ||
			(j > 0 && y[j] < y[j - 1]) ||
			(k < N - 1 && y[k] > y[k + 1]) ||
			(k > 0 && y[k] < y[k - 1]) ||
			(m < N - 1 && y[m] > y[m + 1]) ||
			(m > 0 && y[m] < y[m - 1]) ||
			!atValidPosition(pixelTop, pixelBottom, y[k], w[k], avails[k]) ||
			!atValidPosition(pixelTop, pixelBottom, y[m], w[m], avails[m])
		) {
			y = y1;
			w = w1;
		}
	}
	function edgeTouchBalance() {
		// Edge touch balancing
		for (let j = 0; j < N; j++) {
			if (
				w[j] <= 1 &&
				w[j] < properWidths[j] &&
				y[j] > pixelBottom + 2 &&
				y[j] > w[j] + avails[j].lowLimitW
			) {
				let able = true;
				for (let k = 0; k < j; k++)
					if (directOverlaps[j][k] && !edgetouch(avails[j], avails[k])) {
						able = false;
					}
				if (able) {
					w[j] += 1;
				}
			}
		}
	}
	// Advanced balancer
	for (let pass = 0; pass < env.strategy.REBALANCE_PASSES; pass++) {
		// large size
		if (env.WIDTH_GEAR_PROPER > 1) {
			if (!onePixelMatter) {
				const y0 = [...y];
				avoidThinStroke(y0, false);
				avoidThinStroke(y0, true);
				avoidThinStroke(y0, true);
			}
			for (let j = N - 1; j >= 0; j--) {
				for (let k = j - 1; k >= 0; k--) {
					if (!directOverlaps[j][k]) continue;
					doubletBalance(j, k, pass);
				}
			}
			for (let [j, k, m] of triplets) {
				tripletBalance(pass, j, k, m);
			}
			edgeTouchBalance();
		}

		// Symmetry Preserve
		for (let j = y.length - 2; j >= 0; j--) {
			for (let k = j + 1; k < y.length; k++) {
				if (!env.symmetry[j][k] && !env.symmetry[k][j]) continue;
				if (pass % 2) {
					y[j] = y[k];
					w[j] = w[k];
				} else {
					y[k] = y[j];
					w[k] = w[j];
				}
			}
		}
	}

	// Prevent swap
	for (let j = y.length - 2; j >= 0; j--) {
		if (y[j] > y[j + 1]) {
			const su = env.spaceAbove(y, w, j + 1, pixelTop + 2);
			const sb = env.spaceBelow(y, w, j, pixelBottom - 2);
			if (sb > y[j] - y[j + 1]) {
				y[j] = xclamp(avails[j].lowW, y[j + 1], avails[j].highW);
			} else if (su > y[j] - y[j + 1]) {
				y[j + 1] = xclamp(avails[j + 1].lowW, y[j], avails[j + 1].highW);
			}
		}
	}
	return { y: y, w: w };
}

module.exports = allocateWidth;
