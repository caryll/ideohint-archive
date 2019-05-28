"use strict";

const slopeOf = require("../types/").slopeOf;

function keyptPriority(incoming, current, atl, atr) {
	if (atr) {
		return current.x < incoming.x;
	} else if (atl) {
		return current.x > incoming.x;
	} else {
		if (current.y === incoming.y) {
			return current.x > incoming.x;
		} else {
			return current.y > incoming.y;
		}
	}
}

function findHighLowKeys(s, strategy) {
	let highkey = null,
		lowkey = null;

	for (let j = 0; j < s.high.length; j++) {
		for (let k = 0; k < s.high[j].length; k++) {
			if (
				!highkey ||
				(s.high[j][k].id >= 0 &&
					keyptPriority(s.high[j][k], highkey, s.atLeft, s.atRight, strategy))
			) {
				highkey = s.high[j][k];
			}
		}
	}
	for (let j = 0; j < s.low.length; j++) {
		for (let k = 0; k < s.low[j].length; k++) {
			if (
				!lowkey ||
				(s.low[j][k].id >= 0 &&
					keyptPriority(s.low[j][k], lowkey, s.atLeft, s.atRight, strategy))
			) {
				lowkey = s.low[j][k];
			}
		}
	}
	return { highkey, lowkey };
}

function correctYWForStem(s, strategy) {
	const slope = (slopeOf(s.high) + slopeOf(s.low)) / 2;
	let { highkey, lowkey } = findHighLowKeys(s, strategy);
	s.highkey = highkey;
	s.lowkey = lowkey;
	s.slope = slope;
	s.y = highkey.y;
	s.width = highkey.y - lowkey.y + (lowkey.x - highkey.x) * slope;
	return { highkey, lowkey, slope };
}

exports.findHighLowKeys = findHighLowKeys;
exports.correctYWForStem = correctYWForStem;
