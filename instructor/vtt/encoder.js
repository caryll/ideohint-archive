"use strict";
const { decideDelta, decideDeltaShift, getSWCFG } = require("../delta.js");
const { xclamp } = require("../../support/common");
const roundings = require("../../support/roundings");
const { fpgmShiftOf } = require("./vttenv");

const ROUNDING_SEGMENTS = 8;
const SDB = 9;
const SDS = ROUNDING_SEGMENTS;

function formatdelta(delta) {
	if (delta > 8) return formatdelta(8);
	if (delta < -8) return formatdelta(-8);
	let u = Math.round(delta * ROUNDING_SEGMENTS);
	let d = ROUNDING_SEGMENTS;
	while (!(u % 2) && !(d % 2) && d > 1) {
		(u /= 2), (d /= 2);
	}
	if (d > 1) {
		return u + "/" + d;
	} else {
		return "" + u;
	}
}

function encodeDeltaVtt(quantity, _ppems) {
	const ppems = [..._ppems.sort((a, b) => a - b), 0];
	let ppemstart = 0,
		ppemend = 0;
	let buf = [];
	for (let ppem of ppems) {
		if (ppem === ppemend + 1) {
			ppemend += 1;
		} else {
			if (ppemstart > 0) {
				buf.push(ppemend > ppemstart ? ppemstart + ".." + ppemend : "" + ppemstart);
			}
			ppemstart = ppemend = ppem;
		}
	}
	return quantity + "@" + buf.join(";");
}

function deltaDataOf(deltas) {
	let deltaData = {};
	for (let { delta, ppem } of deltas) {
		let quantity = formatdelta(delta);
		if (!deltaData[quantity]) deltaData[quantity] = [];
		deltaData[quantity].push(ppem);
	}
	const keys = Object.keys(deltaData);
	return { keys, deltaData };
}

class VTTTalkDeltaEncoder {
	constructor() {}
	encode(z, d, tag) {
		const deltas = d.filter(x => x.delta);
		if (!deltas.length) return "";

		const { deltaData, keys } = deltaDataOf(deltas);
		if (!keys.length) return "";
		const deltaInstBody = keys.map(k => encodeDeltaVtt(k, deltaData[k])).join(",");
		return `${tag || "YDelta"}(${z},${deltaInstBody})`;
	}
	estimateImpact(d) {
		// impact caused by DLTP[]
		let impact = 0;
		// impact caused by SDS[]
		let sdsImpact = 0;
		// encoding bytes
		for (let dr of d) {
			let dq = Math.ceil(Math.abs(dr.delta));
			impact += 2 * dq; // two bytes for each entry
			if (dq > 1) sdsImpact = 4; // having a delta greater than one pixel would cause a SDS[]
		}
		const deltas = d.filter(x => x.delta);
		const { keys } = deltaDataOf(deltas);
		impact += keys.length * 2;
		return impact + sdsImpact;
	}
}

class VTTCall {
	constructor(...forms) {
		this.comment = "";
		this.forms = forms;
		this._bytes = -1;
	}
	then(that) {
		return new VTTCall(...this.forms, ...that.forms);
	}
	toString() {
		return (
			this.comment +
			"\n" +
			this.forms
				.filter(c => c && c.length)
				.map(c => `Call(${c})`)
				.join("\n")
		);
	}
	get bytes() {
		if (this._bytes >= 0) return this._bytes;
		let n = 0;
		for (let f of this.forms) n += f.length;
		this._bytes = n;
		return n;
	}
}

const asmDeltaSetCache = new Map();
function deltaSetToHash(d) {
	return JSON.stringify(d.sort((a, b) => a.ppem - b.ppem));
}

class AssemblyDeltaEncoder extends VTTTalkDeltaEncoder {
	constructor(fpgmPad) {
		super();
		this.fpgmPad = fpgmPad;
	}
	encode(z, d, tag) {
		let h = deltaSetToHash(d);
		if (asmDeltaSetCache.has(h)) return asmDeltaSetCache.get(h)(z);
		if (!this.fpgmPad) return super.encode(z, d, tag);

		const hf1 = this.encodeDelta(d, tag);
		const hf = z => {
			const buf = hf1(z);
			buf.comment =
				"/* Delta for " +
				z +
				" | " +
				d
					.filter(x => x.delta)
					.map(x => x.ppem + ":" + x.delta)
					.join(" ") +
				"*/";
			buf.impact = buf.bytes;
			return buf;
		};
		asmDeltaSetCache.set(h, hf);
		return hf(z);
	}

