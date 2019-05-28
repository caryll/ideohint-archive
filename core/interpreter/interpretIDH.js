const roundings = require("../../support/roundings");
const { decideDeltaShift, getSWCFG } = require("../../instructor/delta");

function interpolate(a, b, c) {
	if (c.y <= a.y) c.ytouch = c.y - a.y + a.ytouch;
	else if (c.y >= b.y) c.ytouch = c.y - b.y + b.ytouch;
	else c.ytouch = (c.y - a.y) / (b.y - a.y) * (b.ytouch - a.ytouch) + a.ytouch;
}
function yRound(z, upm, ppem) {
	z.touched = true;
	z.ytouch = roundings.rtg(z.y, upm, ppem);
}
function interpolateIP(a, b, c, upm, ppem) {
	if (!a.touched) yRound(a, upm, ppem);
	if (!b.touched) yRound(b, upm, ppem);
	c.touched = true;
	if (a.y === b.y) {
		c.ytouch = c.y - a.y + a.ytouch;
	} else {
		c.ytouch = (c.y - a.y) / (b.y - a.y) * (b.ytouch - a.ytouch) + a.ytouch;
	}
}
function IUPy(contours) {
	for (let j = 0; j < contours.length; j++) {
		let contour = contours[j];
		let k = 0;
		while (k < contour.points.length && !contour.points[k].touched) k++;
		if (contour.points[k]) {
			// Found a touched point in contour
			// Copy coordinates for first/last point
			if (contour.points[0].touched && !contour.points[contour.points.length - 1].touched) {
				contour.points[contour.points.length - 1].touched = true;
				contour.points[contour.points.length - 1].ytouch = contour.points[0].ytouch;
			} else if (
				!contour.points[0].touched &&
				contour.points[contour.points.length - 1].touched
			) {
				contour.points[0].touched = true;
				contour.points[0].ytouch = contour.points[contour.points.length - 1].ytouch;
			}
			let kleft = k,
				k0 = k;
			let untoucheds = [];
			for (let k = 0; k <= contour.points.length; k++) {
				let ki = (k + k0) % contour.points.length;
				if (contour.points[ki].touched) {
					let pleft = contour.points[kleft];
					let pright = contour.points[ki];
					let lower = pleft.y < pright.y ? pleft : pright;
					let higher = pleft.y < pright.y ? pright : pleft;
					for (let w = 0; w < untoucheds.length; w++)
						interpolate(lower, higher, untoucheds[w]);
					untoucheds = [];
					kleft = ki;
				} else {
					untoucheds.push(contour.points[ki]);
				}
			}
		}
	}
}
function untouchAll(contours) {
	for (let j = 0; j < contours.length; j++)
		for (let k = 0; k < contours[j].points.length; k++) {
			contours[j].points[k].touched = false;
			contours[j].points[k].donttouch = false;
			contours[j].points[k].ytouch = contours[j].points[k].y;
		}
}

function calculateYW(upm, ppem, stem, action, swcfgCtx) {
	const uppx = upm / ppem;
	let h, l;
	if (stem.posKeyAtTop) {
		h = stem.posKey;
		l = stem.advKey;
	} else {
		h = stem.advKey;
		l = stem.posKey;
	}
	const keyDX = h.x - l.x;
	let [y, w, strict, stacked] = action;
	const h_ytouch = y * uppx;
	const l_ytouch = (y - w) * uppx - keyDX * stem.slope;

	const swcfg = getSWCFG(swcfgCtx, 1, ppem);

	if (stem.posKeyAtTop) {
		const delta = decideDeltaShift(
			8,
			-1,
			strict,
			stacked,
			0,
			h.y - l.y,
			0,
			w * uppx,
			upm,
			ppem,
			swcfg
		);
		return { h, l, h_ytouch, l_ytouch: h_ytouch - (h.y - l.y) + delta / 8 * uppx };
	} else {
		const delta = decideDeltaShift(
			8,
			1,
			strict,
			stacked,
			0,
			h.y - l.y,
			0,
			w * uppx,
			upm,
			ppem,
			swcfg
		);
		return { h, l, l_ytouch, h_ytouch: l_ytouch + (h.y - l.y) + delta / 8 * uppx };
	}
}

function interpretIDH(glyph, si, actions, strategy, ppem) {
	const rtg = roundings.Rtg(strategy.UPM, ppem);

	untouchAll(glyph.contours);

	// Bottom blues
	si.blue.bottomZs.forEach(function(z) {
		glyph.indexedPoints[z.id].touched = true;
		glyph.indexedPoints[z.id].ytouch = rtg(strategy.BLUEZONE_BOTTOM_CENTER);
	});
	// Top blues
	si.blue.topZs.forEach(function(z) {
		glyph.indexedPoints[z.id].touched = true;
		//glyph.indexedPoints[z.id].ytouch = rtg(strategy.BLUEZONE_TOP_CENTER);
		glyph.indexedPoints[z.id].ytouch = Math.round(
			rtg(strategy.BLUEZONE_BOTTOM_CENTER) +
				rtg(strategy.BLUEZONE_TOP_CENTER - strategy.BLUEZONE_BOTTOM_CENTER)
		);
	});
	for (let j = 0; j < si.stems.length; j++) {
		const stem = si.stems[j];
		const action = actions.y[j];
		const { h, l, h_ytouch, l_ytouch } = calculateYW(strategy.UPM, ppem, si.stems[j], action, {
			minSW: strategy.MINIMAL_STROKE_WIDTH_PIXELS || 1 / 8,
			maxSWOverflowCpxs: strategy.MAX_SW_OVERFLOW_CPXS,
			maxSWShrinkCpxs: strategy.MAX_SW_SHRINK_CPXS
		});
		glyph.indexedPoints[h.id].touched = glyph.indexedPoints[l.id].touched = true;
		glyph.indexedPoints[h.id].ytouch = h_ytouch;
		glyph.indexedPoints[l.id].ytouch = l_ytouch;
		for (let pt of stem.posAlign) {
			pt = glyph.indexedPoints[pt.id];
			pt.touched = true;
			const key = glyph.indexedPoints[stem.posKey.id];
			pt.ytouch = key.ytouch + pt.y - key.y;
		}
		for (let pt of stem.advAlign) {
			pt = glyph.indexedPoints[pt.id];
			pt.touched = true;
			const key = glyph.indexedPoints[stem.advKey.id];
			pt.ytouch = key.ytouch + pt.y - key.y;
		}
	}

	// diagaligns
	for (let da of si.diagAligns) {
		for (let z of da.zs) {
			interpolateIP(
				glyph.indexedPoints[da.l],
				glyph.indexedPoints[da.r],
				glyph.indexedPoints[z],
				strategy.UPM,
				ppem
			);
		}
	}
	// ipsacalls
	for (let c of si.ipsacalls) {
		if (c.length === 2) {
			interpolateIP(
				glyph.indexedPoints[c[0]],
				glyph.indexedPoints[c[0]],
				glyph.indexedPoints[c[1]],
				strategy.UPM,
				ppem
			);
		} else {
			interpolateIP(
				glyph.indexedPoints[c[0]],
				glyph.indexedPoints[c[1]],
				glyph.indexedPoints[c[2]],
				strategy.UPM,
				ppem
			);
		}
	}

	// IUPy
	IUPy(glyph.contours);
	return glyph.contours;
}

exports.interpretIDH = interpretIDH;
exports.IUPy = IUPy;
