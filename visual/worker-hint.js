/* eslint-env worker */
"use strict";

const core = require("../core");
const postprocess = require("../core/postprocess");

onmessage = function(message) {
	const { input, strategy } = message.data;
	const glyphs = input.map(function(passage) {
		if (passage) {
			const glyph = core.parseOTD(passage);
			return {
				glyph: glyph,
				features: core.extractFeature(glyph, strategy),
				hints: []
			};
		}
	});

	for (let g of glyphs) {
		const hintData = core.decideHints(g.features, strategy);
		postprocess(hintData, g.glyph.contours, strategy);
		g.si = hintData.si;
		g.hints = hintData.sd;
	}
	postMessage(glyphs);
};
