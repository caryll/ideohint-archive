"use strict";

class HintStem {
	constructor(s) {
		this.xmin = s.xmin;
		this.xmax = s.xmax;
		this.xminX = s.xminX;
		this.xmaxX = s.xmaxX;
		this.y = s.y;
		this.width = s.width;
		this.belongRadical = s.belongRadical;

		this.posKey = { id: s.posKey.id, y: s.posKey.y, x: s.posKey.x };
		this.advKey = { id: s.advKey.id, y: s.advKey.y, x: s.advKey.x };
		this.posAlign = s.posAlign.map(z => ({ id: z.id, x: z.x, y: z.y }));
		this.advAlign = s.advAlign.map(z => ({ id: z.id, x: z.x, y: z.y }));
		this.diagHigh = !!s.diagHigh;
		this.diagLow = !!s.diagLow;
		this.atLeft = !!s.atLeft;
		this.atRight = !!s.atRight;
		this.posKeyAtTop = !!s.posKeyAtTop;
		this.rid = s.rid || 0;
		this.slope = s.slope;

		this.turnsBelow = s.turnsBelow || 0;
		this.turnsAbove = s.turnsAbove || 0;

		this.hasLRSpur = !!s.hasLRSpur;
		this.hasGlyphStemAbove = !!s.hasGlyphStemAbove;
		this.hasSameRadicalStemAbove = !!s.hasSameRadicalStemAbove;
		this.hasRadicalPointAbove = !!s.hasRadicalPointAbove;
		this.radicalCenterRise = s.radicalCenterRise;
		this.hasGlyphPointAbove = !!s.hasGlyphPointAbove;
		this.glyphCenterRise = s.glyphCenterRise;
		this.hasRadicalLeftAdjacentPointAbove = !!s.hasRadicalLeftAdjacentPointAbove;
		this.hasRadicalRightAdjacentPointAbove = !!s.hasRadicalRightAdjacentPointAbove;
		this.radicalRightAdjacentRise = s.radicalRightAdjacentRise;
		this.radicalLeftAdjacentRise = s.radicalLeftAdjacentRise;
		this.hasGlyphLeftAdjacentPointAbove = !!s.hasGlyphLeftAdjacentPointAbove;
		this.hasGlyphRightAdjacentPointAbove = !!s.hasGlyphRightAdjacentPointAbove;
		this.glyphRightAdjacentRise = s.glyphRightAdjacentRise;
		this.glyphLeftAdjacentRise = s.glyphLeftAdjacentRise;
		this.hasRadicalLeftDistancedPointAbove = !!s.hasRadicalLeftDistancedPointAbove;
		this.hasRadicalRightDistancedPointAbove = !!s.hasRadicalRightDistancedPointAbove;
		this.radicalRightDistancedRise = s.radicalRightDistancedRise;
		this.radicalLeftDistancedRise = s.radicalLeftDistancedRise;
		this.hasGlyphLeftDistancedPointAbove = !!s.hasGlyphLeftDistancedPointAbove;
		this.hasGlyphRightDistancedPointAbove = !!s.hasGlyphRightDistancedPointAbove;
		this.glyphRightDistancedRise = s.glyphRightDistancedRise;
		this.glyphLeftDistancedRise = s.glyphLeftDistancedRise;
		this.hasGlyphStemBelow = !!s.hasGlyphStemBelow;
		this.hasSameRadicalStemBelow = !!s.hasSameRadicalStemBelow;
		this.hasRadicalPointBelow = !!s.hasRadicalPointBelow;
		this.radicalCenterDescent = s.radicalCenterDescent;
		this.hasGlyphPointBelow = !!s.hasGlyphPointBelow;
		this.glyphCenterDescent = s.glyphCenterDescent;
		this.hasRadicalLeftAdjacentPointBelow = !!s.hasRadicalLeftAdjacentPointBelow;
		this.hasRadicalRightAdjacentPointBelow = !!s.hasRadicalRightAdjacentPointBelow;
		this.radicalLeftAdjacentDescent = s.radicalLeftAdjacentDescent;
		this.radicalRightAdjacentDescent = s.radicalRightAdjacentDescent;
		this.hasGlyphLeftAdjacentPointBelow = !!s.hasGlyphLeftAdjacentPointBelow;
		this.hasGlyphRightAdjacentPointBelow = !!s.hasGlyphRightAdjacentPointBelow;
		this.glyphLeftAdjacentDescent = s.glyphLeftAdjacentDescent;
		this.glyphRightAdjacentDescent = s.glyphRightAdjacentDescent;
		this.hasRadicalLeftDistancedPointBelow = !!s.hasRadicalLeftDistancedPointBelow;
		this.hasRadicalRightDistancedPointBelow = !!s.hasRadicalRightDistancedPointBelow;
		this.radicalLeftDistancedDescent = s.radicalLeftDistancedDescent;
		this.radicalRightDistancedDescent = s.radicalRightDistancedDescent;
		this.hasGlyphLeftDistancedPointBelow = !!s.hasGlyphLeftDistancedPointBelow;
		this.hasGlyphRightDistancedPointBelow = !!s.hasGlyphRightDistancedPointBelow;
		this.glyphLeftDistancedDescent = s.glyphLeftDistancedDescent;
		this.glyphRightDistancedDescent = s.glyphRightDistancedDescent;
		this.hasGlyphFoldAbove = !!s.hasGlyphFoldAbove;
		this.hasRadicalFoldAbove = !!s.hasRadicalFoldAbove;
		this.hasGlyphSideFoldAbove = !!s.hasGlyphSideFoldAbove;
		this.hasRadicalSideFoldAbove = !!s.hasRadicalSideFoldAbove;
		this.hasGlyphFoldBelow = !!s.hasGlyphFoldBelow;
		this.hasRadicalFoldBelow = !!s.hasRadicalFoldBelow;
		this.hasGlyphSideFoldBelow = !!s.hasGlyphSideFoldBelow;
		this.hasRadicalSideFoldBelow = !!s.hasRadicalSideFoldBelow;
		this.hasGlyphVFoldBelow = !!s.hasGlyphVFoldBelow;
		this.hasRadicalVFoldBelow = !!s.hasRadicalVFoldBelow;
		this.hasEntireContourAbove = !!s.hasEntireContourAbove;
		this.hasEntireContourBelow = !!s.hasEntireContourBelow;
	}
}

module.exports = function(s) {
	return new HintStem(s);
};
