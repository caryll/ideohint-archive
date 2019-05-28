"use strict";

// GDI and DW uses a 6×5 filter for antialiasing
// Therefore we use a up-rounding by 1/5px to make strokes
// more consistent
function roundWpx(x) {
	return Math.round(Math.ceil(x * 5) / 5);
}

const MIN_EXPANDABLE_PIXELS_B = 1 + 1 / 4;
const MIN_EXPANDABLE_PIXELS_T = 1 + 1 / 2;

// decide the proper width of given stem locally
function calculateWidthOfStem(s, w) {
	if (this.WIDTH_GEAR_PROPER <= 1) return 1;
	return Math.max(
		1,
		(!s.hasGlyphStemAbove && w >= MIN_EXPANDABLE_PIXELS_B * this.uppx) ||
		(!s.hasGlyphStemAbove && w >= MIN_EXPANDABLE_PIXELS_T * this.uppx)
			? Math.min(2, this.WIDTH_GEAR_PROPER)
			: 0,
		roundWpx(w / this.uppx)
	);
}

// Decide proper widths of stems globally
function decideWidths(stems, options) {
	let tws = [];
	for (let j = 0; j < stems.length; j++) {
		tws[j] = Math.min(
			options.maxStrokeWidths[j],
			calculateWidthOfStem.call(this, stems[j], stems[j].width)
		);
	}
	return tws;
}

module.exports = decideWidths;
