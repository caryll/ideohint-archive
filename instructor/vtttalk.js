"use strict";

const roundings = require("../support/roundings");
const product = require("../support/product");
const { VTTTalkDeltaEncoder, AssemblyDeltaEncoder, VTTECompiler } = require("./vtt/encoder");

const { getVTTAux, cvtIds, generateCVT, generateFPGM } = require("./vtt/vttenv");
const HE = require("./vtt/hintingElement");

const StemInstructionCombiner = require("./vtt/stem-instruction-combiner");
const formOffhints = require("./vtt/off-hints");
const formTrailHints = require("./vtt/trail-hints");
const formIntermediateHints = require("./vtt/intermediate-hints");
const { table } = require("./vtt/predictor");
const hintLS = require("./vtt/largerSizeHints");

const ABRefMethods = [
	{
		comment: "DUAL",
		findItems: elements => {
			let bottomAnchor = null,
				topAnchor = null;
			for (let j = 0; j < elements.length; j++) {
				if (!bottomAnchor) {
					bottomAnchor = elements[j];
				}
				topAnchor = elements[j];
			}
			return {
				bottomAnchor,
				bottomStem: bottomAnchor,
				topAnchor,
				topStem: topAnchor
			};
		}
	},
	{
		comment: "QUAD",
		findItems: elements => {
			let bottomAnchor = null,
				bottomStem = null,
				topAnchor = null,
				topStem = null;
			for (let j = 0; j < elements.length; j++) {
				if (!bottomAnchor && elements[j].kind !== HE.KEY_ITEM_STEM) {
					bottomAnchor = elements[j];
				}
				if (!bottomStem && elements[j].kind === HE.KEY_ITEM_STEM) {
					bottomStem = elements[j];
				}
				if (elements[j].kind !== HE.KEY_ITEM_STEM) {
					topAnchor = elements[j];
				}
				if (elements[j].kind === HE.KEY_ITEM_STEM) {
					topStem = elements[j];
				}
			}
			if (topAnchor && !topStem) topStem = topAnchor;
			if (!topAnchor && topStem) topAnchor = topStem;
			if (bottomAnchor && !bottomStem) bottomStem = bottomAnchor;
			if (!bottomAnchor && bottomStem) bottomAnchor = bottomStem;

			if (bottomAnchor && bottomStem && bottomAnchor.pOrg >= bottomStem.pOrg)
				bottomAnchor = bottomStem;
			if (topAnchor && topStem && topAnchor.pOrg <= topStem.pOrg) topAnchor = topStem;
			return { bottomAnchor, bottomStem, topAnchor, topStem };
		}
	}
];

// 20171025: *** QUAD being unrealiable ***
// 20171025: USE DUAL ONLY
const rfCombinations = [...product([ABRefMethods[0]], [0, 1, 2], [0, 1, 2], [0, 1, 2, 3])];

class VTTCompiler {
	constructor(record, strategy, padding, fpgmPadding, contours) {
		if (record) {
			this.sd = record.sd;
			this.si = record.si;
			this.pmin = record.pmin;
			this.pmax = record.pmax;
			this.upm = strategy.UPM;
			this.cvtCutin = this.upm / Math.max(40, this.pmax);
			this.strategy = strategy;
			this.fpgmPadding = fpgmPadding;
			this.contours = contours;

			this.cvt = cvtIds(padding);
			this.aux = getVTTAux(strategy);

			this.buffer = "";
			this._encoder = null;
			this._hintedPositions = null;
		}
	}
	talk(s) {
		this.buffer += s + "\n";
	}
	get pmaxC() {
		return this.pmax * 3;
	}
	get encoder() {
		if (!this._encoder) {
			this._encoder = new VTTECompiler({
				deltaEncoder: this.fpgmPadding
					? new AssemblyDeltaEncoder(this.fpgmPadding)
					: new VTTTalkDeltaEncoder(),
				cvtLinkEntries: [
					{ width: this.aux.canonicalSW, cvtid: this.cvt.cvtCSW },
					...this.aux.SWDs.map((x, j) => ({
						width: x,
						cvtid: this.cvt.cvtCSWD + j
					}))
				],
				canonicalSW: this.aux.canonicalSW,
				minSW: this.strategy.MINIMAL_STROKE_WIDTH_PIXELS || 1 / 8,
				maxSWOverflowCpxs: this.strategy.MAX_SW_OVERFLOW_CPXS,
				maxSWShrinkCpxs: this.strategy.MAX_SW_SHRINK_CPXS
			});
		}
		return this._encoder;
	}
	get buf() {
		return this.buffer;
	}
	get hintedPositions() {
		if (!this._hintedPositions) {
			let hp = {};
			const { sd, upm, pmin, pmaxC, strategy } = this;

			hp.bot = table(
				pmin,
				pmaxC,
				ppem =>
					sd[ppem] && sd[ppem].y_tb
						? sd[ppem].y_tb.bottom * upm / ppem
						: roundings.rtg(strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem)
			);
			hp.top0 = table(pmin, pmaxC, ppem =>
				roundings.rtg(strategy.BLUEZONE_TOP_CENTER, upm, ppem)
			);
			hp.top = table(pmin, pmaxC, ppem => {
				if (sd[ppem] && sd[ppem].y_tb) {
					return sd[ppem].y_tb.top * upm / ppem;
				} else {
					return (
						roundings.rtg(strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem) +
						roundings.rtg(
							strategy.BLUEZONE_TOP_CENTER - strategy.BLUEZONE_BOTTOM_CENTER,
							upm,
							ppem
						)
					);
				}
			});
			hp.botB = table(pmin, pmaxC, ppem => roundings.rtg(this.aux.yBotBar, upm, ppem));
			hp.topB = table(pmin, pmaxC, ppem => roundings.rtg(this.aux.yTopBar, upm, ppem));
			hp.botD = table(pmin, pmaxC, ppem => roundings.rtg(this.aux.yBotD, upm, ppem));
			hp.topD = table(pmin, pmaxC, ppem => roundings.rtg(this.aux.yTopD, upm, ppem));
			hp.topDLinked = table(
				pmin,
				pmaxC,
				ppem =>
					roundings.rtg(strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem) +
					roundings.rtg(this.aux.yTopD - this.aux.yBotD, upm, ppem)
			);
			this._hintedPositions = hp;
		}
		return this._hintedPositions;
	}
	compileAnchor(z, ref, chosen) {
		return this.encoder.encodeAnchor(z, ref, chosen, this.pmin, this.pmax, this.strategy);
	}
	rtgTable(y) {
		return table(this.pmin, this.pmaxC, ppem => roundings.rtg(y, this.upm, ppem));
	}
}
class MeasuredVTTCompiler extends VTTCompiler {
	constructor(parent) {
		super();
		Object.assign(this, parent);
		this.tdis = 0;
	}
}

