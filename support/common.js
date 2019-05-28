"use strict";

const monoip = require("./monotonic-interpolate");

exports.mix = function(x, y, a) {
	return x + (y - x) * a;
};
exports.mixz = function(p, q, x) {
	return { x: p.x + (q.x - p.x) * x, y: p.y + (q.y - p.y) * x };
};
exports.lerp = function(x, x1, x2, y1, y2) {
	return (x - x1) / (x2 - x1) * (y2 - y1) + y1;
};
exports.xlerp = function(x, x1, x2, x3, y1, y2, y3) {
	if (x <= x2) {
		return (x - x1) / (x2 - x1) * (y2 - y1) + y1;
	} else {
		return (x - x2) / (x3 - x2) * (y3 - y2) + y2;
	}
};
exports.xclamp = function(low, x, high) {
	return x < low ? low : x > high ? high : x;
};

exports.toVQ = function toVQ(v, ppem) {
	if (v && v instanceof Array) {
		return monoip(v)(ppem);
	} else {
		return v;
	}
};
