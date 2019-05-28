"use strict";

const roundings = require("../../support/roundings");
const { lerp, xclamp, toVQ } = require("../../support/common");
const stemSpat = require("../../support/stem-spatial");

const decideAvails = require("./init/avail");
const decideWidths = require("./init/decide-widths");

const { balance1, balance2, balance3 } = require("./uncollide/balance");
const Individual = require("./uncollide/individual");
const uncollide = require("./uncollide");
const allocateWidth = require("./allocate-width");

function risefn(x) {
	return x * x * x * x * x * x;
}

class YCache {
	constructor() {
		this.cache = [];
	}
	get(y) {
		let focus = this.cache;
		for (let j = 0; j < y.length; j++) {
			if (!focus[y[j]]) return null;
			focus = focus[y[j]];
		}
		return focus;
	}
	set(y, v) {
		const [f, k] = this.peek(y);
		f[k] = v;
		return this;
	}
	peek(y) {
		let focus = this.cache;
		let key = null;
		for (let j = 0; j < y.length; j++) {
			if (j < y.length - 1) {
				if (!focus[y[j]]) focus[y[j]] = [];
				focus = focus[y[j]];
			} else {
				key = y[j];
			}
		}
		return [focus, key];
	}
}

class Hinter {
	constructor(strategy, fdefs, ppem, options) {
		//// STRATEGY SPECIFIC
		this.strategy = strategy;
		this.upm = strategy.UPM || 1000;
		this.ppem = ppem;
		this.prepareParameters();

		this.onePixelMatter = ppem <= 16;

		//// GLYPH SPECIFIC
		this.A = [];
		for (let j = 0; j < fdefs.stems.length; j++) {
			this.A[j] = [];
			for (let k = 0; k < fdefs.stems.length; k++) {
				this.A[j][k] =
					fdefs.collisionMatrices.annexation[j][k] * options.annexMultipliers[j][k];
			}
		}
		this.C = [];
		for (let j = 0; j < fdefs.stems.length; j++) {
			this.C[j] = [];
			for (let k = 0; k < fdefs.stems.length; k++) {
				this.C[j][k] =
					fdefs.collisionMatrices.collision[j][k] * options.colMultipliers[j][k];
			}
		}

		this.S = fdefs.collisionMatrices.swap;
		this.D = fdefs.collisionMatrices.darkness;
		this.P = fdefs.collisionMatrices.promixity;
		this.Q = fdefs.collisionMatrices.spatialPromixity;
		this.F = fdefs.collisionMatrices.flips;

		this.overlaps = fdefs.overlaps;
		this.directOverlaps = fdefs.directOverlaps;
		this.stemOverlapLengths = fdefs.stemOverlapLengths;

		this.triplets = fdefs.triplets;
		this.quartlets = fdefs.quartlets;

		this.stats = fdefs.stats;

		//// CALCULATED
		this.tightness = this.getTightness(fdefs);
		this.nStems = fdefs.stems.length;
		this.stems = fdefs.stems;
		this.updateAvails(this.decideWidths(fdefs.stems, options), options);
		this.symmetry = decideSymmetry.call(this);
		this.xExpansion = 1 + Math.round(toVQ(strategy.X_EXPAND, ppem)) / 100;
	}
	updateAvails(tws, options) {
		this.avails = decideAvails.call(this, this.stems, tws, options);

		this.availsByLength = function() {
			let m = [];
			for (let j = 0; j < this.avails.length; j++) {
				m.push([this.avails[j].length, j]);
			}
			return m.sort((a, b) => b[0] - a[0]);
		}.call(this);

		this._idvCache = new YCache();
		this._idvCacheU = new YCache();
		this._balanceCache = new YCache();
	}
	prepareParameters() {
		const { strategy, ppem } = this;
		this.uppx = this.upm / this.ppem;

		this.glyphTop =
			this.round(strategy.BLUEZONE_BOTTOM_CENTER) +
			this.round(strategy.BLUEZONE_TOP_CENTER - strategy.BLUEZONE_BOTTOM_CENTER);
		this.glyphBottom = this.round(strategy.BLUEZONE_BOTTOM_CENTER);
		this.glyphTop0 = strategy.BLUEZONE_TOP_CENTER;
		this.glyphBottom0 = strategy.BLUEZONE_BOTTOM_CENTER;
		this.glyphTopPixels = Math.round(this.glyphTop / this.uppx);
		this.glyphBottomPixels = Math.round(this.glyphBottom / this.uppx);
		this.TOP_UNIFY_FORCE = toVQ(strategy.TOP_UNIFY_FORCE, ppem) / 100;
		this.TOP_UNIFY_FORCE_DIAG = toVQ(strategy.TOP_UNIFY_FORCE_DIAG, ppem) / 100;
		this.BOTTOM_UNIFY_FORCE = toVQ(strategy.BOTTOM_UNIFY_FORCE, ppem) / 100;
		this.BOTTOM_UNIFY_FORCE_DIAG = toVQ(strategy.BOTTOM_UNIFY_FORCE_DIAG, ppem) / 100;

		// SWP
		this.CANONICAL_STEM_WIDTH = toVQ(strategy.CANONICAL_STEM_WIDTH, ppem);
		this.CANONICAL_STEM_WIDTH_DENSE = toVQ(strategy.CANONICAL_STEM_WIDTH_DENSE, ppem);

		this.SHRINK_THERSHOLD = strategy.SHRINK_THERSHOLD || 0.75;
		this.WIDTH_GEAR_PROPER = Math.round(this.CANONICAL_STEM_WIDTH / this.uppx);
		this.WIDTH_GEAR_MIN = Math.min(
			this.WIDTH_GEAR_PROPER,
			Math.round(this.CANONICAL_STEM_WIDTH_DENSE / this.uppx)
		);

		// FeatDP
		this.STEM_SIDE_MIN_RISE = Math.min(strategy.STEM_SIDE_MIN_RISE, this.uppx);
		this.STEM_SIDE_MIN_DIST_RISE = Math.min(strategy.STEM_SIDE_MIN_DIST_RISE, this.uppx);
		this.STEM_CENTER_MIN_RISE = Math.min(strategy.STEM_CENTER_MIN_RISE, this.uppx);

		this.STEM_SIDE_MIN_DESCENT = Math.min(strategy.STEM_SIDE_MIN_DESCENT, this.uppx);
		this.STEM_SIDE_MIN_DIST_DESCENT = Math.min(strategy.STEM_SIDE_MIN_DIST_DESCENT, this.uppx);
		this.STEM_CENTER_MIN_DESCENT = Math.min(strategy.STEM_CENTER_MIN_DESCENT, this.uppx);

		this.TOP_CUT = Math.round(toVQ(strategy.TOP_CUT, ppem)) * this.uppx;
		this.BOTTOM_CUT = Math.round(toVQ(strategy.BOTTOM_CUT, ppem)) * this.uppx;
		this.TOP_CUT_DIAGH = Math.round(toVQ(strategy.TOP_CUT_DIAGH, ppem)) * this.uppx;
		this.BOTTOM_CUT_DIAGL = Math.round(toVQ(strategy.BOTTOM_CUT_DIAGL, ppem)) * this.uppx;
		this.TOP_CUT_DIAG_DIST = Math.round(toVQ(strategy.TOP_CUT_DIAG_DIST, ppem)) * this.uppx;
		this.BOTTOM_CUT_DIAG_DIST =
			Math.round(toVQ(strategy.BOTTOM_CUT_DIAG_DIST, ppem)) * this.uppx;

		this.RISE = toVQ(strategy.RISE, ppem) / 200;
		this.SINK = toVQ(strategy.SINK, ppem) / 200;
		this.RISE_DIAGH = toVQ(strategy.RISE_DIAGH, ppem) / 200;
		this.SINK_DIAGL = toVQ(strategy.SINK_DIAGL, ppem) / 200;
		this.CHEBYSHEV_2 = toVQ(strategy.GRAVITY, ppem) / -200;
		this.CHEBYSHEV_3 = toVQ(strategy.CONCENTRATE, ppem) / 200;
		this.CHEBYSHEV_4 = toVQ(strategy.CHEBYSHEV_4, ppem) / -200;
		this.CHEBYSHEV_5 = toVQ(strategy.CHEBYSHEV_5, ppem) / 200;

		this.COEFF_OVERSEP = strategy.COEFF_OVERSEP;
	}
	getTightness(fdefs) {
		let d = 0xffff;
		for (let j = 0; j < fdefs.stems.length; j++)
			for (let k = 0; k < j; k++) {
				if (fdefs.directOverlaps[j][k]) {
					let d1 = fdefs.stems[j].y - fdefs.stems[j].width - fdefs.stems[k].y;
					if (d1 < d) d = d1;
				}
			}
		if (d < 1) d = 1;
		return this.upm / d;
	}
	round(x) {
		return roundings.rtg(x, this.upm, this.ppem);
	}
	atRadicalTop(stem) {
		return stemSpat.atRadicalTop(stem, this);
	}
	atGlyphTop(stem) {
		return stemSpat.atGlyphTop(stem, this);
	}
	atRadicalBottom(stem) {
		return stemSpat.atRadicalBottom(stem, this);
	}
	atGlyphBottom(stem) {
		return stemSpat.atGlyphBottom(stem, this);
	}
	atGlyphBottomMost(stem) {
		return stemSpat.atGlyphBottomMost(stem, this);
	}

