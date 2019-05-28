"use strict";

const { adjacent, adjacentZ } = require("../types/point");

function nearTop(z1, z2, d) {
	return Math.hypot(z1.x - z2.x, z1.y - z2.y) < d;
}
function nearBot(z1, z2, d) {
	return Math.abs(z1.y - z2.y) <= d;
}

module.exports = function (glyph, strategy) {
	// Blue zone points
	var topBluePoints = [];
	var bottomBluePoints = [];
	for (var j = 0; j < glyph.contours.length; j++) {
		for (var k = 0; k < glyph.contours[j].points.length - 1; k++) {
			var point = glyph.contours[j].points[k];
			var isDecoTop = false;
			var isDecoBot = false;
			for (var m = 0; m < glyph.contours[j].points.length - 1; m++) {
				var zm = glyph.contours[j].points[m];
				if (
					(zm.touched || zm.donttouch) &&
					(adjacent(point, zm) || adjacentZ(point, zm)) &&
					zm.y <= point.y &&
					nearTop(point, zm, strategy.STEM_SIDE_MIN_RISE)
				) {
					isDecoTop = true;
					point.donttouch = true;
				}
				if (
					(zm.touched || zm.donttouch) &&
					(adjacent(point, zm) || adjacentZ(point, zm)) &&
					zm.y >= point.y &&
					nearBot(point, zm, strategy.STEM_SIDE_MIN_RISE / 3)
				) {
					isDecoBot = true;
					point.donttouch = true;
				}
			}
			if (
				!isDecoTop &&
				point.ytouch >= strategy.BLUEZONE_TOP_LIMIT &&
				point.yExtrema &&
				!point.touched &&
				!point.donttouch
			) {
				point.touched = true;
				point.keypoint = true;
				point.blued = true;
				topBluePoints.push(point);
			}
			if (
				!isDecoBot &&
				point.ytouch <= strategy.BLUEZONE_BOTTOM_LIMIT &&
				point.yExtrema &&
				!point.touched &&
				!point.donttouch
			) {
				point.touched = true;
				point.keypoint = true;
				point.blued = true;
				bottomBluePoints.push(point);
			}
		}
	}
	return {
		topZs: topBluePoints.sort((a, b) => b.y - a.y),
		bottomZs: bottomBluePoints.sort((a, b) => b.y - a.y)
	};
};
