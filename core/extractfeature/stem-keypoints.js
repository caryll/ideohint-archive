"use strict";

const hlkey = require("../findstem/hlkey");

module.exports = function(stems, strategy) {
	// Stem Keypoints
	for (var js = 0; js < stems.length; js++) {
		const s = stems[js];
		// posKeyShouldAtBottom : a bottom stem?
		const { highkey, lowkey } = hlkey.correctYWForStem(s, strategy);
		highkey.touched = lowkey.touched = true;

		// Identify bottom stems, when it does not have folds or entire contour below it, and
		// - is below half of the character frame, or
		// - has a stem above it and not being the top frame of enclosed radical
		const posKeyShouldAtBottom =
			!s.hasGlyphStemBelow &&
			!(s.hasGlyphFoldBelow || s.hasEntireContourBelow) &&
			!(s.diagHigh || s.diagLow);

		// get non-key points
		let highnonkey = [],
			lownonkey = [];
		let jh = -1,
			jl = -1;
		for (let j = 0; j < s.high.length; j++) {
			for (let k = 0; k < s.high[j].length; k++) {
				if (s.high[j][k] === highkey) {
					jh = j;
					continue;
				}
				s.high[j][k].linkedKey = highkey;
				if (!(s.high[j][k].id >= 0)) {
					continue;
				}
				if (k === 0) {
					highnonkey[j] = s.high[j][k];
					s.high[j][k].touched = true;
				} else {
					s.high[j][k].donttouch = true;
				}
			}
		}
		highnonkey = highnonkey.filter((v, j) => j !== jh);
		for (let j = 0; j < s.low.length; j++) {
			for (let k = 0; k < s.low[j].length; k++) {
				if (s.low[j][k] === lowkey) {
					jl = j;
					continue;
				}
				s.low[j][k].linkedKey = lowkey;
				if (!(s.low[j][k].id >= 0)) {
					continue;
				}
				if (k === s.low[j].length - 1) {
					lownonkey[j] = s.low[j][k];
					s.low[j][k].touched = true;
				} else {
					s.low[j][k].donttouch = true;
				}
			}
		}
		lownonkey = lownonkey.filter((v, j) => j !== jl);

		s.posKey = posKeyShouldAtBottom ? lowkey : highkey;
		s.advKey = posKeyShouldAtBottom ? highkey : lowkey;
		s.advKey.linkedKey = s.posKey;
		s.posAlign = posKeyShouldAtBottom ? lownonkey : highnonkey;
		s.advAlign = posKeyShouldAtBottom ? highnonkey : lownonkey;
		s.posKeyAtTop = !posKeyShouldAtBottom;
		s.posKey.keypoint = true;
		s.advKey.keypoint = true;
		s.posKey.slope = s.advKey.slope = s.slope;
	}
};
