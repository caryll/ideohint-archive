"use strict";

const SIZE = 255;

function inGlyph(glyph, z) {
	for (let r of glyph.radicals) if (r.includes(z)) return true;
	return false;
}

class Bitmap {
	constructor(strategy, array) {
		let scale = strategy.UPM / SIZE;
		let ymin = Math.floor(strategy.BLUEZONE_BOTTOM_CENTER / scale);
		let ymax = Math.ceil(strategy.BLUEZONE_TOP_CENTER / scale);
		this.scale = scale;
		this.ymin = ymin;
		this.ymax = ymax;
		this.array = array;
	}
	transform(x, y) {
		return {
			x: Math.round(x / this.scale),
			y: Math.round(y / this.scale) - this.ymin
		};
	}
	access(x, y) {
		if (x < 0 || x > SIZE * this.scale) return false;
		if (y < this.ymin * this.scale || y > this.ymax * this.scale) return false;
		return this.array[Math.round(x / this.scale)][Math.round(y / this.scale) - this.ymin];
	}
}

function createImageBitmap(g, strategy) {
	let scale = strategy.UPM / SIZE;
	let ymin = Math.floor(strategy.BLUEZONE_BOTTOM_CENTER / scale);
	let ymax = Math.ceil(strategy.BLUEZONE_TOP_CENTER / scale);
	let bitmap = new Array(SIZE + 1);
	for (let x = 0; x <= SIZE; x++) {
		bitmap[x] = new Array(ymax - ymin + 1);
		for (let y = ymin; y <= ymax; y++) {
			bitmap[x][y - ymin] = inGlyph(g, {
				x: x * scale,
				y: y * scale
			});
		}
	}
	return new Bitmap(strategy, bitmap);
}

class FlipAnalyzer {
	constructor() {
		this.lifetime = [];
	}
	enter(a) {
		const turns = this.getTurns(a);
		for (let t = 0; t <= turns; t++) {
			this.lifetime[t] = (this.lifetime[t] || 0) + 1;
		}
	}
	getTurns(a) {
		if (!a || !a.length) return 0;
		let v0 = a[0],
			turns = 0;
		for (let v of a)
			if (v !== v0) {
				turns += 1;
				v0 = v;
			}
		return turns;
	}
	computeFlips(limit) {
		let turns = 0;
		while (this.lifetime[turns] >= limit) turns++;
		return turns;
	}
}

function analyzeTurns(g, strategy, stems) {
	const bitmap = createImageBitmap(g, strategy);
	const LIMIT = bitmap.transform(strategy.UPM / 4, 0).x;
	for (let s of stems) {
		let x1 = bitmap.transform(s.xmin, 0).x;
		let x2 = bitmap.transform(s.xmax, 0).x;
		let yBot = bitmap.transform(0, s.y - s.width).y - 1;
		let yTop = bitmap.transform(0, s.y).y + 1;
		if (!bitmap.array[x1] || !bitmap.array[x2]) continue;
		if (yBot > 0) {
			const fa = new FlipAnalyzer();
			for (let x = x1; x <= x2; x++) {
				if (!bitmap.array[x]) continue;
				fa.enter([...bitmap.array[x].slice(0, yBot), 1]);
			}
			s.turnsBelow = fa.computeFlips(LIMIT);
		}
		if (yTop > 0) {
			const fa = new FlipAnalyzer();
			for (let x = x1; x <= x2; x++) {
				if (!bitmap.array[x]) continue;
				fa.enter([1, ...bitmap.array[x].slice(yTop)]);
			}
			s.turnsAbove = fa.computeFlips(LIMIT);
		}
	}

	let turnMatrix = [];
	for (let j = 0; j < stems.length; j++) {
		turnMatrix[j] = [];
		turnMatrix[j][j] = 0;
		const sj = stems[j];
		for (let k = 0; k < j; k++) {
			turnMatrix[j][k] = turnMatrix[k][j] = 0;
			const fa = new FlipAnalyzer();

			const sk = stems[k];
			let xj1 = bitmap.transform(sj.xmin, 0).x;
			let xj2 = bitmap.transform(sj.xmax, 0).x;
			let xk1 = bitmap.transform(sk.xmin, 0).x;
			let xk2 = bitmap.transform(sk.xmax, 0).x;
			let ybot = bitmap.transform(0, sj.y - sj.width).y - 1;
			let ytop = bitmap.transform(0, sk.y).y + 1;
			if (ybot <= ytop) continue;
			if (xk1 > xj2 || xj1 > xk2) continue;
			if (ybot < 0 || ytop < 0) continue;

			for (let x = Math.max(xj1, xk1); x <= Math.min(xj2, xk2); x++) {
				if (!bitmap.array[x]) continue;
				fa.enter([1, ...bitmap.array[x].slice(ytop, ybot), 1]);
			}
			turnMatrix[j][k] = turnMatrix[k][j] = fa.computeFlips(LIMIT);
		}
	}
	return turnMatrix;
}

exports.createImageBitmap = createImageBitmap;
exports.analyzeTurns = analyzeTurns;
