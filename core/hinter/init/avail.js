"use strict";

const { mix, lerp, xclamp } = require("../../../support/common");
const stemSpat = require("../../../support/stem-spatial");

function decideMaxShift(y0, w0, ppem, tightness, strategy) {
	const minShiftLL = xclamp(3 / 4, lerp(ppem, 12, 24, 0.1 * tightness + 0.27, 3 / 4), 2);
	const mU = xclamp(
		1,
		lerp(y0 - w0 / 2, strategy.BLUEZONE_TOP_CENTER, strategy.BLUEZONE_BOTTOM_CENTER, 1, 3),
		2
	);
	const mD = xclamp(
		1,
		lerp(y0 - w0 / 2, strategy.BLUEZONE_TOP_CENTER, strategy.BLUEZONE_BOTTOM_CENTER, 3, 1),
		2
	);
	const maxShiftU = xclamp(Math.min(mU, minShiftLL), ppem / 16, mU);
	const maxShiftD = xclamp(Math.min(mD, minShiftLL), ppem / 16, mD);
	return [maxShiftD, maxShiftU];
}

class Avail {
	constructor(env, stem, tw, stemMargins) {
		const { upm, ppem, uppx, strategy, tightness } = env;

		const y0 = stem.y,
			w0 = stem.width,
			w = tw * uppx;
		// Spatial relationships
		this.atGlyphTop = env.atGlyphTop(stem);
		this.atGlyphBottom = env.atGlyphBottom(stem);

		// The bottom limit of a stem
		const lowlimitHard =
			env.glyphBottom +
			w +
			Math.max(
				stem.diagLow
					? env.BOTTOM_CUT_DIAGL
					: stem.diagHigh
						? env.BOTTOM_CUT_DIAGL + env.BOTTOM_CUT_DIAG_DIST
						: env.BOTTOM_CUT,
				this.atGlyphBottom ? 0 : uppx
			);
		let lowlimit = Math.max(
			lowlimitHard,
			env.glyphBottom +
				w +
				Math.max(
					0,
					stem.turnsBelow > 2 &&
					((!stem.hasGlyphStemBelow && !stem.diagLow) || stem.turnsBelow > 5)
						? Math.min(3, stem.turnsBelow / 2) * uppx
						: 0
				)
		);
		if (!stem.hasGlyphStemBelow && stemMargins && stemMargins.bottom < stemMargins.top) {
			lowlimit = Math.max(env.glyphBottom + w + stemMargins.bottom * uppx, lowlimit);
		}
		let fold = false;
		// Add additional space below strokes with a fold under it.
		if (stem.hasGlyphFoldBelow && !stem.hasGlyphStemBelow) {
			lowlimit = Math.max(
				lowlimit,
				env.glyphBottom +
					Math.max(tw + 2, tw * 2 + 1 + (tw === 1 && env.WIDTH_GEAR_PROPER > 1 ? 1 : 0)) *
						uppx
			);
			fold = true;
		} else if (stem.hasGlyphSideFoldBelow && !stem.hasGlyphStemBelow) {
			lowlimit = Math.max(lowlimit, env.glyphBottom + Math.max(tw + 2, tw * 2) * uppx);
			fold = true;
		}
		lowlimit = Math.max(lowlimitHard, Math.min(lowlimit, uppx * Math.ceil(y0 / uppx)));

		// The top limit of a stem ('s upper edge)
		const highLimitHard =
			env.glyphTop -
			Math.max(
				// cut part
				stem.diagHigh
					? env.TOP_CUT_DIAGH
					: stem.diagLow
						? env.TOP_CUT_DIAGH + env.TOP_CUT_DIAG_DIST
						: env.TOP_CUT,
				// spatial part
				this.atGlyphTop ? 0 : uppx
			);
		let highlimit = Math.min(
			highLimitHard,
			env.glyphTop -
				Math.max(
					0,
					stem.turnsAbove > 2 && !stem.hasGlyphStemAbove
						? xclamp(0, stem.turnsAbove - 2, 3) * uppx
						: 0
				)
		);
		if (!stem.hasGlyphStemAbove && stemMargins && stemMargins.top < stemMargins.bottom) {
			highlimit = Math.min(env.glyphTop - stemMargins.top * uppx, highlimit);
		}

		if (stem.hasEntireContourAbove) {
			highlimit = Math.min(env.glyphTop - 2 * uppx, highlimit);
		}
		highlimit = Math.min(
			highLimitHard,
			Math.max(highlimit, uppx * Math.floor((y0 - w0) / uppx))
		);

		const lowlimitW = Math.max(env.glyphBottom + w, tw > 1 ? lowlimit - uppx : lowlimit);
		const lowlimitP = lowlimit;
		const highlimitP = highlimit;

		for (let prop of [1 / 2]) {
			const lim0 = mix(env.glyphBottom0, env.glyphTop0, prop);
			const lim = mix(env.glyphBottomPixels, env.glyphTopPixels, prop);
			if (y0 - w0 <= lim0 + uppx / 2) {
				highlimit = xclamp(lowlimit, Math.ceil(lim) * uppx + w, highlimit);
			}
			if (y0 <= lim0 + uppx / 2) {
				highlimit = xclamp(lowlimit, Math.ceil(lim) * uppx, highlimit);
			}
			if (y0 - w0 >= lim0 - uppx / 2) {
				lowlimit = xclamp(lowlimit, Math.floor(lim) * uppx + w, highlimit);
			}
			if (y0 >= lim0 - uppx / 2) {
				lowlimit = xclamp(lowlimit, Math.floor(lim) * uppx, highlimit);
			}
		}

		const center0 = env.cy(
			y0,
			w0,
			w,
			(this.atGlyphTop && stem.diagHigh) || (this.atGlyphBottom && stem.diagLow),
			stem.posKeyAtTop
		);
		const [maxShiftD, maxShiftU] = decideMaxShift(y0, w0, ppem, tightness, strategy);
		const lowW = xclamp(
			lowlimitW,
			env.round(center0 - Math.max(1, maxShiftD) * uppx),
			highlimitP
		);
		const highW = xclamp(
			lowlimitW,
			env.round(center0 + Math.max(1, maxShiftU) * uppx),
			highlimitP
		);
		const lowP = xclamp(lowlimitP, env.round(center0 - maxShiftD / 2 * uppx), highlimitP);
		const highP = xclamp(lowlimitP, env.round(center0 + maxShiftU / 2 * uppx), highlimitP);
		const low = xclamp(lowlimit, env.round(center0 - maxShiftD * uppx), highlimit);
		const high = xclamp(lowlimit, env.round(center0 + maxShiftU * uppx), highlimit);
		const center = xclamp(low, center0, high);

		const ablationCoeff =
			env.atGlyphTop(stem) || env.atGlyphBottom(stem)
				? env.strategy.ABLATION_GLYPH_HARD_EDGE
				: !stem.hasGlyphStemAbove || !stem.hasGlyphStemBelow
					? env.strategy.ABLATION_GLYPH_EDGE
					: !stem.hasSameRadicalStemAbove || !stem.hasSameRadicalStemBelow
						? env.strategy.ABLATION_RADICAL_EDGE
						: env.strategy.ABLATION_IN_RADICAL;

		// limit of the stroke's y, when positioning, in pixels
		this.low = Math.round(low / uppx);
		this.high = Math.round(high / uppx);
		// limit of the stroke's y, when width allocating, in pixels
		this.lowLimitW = Math.round((lowlimit - w) / uppx);
		this.lowW = Math.round(lowW / uppx);
		this.highW = Math.round(highW / uppx);
		// limit of the stroke's y, when width allocating's pushing pass, in pixels
		this.lowP = Math.round(lowP / uppx);
		this.highP = Math.round(highP / uppx);
		// soft high/low limits, affects ablation potential
		this.softLow = this.low;
		this.softHigh = this.high;
		// its proper width, in pixels
		this.properWidth = tw;
		// its proper position, in pixels
		this.center = center / uppx;
		this.ablationCoeff = ablationCoeff / uppx * (1 + 0.5 * (stem.xmax - stem.xmin) / upm);
		// original position and width
		this.y0 = y0;
		this.w0 = w0;
		this.y0px = y0 / uppx;
		this.w0px = w0 / uppx;
		const proportion =
			(env.glyphTopPixels - this.y0px) /
			(env.glyphTopPixels - env.glyphBottomPixels - this.w0px);
		this.yrpx =
			proportion * this.w0px + mix(env.glyphTopPixels, env.glyphBottomPixels, proportion);
		this.xmin = stem.xmin;
		this.xmax = stem.xmax;
		this.xminX = stem.xminX;
		this.xmaxX = stem.xmaxX;
		this.length = stem.xmax - stem.xmin;
		this.plength = this.length / upm;
		this.hasLRSpur = stem.hasLRSpur;
		// spatial relationships
		// this.atGlyphTop = env.atGlyphTop(stem);
		// this.atGlyphBottom = env.atGlyphBottom(stem);
		this.hasGlyphStemAbove = stem.hasGlyphStemAbove;
		this.hasGlyphStemBelow = stem.hasGlyphStemBelow;
		this.hasSameRadicalStemAbove = stem.hasSameRadicalStemAbove;
		this.hasSameRadicalStemBelow = stem.hasSameRadicalStemBelow;
		this.hasFoldBelow = fold;
		this.posKeyAtTop = stem.posKeyAtTop;
		this.diagLow = stem.diagLow;
		this.diagHigh = stem.diagHigh;
		this.rid = stem.rid;
		this.belongRadical = stem.belongRadical;
		this.atStrictRadicalBottom = stemSpat.atStrictRadicalBottom(stem, env);
		this.isHangingHook =
			!this.atStrictRadicalBottom &&
			this.plength < 1 / 3 &&
			!(this.diagLow || this.diagHigh) &&
			!stem.hasGlyphLeftAdjacentPointBelow &&
			!stem.hasGlyphRightAdjacentPointBelow &&
			this.y0 - this.w0 > env.strategy.Y_FUZZ + env.strategy.BLUEZONE_BOTTOM_LIMIT;
		this.atGlyphBottomMost = this.atStrictRadicalBottom && env.atGlyphBottomMost(stem);
	}
}

