"use strict";

// Util functions to deal with segs

const { adjacent: adjacent } = require("../types/point");

exports.minmaxOfSeg = function(u) {
	var min = 0xffff,
		max = -0xffff;
	for (var s = 0; s < u.length; s++)
		for (var k = 0; k < u[s].length; k++) {
			if (u[s][k].x < min) min = u[s][k].x;
			if (u[s][k].x > max) max = u[s][k].x;
		}
	return { min: min, max: max };
};

exports.segmentsPromixity = function(s1, s2) {
	var count = 0;
	for (var j = 0; j < s1.length; j++)
		for (var k = 0; k < s2.length; k++) {
			if (adjacent(s1[j][0], s2[k][0])) count += 1;
			if (adjacent(s1[j][0], s2[k][1])) count += 1;
			if (adjacent(s1[j][1], s2[k][0])) count += 1;
			if (adjacent(s1[j][1], s2[k][1])) count += 1;
		}
	return 2 * count / (s1.length + s2.length);
};

exports.leftmostZ_S = function(seg) {
	let m = seg[0];
	for (let z of seg) if (!m || (z && z.x < m.x)) m = z;
	return m;
};
exports.rightmostZ_S = function(seg) {
	let m = seg[0];
	for (let z of seg) if (!m || (z && z.x > m.x)) m = z;
	return m;
};

exports.leftmostZ_SS = function(segs) {
	let m = segs[0][0];
	for (let seg of segs) for (let z of seg) if (!m || (z && z.x < m.x)) m = z;
	return m;
};
exports.rightmostZ_SS = function(segs) {
	let m = segs[0][0];
	for (let seg of segs) for (let z of seg) if (!m || (z && z.x > m.x)) m = z;
	return m;
};

exports.expandZ = function expandZ(radical, z, dx, dy, maxticks) {
	let z1 = { x: z.x + dx, y: z.y + dy },
		steps = 0;
	while (radical.includesEdge(z1, 0, 2) && steps < maxticks) {
		z1.x += dx;
		z1.y += dy;
		steps++;
	}
	z1.x -= dx;
	z1.y -= dy;
	return z1;
};
exports.expandZ0 = function(radical, z, dx, dy, maxticks) {
	let z1 = { x: z.x + dx, y: z.y + dy },
		steps = 0;
	while (radical.includes(z1) && steps < maxticks) {
		z1.x += dx;
		z1.y += dy;
		steps++;
	}
	z1.x -= dx;
	z1.y -= dy;
	return z1;
};
