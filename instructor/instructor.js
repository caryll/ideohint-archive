"use strict";

const roundings = require("../support/roundings");
const pushargs = require("./invoke").pushargs;
const invokesToInstrs = require("./invoke").invokesToInstrs;
const pushInvokes = require("./invoke").pushInvokes;

const { decideDelta, getSWCFG, decideDeltaShift } = require("./delta.js");

function ipsaInvokes(actions) {
	if (!actions) return [];
	let invokes = [];
	let cur_rp1 = -1;
	let cur_rp2 = -1;
	for (let k = 0; k < actions.length; k++) {
		if (!actions[k]) continue;
		if (actions[k].length > 2 && actions[k][0] === actions[k][1]) {
			actions[k] = [actions[k][0], actions[k][2]];
		}
		if (actions[k].length > 2) {
			// an IP
			const rp1 = actions[k][0];
			const rp2 = actions[k][1];
			if (cur_rp1 !== rp1) {
				cur_rp1 = rp1;
				invokes.push([[rp1], ["SRP1"]]);
			}
			if (cur_rp2 !== rp2) {
				cur_rp2 = rp2;
				invokes.push([[rp2], ["SRP2"]]);
			}
			invokes.push([[actions[k][2]], ["IP"]]);
		} else {
			// an short absorption
			const rp1 = actions[k][0];
			if (cur_rp1 !== rp1) {
				cur_rp1 = rp1;
				invokes.push([[rp1], ["SRP1"]]);
			}
			invokes.push([[actions[k][1]], ["SHP[rp1]"]]);
		}
	}
	return invokes;
}

class DeltaEncoder {
	constructor(sdb, stackDepth) {
		this.gear = GEAR;
		this.sds = SDS;
		this.gearCoarse = GEAR_COARSE;
		this.sdsCoarse = SDS_COARSE;
		this.sdb = sdb;
		this.stackDepth = stackDepth;

		this.deltas = [];
	}

	encodeDeltaVal(d, ppem) {
		if (!d) return [];
		if (d < -8) {
			return this.encodeDeltaVal(-8, ppem).concat(this.encodeDeltaVal(d + 8, ppem));
		}
		if (d > 8) {
			return this.encodeDeltaVal(8, ppem).concat(this.encodeDeltaVal(d - 8, ppem));
		}
		var selector = d > 0 ? d + 7 : d + 8;
		var deltappem = (ppem - this.sdb) % 16;
		return [deltappem * 16 + selector];
	}

	encodeDelta(d, ppem) {
		if (d >= 0) {
			const dCoarse = (d / this.gearCoarse) | 0;
			const dFine = d % this.gearCoarse;
			return {
				coarse: this.encodeDeltaVal(dCoarse, ppem),
				fine: this.encodeDeltaVal(dFine, ppem)
			};
		} else {
			const dCoarse = (-d / this.gearCoarse) | 0;
			const dFine = -d % this.gearCoarse;
			return {
				coarse: this.encodeDeltaVal(-dCoarse, ppem),
				fine: this.encodeDeltaVal(-dFine, ppem)
			};
		}
	}

	pushDelta(ppem, pointID, shift) {
		this.deltas.push({
			id: pointID,
			ppem,
			deltas: this.encodeDelta(shift, ppem)
		});
	}

	_pushDeltaCalls(deltaCalls, invocations, STACK_DEPTH) {
		if (!deltaCalls.length) return;
		var currentDeltaCall = {
			arg: deltaCalls[0].arg.slice(0),
			instruction: deltaCalls[0].instruction
		};
		for (var j = 1; j < deltaCalls.length; j++) {
			if (
				deltaCalls[j].instruction === currentDeltaCall.instruction &&
				currentDeltaCall.arg.length + deltaCalls[j].arg.length < STACK_DEPTH - 10
			) {
				// Same Instruction
				currentDeltaCall.arg = currentDeltaCall.arg.concat(deltaCalls[j].arg);
			} else {
				currentDeltaCall.arg.push(currentDeltaCall.arg.length >> 1);
				invocations.push([currentDeltaCall.arg, [currentDeltaCall.instruction]]);
				currentDeltaCall = {
					arg: deltaCalls[j].arg.slice(0),
					instruction: deltaCalls[j].instruction
				};
			}
		}
		currentDeltaCall.arg.push(currentDeltaCall.arg.length >> 1);
		invocations.push([currentDeltaCall.arg, [currentDeltaCall.instruction]]);
	}