/**
 * Adjust avail list to unify top/bottom features
 * @param {*} avails
 * @param {*} stems
 */
function adjustAvails(avails, stems) {
	const { uppx } = this;
	const topPx = this.glyphTop / uppx;
	const bottomPx = this.glyphBottom / uppx;
	// fix top and bottom stems
	for (let j = 0; j < stems.length; j++) {
		const avail = avails[j],
			stem = stems[j];
		/// Locking bottom
		if (
			!stem.hasGlyphStemBelow &&
			!stem.hasGlyphFoldBelow &&
			!stem.diagHigh &&
			(avail.atGlyphBottom ||
				(this.onePixelMatter && avail.center <= (topPx + bottomPx) / 2) ||
				avail.high - avail.properWidth - bottomPx < 3) &&
			(stems.length > 1 || avail.atGlyphBottom)
		) {
			avail.high = Math.round(
				Math.max(
					avail.low,
					Math.floor(avail.center),
					bottomPx +
						avail.properWidth +
						(avail.atGlyphBottom && avail.isHangingHook ? 1 : 0)
				)
			);
		}
		/// lock top
		if (
			!stem.hasGlyphStemAbove &&
			!stem.diagLow &&
			(avail.atGlyphTop ? avail.center > (topPx + bottomPx) / 2 : avail.center >= topPx - 1)
		) {
			avail.low = Math.min(avail.high, Math.round(avail.center));
		}

		// Push bottommost stroke down to unify bottom features.
		// This unifies bottom features to make the text more "aligned".
		if (avail.atGlyphBottomMost && !avail.diagHigh) {
			const bot = avail.high - avail.properWidth;
			const force =
				stem.diagHigh || stem.diagLow
					? this.BOTTOM_UNIFY_FORCE_DIAG
					: stem.hasLRSpur && !this.onePixelMatter
						? 0
						: this.BOTTOM_UNIFY_FORCE;
			const bot1 =
				topPx - (topPx - bot) * (topPx - bottomPx - force) / (topPx - bottomPx - force * 2);
			avail.high = Math.round(bot1 + avail.properWidth);
			if (avail.high < avail.low) avail.high = avail.low;
		}

		// Push topmost stroke down to unify top features.
		// This unifies top features to make the text more "aligned".
		if (avail.atGlyphTop && !avail.atGlyphBottomMost && !avail.diagLow) {
			const top = avail.low;
			const force =
				stem.diagHigh || stem.diagLow ? this.TOP_UNIFY_FORCE_DIAG : this.TOP_UNIFY_FORCE;
			const top1 =
				bottomPx +
				(top - bottomPx) * (topPx - bottomPx - force) / (topPx - bottomPx - force * 2);
			avail.low = Math.round(top1);
			if (avail.low - avail.center > 1) avail.low = Math.max(top, avail.low - 1);

			if (avail.low > avail.high) avail.low = avail.high;
		}
	}

	for (let s of avails) {
		if (!this.onePixelMatter && s.diagLow && s.center >= topPx - 0.5) {
			s.center = xclamp(s.low, topPx - 1, s.center);
			s.softHigh = s.center;
		}
		if (!this.onePixelMatter && s.diagHigh && s.center <= bottomPx + 0.5) {
			s.center = xclamp(s.center, bottomPx + 1, s.high);
			s.softLow = s.center;
		}
		if (s.isHangingHook) {
			s.softLow = Math.max(this.glyphBottomPixels + s.properWidth + 1, s.softLow);
		}
	}
}

function decideAvails(stems, tws, options) {
	const { margins } = options;
	let avails = [];
	// decide avails
	for (let j = 0; j < stems.length; j++) {
		avails[j] = new Avail(this, stems[j], tws[j], margins ? margins[j] : null);
	}
	// unify top/bottom features
	adjustAvails.call(this, avails, stems);
	// get soft high/low limit for diggonals
	for (let j = 0; j < stems.length; j++) {
		if (!this.onePixelMatter && avails[j].diagLow) {
			avails[j].softHigh = avails[j].center;
		}
		if (!this.onePixelMatter && avails[j].diagHigh) {
			avails[j].softLow = avails[j].center;
		}
	}
	// calculate proportion for ablation calculation
	for (let j = 0; j < stems.length; j++) {
		avails[j].proportion =
			(avails[j].center - avails[0].center) /
				(avails[avails.length - 1].center - avails[0].center) || 0;
	}
	return avails;
}

module.exports = decideAvails;
