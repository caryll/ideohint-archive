const BG_COLOR = "white";
const { interpretIDH } = require("../core/interpreter/interpretIDH");

function interpretTT(glyphs, strategy, ppem) {
	for (var j = 0; j < glyphs.length; j++) {
		var glyph = glyphs[j].glyph,
			si = glyphs[j].si;
		var actions = glyphs[j].hints[ppem];

		interpretIDH(glyph, si, actions, strategy, ppem);
	}
}

const SUPERSAMPLING = 8;
const SAMPLING_Y = 4;
const DPI = 2;
const GAMMA = 1.5;

function renderTTFCurve(h, zs, m, txp, typ) {
	if (zs.length < 3) return;
	if (!zs[0].on) {
		// the contour starts at an off point
		if (zs[1].on) {
			zs = [...zs.slice(1), zs[0]];
		} else {
			zs = [
				{
					xtouch: (zs[0].xtouch + zs[1].xtouch) / 2,
					ytouch: (zs[0].ytouch + zs[1].ytouch) / 2,
					on: true
				},
				...zs.slice(1),
				zs[0]
			];
		}
	}
	zs.push(zs[0]);
	h.moveTo(txp(zs[0].xtouch, m), typ(zs[0].ytouch));
	for (var k = 1; k < zs.length; k++) {
		if (zs[k].on || !zs[k + 1]) {
			h.lineTo(txp(zs[k].xtouch, m), typ(zs[k].ytouch));
		} else {
			if (zs[k + 1].on) {
				h.quadraticCurveTo(
					txp(zs[k].xtouch, m),
					typ(zs[k].ytouch),
					txp(zs[k + 1].xtouch, m),
					typ(zs[k + 1].ytouch)
				);
				k += 1;
			} else {
				h.quadraticCurveTo(
					txp(zs[k].xtouch, m),
					typ(zs[k].ytouch),
					txp((zs[k].xtouch + zs[k + 1].xtouch) / 2, m),
					typ((zs[k].ytouch + zs[k + 1].ytouch) / 2)
				);
			}
		}
	}
}

function RenderPreviewForPPEM(glyphs, strategy, hdc, basex, basey, ppem) {
	const uppx = strategy.UPM / ppem;

	interpretTT(glyphs, strategy, ppem);

	// Create a temp canvas
	const hpixels = ppem * glyphs.length;
	const vpixels = ppem + 1;
	var eTemp = document.createElement("canvas");
	eTemp.width = hpixels * 3 * SUPERSAMPLING;
	eTemp.height = vpixels * SAMPLING_Y;
	var hTemp = eTemp.getContext("2d");
	hTemp.fillStyle = "white";
	hTemp.fillRect(0, 0, eTemp.width, eTemp.height);

	function txp(x, m) {
		let v = (x + m * strategy.UPM) / uppx * 3 * SUPERSAMPLING;
		if (!isFinite(v)) v = 0;
		return v;
	}
	function typ(y) {
		let v = (-y / uppx + Math.round(strategy.BLUEZONE_TOP_CENTER / uppx) + 1) * SAMPLING_Y;
		if (!isFinite(v)) v = 0;
		return v;
	}
	// Fill
	hTemp.fillStyle = "black";
	for (var m = 0; m < glyphs.length; m++) {
		hTemp.beginPath();
		for (var j = 0; j < glyphs[m].glyph.contours.length; j++) {
			renderTTFCurve(hTemp, glyphs[m].glyph.contours[j].points.slice(0), m, txp, typ);
			hTemp.closePath();
		}
		hTemp.fill("nonzero");
	}

	// Downsampling
	const ori = hTemp.getImageData(0, 0, eTemp.width, eTemp.height);
	const eAA = document.createElement("canvas");
	eAA.width = hpixels;
	eAA.height = vpixels;
	const hAA = eAA.getContext("2d");

	for (var j = 0; j < vpixels; j++) {
		let aa = hAA.createImageData(hpixels, 1);
		for (var k = 0; k < hpixels; k++) {
			aa.data[k * 4] = 0xff;
			aa.data[k * 4 + 1] = 0;
			aa.data[k * 4 + 2] = 0;
			aa.data[k * 4 + 3] = 0xff;
			for (var component = 0; component < 3; component++) {
				let coverage = 0;
				for (let ssy = 0; ssy < SAMPLING_Y; ssy++)
					for (let ss = -SUPERSAMPLING; ss < SUPERSAMPLING * 2; ss++) {
						const origRow = j * SAMPLING_Y + ssy;
						let origCol = (k * 3 + component) * SUPERSAMPLING + ss;
						if (origCol < 0) origCol = 0;
						if (origCol >= eTemp.width) origCol = eTemp.width - 1;
						const origPixelId = eTemp.width * origRow + origCol;
						const raw = ori.data[origPixelId * 4];
						coverage += raw < 128 ? 1 : 0;
					}
				const alpha = coverage / (3 * SUPERSAMPLING * SAMPLING_Y);
				aa.data[k * 4 + component] = 255 * Math.pow(1 - alpha, 1 / GAMMA);
			}
		}
		hAA.putImageData(aa, 0, j);
	}
	hdc.imageSmoothingEnabled = false;
	hdc.drawImage(eAA, basex, basey, eAA.width * DPI, eAA.height * DPI);
}

let renderHandle = { handle: null };

function renderPreview(canvas, glyphs, strategy) {
	if (!canvas) return;
	const hPreview = canvas.getContext("2d");
	hPreview.font = 12 * DPI + "px sans-serif";
	let y = 10 * DPI;
	let ppem = strategy.PPEM_MIN;
	function renderView() {
		// fill with white
		hPreview.fillStyle = BG_COLOR;
		hPreview.fillRect(0, y, 128 + glyphs.length * DPI * ppem, y + DPI * ppem);
		// render
		RenderPreviewForPPEM(glyphs, strategy, hPreview, 128, y, ppem);
		hPreview.fillStyle = "black";
		hPreview.fillText(
			ppem + "",
			0,
			y + ppem * (strategy.BLUEZONE_TOP_CENTER / strategy.UPM) * DPI
		);
		y += Math.round(ppem * 1.2) * DPI;
		ppem += 1;
		if (ppem <= strategy.PPEM_MAX) {
			if (renderHandle.handle) {
				clearTimeout(renderHandle.handle);
			}
			setTimeout(renderView, 0);
		} else {
			renderHandle.handle = null;
		}
	}
	if (renderHandle.handle) {
		clearTimeout(renderHandle.handle);
	}
	setTimeout(renderView, 0);
}

function clean(canvas) {
	if (!canvas) return;
	const hPreview = canvas.getContext("2d");
	hPreview.fillStyle = BG_COLOR;
	hPreview.fillRect(0, 0, canvas.width, canvas.height);
}

function renderLoading(canvas) {
	if (!canvas) return;
	const hPreview = canvas.getContext("2d");
	hPreview.fillStyle = BG_COLOR;
	hPreview.fillRect(0, 0, canvas.width, canvas.height);
	hPreview.font = "24px sans-serif";
	hPreview.fillStyle = "black";
	hPreview.fillText("Loading...", 24, 24);
}

exports.renderPreview = renderPreview;
exports.clean = clean;
exports.renderLoading = renderLoading;
