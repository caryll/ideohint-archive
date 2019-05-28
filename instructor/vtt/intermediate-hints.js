"use strict";

const HE = require("./hintingElement");
const { iphintedPositions, distHintedPositions, yAnchoredPositions } = require("./predictor");
const StemInstructionCombiner = require("./stem-instruction-combiner");

const INTERMEDIATE_ROUNDS = {
	max: 3,
	IP_ONLY: 0,
	SHORT_LINK: 1,
	BOTTOM_ONLY: 2,
	TOP_ONLY: 3
};

module.exports = function(boundary, sd, elements, round) {
	let tdis = 0;
	const { fpgmPadding, strategy, pmin, pmaxC, upm } = this;
	const { bottomStem, bottomAnchor, topStem, topAnchor } = boundary;

	this.talk(`\n\n/* !!IDH!! INTERMEDIATES */`);
	const directs = [];
	const ipAnchorZs = [];
	const linkTopZs = [];
	const linkBottomZs = [];
	const ipZs = [];
	for (let r of elements) {
		if (r.told) {
			//pass
		} else if (r.kind === HE.KEY_ITEM_STEM) {
			// pass
		} else {
			ipZs.push(r.ipz);
			r.told = true;
		}
	}

	const combiner = new StemInstructionCombiner(fpgmPadding);
	for (let r of elements) {
		if (r.told) continue;
		// ASSERT: r.kind === KEY_ITEM_STEM
		let attempts = [];

		if (
			round === INTERMEDIATE_ROUNDS.BOTTOM_ONLY ||
			(round === INTERMEDIATE_ROUNDS.SHORT_LINK &&
				topStem.pOrg - r.pOrg > r.pOrg - bottomStem.pOrg)
		) {
			attempts.push({
				to: linkBottomZs,
				addTDI: 6,
				pos0: distHintedPositions(bottomStem, r, upm, pmin, pmaxC)
			});
		}
		if (
			round === INTERMEDIATE_ROUNDS.TOP_ONLY ||
			(round === INTERMEDIATE_ROUNDS.SHORT_LINK &&
				topStem.pOrg - r.pOrg <= r.pOrg - bottomStem.pOrg)
		) {
			attempts.push({
				to: linkTopZs,
				addTDI: 6,
				pos0: distHintedPositions(topStem, r, upm, pmin, pmaxC)
			});
		}

		// IP and Direct
		if (round !== INTERMEDIATE_ROUNDS.TOP_ONLY && round !== INTERMEDIATE_ROUNDS.BOTTOM_ONLY) {
			attempts.push({
				to: ipAnchorZs,
				addTDI: 3,
				pos0: iphintedPositions(bottomStem, r, topStem, pmin, pmaxC)
			});
			attempts.push({
				to: directs,
				addTDI: 2,
				pos0: yAnchoredPositions(r, upm, pmin, pmaxC)
			});
		}

		let bestCost = 0xffff;
		let bestG = null;
		let bestA = null;
		for (let a of attempts) {
			const g = this.encoder.encodeStem(r.stem, r.sid, sd, strategy, a.pos0, pmaxC);
			if (g.totalDeltaImpact + a.addTDI < bestCost) {
				bestG = g;
				bestA = a;
				bestCost = g.totalDeltaImpact + a.addTDI;
			}
		}

		bestA.to.push(r.ipz);
		combiner.add(bestG.parts);
		tdis += bestCost;
		r.hintedPositions = bestG.hintedPositions;
	}
	const ipks = [...ipZs, ...ipAnchorZs];
	if (ipks.length) {
		this.talk(`YInterpolate(${bottomAnchor.ipz},${ipks.join(",")},${topAnchor.ipz})`);
		tdis += 7;
	}
	for (let z of ipAnchorZs) {
		this.talk(`YAnchor(${z})`);
	}
	for (let z of directs) {
		this.talk(`YAnchor(${z})`);
	}

	for (let z of linkTopZs) {
		this.talk(`YShift(${topStem.ipz},${z}) YAnchor(${z})`);
	}
	for (let z of linkBottomZs) {
		this.talk(`YShift(${bottomStem.ipz},${z}) YAnchor(${z})`);
	}

	this.talk(combiner.combine());
	return tdis;
};