	formDeltaCall() {
		const deltaCalls = { coarse: [], fine: [] };
		const _deltas = this.deltas.sort((a, b) => a.ppem - b.ppem);
		for (let { deltas: { coarse, fine }, ppem, id } of _deltas) {
			let instr = "DELTAP" + (1 + Math.floor((ppem - this.sdb) / 16));
			for (let d of coarse) {
				deltaCalls.coarse.push({
					arg: [d, id],
					instruction: instr
				});
			}
			for (let d of fine) {
				deltaCalls.fine.push({
					arg: [d, id],
					instruction: instr
				});
			}
		}

		const invokes = [];
		if (deltaCalls.coarse.length) {
			invokes.push([[this.sds - this.sdsCoarse], ["SDS"]]);
			this._pushDeltaCalls(deltaCalls.coarse, invokes, this.stackDepth);
		}
		if (deltaCalls.fine.length) {
			invokes.push([[this.sds], ["SDS"]]);
			this._pushDeltaCalls(deltaCalls.fine, invokes, this.stackDepth);
		}
		return invokes;
	}
}

const SDS = 4;
const GEAR = 16;
const SDS_COARSE = 2;
const GEAR_COARSE = 4;

function instruct(record, strategy, options) {
	const si = record.si;
	const sd = record.sd;
	const pmin = record.pmin;
	const pmax = record.pmax;

	const padding = options.cvtPadding || 0;
	var upm = strategy.UPM || 1000;
	var cvtTopID = padding + 1;
	var cvtBottomID = padding + 2;

	var STACK_DEPTH = strategy.STACK_DEPTH || 200;
	var invocations = [];

	// if(!si.stems.length) return;
	var tt = ["SVTCA[y-axis]", "RTG"];

	invocations.push([[pmin], ["SDB"]]);

	// Blue zone alignment instructions
	{
		const de = new DeltaEncoder(pmin, STACK_DEPTH);

		// Bottom
		for (let k = 0; k < si.blue.bottomZs.length; k++) {
			invocations.push([[si.blue.bottomZs[k].id, cvtBottomID], ["MIAP[rnd]"]]);
		}
		pushInvokes(tt, invocations, STACK_DEPTH);
		// Top
		// Normal cases:
		// Padding + 3 + ppem is the CVT index of top blue zone center.
		tt.push("PUSHB_1", pmin, "MPPEM", "LTEQ", "PUSHB_1", pmax, "MPPEM", "GTEQ", "AND", "IF");
		tt.push("MPPEM");
		pushargs(tt, padding + 3);
		tt.push("ADD");
		for (let k = 0; k < si.blue.topZs.length; k++) {
			tt.push("DUP");
			pushargs(tt, si.blue.topZs[k].id);
			tt.push("SWAP", "MIAP[0]"); // Don't round top absorptions
		}
		tt.push("CLEAR");
		tt.push("ELSE");
		for (let k = 0; k < si.blue.topZs.length; k++) {
			invocations.push([[si.blue.topZs[k].id, cvtTopID], ["MIAP[rnd]"]]);
		}
		pushInvokes(tt, invocations, STACK_DEPTH);
		tt.push("EIF");

		// Anchor deltas
		for (let ppem = 0; ppem < sd.length; ppem++) {
			if (!sd[ppem]) continue;
			const uppx = upm / ppem;
			const defaultBottomY = roundings.rtg(strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem);
			const defaultTopY =
				roundings.rtg(strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem) +
				roundings.rtg(
					strategy.BLUEZONE_TOP_CENTER - strategy.BLUEZONE_BOTTOM_CENTER,
					upm,
					ppem
				);
			const targetBottomY = sd[ppem].y_tb ? sd[ppem].y_tb.bottom * ppem : defaultBottomY;
			const targetTopY = sd[ppem].y_tb ? sd[ppem].y_tb.top * ppem : defaultTopY;
			if (Math.abs(defaultBottomY - targetBottomY) >= uppx / GEAR) {
				for (let z of si.blue.bottomZs) {
					de.pushDelta(
						ppem,
						z.id,
						Math.round(de.gear * (targetBottomY - defaultBottomY))
					);
				}
			}
			if (Math.abs(defaultTopY - targetTopY) >= uppx / GEAR) {
				for (let z of si.blue.topZs) {
					de.pushDelta(ppem, z.id, Math.round(de.gear * (targetTopY - defaultTopY)));
				}
			}
		}
		invocations = invocations.concat(de.formDeltaCall());
	}

	// Stem instructions
	{
		// Microsoft eats my deltas, I have to add additional MDAPs
		// cf. http://www.microsoft.com/typography/cleartype/truetypecleartype.aspx#Toc227035721
		if (si.stems.length) {
			for (var k = 0; k < si.stems.length; k++) {
				invocations.push([[si.stems[k].posKey.id], ["MDAP[rnd]"]]);
				invocations.push([[si.stems[k].advKey.id], ["MDRP[0]"]]);
			}
		}

		const de = new DeltaEncoder(pmin, STACK_DEPTH);

		for (var ppem = 0; ppem < sd.length; ppem++) {
			const uppx = upm / ppem;
			if (!sd[ppem]) continue;
			const instrs = sd[ppem].y;
			if (!instrs || !instrs.length) continue;

			for (let k = 0; k < instrs.length; k++) {
				if (!instrs[k]) continue;
				const [y, w, isStrict, isStacked] = instrs[k];
				const stem = si.stems[k];
				const y0 = stem.posKeyAtTop ? stem.posKey.y : stem.advKey.y;
				const w0 = stem.posKeyAtTop
					? stem.posKey.y - stem.advKey.y + (stem.advKey.x - stem.posKey.x) * stem.slope
					: stem.advKey.y - stem.posKey.y + (stem.posKey.x - stem.advKey.x) * stem.slope;
				const keyDX = stem.advKey.x - stem.posKey.x;
				let ypos, ypos0;
				if (stem.posKeyAtTop) {
					ypos = y * uppx;
					ypos0 = roundings.rtg(y0, upm, ppem);
				} else {
					ypos = (y - w) * uppx - keyDX * stem.slope;
					ypos0 = roundings.rtg(y0 - w0 - keyDX * stem.slope, upm, ppem);
				}

				de.pushDelta(ppem, stem.posKey.id, decideDelta(de.gear, ypos0, ypos, upm, ppem));

				const originalAdvance = w0;
				const targetAdvance = w * (upm / ppem);

				de.pushDelta(
					ppem,
					stem.advKey.id,
					decideDeltaShift(
						de.gear,
						stem.posKeyAtTop ? -1 : 1,
						isStrict,
						isStacked,
						ypos0,
						originalAdvance,
						ypos,
						targetAdvance,
						upm,
						ppem,
						getSWCFG(
							{
								minSW: strategy.MINIMAL_STROKE_WIDTH_PIXELS || 1 / 8,
								maxSWOverflowCpxs: strategy.MAX_SW_OVERFLOW_CPXS,
								maxSWShrinkCpxs: strategy.MAX_SW_SHRINK_CPXS
							},
							1,
							ppem
						)
					)
				);
			}
		}

		invocations = invocations.concat(de.formDeltaCall());
	}

	// In-stem alignments
	let isalInvocations = [];
	for (let j = 0; j < si.stems.length; j++) {
		[
			[si.stems[j].posKey.id, si.stems[j].posAlign],
			[si.stems[j].advKey.id, si.stems[j].advAlign]
		].forEach(function(x) {
			if (!x[1].length) return;
			isalInvocations.push([
				x[1].map(z => z.id).concat([x[0]]),
				["SRP0"].concat(x[1].map(() => "MDRP[0]"))
			]);
		});
	}
	let isks = [];
	for (let da of si.diagAligns) {
		if (!da.zs || !da.zs.length) continue;
		for (let z of da.zs) {
			isks.push([da.l, da.r, z]);
		}
	}

	// Interpolations
	tt = tt.concat(
		invokesToInstrs(invocations, STACK_DEPTH),
		invokesToInstrs(
			[].concat(isalInvocations, ipsaInvokes(isks.concat(si.ipsacalls))),
			STACK_DEPTH
		)
	);

	tt.push("IUP[y]");
	return tt;
}

exports.instruct = instruct;
