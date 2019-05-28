"use strict";

const KEY_ITEM_STEM = 1;
const KEY_ITEM_BOTTOM = 2;
const KEY_ITEM_TOP = 3;

class HintingElement {
	constructor() {
		this.told = false;
		this.hintedPositions = null;
	}
	untell() {
		this.told = false;
	}
	talk() {
		return ``;
	}
	below() {
		return false;
	}
	above() {
		return false;
	}
}

function ppemMaxIf(limit, consequent, alternate) {
	if (limit) {
		return `
ASM("
#BEGIN
#PUSHOFF
MPPEM[]
#PUSH, ${limit}
LT[]
IF[]
#BEGIN
#PUSHON
")
${consequent}
ASM("
#END
ELSE[]
#BEGIN
#PUSHON")
${alternate}
ASM("
#END
EIF[]
#END")
`;
	} else {
		return consequent;
	}
}
function anchor(place, knot, cvt, limit) {
	if (cvt) {
		return (
			`/* !!IDH!! ${place} Anchor Kind Direct w/CVT */` +
			"\n" +
			ppemMaxIf(limit, `YAnchor(${knot},${cvt})`, `YAnchor(${knot})		`)
		);
	} else {
		return `
/* !!IDH!! ${place} Anchor Kind Direct */
YAnchor(${knot})
		`;
	}
}

class BottomAnchorHintingElement extends HintingElement {
	constructor(id, y, _) {
		super();
		this.ipz = id;
		this.pOrg = y;
		Object.assign(this, _);
	}
	get kind() {
		return KEY_ITEM_BOTTOM;
	}
	talk() {
		return `
${anchor("Bottom", this.ipz, this.cvtID, this.ppemMax)}
${this.deltas || ""}
		`;
	}
	below(z) {
		return z.y < this.pOrg;
	}
	above(z) {
		return z.y > this.pOrg;
	}
}
class TopAnchorHintingElement extends HintingElement {
	constructor(id, y, _) {
		super();
		this.ipz = id;
		this.pOrg = y;
		Object.assign(this, _);
	}
	get kind() {
		return KEY_ITEM_TOP;
	}
	talk($, bottomAnchor) {
		if (this.cvtID) {
			const isValidLink =
				bottomAnchor &&
				Math.abs(this.pOrg - bottomAnchor.pOrg - this.topBotRefDist) < $.cvtCutin / 2;
			if (isValidLink) {
				return (
					`/* !!IDH!! Top Anchor Kind Linked */` +
					"\n" +
					ppemMaxIf(
						this.ppemMax,
						`YLink(${bottomAnchor.ipz},${this.ipz},${this.cvtTopBotDistId})`,
						`YLink(${bottomAnchor.ipz},${this.ipz})`
					)
				);
			} else {
				return `
				${anchor("Top", this.ipz, this.cvtID, this.ppemMax)}
				${this.deltas || ""}
`;
			}
		} else {
			return `
			${anchor("Top", this.ipz, this.cvtID, this.ppemMax)}
			${this.deltas || ""}
`;
		}
	}
	below(z) {
		return z.y < this.pOrg;
	}
	above(z) {
		return z.y > this.pOrg;
	}
}
class StemHintingElement extends HintingElement {
	constructor(zpos, zadv, _) {
		super();
		this.ipz = zpos.id;
		this.pOrg = zpos.y;
		this.advZ = zadv.id;
		this.pAdv = zadv.y;
		Object.assign(this, _);
	}
	get kind() {
		return KEY_ITEM_STEM;
	}
	below(z) {
		if (!(z.y < this.pOrg && z.y < this.pAdv)) return false;
		if (this.stem) {
			for (let zp of this.stem.posAlign) if (z.y >= zp.y) return false;
			for (let zp of this.stem.advAlign) if (z.y >= zp.y) return false;
		}
		return true;
	}
	above(z) {
		if (!(z.y > this.pOrg && z.y > this.pAdv)) return false;
		if (this.stem) {
			for (let zp of this.stem.posAlign) if (z.y <= zp.y) return false;
			for (let zp of this.stem.advAlign) if (z.y <= zp.y) return false;
		}
		return true;
	}
}
exports.Bottom = BottomAnchorHintingElement;
exports.Top = TopAnchorHintingElement;
exports.Stem = StemHintingElement;

exports.KEY_ITEM_BOTTOM = KEY_ITEM_BOTTOM;
exports.KEY_ITEM_TOP = KEY_ITEM_TOP;
exports.KEY_ITEM_STEM = KEY_ITEM_STEM;
