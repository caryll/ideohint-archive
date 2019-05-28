"use strict";

function canBeAdjustedUp(y, k, env, distance) {
	for (let j = k + 1; j < y.length; j++) {
		if (env.directOverlaps[j][k] && y[j] - y[k] - 1 <= distance) return false;
	}
	return true;
}
function canBeAdjustedDown(y, k, env, distance) {
	for (let j = 0; j < k; j++) {
		if (env.directOverlaps[k][j] && y[k] - y[j] - 1 <= distance) return false;
	}
	return true;
}

const ANNEXED = 0;
const COLLIDING = 1;
const SPACED = 2;

function balanceMove(y, env) {
	const m = env.availsByLength;
	const avails = env.avails;
	let stable = true;
	for (let jm = 0; jm < y.length; jm++) {
		let j = m[jm][1];
		if (avails[j].atGlyphBottom || avails[j].atGlyphTop) continue;
		if (canBeAdjustedDown(y, j, env, 1.8) && y[j] > avails[j].low) {
			if (y[j] - avails[j].center > 0.75) {
				y[j] -= 1;
				stable = false;
			}
		} else if (canBeAdjustedUp(y, j, env, 1.8) && y[j] < avails[j].high) {
			if (avails[j].center - y[j] > 0.75) {
				y[j] += 1;
				stable = false;
			}
		}
	}
	return stable;
}

function tryImprove2(env, y, j1, mark1, j2, mark2) {
	const avails = env.avails;
	if (mark1 > 0 && y[j1] >= avails[j1].high) return false;
	if (mark1 < 0 && y[j1] <= avails[j1].low) return false;
	if (mark2 > 0 && y[j2] >= avails[j2].high) return false;
	if (mark2 < 0 && y[j2] <= avails[j2].low) return false;
	const before = env.createIndividual(y, true);
	y[j1] += mark1;
	y[j2] += mark2;
	const after = env.createIndividual(y, true);
	if (after.better(before)) {
		return true;
	} else {
		y[j1] -= mark1;
		y[j2] -= mark2;
		return false;
	}
}
function tryImprove3(env, y, j1, mark1, j2, mark2, j3, mark3) {
	const avails = env.avails;
	if (mark1 > 0 && y[j1] >= avails[j1].high) return false;
	if (mark1 < 0 && y[j1] <= avails[j1].low) return false;
	if (mark2 > 0 && y[j2] >= avails[j2].high) return false;
	if (mark2 < 0 && y[j2] <= avails[j2].low) return false;
	if (mark3 > 0 && y[j3] >= avails[j3].high) return false;
	if (mark3 < 0 && y[j3] <= avails[j3].low) return false;
	const before = env.createIndividual(y, true);
	y[j1] += mark1;
	y[j2] += mark2;
	y[j3] += mark3;
	const after = env.createIndividual(y, true);
	if (after.better(before)) {
		return true;
	} else {
		y[j1] -= mark1;
		y[j2] -= mark2;
		y[j3] -= mark3;
		return false;
	}
}

function balanceTriplets1(y, env, pass) {
	const avails = env.avails;
	const triplets = env.triplets;
	const P = env.P;
	let stable = true;
	for (let _t = 0; _t < triplets.length; _t++) {
		const t = triplets[_t];
		const j = t[0],
			k = t[1],
			m = t[2];
		let mark = 0;
		let checkImprove = false;
		if (y[j] - y[k] === COLLIDING && y[k] - y[m] === COLLIDING) {
			// Situation |0|0|
			if (pass % 2) {
				if (y[k] > avails[k].low) mark = -1;
				else if (y[k] < avails[k].high) mark = +1;
			} else {
				if (y[k] < avails[k].high) mark = +1;
				else if (y[k] > avails[k].low) mark = -1;
			}
		} else if (y[j] - y[k] === COLLIDING && y[k] - y[m] === SPACED && y[k] > avails[k].low) {
			mark = -1;
			checkImprove = true;
		} else if (y[k] - y[m] === COLLIDING && y[j] - y[k] === SPACED && y[k] < avails[k].high) {
			mark = 1;
			checkImprove = true;
		} else if (
			(y[j] - y[k] === COLLIDING || y[j] - y[k] === ANNEXED) &&
			y[k] - y[m] > SPACED &&
			y[k] > avails[k].low
		) {
			mark = -1;
			if (P[k][m] < 4) checkImprove = true;
		} else if (
			(y[k] - y[m] === COLLIDING || y[k] - y[m] === ANNEXED) &&
			y[j] - y[k] > SPACED &&
			y[k] < avails[k].high
		) {
			mark = 1;
			if (P[j][k] < 4) checkImprove = true;
		}
		if (checkImprove) {
			if (tryImprove2(env, y, k, mark, 0, 0)) {
				stable = false;
			}
		} else if (mark) {
			y[k] += mark;
			stable = false;
		}
	}
	return stable;
}