	// Decide proper widths of stems globally
	decideWidths(stems, options) {
		return decideWidths.call(this, stems, options);
	}

	cheby(_x, extreme) {
		const x = _x * 2 - 1;
		const rise = this.RISE + (extreme ? this.RISE_DIAGH : 0);
		const sink = this.SINK + (extreme ? this.SINK_DIAGL : 0);
		const y = x + rise * risefn(_x) - sink * risefn(1 - _x);
		const dy =
			this.CHEBYSHEV_2 * (2 * x * x - 1) +
			this.CHEBYSHEV_3 * (4 * x * x * x - 3 * x) +
			this.CHEBYSHEV_4 * (8 * x * x * x * x - 8 * x * x + 1) +
			this.CHEBYSHEV_5 * (16 * x * x * x * x * x - 20 * x * x * x + 5 * x);
		const dy0 = this.CHEBYSHEV_2 - this.CHEBYSHEV_3 + this.CHEBYSHEV_4 - this.CHEBYSHEV_5;
		const dy1 = this.CHEBYSHEV_2 + this.CHEBYSHEV_3 + this.CHEBYSHEV_4 + this.CHEBYSHEV_5;
		const fdy = _x < 0 || _x > 1 ? 0 : dy - dy0 - ((dy1 - dy0) * (x + 1)) / 2;
		return (y + fdy + 1) / 2;
	}

