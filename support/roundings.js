"use strict";

function toF26D6(x) {
	return Math.round(x * 64);
}
function toF26D6P(x, upm, ppem) {
	return toF26D6(x / upm * ppem) / 64;
}
// from freetype
function rtg(x, upm, ppem) {
	var distance = toF26D6(x / upm * ppem);
	var val;
	if (distance > 0) {
		val = distance + 32;
		if (val > 0 && distance) {
			val &= ~63;
		} else {
			val = 0;
		}
	} else {
		val = -((32 - distance) & ~63);
		if (val > 0) val = 0;
	}
	return val * (upm / ppem) / 64;
}
function rtgDiff(x1, x2, upm, ppem) {
	const x1_ = toF26D6(x1 / upm * ppem);
	const x2_ = toF26D6(x2 / upm * ppem);
	var distance = x1_ - x2_;
	var val;
	if (distance > 0) {
		val = distance + 32;
		if (val > 0 && distance) {
			val &= ~63;
		} else {
			val = 0;
		}
	} else {
		val = -((32 - distance) & ~63);
		if (val > 0) val = 0;
	}
	return val * (upm / ppem) / 64;
}
function rtg1(x, upm, ppem) {
	if (x >= 0) return Math.max(upm / ppem, rtg(x, upm, ppem));
	else return -Math.max(upm / ppem, rtg(-x, upm, ppem));
}
function rtg_raw(y, upm, ppem) {
	return Math.round(y / upm * ppem) / ppem * upm;
}

function Rtg(upm, ppem) {
	return function(x) {
		return rtg(x, upm, ppem);
	};
}
function rutg(x, upm, ppem) {
	var distance = toF26D6(x / upm * ppem);
	var val;
	if (distance > 0) {
		val = distance + 63;
		if (val > 0 && distance) {
			val &= ~63;
		} else {
			val = 0;
		}
	} else {
		val = -((63 - distance) & ~63);
		if (val > 0) val = 0;
	}
	return val * (upm / ppem) / 64;
}
function Rutg(upm, ppem) {
	return function(x) {
		return rutg(x, upm, ppem);
	};
}
function rdtg(x, upm, ppem) {
	var distance = toF26D6(x / upm * ppem);
	var val;
	if (distance > 0) {
		val = distance;
		if (val > 0 && distance) {
			val &= ~63;
		} else {
			val = 0;
		}
	} else {
		val = -((0 - distance) & ~63);
		if (val > 0) val = 0;
	}
	return val * (upm / ppem) / 64;
}
function Rdtg(upm, ppem) {
	return function(x) {
		return rdtg(x, upm, ppem);
	};
}

exports.toF26D6P = toF26D6P;
exports.rtg = rtg;
exports.rtg1 = rtg1;
exports.rutg = rutg;
exports.rdtg = rdtg;
exports.rtg_raw = rtg_raw;
exports.Rtg = Rtg;
exports.Rutg = Rutg;
exports.Rdtg = Rdtg;
exports.rtgDiff = rtgDiff;
