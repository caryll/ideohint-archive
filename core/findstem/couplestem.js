"use strict";

const hlkey = require("./hlkey");
const {
	leftmostZ_SS: leftmostZ,
	rightmostZ_SS: rightmostZ,
	leftmostZ_S,
	rightmostZ_S,
	expandZ
} = require("../si-common/seg");
const slopeOf = require("../types/").slopeOf;

class CoupleStem {
	constructor(high, low, r) {
		this.high = high;
		this.low = low;
		this.highExp = high;
		this.lowExp = low;
		this.y = high[0][0].y;
		this.width = Math.abs(high[0][0].y - low[0][0].y);
		this.slope = 0;
		this.belongRadical = r;
	}
	calculateYW(strategy) {
		hlkey.correctYWForStem(this, strategy);
		return this;
	}
	calculateMinmax(radicals, strategy) {
		const p = expandZ(
			radicals[this.belongRadical],
			leftmostZ(this.high),
			-1,
			-(this.slope || 0),
			strategy.UPM
		);
		const q = expandZ(
			radicals[this.belongRadical],
			leftmostZ(this.low),
			-1,
			-(this.slope || 0),
			strategy.UPM
		);
		const coP = expandZ(
			radicals[this.belongRadical],
			rightmostZ(this.high),
			1,
			this.slope || 0,
			strategy.UPM
		);
		const coQ = expandZ(
			radicals[this.belongRadical],
			rightmostZ(this.low),
			1,
			this.slope || 0,
			strategy.UPM
		);

		this.xminX = Math.min(p.x, q.x);
		this.xmaxX = Math.max(coP.x, coQ.x);
		this.xmin = Math.min(leftmostZ(this.high).x, leftmostZ(this.low).x);
		this.xmax = Math.max(rightmostZ(this.high).x, rightmostZ(this.low).x);
		return this;
	}
	_expandSeg(seg, radical, slope) {
		let z0 = leftmostZ_S(seg),
			zm = rightmostZ_S(seg);
		if (radical) {
			z0 = expandZ(radical, z0, -1, -slope, 1000);
			zm = expandZ(radical, zm, 1, slope, 1000);
		}
		return [z0, zm];
	}
	calculateExp(radical) {
		const slopeH = slopeOf(this.high);
		const slopeL = slopeOf(this.low);
		this.highExp = [];
		this.lowExp = [];
		for (let seg of this.high) {
			this.highExp.push(this._expandSeg(seg, radical, slopeH));
		}
		for (let seg of this.low) {
			this.lowExp.push(this._expandSeg(seg, radical, slopeL));
		}
	}
}

module.exports = CoupleStem;
