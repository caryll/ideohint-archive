"use strict";

module.exports = function(blueZonePoints, stems) {
	for (let s of stems) {
		let hasl = false;
		let hasr = false;
		for (let z of blueZonePoints.bottomZs) {
			if (z.x < s.posKey.x && z.y < s.posKey.y && z.x < s.advKey.x && z.y < s.advKey.y)
				hasl = true;
			if (z.x > s.posKey.x && z.y < s.posKey.y && z.x > s.advKey.x && z.y < s.advKey.y)
				hasr = true;
		}
		if (hasl && hasr) {
			s.hasLRSpur = true;
		} else {
			s.hasLRSpur = false;
		}
	}
};