// si : size-inpendent actions
// sd : size-dependent actions
// strategy : strategy object
// padding : CVT padding value, padding + 2 -> bottom anchor; padding + 1 -> top anchor
// fpgmPadding : FPGM padding
function produceVTTTalk(record, strategy, contours, options) {
	const padding = options.cvtPadding;
	const fpgmPadding = options.fpgmPadding;
	const $ = new VTTCompiler(record, strategy, padding, fpgmPadding, contours);
	const ec = $.encoder;

	// Initialize elements
	// An hinting element represents something needed to be carefully dealt.
	let elements = [];
	for (let z of $.si.blue.bottomZs) {
		if (options.noCVTAnchoring) {
			let targetPos = table(
				$.pmin,
				$.pmaxC,
				ppem =>
					ppem <= $.pmax ? $.hintedPositions.bot[ppem] : roundings.rtg(z.y, $.upm, ppem)
			);
			elements.push(
				new HE.Bottom(z.id, z.y, {
					cvtID: $.cvt.cvtBottomId,
					ppemMax: $.pmax,
					deltas: "",
					hintedPositions: targetPos
				})
			);
		} else if (
			Math.abs(z.y - $.aux.yBotD) < Math.abs(z.y - $.strategy.BLUEZONE_BOTTOM_CENTER)
		) {
			elements.push(
				new HE.Bottom(z.id, z.y, {
					cvtID: $.cvt.cvtBottomDId,
					deltas: $.compileAnchor(z.id, $.hintedPositions.botD, $.hintedPositions.bot),
					hintedPositions: $.hintedPositions.bot
				})
			);
		} else {
			elements.push(
				new HE.Bottom(z.id, z.y, {
					cvtID: $.cvt.cvtBottomId,
					deltas: "",
					hintedPositions: $.hintedPositions.bot
				})
			);
		}
	}
	for (let z of $.si.blue.topZs) {
		if (options.noCVTAnchoring) {
			let targetPos = table(
				$.pmin,
				$.pmaxC,
				ppem =>
					ppem <= $.pmax ? $.hintedPositions.top[ppem] : roundings.rtg(z.y, $.upm, ppem)
			);
			elements.push(
				new HE.Top(z.id, z.y, {
					hintedPositions: targetPos,
					cvtID: $.cvt.cvtTopId,
					ppemMax: $.pmax,
					cvtTopBotDistId: $.cvt.cvtTopBotDistId,
					topBotRefDist:
						$.strategy.BLUEZONE_TOP_CENTER - $.strategy.BLUEZONE_BOTTOM_CENTER,
					deltas: $.compileAnchor(z.id, $.hintedPositions.top0, $.hintedPositions.top)
				})
			);
		} else if (Math.abs(z.y - $.aux.yTopD) < Math.abs(z.y - $.strategy.BLUEZONE_TOP_CENTER)) {
			elements.push(
				new HE.Top(z.id, z.y, {
					hintedPositions: $.hintedPositions.top,
					cvtID: $.cvt.cvtTopDId,
					cvtTopBotDistId: $.cvt.cvtTopBotDistId,
					topBotRefDist:
						$.strategy.BLUEZONE_TOP_CENTER - $.strategy.BLUEZONE_BOTTOM_CENTER,
					deltas: $.compileAnchor(z.id, $.hintedPositions.topD, $.hintedPositions.top)
				})
			);
		} else {
			elements.push(
				new HE.Top(z.id, z.y, {
					hintedPositions: $.hintedPositions.top,
					cvtID: $.cvt.cvtTopId,
					cvtTopBotDistId: $.cvt.cvtTopBotDistId,
					topBotRefDist:
						$.strategy.BLUEZONE_TOP_CENTER - $.strategy.BLUEZONE_BOTTOM_CENTER,
					deltas: $.compileAnchor(z.id, $.hintedPositions.top0, $.hintedPositions.top)
				})
			);
		}
	}
	for (let sid = 0; sid < $.si.stems.length; sid++) {
		const s = $.si.stems[sid];
		elements.push(
			new HE.Stem(s.posKey, s.advKey, {
				stem: s,
				sid: sid
			})
		);
	}
	elements = elements.sort((a, b) => a.pOrg - b.pOrg);

	/// Stems and Anchors
	/// We choose one best combination of methods from 18 combinations
	let bestTDI = 0xffff,
		bestTalk = "";
	for (let [refMethod, bsMethod, tsMethod, allowFarLinks] of rfCombinations) {
		const $$ = new MeasuredVTTCompiler($);
		let { bottomAnchor, bottomStem, topAnchor, topStem } = refMethod.findItems(elements);
		if (!(topAnchor && bottomAnchor && topStem && bottomStem)) continue;
		// clear key items' status
		for (let r of elements) r.untell();
		// local talker

		$$.talk(`/* !!IDH!! REFMETHOD ${refMethod.comment} */`);

		/// Reference items
		// Bottom anchor reference
		let refBottom = null;
		if (!bottomAnchor.told && bottomAnchor.kind !== HE.KEY_ITEM_STEM) {
			// BKT must have a talk()
			$$.talk(bottomAnchor.talk($));
			bottomAnchor.told = true;
			refBottom = bottomAnchor;
		}
		// Top anchor reference
		if (!topAnchor.told && topAnchor.kind !== HE.KEY_ITEM_STEM) {
			$$.talk(topAnchor.talk($, refBottom));
			topAnchor.told = true;
		}
		let tbCombiner = new StemInstructionCombiner($$.fpgmPadding);
		// Bottom stem reference
		if (!bottomStem.told && bottomStem.kind === HE.KEY_ITEM_STEM) {
			const bsHintingMethodList = [];
			// Direct YAnchor
			bsHintingMethodList.push({
				posInstr: `/* !!IDH!! StemDef ${bottomStem.sid} BOTTOM Direct */\nYAnchor(${
					bottomStem.ipz
				})`,
				pos0s: null
			});

			const bsParams = bsHintingMethodList[bsMethod];
			if (!bsParams) continue;
			const { totalDeltaImpact: tdi, parts, hintedPositions } = ec.encodeStem(
				bottomStem.stem,
				bottomStem.sid,
				$$.sd,
				$$.strategy,
				bsParams.pos0s,
				$$.pmaxC
			);
			$$.talk(bsParams.posInstr);
			bottomStem.hintedPositions = hintedPositions;
			$$.tdis += tdi;
			tbCombiner.add(parts);
			bottomStem.told = true;
		}

		// Top stem reference
		if (!topStem.told && topStem.kind === HE.KEY_ITEM_STEM) {
			const tsHintingMethodList = [];
			// Direct YAnchor
			tsHintingMethodList.push({
				posInstr: `/* !!IDH!! StemDef ${topStem.sid} TOP Direct */\nYAnchor(${
					topStem.ipz
				})`,
				pos0s: null
			});

			const tsParams = tsHintingMethodList[tsMethod];
			if (!tsParams) continue;

			const { totalDeltaImpact: tdi, parts, hintedPositions } = ec.encodeStem(
				topStem.stem,
				topStem.sid,
				$$.sd,
				$$.strategy,
				tsParams.pos0s,
				$$.pmaxC
			);
			$$.talk(tsParams.posInstr);
			topStem.hintedPositions = hintedPositions;
			$$.tdis += tdi;
			tbCombiner.add(parts);
			topStem.told = true;
		}
		if (tbCombiner.parts.length) {
			$$.talk(tbCombiner.combine());
			$$.tdis += 3;
		}

		$$.tdis += formIntermediateHints.call(
			$$,
			{ bottomStem, bottomAnchor, topStem, topAnchor },
			$$.sd,
			elements,
			allowFarLinks
		);

		$$.tdis += hintLS($$, elements);

		if ($$.tdis < bestTDI) {
			bestTalk = $$.buf;
			bestTDI = $$.tdis;
		}
	}
	$.talk(bestTalk);

	formTrailHints.call($, $.si, contours);
	formOffhints.call($, contours, elements);
	$.talk("Smooth()");
	return $.buf;
}

exports.talk = produceVTTTalk;
exports.generateCVT = generateCVT;
exports.generateFPGM = generateFPGM;
