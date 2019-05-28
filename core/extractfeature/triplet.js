"use strict";

function analyzeBlanks(stems, directOverlaps) {
	let blanks = [];
	for (let j = 0; j < directOverlaps.length; j++) {
		blanks[j] = [];
		for (let k = 0; k < directOverlaps.length; k++) {
			blanks[j][k] = stems[j].y - stems[j].width - stems[k].y;
		}
	}
	return blanks;
}
exports.analyzeBlanks = analyzeBlanks;
exports.analyzeTriplets = function(stems, directOverlaps, blanks) {
	let triplets = [];
	for (let j = 0; j < stems.length; j++) {
		for (let k = 0; k < j; k++) {
			if (!directOverlaps[j][k] || blanks[j][k] < 0) continue;
			for (let w = 0; w < k; w++)
				if (directOverlaps[k][w] && blanks[k][w] >= 0) {
					triplets.push([j, k, w, blanks[j][k], blanks[k][w]]);
				}
		}
	}
	return triplets;
};
exports.analyzeQuartlets = function(triplets, directOverlaps, blanks) {
	const quartlets = [];
	for (let [j, k, m] of triplets) {
		for (let w = 0; w < m; w++) {
			if (!directOverlaps[m][w] || blanks[m][w] < 0) continue;
			quartlets.push([j, k, m, w]);
		}
	}
	return quartlets;
};
