"use strict";

const Point = require("../types/").Point;
const { leftmostZ_SS: leftmostZ, rightmostZ_SS: rightmostZ } = require("../si-common/seg");
const Stem = require("./couplestem");

function shouldSplit(hl, ll, hr, lr, strategy) {
	if (hl === hr || ll === lr) return false;
	if (hl.y === hr.y || ll.y === lr.y) return false;
	if ((hl.on && ll.on && !hr.on && !lr.on) || (!hl.on && !ll.on && hr.on && lr.on)) {
		if (Point.adjacentZ(hl, hr) && Point.adjacentZ(ll, lr)) return false;
	}

	return (
		Math.abs(hr.y - hl.y) >= Math.abs(hr.x - hl.x) * strategy.SLOPE_FUZZ_R &&
		Math.abs(lr.y - ll.y) >= Math.abs(lr.x - ll.x) * strategy.SLOPE_FUZZ_R &&
		Math.abs(Math.min(hl.x, ll.x) - Math.max(hr.x, lr.x)) >=
			2 * Math.max(Math.abs(hl.y - ll.y), Math.abs(hr.y - lr.y)) &&
		Math.abs(Math.max(hl.x, ll.x) - Math.min(hr.x, lr.x)) >=
			Math.max(Math.abs(hl.y - ll.y), Math.abs(hr.y - lr.y)) &&
		Math.abs(hl.x - ll.x) * 2.25 < Math.max(Math.abs(hl.x - hr.x), Math.abs(ll.x - lr.x)) &&
		Math.abs(hr.x - lr.x) * 2.25 < Math.max(Math.abs(hl.x - hr.x), Math.abs(ll.x - lr.x)) &&
		(Math.abs(hl.y - hr.y) >= strategy.Y_FUZZ_DIAG ||
			Math.abs(ll.y - lr.y) >= strategy.Y_FUZZ_DIAG)
	);
}
function contained(z1, z2, segs, fuzz) {
	for (let seg of segs)
		for (let z of seg) {
			if (
				(z.y > z1.y + fuzz && z.y > z2.y + fuzz) ||
				(z.y < z1.y - fuzz && z.y < z2.y - fuzz)
			) {
				return false;
			}
		}
	return true;
}

function splitDiagonalStem(s, strategy, rid, results) {
	let hl = leftmostZ(s.high);
	let ll = leftmostZ(s.low);
	let hr = rightmostZ(s.high);
	let lr = rightmostZ(s.low);

	if (
		shouldSplit(hl, ll, hr, lr, strategy) &&
		contained(ll, lr, s.low, strategy.Y_FUZZ) &&
		contained(hl, hr, s.high, strategy.Y_FUZZ)
	) {
		let hmx = (hl.x + hr.x) / 2;
		let lmx = (ll.x + lr.x) / 2;
		let hmy = (hl.y + hr.y) / 2;
		let lmy = (ll.y + lr.y) / 2;
		const sleft = new Stem(
			[[hl, new Point(hmx - 1, hmy, true, Point.PHANTOM)]],
			[[ll, new Point(lmx - 1, lmy, true, Point.PHANTOM)]],
			s.belongRadical
		);
		sleft.atLeft = true;
		sleft.rid = rid;
		const sright = new Stem(
			[[new Point(hmx + 1, hmy, true, Point.PHANTOM), hr]],
			[[new Point(lmx + 1, lmy, true, Point.PHANTOM), lr]],
			s.belongRadical
		);
		sright.atRight = true;
		sright.rid = rid;
		if (hl.y > hr.y) {
			sleft.diagHigh = true;
			sright.diagLow = true;
		} else {
			sright.diagHigh = true;
			sleft.diagLow = true;
		}
		// intermediate knots
		const ipHigh = [];
		const ipLow = [];
		for (let sg of s.high) {
			for (let z of [sg[0], sg[sg.length - 1]]) {
				if (!(z.id >= 0)) continue;
				if (z.id === hl.id || z.id === hr.id) continue;
				ipHigh.push([hl, hr, z]);
			}
		}
		for (let sg of s.low) {
			for (let z of [sg[0], sg[sg.length - 1]]) {
				if (!(z.id >= 0)) continue;
				if (z.id === ll.id || z.id === lr.id) continue;
				ipLow.push([ll, lr, z]);
			}
		}
		sleft.ipHigh = ipHigh;
		sleft.ipLow = ipLow;
		results.push(sleft, sright);
	} else {
		results.push(s);
	}
}
function splitDiagonalStems(ss, strategy) {
	var ans = [];
	let rid = 1;
	for (let s of ss) {
		splitDiagonalStem(s, strategy, rid, ans);
		rid += 1;
	}
	return ans;
}
exports.splitDiagonalStems = splitDiagonalStems;
exports.splitDiagonalStem = splitDiagonalStem;
