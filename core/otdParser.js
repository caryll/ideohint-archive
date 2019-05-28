"use strict";

const Contour = require("./types").Contour;
const Point = require("./types").Point;
const Glyph = require("./types").Glyph;

const crypto = require("crypto");
function getSHA1(text) {
	return crypto
		.createHash("sha1")
		.update(text)
		.digest("hex");
}
function hashContours(input) {
	var buf = "";
	for (var j = 0; j < input.length; j++) {
		buf += "a";
		var c = input[j];
		for (var k = 0; k < c.length; k++) {
			if (c[k].on) {
				buf += "l";
			} else {
				buf += "c";
			}
			buf += c[k].x + " " + c[k].y;
		}
	}
	return getSHA1(buf);
}

function rotatePoints(c) {
	let zm = c[0],
		jm = 0;
	for (let j = 1; j < c.length; j++) {
		if (c[j].x + c[j].y < zm.x + zm.y) {
			zm = c[j];
			jm = j;
		}
	}
	return [...c.slice(jm), ...c.slice(0, jm)];
}

function parseOTD(input) {
	let contours = [],
		indexedPoints = [];
	let ptindex = 0;
	for (let j = 0; j < input.length; j++) {
		const c = input[j];
		const currentContour = new Contour();
		for (let k = 0; k < c.length; k++) {
			const pt = new Point(c[k].x, c[k].y, c[k].on, ptindex);
			currentContour.points.push(pt);
			indexedPoints[ptindex] = pt;
			ptindex++;
		}
		if (currentContour.points.length < 1) continue;
		currentContour.points = rotatePoints(currentContour.points);
		currentContour.points.push(
			new Point(
				currentContour.points[0].x,
				currentContour.points[0].y,
				currentContour.points[0].on,
				currentContour.points[0].id
			)
		);
		contours.push(currentContour);
	}
	const glyph = new Glyph(contours);
	glyph.unifyZ();
	glyph.stat();
	glyph.nPoints = ptindex - 1;
	glyph.indexedPoints = indexedPoints;
	return glyph;
}

exports.parseOTD = parseOTD;
exports.hashContours = hashContours;