	encodeDeltaByte(dPPEM, shift) {
		return dPPEM * 16 + (shift > 0 ? 7 + shift : shift + 8);
	}
	encodeDelta(d) {
		const dltpg = {
			DLTP1: [],
			DLTP2: [],
			DLTP3: []
		};
		for (let { ppem, delta: deltaPpem } of d) {
			if (!deltaPpem) continue;
			const dltp =
				ppem >= SDB && ppem < SDB + 16
					? dltpg.DLTP1
					: ppem >= SDB + 16 && ppem < SDB + 32
						? dltpg.DLTP2
						: ppem >= SDB + 32 && ppem < SDB + 48 ? dltpg.DLTP3 : null;
			if (!dltp) continue;
			const dPPEM = (ppem - SDB) % 16;

			let delta = Math.round(xclamp(-8, deltaPpem, 8) * SDS);
			if (delta > 0)
				do {
					const shift = Math.min(delta, SDS);
					if (!shift) break;
					dltp.push(this.encodeDeltaByte(dPPEM, shift));
					delta -= shift;
				} while (delta);
			else
				do {
					const shift = Math.max(delta, -SDS);
					if (!shift) break;
					dltp.push(this.encodeDeltaByte(dPPEM, shift));
					delta -= shift;
				} while (delta);
		}

		if (
			dltpg.DLTP1.length &&
			dltpg.DLTP2.length &&
			!dltpg.DLTP3.length &&
			dltpg.DLTP1.length + dltpg.DLTP2.length < 60
		) {
			const n1 = dltpg.DLTP1.length,
				n2 = dltpg.DLTP2.length;
			const trailArgs =
				n1 <= 16 && n2 <= 16
					? [((n1 - 1) << 4) | (n2 - 1), this.fpgmPad + fpgmShiftOf._combined_ss]
					: [n1, n2, this.fpgmPad + fpgmShiftOf._combined];
			return z => {
				const args = [...dltpg.DLTP1, ...dltpg.DLTP2, z, ...trailArgs];
				return new VTTCall(args);
			};
		} else {
			return z => {
				let buf = new VTTCall();
				for (let instr in dltpg) {
					if (!dltpg[instr].length || !fpgmShiftOf[instr]) continue;
					let a = dltpg[instr].slice(0);
					while (a.length) {
						let slcLen = Math.min(60, a.length);
						let slc = a.slice(0, slcLen);
						a = a.slice(slcLen);
						buf = buf.then(
							new VTTCall([...slc, z, slcLen, this.fpgmPad + fpgmShiftOf[instr]])
						);
					}
				}
				return buf;
			};
		}
	}

	estimateImpact(d) {
		// impact caused by DLTP[]
		let impact = 0;

		// encoding bytes
		for (let dr of d) {
			let dq = Math.ceil(Math.abs(dr.delta));
			impact += dq; // two bytes for each entry
		}
		return impact;
	}
}

const TRY_INTEGER = [
	[fpgmShiftOf.comp_integral, 1, 4, -1],
	[fpgmShiftOf.comp_integral_pos, 1, 2, 0],
	[fpgmShiftOf.comp_integral_neg, 1, 2, -1]
];
const TRY_FRACTION = [
	[fpgmShiftOf.comp_octet, 1 / 8, 4, -1],
	[fpgmShiftOf.comp_octet_pos, 1 / 8, 2, 0],
	[fpgmShiftOf.comp_octet_neg, 1 / 8, 2, -1],
	[fpgmShiftOf.comp_quart, 1 / 4, 4, -1],
	[fpgmShiftOf.comp_quart_pos, 1 / 4, 2, 0],
	[fpgmShiftOf.comp_quart_neg, 1 / 4, 2, -1],
	[fpgmShiftOf.comp_quart_h, 1 / 8, 4, 0],
	[fpgmShiftOf.comp_quart_neg_h, 1 / 8, 4, -3]
];
const OPTIMIZE_ATTEMPTS = [TRY_INTEGER, TRY_INTEGER, TRY_FRACTION, TRY_FRACTION];

