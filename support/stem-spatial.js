"use strict";

function atRadicalBottom(s, strategy) {
	return (
		!s.hasSameRadicalStemBelow &&
		!(s.hasRadicalPointBelow && s.radicalCenterDescent > strategy.STEM_CENTER_MIN_DESCENT) &&
		!(
			s.hasRadicalLeftAdjacentPointBelow &&
			s.radicalLeftAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT
		) &&
		!(
			s.hasRadicalRightAdjacentPointBelow &&
			s.radicalRightAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT
		)
	);
}

function atGlyphBottom(stem, strategy) {
	return (
		atRadicalBottom(stem, strategy) &&
		!stem.hasGlyphStemBelow &&
		!(stem.hasGlyphPointBelow && stem.glyphCenterDescent > strategy.STEM_CENTER_MIN_DESCENT) &&
		!(
			stem.hasGlyphLeftAdjacentPointBelow &&
			stem.glyphLeftAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT
		) &&
		!(
			stem.hasGlyphRightAdjacentPointBelow &&
			stem.glyphRightAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT
		)
	);
}

function atRadicalBottomMost(stem, strategy) {
	return (
		atRadicalBottom(stem, strategy) &&
		!(
			stem.hasRadicalLeftDistancedPointBelow &&
			stem.radicalLeftDistancedDescent > strategy.STEM_SIDE_MIN_DIST_DESCENT
		) &&
		!(
			stem.hasRadicalRightDistancedPointBelow &&
			stem.radicalRightDistancedDescent > strategy.STEM_SIDE_MIN_DIST_DESCENT
		)
	);
}
function isCapShape(stem, strategy) {
	return (
		atRadicalBottom(stem, strategy) &&
		((stem.hasRadicalLeftDistancedPointBelow &&
			stem.radicalLeftDistancedDescent > strategy.STEM_SIDE_MIN_DIST_DESCENT) ||
			(stem.hasRadicalRightDistancedPointBelow &&
				stem.radicalRightDistancedDescent > strategy.STEM_SIDE_MIN_DIST_DESCENT))
	);
}
function atGlyphBottomMost(stem, strategy) {
	return (
		atGlyphBottom(stem, strategy) &&
		!(
			stem.hasGlyphLeftDistancedPointBelow &&
			stem.glyphLeftDistancedDescent > strategy.STEM_SIDE_MIN_DIST_DESCENT
		) &&
		!(
			stem.hasGlyphRightDistancedPointBelow &&
			stem.glyphRightDistancedDescent > strategy.STEM_SIDE_MIN_DIST_DESCENT
		) &&
		!(
			stem.hasRadicalLeftAdjacentPointBelow &&
			stem.radicalLeftAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT / 3
		) &&
		!(
			stem.hasRadicalRightAdjacentPointBelow &&
			stem.radicalRightAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT / 3
		)
	);
}

function atStrictRadicalBottom(stem, strategy) {
	return (
		atRadicalBottom(stem, strategy) &&
		!stem.hasRadicalLeftAdjacentPointBelow &&
		!stem.hasRadicalRightAdjacentPointBelow &&
		!stem.hasRadicalLeftDistancedPointBelow &&
		!stem.hasRadicalRightDistancedPointBelow
	);
}

function atRadicalTop(stem, strategy) {
	return (
		!stem.hasSameRadicalStemAbove &&
		!(stem.hasRadicalPointAbove && stem.radicalCenterRise > strategy.STEM_CENTER_MIN_RISE) &&
		!(
			stem.hasRadicalLeftAdjacentPointAbove &&
			stem.radicalLeftAdjacentRise > strategy.STEM_SIDE_MIN_RISE
		) &&
		!(
			stem.hasRadicalRightAdjacentPointAbove &&
			stem.radicalRightAdjacentRise > strategy.STEM_SIDE_MIN_RISE
		) &&
		!(
			stem.hasRadicalLeftDistancedPointAbove &&
			stem.radicalLeftDistancedRise > strategy.STEM_SIDE_MIN_DIST_RISE
		) &&
		!(
			stem.hasRadicalRightDistancedPointAbove &&
			stem.radicalRightDistancedRise > strategy.STEM_SIDE_MIN_DIST_RISE
		)
	);
}

function atGlyphTop(stem, strategy) {
	return (
		atRadicalTop(stem, strategy) &&
		!stem.hasGlyphStemAbove &&
		!(stem.hasGlyphPointAbove && stem.glyphCenterRise > strategy.STEM_CENTER_MIN_RISE) &&
		!(
			stem.hasGlyphLeftAdjacentPointAbove &&
			stem.glyphLeftAdjacentRise > strategy.STEM_SIDE_MIN_RISE
		) &&
		!(
			stem.hasGlyphRightAdjacentPointAbove &&
			stem.glyphRightAdjacentRise > strategy.STEM_SIDE_MIN_RISE
		)
	);
}

exports.atRadicalBottom = atRadicalBottom;
exports.atRadicalTop = atRadicalTop;
exports.atGlyphBottom = atGlyphBottom;
exports.atGlyphTop = atGlyphTop;
exports.atRadicalBottomMost = atRadicalBottomMost;
exports.isCapShape = isCapShape;
exports.atGlyphBottomMost = atGlyphBottomMost;
exports.atStrictRadicalBottom = atStrictRadicalBottom;