function balanceQuartlets(y, env) {
	const avails = env.avails;
	const quartlets = env.quartlets;
	let stable = true;
	for (let _t = 0; _t < quartlets.length; _t++) {
		const t = quartlets[_t];
		const j = t[0],
			k = t[1],
			m = t[2],
			w = t[3];
		// |1||2| prevention -> |1|0|1|
		if (
			avails[k].xmin === avails[m].xmin &&
			avails[k].xmax === avails[m].xmax &&
			y[k] - y[m] === ANNEXED
		) {
			if (y[j] - y[k] === SPACED + 1 && y[m] - y[w] === SPACED && y[k] < avails[k].high) {
				y[k] += 1;
				stable = false;
			} else if (
				y[j] - y[k] === SPACED &&
				y[m] - y[w] === SPACED + 1 &&
				y[m] > avails[m].high
			) {
				y[m] -= 1;
				stable = false;
			}
		} else if (
			y[j] - y[k] === COLLIDING &&
			y[k] - y[m] === SPACED &&
			y[m] - y[w] === COLLIDING &&
			y[k] > avails[k].low &&
			y[m] < avails[m].high
		) {
			// |0|1|0| -> |1||1|
			y[k] -= 1;
			y[m] += 1;
			stable = false;
		} else if (
			y[j] - y[k] === COLLIDING &&
			y[k] - y[m] === ANNEXED &&
			y[m] - y[w] === COLLIDING
		) {
			// Situation |0||0| --> ||1|| or |1||| or |||1|
			if (tryImprove2(env, y, k, 1, m, -1)) stable = false;
			if (tryImprove2(env, y, k, 1, m, 1)) stable = false;
			if (tryImprove2(env, y, k, -1, m, -1)) stable = false;
		} else if (
			y[j] - y[k] === COLLIDING &&
			y[k] - y[m] === SPACED &&
			y[m] - y[w] === ANNEXED &&
			env.spaceBelow1(y, w, env.glyphBottomPixels - 1) < 1
		) {
			// Situation |0|1||0[ -> |1|||1[
			if (tryImprove3(env, y, k, -1, m, +1, w, +1)) stable = false;
		} else if (
			y[j] - y[k] === COLLIDING &&
			y[k] - y[m] === ANNEXED &&
			y[m] - y[w] === SPACED &&
			env.spaceBelow1(y, w, env.glyphBottomPixels - 1) < 1
		) {
			// Situation |0||1|0[ -> |1|||1[
			if (tryImprove3(env, y, k, -1, m, -1, w, +1)) stable = false;
		} else if (
			y[j] - y[k] === ANNEXED &&
			y[k] - y[m] === SPACED &&
			y[m] - y[w] === COLLIDING &&
			env.spaceAbove1(y, j, env.glyphTopPixels + 1) < 1
		) {
			// Situation ]0||1|0| -> ]1|||1|
			if (tryImprove3(env, y, j, -1, k, -1, m, +1)) stable = false;
		} else if (
			y[j] - y[k] === SPACED &&
			y[k] - y[m] === ANNEXED &&
			y[m] - y[w] === COLLIDING &&
			env.spaceAbove1(y, j, env.glyphTopPixels + 1) < 1
		) {
			// Situation ]0|1||0| -> ]1|||1|
			if (tryImprove3(env, y, j, -1, k, +1, m, +1)) stable = false;
		}
	}
	return stable;
}

function balance1(y, env) {
	const REBALANCE_PASSES = env.strategy.REBALANCE_PASSES;
	for (let pass = 0; pass < REBALANCE_PASSES; pass++) {
		if (balanceMove(y, env, pass)) break;
	}
	return y;
}
function balance2(y, env) {
	const REBALANCE_PASSES = env.strategy.REBALANCE_PASSES;
	for (let pass = 0; pass < REBALANCE_PASSES; pass++) {
		if (balanceTriplets1(y, env, pass)) break;
	}
	return y;
}
function balance3(y, env) {
	const REBALANCE_PASSES = env.strategy.REBALANCE_PASSES;
	for (let pass = 0; pass < REBALANCE_PASSES; pass++) {
		if (balanceQuartlets(y, env, pass)) break;
	}
	for (let j = 0; j < y.length; j++) {
		for (let k = 0; k < j; k++) {
			if (env.symmetry[j][k] && y[j] !== y[k]) {
				y[k] = y[j];
			}
		}
	}
	return y;
}

module.exports.balance1 = balance1;
module.exports.balance2 = balance2;
module.exports.balance3 = balance3;
