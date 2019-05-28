"use strict";

const analyzeStems = require("./coupler");
const {
	analyzeStemSpatialRelationships,
	analyzeEntireContourAboveBelow
} = require("./stem-relationship");
const { computeACS, computePQ } = require("./collide-matrix");
const findRadicals = require("./radical");

const {
	stemOverlapRatio,
	stemOverlapLength,
	analyzeDirectOverlaps
} = require("../si-common/overlap");

const turns = require("./turns");

function OverlapMatrix(stems, fn) {
	var transitions = [];
	for (var j = 0; j < stems.length; j++) {
		transitions[j] = [];
		for (var k = 0; k < stems.length; k++) {
			transitions[j][k] = fn(stems[j], stems[k]);
		}
	}
	return transitions;
}

function updatePromixity(stems, dov, P, F) {
	for (let js = 0; js < stems.length; js++) {
		let promUp = 0;
		let promDown = 0;
		for (let j = 0; j < stems.length; j++) {
			if (dov[j][js]) promUp += P[j][js] + F[j][js];
			if (dov[js][j]) promDown += P[js][j] + F[js][j];
		}
		stems[js].promixityUp = promUp;
		stems[js].promixityDown = promDown;
	}
}

function findStems(glyph, strategy) {
	const radicals = findRadicals(glyph.contours);
	glyph.radicals = radicals;
	const stems = analyzeStems(radicals, strategy);
	glyph.stems = stems;

	// There are two overlapping matrices are being used: one "minimal" and one "canonical".
	// The minimal one is ued for collision matrices calclulation, and the canonical one is
	// used for spatial relationship detection
	glyph.stemOverlaps = OverlapMatrix(stems, (p, q) => stemOverlapRatio(p, q, Math.min, radicals));
	glyph.stemOverlapLengths = OverlapMatrix(
		stems,
		(p, q) => stemOverlapLength(p, q, radicals) / strategy.UPM
	);
	analyzeStemSpatialRelationships(stems, radicals, glyph.stemOverlaps, strategy);
	analyzeEntireContourAboveBelow(glyph, stems, strategy);
	const F = (glyph.turnsBetween = turns.analyzeTurns(glyph, strategy, stems));
	const { P, Q } = computePQ(strategy, stems, F);
	// We need to calculate PromixityUp and PromixityDown
	// so computeACS would be ran TWICE
	glyph.collisionMatrices = computeACS(
		strategy,
		stems,
		glyph.stemOverlaps,
		glyph.stemOverlapLengths,
		Q,
		F
	);
	const directOverlaps = analyzeDirectOverlaps(glyph, strategy, true);
	updatePromixity(stems, directOverlaps, P, F);
	glyph.collisionMatrices = computeACS(
		strategy,
		stems,
		glyph.stemOverlaps,
		glyph.stemOverlapLengths,
		Q,
		F,
		directOverlaps
	);
	glyph.collisionMatrices.promixity = P;
	glyph.collisionMatrices.spatialPromixity = Q;
	return glyph;
}

exports.findStems = findStems;
