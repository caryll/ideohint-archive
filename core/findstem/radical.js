"use strict";

const Radical = require("../types/").Radical;

function transitiveReduce(g) {
	// Floyd-warshall transitive reduction
	for (var x = 0; x < g.length; x++)
		for (var y = 0; y < g.length; y++)
			for (var z = 0; z < g.length; z++) {
				if (g[x][y] && g[y][z]) g[x][z] = false;
			}
}

function inclusionToRadicals(inclusions, contours, j, orient) {
	var radicals;
	if (orient) {
		// contours[j] is an inner contour
		// find out radicals inside it
		radicals = [];
		for (var k = 0; k < contours.length; k++)
			if (inclusions[j][k]) {
				if (contours[k].ccw !== orient) {
					radicals = radicals.concat(
						inclusionToRadicals(inclusions, contours, k, !orient)
					);
				}
			}
		return radicals;
	} else {
		// contours[j] is an outer contour
		// find out its inner contours and radicals inside it
		var radical = new Radical(contours[j]);
		radicals = [radical];
		for (var k = 0; k < contours.length; k++)
			if (inclusions[j][k]) {
				if (contours[k].ccw !== orient) {
					radical.holes.push(contours[k]);
					var inner = inclusionToRadicals(inclusions, contours, k, !orient);
					radical.subs = inner;
					radicals = radicals.concat(inner);
				}
			}
		return radicals;
	}
}

module.exports = function findRadicals(contours) {
	var inclusions = [];
	var radicals = [];
	for (var j = 0; j < contours.length; j++) {
		inclusions[j] = [];
		contours[j].outline = true;
	}
	// Find out all inclusion relationships
	for (var j = 0; j < contours.length; j++) {
		for (var k = 0; k < contours.length; k++) {
			if (j !== k && contours[j].includes(contours[k])) {
				inclusions[j][k] = true;
				contours[k].outline = false;
			}
		}
	}
	// Transitive reduction
	transitiveReduce(inclusions);
	// Figure out radicals
	for (var j = 0; j < contours.length; j++)
		if (contours[j].outline) {
			radicals = radicals.concat(
				inclusionToRadicals(inclusions, contours, j, contours[j].ccw)
			);
		}
	return radicals;
};
