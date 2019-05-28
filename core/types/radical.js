"use strict";

const mixz = require("../../support/common").mixz;

function Radical(outline) {
	this.outline = outline;
	this.holes = [];
	this.subs = [];
	this.segments = [];
}
Radical.prototype.includes = function(z) {
	if (!this.outline.includesPoint(z)) return false;
	for (var j = 0; j < this.holes.length; j++) {
		if (this.holes[j].includesPoint(z)) return false;
	}
	return true;
};
Radical.prototype.includesEdge = function(z, mu, mv) {
	for (let u = -mu; u <= mu; u++)
		for (let v = -mv; v <= mv; v++)
			if (this.includes({ x: z.x + u, y: z.y + v })) {
				return true;
			}
	return false;
};
Radical.prototype.includesSegment = function(z1, z2) {
	var SEGMENTS = 64;
	for (var s = 1; s < SEGMENTS; s++) {
		var testz = {
			x: z2.x + (z1.x - z2.x) * (s / SEGMENTS),
			y: z2.y + (z1.y - z2.y) * (s / SEGMENTS)
		};
		if (!this.includes(testz)) {
			return false;
		}
	}
	return true;
};
Radical.prototype.includesSegmentEdge = function(z1, z2, umx, deltax, umy, deltay) {
	if (this.includesSegment(z1, z2)) {
		return true;
	}
	for (var u1 = -umx; u1 <= umx; u1++)
		for (var u2 = -umy; u2 <= umy; u2++)
			for (var u3 = -umx; u3 <= umx; u3++)
				for (var u4 = -umy; u4 <= umy; u4++) {
					var z1a = { x: z1.x + u1 * deltax, y: z1.y + u2 * deltay };
					var z2a = { x: z2.x + u3 * deltax, y: z2.y + u4 * deltay };
					if (this.includesSegment(z1a, z2a)) {
						return true;
					}
				}
	//console.log("IXS", z1, z2, umx, deltax, umy, deltay);
	return false;
};
Radical.prototype.includesTetragon = function(s1, s2, _dS) {
	let xmin1 = s1[0].x,
		xmax1 = s1[0].x,
		xmin2 = s2[0].x,
		xmax2 = s2[0].x;
	for (let u = 0; u < s1.length; u++) {
		if (s1[u].x < xmin1) xmin1 = s1[u].x;
		if (s1[u].x > xmax1) xmax1 = s1[u].x;
	}
	for (let u = 0; u < s2.length; u++) {
		if (s2[u].x < xmin2) xmin2 = s2[u].x;
		if (s2[u].x > xmax2) xmax2 = s2[u].x;
	}
	const dS = Math.min(_dS, (xmax1 - xmin1) / 3, (xmax2 - xmin2) / 3);
	//console.log(s1.map(z => z.id), s2.map(z => z.id), xmin1, xmax1, xmin2, xmax2, dS);
	for (let u = 0; u < s1.length - 1; u++) {
		for (let v = 0; v < s2.length - 1; v++) {
			let p = s1[u],
				q = s1[u + 1];
			let r = s2[v],
				s = s2[v + 1];
			if (p.x > q.x) {
				let t = p;
				p = q;
				q = t;
			}
			if (r.x > s.x) {
				let t = r;
				r = s;
				s = t;
			}
			const N = 8;
			for (let sg = 0; sg <= N; sg++) {
				let ztop = mixz(p, q, sg / N);
				let zbot = mixz(r, s, sg / N);
				if (!p.turn && ztop.x < xmin1 + dS) continue;
				if (!q.turn && ztop.x > xmax1 - dS) continue;
				if (!r.turn && zbot.x < xmin2 + dS) continue;
				if (!s.turn && zbot.x > xmax2 - dS) continue;
				if (!this.includesSegmentEdge(ztop, zbot, 1, 1, 1, 1)) {
					//console.log(p, q, r, s, ztop, zbot);
					return false;
				}
			}
		}
	}
	return true;
};
module.exports = Radical;