class AssemblyDeltaEncoder2 extends AssemblyDeltaEncoder {
	constructor(fpgmPad) {
		super(fpgmPad);
	}
	getIAmount(delta, divisor, shift, bpa) {
		let neg = shift * divisor;
		let pos = divisor * (bpa - 1) + shift * divisor;
		let s = 0;
		if (delta <= neg) s = neg;
		else if (delta >= pos) s = pos;
		else if (delta < 0) s = -divisor * Math.floor(-delta / divisor);
		else if (delta > 0) s = divisor * Math.floor(delta / divisor);
		return s / divisor;
	}
	encodeIntDelta(d, fnid, shift, bpa) {
		let dataBytes = [];
		let curByte = 0;
		let bits = 0;
		let deltas = [];
		for (let { ppem, delta } of d) {
			deltas[ppem] = Math.round(delta);
		}
		const bitsPerSeg = Math.log2(bpa);
		const ppemsPerByte = 8 / bitsPerSeg;
		let pmin = 0xffff,
			pmax = 0;
		for (let ppem = 0; ppem < deltas.length; ppem++) {
			if (!deltas[ppem]) continue;
			if (ppem < pmin) pmin = ppem;
			if (ppem > pmax) pmax = ppem;
		}
		for (
			let ppem = pmin;
			ppem < pmin + ppemsPerByte * Math.ceil((pmax + 1 - pmin) / ppemsPerByte);
			ppem++
		) {
			let delta = (deltas[ppem] || 0) - shift;
			let dibit = delta % bpa;
			curByte = curByte | (dibit << (((ppem - pmin) % ppemsPerByte) * bitsPerSeg));
			bits += 1;
			if ((ppem - pmin) % ppemsPerByte === ppemsPerByte - 1) {
				dataBytes.push(curByte);
				curByte = 0;
				bits = 0;
			}
		}
		if (bits) {
			dataBytes.push(curByte);
			curByte = 0;
		}
		if (dataBytes.length) {
			if (dataBytes.length >= 8 || pmin < SDB || pmin >= SDB + 32) return null;
			const initArgs = [...dataBytes].reverse();
			return z => new VTTCall([...initArgs, z, ((pmin - SDB) << 3) | dataBytes.length, fnid]);
		} else {
			return () => new VTTCall();
		}
	}
	encodeIntDeltaInternal(d, fnid, gear, shift, bpa, lv, bytesSofar, bestBytes, tag) {
		let iDelta = [],
			restDelta = [];
		for (let { ppem, delta } of d) {
			let iAmount = this.getIAmount(delta, gear, shift, bpa);
			if (iAmount) iDelta.push({ ppem, delta: iAmount });
			if (delta - iAmount * gear) restDelta.push({ ppem, delta: delta - iAmount * gear });
		}
		if (!iDelta.length) return null;
		let r1 = this.encodeIntDelta(iDelta, fnid, shift, bpa, tag);
		if (!r1) return null;

		let r1length = r1(0).bytes;
		if (bytesSofar + r1length > bestBytes) return null;

		let r2 = this.encodeDeltaIntLevel(restDelta, lv + 1, bytesSofar + r1length, tag);
		if (!r2) return null;

		return z => r1(z).then(r2(z));
	}
	encodeDeltaIntLevel(d, level, bytesSofar, tag) {
		if (level >= OPTIMIZE_ATTEMPTS.length) return super.encodeDelta(d, tag);
		let r = this.encodeDeltaIntLevel(d, level + 1, bytesSofar, tag);
		let bestBytes = r(0).bytes;
		const shiftTries = OPTIMIZE_ATTEMPTS[level];
		for (let [fs, gear, bpa, shift] of shiftTries) {
			let r1 = this.encodeIntDeltaInternal(
				d,
				this.fpgmPad + fs,
				gear,
				shift,
				bpa,
				level,
				bytesSofar,
				bestBytes,
				tag
			);
			if (!r1) continue;
			let bytes1 = r1(0).bytes;
			if (bytes1 < bestBytes) {
				bestBytes = bytes1;
				r = r1;
			}
		}
		return r;
	}
	encodeDelta(d, tag) {
		return this.encodeDeltaIntLevel(d, 0, 0, tag);
	}
}

class AdvanceEncoder {
	constructor(upm, s, sid) {
		this.upm = upm;
		const wsrc = s.posKeyAtTop
			? s.posKey.y - s.advKey.y + (s.advKey.x - s.posKey.x) * s.slope
			: s.advKey.y - s.posKey.y + (s.posKey.x - s.advKey.x) * s.slope;
		this.s = s;
		this.sid = sid;
		this.wsrc = wsrc;
		this.wsrc0 = wsrc;
		this.deltas = [];
		this.totalDeltaImpact = 0;
	}

	siHint(zpos, zadv) {
		return `YNoRound(${zadv}) YDist(${zpos},${zadv})`;
	}

	_calculateDeltaPpem(encoder, sd, ppem) {
		if (!sd[ppem] || !sd[ppem].y || !sd[ppem].y[this.sid]) return;
		const [, wtouch, isHard, isStacked] = sd[ppem].y[this.sid];
		const wdst = wtouch * (this.upm / ppem);
		const swcfg = getSWCFG(encoder, 1, ppem);
		if (this.s.posKeyAtTop) {
			const rawDelta = decideDeltaShift(
				ROUNDING_SEGMENTS,
				-1,
				isHard,
				isStacked,
				0,
				this.wsrc,
				0,
				wdst,
				this.upm,
				ppem,

				swcfg
			);
			const advDelta = rawDelta / ROUNDING_SEGMENTS;
			this.deltas.push({ ppem, delta: advDelta, rawDelta });
		} else {
			const rawDelta = decideDeltaShift(
				ROUNDING_SEGMENTS,
				1,
				isHard,
				isStacked,
				0,
				this.wsrc,
				0,
				wdst,
				this.upm,
				ppem,
				swcfg
			);
			const advDelta = rawDelta / ROUNDING_SEGMENTS;
			this.deltas.push({ ppem, delta: advDelta, rawDelta });
		}
	}

