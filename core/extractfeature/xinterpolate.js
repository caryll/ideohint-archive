"use strict"

// X interolation

module.exports = function (glyph) {
	let extrema = [];
	for (let c of glyph.contours) {
		let min = null, max = null;
		for (let z of c.points) {
			if (z && z.id >= 0 && (!min || z.x < min.x)) {
				min = z
			}
			if (z && z.id >= 0 && (!max || z.x > max.x)) {
				max = z
			}
		}
		extrema.push(min, max);
	}
	extrema = extrema.sort((a, b) => a.x - b.x)
	return extrema.map(z => ({ id: z.id, x: z.x }));
}
