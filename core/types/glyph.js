"use strict";

function Glyph(contours) {
	this.contours = contours || [];
	this.stems = [];
	this.nPoints = 0;
	this.indexedPoints = [];
	this.stats = {
		xmin: 0xffff,
		xmax: -0xffff,
		ymin: 0xffff,
		ymax: -0xffff
	};
}
Glyph.prototype.containsPoint = function(x, y) {
	var nCW = 0,
		nCCW = 0;
	for (var j = 0; j < this.contours.length; j++) {
		if (inPoly({ x: x, y: y }, this.contours[j].points)) {
			if (this.contours[j].ccw) nCCW += 1;
			else nCW += 1;
		}
	}
	return nCCW != nCW;
};
Glyph.prototype.unifyZ = function() {
	for (var j = 0; j < this.contours.length; j++) {
		var pts = this.contours[j].points;
		for (var k = 0; k < pts.length; k++) {
			if (this.indexedPoints[pts[k].id]) {
				pts[k] = this.indexedPoints[pts[k].id];
			}
		}
	}
};
Glyph.prototype.stat = function() {
	for (let c of this.contours) {
		c.stat();
		if (c.xmin < this.stats.xmin) this.stats.xmin = c.xmin;
		if (c.ymin < this.stats.ymin) this.stats.ymin = c.ymin;
		if (c.xmax > this.stats.xmax) this.stats.xmax = c.xmax;
		if (c.ymax > this.stats.ymax) this.stats.ymax = c.ymax;
	}
};

module.exports = Glyph;
