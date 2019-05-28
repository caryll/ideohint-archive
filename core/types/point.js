"use strict";

function Point(x, y, on, id) {
	this.id = id;
	this.x = x;
	this.y = y;
	this.on = on;
	this.xtouch = x;
	this.ytouch = y;
	this.touched = false;
	this.donttouch = false;
	this.interpolated = id < 0;
}
Point.PHANTOM = -1;

Point.adjacentZ = function(p, q) {
	return p.nextZ === q || p.prevZ === q || q.nextZ === p || q.prevZ === p;
};

Point.adjacent = function(p, q) {
	return p.next === q || p.prev === q || q.next === p || q.prev === p;
};

module.exports = Point;
