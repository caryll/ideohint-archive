"use strict";

function Contour() {
	this.points = [];
	this.ccw = false;
}
function checkExtrema(prev, z, next) {
	if ((z.y > prev.y && z.y >= next.y) || (z.y < prev.y && z.y <= next.y)) {
		z.yExtrema = true;
		z.yStrongExtrema =
			(z.y > prev.y + 1 && z.y > next.y + 1) || (z.y < prev.y - 1 && z.y < next.y - 1);
	}
	if ((z.x > prev.x && z.x >= next.x) || (z.x < prev.x && z.x <= next.x)) {
		z.xExtrema = true;
		z.xStrongExtrema =
			(z.x > prev.x + 1 && z.x > next.x + 1) ||
			(z.x < prev.x - 1 && z.x < next.x - 1) ||
			(z.on && !prev.on && !next.on && z.x === prev.x && z.x === next.x);
		if (z.xStrongExtrema) {
			z.atleft = z.x < prev.x - 1 && z.x < next.x - 1;
		}
	}
	const cross = (z.x - prev.x) * (next.y - z.y) - (z.y - prev.y) * (next.x - z.x);
	z.turn = cross > 0;
}

Contour.prototype.stat = function() {
	var points = this.points;
	checkExtrema(points[points.length - 2], points[0], points[1]);
	checkExtrema(points[points.length - 2], points[points.length - 1], points[1]);
	for (var j = 1; j < points.length - 1; j++) {
		checkExtrema(points[j - 1], points[j], points[j + 1]);
	}
	var xoris = this.points.map(function(p) {
		return p.x;
	});
	var yoris = this.points.map(function(p) {
		return p.y;
	});
	this.xmax = Math.max.apply(Math, xoris);
	this.ymax = Math.max.apply(Math, yoris);
	this.xmin = Math.min.apply(Math, xoris);
	this.ymin = Math.min.apply(Math, yoris);
	this.orient();
};
function setHidden(obj, prop, v) {
	Object.defineProperty(obj, prop, { value: v, enumerable: false, configurable: true });
}
Contour.prototype.orient = function() {
	// Findout PYmin
	var jm = 0,
		ym = this.points[0].y;
	for (var j = 0; j < this.points.length - 1; j++)
		if (this.points[j].y < ym) {
			jm = j;
			ym = this.points[j].y;
		}
	var p0 = this.points[jm ? jm - 1 : this.points.length - 2],
		p1 = this.points[jm],
		p2 = this.points[jm + 1];
	var x = (p0.x - p1.x) * (p2.y - p1.y) - (p0.y - p1.y) * (p2.x - p1.x);
	if (x < 0) {
		this.ccw = true;
	} else if (x === 0) {
		this.ccw = p2.x > p1.x;
	}
	// Adjacency
	{
		let pt = this.points[0];
		for (let j = 0; j < this.points.length - 1; j++)
			if (this.points[j].on) {
				setHidden(this.points[j], "prev", pt);
				setHidden(pt, "next", this.points[j]);
				pt = this.points[j];
			}
		setHidden(this.points[0], "prev", pt);
		setHidden(pt, "next", this.points[0]);
	}
	// Direct adjancy
	{
		let pt = this.points[0];
		for (let j = 0; j < this.points.length - 1; j++) {
			setHidden(this.points[j], "prevZ", pt);
			setHidden(pt, "nextZ", this.points[j]);
			pt = this.points[j];
		}
		setHidden(this.points[0], "prevZ", pt);
		setHidden(pt, "nextZ", this.points[0]);
	}
};
var inPoly = function(point, vs) {
	// ray-casting algorithm based on
	// http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

	var x = point.x,
		y = point.y;

	var inside = 0;
	for (var i = 0, j = vs.length - 2; i < vs.length - 1; j = i++) {
		var xi = vs[i].x,
			yi = vs[i].y;
		var xj = vs[j].x,
			yj = vs[j].y;
		if (xi == x && yi == y) return true;
		var intersect =
			yi > y !== yj > y &&
			(yj > yi
				? (x - xi) * (yj - yi) < (xj - xi) * (y - yi)
				: (x - xi) * (yj - yi) > (xj - xi) * (y - yi));
		if (intersect) {
			if (yi > yj) inside += 1;
			else inside -= 1;
		}
	}

	return !!inside;
};
Contour.prototype.includesPoint = function(z) {
	return inPoly(z, this.points);
};
Contour.prototype.includes = function(that) {
	for (var j = 0; j < that.points.length - 1; j++) {
		if (!inPoly(that.points[j], this.points)) return false;
	}
	return true;
};

module.exports = Contour;
