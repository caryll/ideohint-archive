"use strict";

exports.Point = require('./point');
exports.Contour = require('./contour');
exports.Glyph = require('./glyph');
exports.Radical = require('./radical');

function slopeOf(segs) {
	var sy = 0, sx = 0, n = 0;
	for (var j = 0; j < segs.length; j++) for (var k = 0; k < segs[j].length; k++) {
		sy += segs[j][k].y;
		sx += segs[j][k].x;
		n += 1;
	}
	var ax = sx / n, ay = sy / n;
	var b1num = 0, b1den = 0;
	for (var j = 0; j < segs.length; j++) for (var k = 0; k < segs[j].length; k++) {
		b1num += (segs[j][k].x - ax) * (segs[j][k].y - ay);
		b1den += (segs[j][k].x - ax) * (segs[j][k].x - ax);
	}
	return b1num / b1den;
}
exports.slopeOf = slopeOf;