	calculateDelta(encoder, sd) {
		for (let ppem = 0; ppem < sd.length; ppem++) {
			this._calculateDeltaPpem(encoder, sd, ppem);
		}
	}
}

class VTTECompiler {
	constructor(_) {
		this.maxSWOverflowCpxs = _.maxSWOverflowCpxs;
		this.maxSWShrinkCpxs = _.maxSWShrinkCpxs;
		this.canonicalSW = _.canonicalSW;
		this.minSW = _.minSW;
		this.deltaEncoder = _.deltaEncoder;
		this.cvtLinkEntries = _.cvtLinkEntries;
	}
	encodeAnchor(z, ref, chosen, pmin, pmax, strategy) {
		const upm = strategy.UPM;
		let deltas = [];
		for (let ppem = pmin; ppem <= pmax; ppem++) {
			deltas.push({
				ppem,
				delta:
					decideDelta(ROUNDING_SEGMENTS, ref[ppem], chosen[ppem], upm, ppem) /
					ROUNDING_SEGMENTS
			});
		}
		return this.deltaEncoder.encode(z, deltas);
	}

	_encodeStemAdvance(upm, s, sid, sd) {
		const advDeltaGroups = [new AdvanceEncoder(upm, s, sid)];

		for (let adg of advDeltaGroups) {
			adg.calculateDelta(this, sd);
		}

		// decide optimal advance delta group
		for (let g of advDeltaGroups) {
			let encoded = this.deltaEncoder.encode(s.advKey.id, g.deltas);
			g.encodedDeltas = encoded;
			g.totalDeltaImpact += encoded.impact
				? encoded.impact
				: this.deltaEncoder.estimateImpact(g.deltas);
		}
		return advDeltaGroups.reduce((a, b) => (a.totalDeltaImpact <= b.totalDeltaImpact ? a : b));
	}
	encodeStem(s, sid, sd, strategy, pos0s, pmaxC) {
		const upm = strategy.UPM;

		let deltaPos = [];
		let hintedPositions = [];

		for (let ppem = 0; ppem < sd.length || (pmaxC && ppem < pmaxC); ppem++) {
			const pos0 = pos0s ? pos0s[ppem] : s.posKey.y;
			if (!sd[ppem] || !sd[ppem].y || !sd[ppem].y[sid]) {
				hintedPositions[ppem] = roundings.rtg(pos0, upm, ppem);
				continue;
			}
			const [ytouch, wtouch] = sd[ppem].y[sid];
			const psrc = roundings.rtg(pos0, upm, ppem);

			if (s.posKeyAtTop) {
				const pdst = ytouch * (upm / ppem);
				hintedPositions[ppem] = pdst;
				deltaPos.push({
					ppem,
					delta: decideDelta(ROUNDING_SEGMENTS, psrc, pdst, upm, ppem) / ROUNDING_SEGMENTS
				});
			} else {
				const pdst = (ytouch - wtouch) * (upm / ppem) - (s.advKey.x - s.posKey.x) * s.slope;
				const pd =
					decideDelta(ROUNDING_SEGMENTS, psrc, pdst, upm, ppem) / ROUNDING_SEGMENTS;
				deltaPos.push({ ppem, delta: pd });
				hintedPositions[ppem] = psrc + pd * (upm / ppem);
			}
		}

		// advance
		const adg = this._encodeStemAdvance(upm, s, sid, sd);

		// instructions
		const bufPosDelta = this.deltaEncoder.encode(s.posKey.id, deltaPos);
		const posDeltaImpact = bufPosDelta.impact
			? bufPosDelta.impact
			: this.deltaEncoder.estimateImpact(deltaPos);
		const bufAdvLink = adg.siHint(s.posKey.id, s.advKey.id, strategy);
		const bufAdvDelta = adg.encodedDeltas;

		const parts = [bufPosDelta, bufAdvLink, bufAdvDelta];
		return {
			buf: parts.join("\n"),
			parts,
			ipz: s.posKey.id,
			hintedPositions,
			pOrg: s.posKey.y,
			totalDeltaImpact: posDeltaImpact + adg.totalDeltaImpact
		};
	}
}

module.exports = {
	ROUNDING_SEGMENTS,
	VTTTalkDeltaEncoder,
	AssemblyDeltaEncoder: AssemblyDeltaEncoder2,
	VTTECompiler,
	VTTCall
};