	cy(y, w0, w, extreme) {
		const p =
			(y - w0 - this.strategy.BLUEZONE_BOTTOM_CENTER) /
			(this.strategy.BLUEZONE_TOP_CENTER - this.strategy.BLUEZONE_BOTTOM_CENTER - w0);
		return (
			w + this.glyphBottom + (this.glyphTop - this.glyphBottom - w) * this.cheby(p, extreme)
		);
	}

	// Space query
	requiredSpaceBetween(j, k) {
		return this.F[j][k] > 4 ? this.WIDTH_GEAR_PROPER : this.F[j][k] > 3 ? 1 : 0;
	}
	spaceBelow(y, w, k, bottom) {
		let space = y[k] - w[k] - bottom;
		for (let j = k - 1; j >= 0; j--) {
			if (this.directOverlaps[k][j] && y[k] - y[j] - w[k] < space)
				space = y[k] - y[j] - w[k] - this.requiredSpaceBetween(j, k);
		}
		return space;
	}
	spaceBelow1(y, k, bottom) {
		let space = y[k] - 1 - bottom;
		for (let j = k - 1; j >= 0; j--) {
			if (this.directOverlaps[k][j] && y[k] - y[j] - 1 < space)
				space = y[k] - y[j] - 1 - this.requiredSpaceBetween(j, k);
		}
		return space;
	}
	spaceAbove(y, w, k, top) {
		let space = top - y[k];
		for (let j = k + 1; j < y.length; j++) {
			if (this.directOverlaps[j][k] && y[j] - y[k] - w[j] < space)
				space = y[j] - y[k] - w[j] - this.requiredSpaceBetween(j, k);
		}
		return space;
	}
	spaceAbove1(y, k, top) {
		let space = top - y[k];
		for (let j = k + 1; j < y.length; j++) {
			if (this.directOverlaps[j][k] && y[j] - y[k] - 1 < space)
				space = y[j] - y[k] - 1 - this.requiredSpaceBetween(j, k);
		}
		return space;
	}

