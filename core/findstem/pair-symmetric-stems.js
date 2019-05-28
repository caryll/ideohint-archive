"use strict";
module.exports = function pairSymmetricStems(stems, strategy) {
	// Symmetric stem pairing
	for (let j = 0; j < stems.length; j++) {
		for (let k = j + 1; k < stems.length; k++) {
			if (!stems[j] || !stems[k]) continue;
			let delta = stems[j].belongRadical === stems[k].belongRadical ? 0.002 : 0.005;
			if (
				Math.abs(stems[j].y - stems[j].width / 2 - stems[k].y + stems[k].width / 2) >
				strategy.UPM * delta
			)
				continue;
			if (Math.abs(stems[j].width - stems[k].width) > strategy.UPM * delta) continue;
			if (
				Math.abs(stems[j].xmaxX - stems[j].xminX - (stems[k].xmaxX - stems[k].xminX)) >
				strategy.UPM / 16
			)
				continue;
			stems[j].high = stems[j].high.concat(stems[k].high);
			stems[j].low = stems[j].low.concat(stems[k].low);
			stems[k] = null;
		}
	}
	let res = [];
	for (let j = 0; j < stems.length; j++) {
		if (!stems[j]) continue;
		res.push(stems[j]);
	}
	return res;
};
