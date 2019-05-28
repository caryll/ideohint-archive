"use strict";
const { fpgmShiftOf } = require("./vttenv");
const HE = require("./hintingElement");

function findClash($$, ej, ek) {
	const rangeMin = $$.sd.length;
	const rangeMax = $$.pmaxC;
	if (ej.hintedPositions.length < rangeMax) {
		return true;
	}
	if (ek.hintedPositions.length < rangeMax) {
		return true;
	}
	const sj = ej.stem;
	const sk = ek.stem;
	const wj = Math.abs(sj.posKey.y - sj.advKey.y);
	const wk = Math.abs(sk.posKey.y - sk.advKey.y);
	for (let ppem = rangeMin; ppem < rangeMax; ppem++) {
		const uppx = $$.upm / ppem;
		const lowEdgeUpHinted = ek.hintedPositions[ppem] - (sk.posKeyAtTop ? wk : 0);
		const lowEdgeUpUninted = sk.posKey.y - (sk.posKeyAtTop ? wk : 0);
		const highEdgeDownHinted = ej.hintedPositions[ppem] + (!sj.posKeyAtTop ? wj : 0);
		const highEdgeDownUninted = sj.posKey.y + (!sj.posKeyAtTop ? wj : 0);

		if (
			lowEdgeUpHinted - highEdgeDownHinted <
			uppx * Math.min(2, Math.floor((lowEdgeUpUninted - highEdgeDownUninted) / uppx))
		) {
			return true;
		}
	}
	return false;
}

module.exports = function($$, elements) {
	const si = $$.si;
	if (!$$.fpgmPadding || !si.directOverlaps) return 0;
	let tdi = 0;
	const fid = $$.fpgmPadding + fpgmShiftOf.quadstroke_f;
	for (let j = 0; j < elements.length; j++) {
		if (!(elements[j] instanceof HE.Stem)) continue;
		for (let k = elements.length - 1; k > j; k--) {
			if (!(elements[k] instanceof HE.Stem)) continue;
			if (
				!si.directOverlaps[elements[j].sid][elements[k].sid] &&
				!si.directOverlaps[elements[k].sid][elements[j].sid]
			) {
				continue;
			}
			const sj = elements[j].stem;
			const sk = elements[k].stem;

			if (!findClash($$, elements[j], elements[k])) continue;
			if (sk.posKeyAtTop && !sj.posKeyAtTop) {
				$$.talk(
					`Call(${sk.advKey.id},${sj.advKey.id},${sk.posKey.id},${sj.posKey.id},${$$.sd
						.length - 1},${fid})`
				);
				tdi += 7;
			} else if (sk.posKeyAtTop && sj.posKeyAtTop) {
				$$.talk(
					`Call(${sk.advKey.id},${sj.posKey.id},${sk.posKey.id},${sj.posKey.id},${$$.sd
						.length - 1},${fid})`
				);
				tdi += 7;
			} else if (!sk.posKeyAtTop && !sj.posKeyAtTop) {
				$$.talk(
					`Call(${sk.posKey.id},${sj.advKey.id},${sk.posKey.id},${sj.posKey.id},${$$.sd
						.length - 1},${fid})`
				);
				tdi += 7;
			}
		}
	}
	return tdi;
};