	decideInitHint() {
		const { avails } = this;
		return avails.map(s => s.center);
	}

	decideInitHintNT(y0) {
		const { avails, uppx } = this;
		const hinter = this;
		const pass1 = avails.map(function(a, j) {
			let initY =
				(1 / uppx) *
				lerp(
					a.y0,
					hinter.glyphBottom0,
					hinter.glyphTop0,
					hinter.glyphBottom,
					hinter.glyphTop
				);
			if (y0) {
				initY = y0[j];
			}
			return xclamp(a.low, Math.round(initY), a.high);
		});

		if (
			pass1.length > 1 &&
			avails[0].y0 < avails[avails.length - 1].y0 &&
			pass1[0] < pass1[pass1.length - 1]
		) {
			return avails.map(a =>
				xclamp(
					a.low,
					Math.round(
						lerp(
							a.y0,
							avails[0].y0,
							avails[avails.length - 1].y0,
							pass1[0],
							pass1[pass1.length - 1]
						)
					),
					a.high
				)
			);
		} else {
			return pass1;
		}
	}

	uncollide(y) {
		const { strategy } = this;
		const stages = strategy.STEADY_STAGES_MAX;

		const population = strategy.POPULATION_LIMIT;
		const y1 = uncollide(y, this, stages, population, true);
		const y2 = uncollide(y1, this, stages, population, false);
		return y2;
	}
	// Manual expanded for performance
	balance(y) {
		const cached = this._balanceCache.get(y);
		if (cached) {
			return cached;
		}

		let y0 = [...y];
		const [f, k] = this._balanceCache.peek(y);

		const y1 = balance1(y0, this);
		const cached1 = this._balanceCache.get(y1);
		if (cached1) {
			f[k] = cached1;
			return cached1;
		}
		const [f1, k1] = this._balanceCache.peek(y1);

		const y2 = balance2(y1, this);
		const cached2 = this._balanceCache.get(y2);
		if (cached2) {
			f[k] = f1[k1] = cached2;
			return cached2;
		}
		const [f2, k2] = this._balanceCache.peek(y2);

		const y3 = balance3(y2, this);
		const [f3, k3] = this._balanceCache.peek(y3);

		f[k] = f1[k1] = f2[k2] = f3[k3] = y3;
		return y3;
	}
	createIndividual(y, unbalanced) {
		const cache = unbalanced ? this._idvCacheU : this._idvCache;
		const cached = cache.get(y);
		if (cached) {
			return cached;
		} else {
			const idv = new Individual([...y], this, !!unbalanced);
			cache.set(y, idv);
			return idv;
		}
	}
	createBalancedIndividual(y) {
		const cache = this._idvCache;
		const cached = cache.get(y);
		if (cached) {
			return cached;
		} else {
			const idv = new Individual(this.balance(y), this, false);
			cache.set(y, idv);
			return idv;
		}
	}

	allocateWidth(y) {
		return allocateWidth(this.createIndividual(y).gene, this);
	}
}

function decideSymmetry() {
	const { avails, directOverlaps } = this;
	let sym = [];
	for (let j = 0; j < avails.length; j++) {
		sym[j] = [];
		for (let k = 0; k < j; k++) {
			sym[j][k] =
				!directOverlaps[j][k] &&
				!avails[j].diagHigh &&
				!avails[k].diagHigh &&
				Math.abs(avails[j].y0 - avails[k].y0) < this.uppx / 3 &&
				Math.abs(avails[j].y0 - avails[j].w0 - avails[k].y0 + avails[k].w0) <
					this.uppx / 3 &&
				Math.abs(avails[j].length - avails[k].length) < this.uppx / 3 &&
				avails[j].hasSameRadicalStemAbove === avails[k].hasSameRadicalStemAbove &&
				avails[j].hasSameRadicalStemBelow === avails[k].hasSameRadicalStemBelow &&
				(avails[j].hasGlyphStemAbove === avails[k].hasGlyphStemAbove ||
					avails[j].hasGlyphStemBelow === avails[k].hasGlyphStemBelow) &&
				(avails[j].atGlyphTop === avails[k].atGlyphTop ||
					avails[j].atGlyphBottom === avails[k].atGlyphBottom);
		}
	}
	return sym;
}

module.exports = Hinter;
