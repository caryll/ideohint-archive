"use strict";

const outlier = require("outlier");
const Hinter = require("./hinter");
const stemPositionToActions = require("./actions");

class HintDecision {
	constructor(x, y, symmetry) {
		this.y = y;
		this.x = { expansion: x };
		this.symmetry = symmetry;
	}
}

function choose(hinter, first, ...sps) {
	let optimal = first;
	let idvOptimal = hinter.createIndividual(optimal, false);
	for (let sp of sps) {
		let idv = hinter.createIndividual(sp, false);
		if (idv.compare(idvOptimal) > 0) {
			optimal = sp;
			idvOptimal = idv;
		}
	}
	return idvOptimal;
}

function hint(gd, ppem, strg, options) {
	const hinter = new Hinter(strg, gd, ppem, options);
	if (!hinter.avails.length) return new HintDecision(hinter.xExpansion, [], false);
	const spInit = hinter.balance(hinter.decideInitHint(options.y0));
	const spNT = hinter.balance(hinter.decideInitHintNT(options.y0));
	// Y pass
	let initWidths = hinter.avails.map(a => a.properWidth);
	const spUncol = hinter.uncollide(spInit);
	// width pass
	const pass1Idv = choose(hinter, spNT, spUncol);
	let { y, w } = hinter.allocateWidth([...pass1Idv.gene]);

	for (let contHintRound = 0; contHintRound < 2; contHintRound++) {
		// Do we still have collisions?
		let hasCollide = false;
		let detectedCollisons = [];
		let w1 = [];
		for (let j = 0; j < y.length; j++) {
			detectedCollisons[j] = false;
			const sa = hinter.spaceAbove(y, w, j, hinter.glyphTopPixels + 1);
			const sb = hinter.spaceBelow(y, w, j, hinter.glyphBottomPixels - 1);
			if (sa < 1 || sb < 1) {
				hasCollide = true;
				detectedCollisons[j] = true;
			}
		}

		// filter out outliers
		let doThisRound = false;
		const otl = outlier(w);
		const avgw = Math.round(w.reduce((a, b) => a + b, 0) / w.length);
		for (let j = 0; j < y.length; j++) {
			const isOutlier = otl.testOutlier(w[j]);
			let maxw = w[j];
			// the stroke is wider then one pixel but there's some collision around it
			// we'd like to shrink this stroke by one pixel to leave out spaces
			if (
				w[j] === 2 &&
				hinter.avails[j].w0px < w[j] &&
				((hasCollide && isOutlier) || detectedCollisons[j])
			) {
				maxw -= 1;
				doThisRound = true;
			}
			w1[j] = Math.min(
				maxw,
				options.maxStrokeWidths[j],
				outlier && !contHintRound ? Math.max(w[j], avgw) : w[j]
				// only allow unifying stroke widths in first continued hinting round
			);
		}

		// The width allocator may alter the initial width
		// do the second pass if necessary
		for (let j = 0; j < w1.length; j++) {
			if (y[j] !== pass1Idv.gene[j]) doThisRound = true;
			if (w1[j] !== initWidths[j]) doThisRound = true;
		}
		if (doThisRound) {
			hinter.updateAvails([...w1], options);
			const spUncol1 = hinter.uncollide(hinter.balance(hinter.decideInitHint()));
			const pass2Idv = choose(
				hinter,
				hinter.balance([...y]),
				hinter.balance([...spNT]),
				spUncol1
			);
			const a = hinter.allocateWidth(pass2Idv.gene);
			y = a.y;
			w = a.w;
		} else {
			break;
		}
	}
	// results
	return new HintDecision(
		hinter.xExpansion,
		stemPositionToActions.call(hinter, y, w, gd.stems),
		hinter.symmetry
	);
}
module.exports = hint;
