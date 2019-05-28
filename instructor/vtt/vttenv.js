"use strict";

const { mix, toVQ } = require("../../support/common");

const GROUP_CVT = gid => "ideohint_CVT_entries" + (gid ? "_" + gid : "");
const GROUP_FPGM = gid => "ideohint_FPGM_entries" + (gid ? "_" + gid : "");

function mgmGroupRegex(group) {
	return new RegExp(
		`^/\\*## !! MEGAMINX !! BEGIN SECTION ${group} ##\\*/$[\\s\\S]*?^/\\*## !! MEGAMINX !! END SECTION ${group} ##\\*/$`,
		"m"
	);
}

function mgmGroup(group, ...s) {
	return (
		`\n\n/*## !! MEGAMINX !! BEGIN SECTION ${group} ##*/\n` +
		s.join("\n") +
		`\n/*## !! MEGAMINX !! END SECTION ${group} ##*/\n\n`
	).replace(/\t/g, "    ");
}

/// FPGM
const fpgmShiftOf = (exports.fpgmShiftOf = {
	interpreter: 0,
	DLTP1: 1,
	DLTP2: 2,
	DLTP3: 3,
	_combined: 4,
	_combined_ss: 5,
	comp_integral: 6,
	comp_integral_pos: 7,
	comp_integral_neg: 8,
	comp_octet: 9,
	comp_octet_pos: 10,
	comp_octet_neg: 11,
	comp_quart: 12,
	comp_quart_pos: 13,
	comp_quart_neg: 14,
	comp_quart_h: 15,
	comp_quart_neg_h: 16,
	quadstroke_f: 18
});

exports.generateFPGM = (function() {
	const While = (index, cond, body) => `
#Begin${index}:
${cond}
#PUSH, Wend${index}
SWAP[]
JROF[], (Wend${index}=#End${index})
${body}
#PUSH, Wbegin${index}
JMPR[], (Wbegin${index}=#Begin${index})
#End${index}:
`;

	const interpreterF = fid => `
/* Function ${fid}, the interpreter */
FDEF[], ${fid}
#BEGIN
	#PUSHOFF
	DUP[]
	#PUSH, 6
	SWAP[]
	#PUSHON
	JROF[],*,*
	#PUSHOFF
	CALL[]
	#PUSH, -9
	#PUSHON
	JMPR[],*
	#PUSHOFF
	POP[]
	#PUSHON
#END
ENDF[]
`;
	const splitStackTopByte = (d, s1, s2) => `
	DUP[]
	DUP[]
	#PUSH, ${d * 64}
	DIV[]
	#PUSH, ${d * 64}
	MUL[]
	SUB[]
	${s1 ? "#PUSH, " + s1 + "\n\tADD[]" : ""}
	SWAP[]
	#PUSH, ${d * 64}
	DIV[]
	${s2 ? "#PUSH, " + s2 + "\n\tADD[]" : ""}
	SWAP[]
`;
	const intCompressedSegment = (l, n, d) => {
		const bitsPerSeg = 8 / l;
		const multiplier = 1 << bitsPerSeg;
		return `
		#PUSH, 4
		MINDEX[]
		DUP[]
		ROLL[]
		DUP[]
		SWAP[]
		DUP[]
		#PUSH, ${64 * multiplier}
		DIV[]
		#PUSH, ${64 * multiplier}
		MUL[]
		SUB[]
		ROLL[]
		SWAP[]
		#PUSH, ${n}
		ADD[]
		#PUSH, ${d}
		DIV[]
		#PUSH, 6
		MINDEX[]
		DUP[]
		MPPEM[]
		EQ[]
		IF[]
			ROLL[]
			ROLL[]
			SHPIX[]
		ELSE[]
			ROLL[]
			ROLL[]
			POP[]
			POP[]
		EIF[]
		#PUSH, 1
		ADD[]
		SWAP[]
		#PUSH, ${64 * multiplier}
		DIV[]
		#PUSH, 4
		MINDEX[]
		SWAP[]
`;
	};

	const intCompressedDeltaFunction = (fid, _d, _l, n) => {
		const d = 1 / _d;
		const l = 16 / _l;
		return `
/* Function ${fid} : Compressed form of Deltas (${d} - ${n}) */
FDEF[], ${fid}
#BEGIN
	#PUSHOFF
	/* Extract startPpem and n from the compact byte */
	${splitStackTopByte(8, 0, 9)}
	/* On Y axis */
	SVTCA[Y]
	${While(
		"f" + fid,
		"DUP[]",
		`
		#PUSH, 4
		MINDEX[]
		${intCompressedSegment(l, n, d).repeat(l)}
		/* Pop it */
		POP[]
		#PUSH, 1
		SUB[]
		`
	)}
	POP[]
	POP[]
	POP[]
	#PUSHON
#END
ENDF[]
`;
	};
	const compressedDeltaFunction = (fid, instr) => `
/* Function ${fid} : Compressed form of ${instr}
   Arguments:
	 p_n, ..., p_1 : Delta of ${instr}
	 z : point ID
	 n : Quantity of ${instr}s
*/
FDEF[], ${fid}
#BEGIN
#PUSHOFF
DUP[]
#PUSH, 18
SWAP[]
#PUSHON
JROF[],*,*
#PUSHOFF
SWAP[]
DUP[]
#PUSH, 4
MINDEX[]
SWAP[]
#PUSH, 1
${instr}[]
SWAP[]
#PUSH, 1
SUB[]
#PUSH, -21
#PUSHON
JMPR[],*
#PUSHOFF
POP[]
POP[]
#PUSHON
#END
ENDF[]
`;

	const combinedCompDeltaFunction = fid => `
/* Function ${fid} : Compressed form of DLTP1 and DLTP2
   Arguments:
	 p1_n, ..., p1_1 : Delta quantity of DLTP1
	 p2_m, ..., p2_2 : Delta quantity of DLTP2
	 z : point ID
	 n : quantity of DLTP1s
	 m : quantity of DLTP2s
*/
FDEF[], ${fid}
#BEGIN
#PUSHOFF
	${While(
		`af${fid}`,
		"DUP[]",
		`
		ROLL[]
		DUP[]
		#PUSH, 5
		MINDEX[]
		SWAP[]
		#PUSH, 1
		DELTAP2[]
		SWAP[]
		ROLL[]
		SWAP[]
		#PUSH, 1
		SUB[]
		`
	)}	
	POP[]
	${While(
		`bf${fid}`,
		"DUP[]",
		`
		SWAP[]
		DUP[]
		#PUSH, 4
		MINDEX[]
		SWAP[]
		#PUSH, 1
		DELTAP1[]
		SWAP[]
		#PUSH, 1
		SUB[]
		`
	)}
	POP[]
	POP[]
#PUSHON
#END
ENDF[]

/* Function ${fid + 1} : Fn ${fid} with m <= 16 and n <= 16
	m and n are compressed into one byte, four bits for each
*/
FDEF[], ${fid + 1}
#BEGIN
	#PUSHOFF
	${splitStackTopByte(16, 1, 1)}
	#PUSH, ${fid}
	CALL[]
	#PUSHON
#END
ENDF[]
`;

	const quadStrokePreventer = fid => `
FDEF[], ${fid}
#BEGIN
#PUSHOFF
	MPPEM[]
	LTEQ[]
	IF[]
	#BEGIN
	#PUSHOFF
		SRP1[]
		SRP2[]
		DUP[]
		ROLL[]
		DUP[]
		ROLL[]
		DUP[]
		ROLL[]
		DUP[]
		ROLL[]
		SWAP[]
		GC[N]
		SWAP[]
		GC[N]
		SUB[]
		ROLL[]
		ROLL[]
		GC[O]
		SWAP[]
		GC[O]
		SUB[]
		FLOOR[]
		#PUSH, 128
		MIN[]
		LT[]
		IF[]
		#BEGIN
		#PUSHOFF
			IP[]
			IP[]
		#PUSHON
		#END
		ELSE[]
		#BEGIN
		#PUSHOFF
			POP[]
			POP[]
		#PUSHON
		#END
		EIF[]
	#PUSHON
	#END
	ELSE[]
	#BEGIN
	#PUSHOFF
		POP[]
		POP[]
		POP[]
		POP[]
	#PUSHON
	#END
	EIF[]
#PUSHON
#END
ENDF[]
`;

	return function(fpgm, padding, gid) {
		if (!padding) return fpgm;
		return (
			fpgm +
			mgmGroup(
				GROUP_FPGM(gid),
				interpreterF(padding),
				compressedDeltaFunction(padding + fpgmShiftOf.DLTP1, "DELTAP1"),
				compressedDeltaFunction(padding + fpgmShiftOf.DLTP2, "DELTAP2"),
				compressedDeltaFunction(padding + fpgmShiftOf.DLTP3, "DELTAP3"),
				combinedCompDeltaFunction(padding + fpgmShiftOf._combined),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_integral, 1, 4, -1),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_integral_pos, 1, 2, 0),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_integral_neg, 1, 2, -1),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_octet, 1 / 8, 4, -1),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_octet_pos, 1 / 8, 2, 0),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_octet_neg, 1 / 8, 2, -1),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_quart, 1 / 4, 4, -1),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_quart_pos, 1 / 4, 2, 0),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_quart_neg, 1 / 4, 2, -1),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_quart_h, 1 / 8, 4, 0),
				intCompressedDeltaFunction(padding + fpgmShiftOf.comp_quart_neg_h, 1 / 8, 4, -3),
				quadStrokePreventer(padding + fpgmShiftOf.quadstroke_f)
			)
		);
	};
})();

/// CVT

const SPLITS = 7 + 16;
function getVTTAux(strategy) {
	const bot = strategy.BLUEZONE_BOTTOM_CENTER;
	const top = strategy.BLUEZONE_TOP_CENTER;
	const canonicalSW = toVQ(strategy.CANONICAL_STEM_WIDTH, strategy.PPEM_MAX);
	const p = 1 / 20;
	const pd = 1 / 40;

	const SWDs = [];
	for (let j = 1; j < SPLITS; j++) {
		SWDs.push(Math.round(canonicalSW * mix(1 / 2, 1 + 1 / 5, j / SPLITS)));
	}
	return {
		yBotBar: Math.round(mix(bot, top, p)),
		yBotD: Math.round(mix(bot, top, pd)),
		yTopBar: Math.round(mix(top, bot, p)),
		yTopD: Math.round(mix(top, bot, pd)),
		canonicalSW: Math.round(canonicalSW),
		SWDs: SWDs
	};
}

exports.getVTTAux = getVTTAux;
exports.cvtIds = function(padding) {
	return {
		cvtZeroId: padding,
		cvtTopId: padding + 1,
		cvtBottomId: padding + 2,
		cvtTopDId: padding + 5,
		cvtBottomDId: padding + 6,
		cvtTopBarId: padding + 3,
		cvtBottomBarId: padding + 4,
		cvtTopBotDistId: padding + 7,
		cvtTopBotDDistId: padding + 8,
		cvtCSW: padding + 9,
		cvtCSWD: padding + 10
	};
};

exports.generateCVT = function generateCVT(cvt, cvtPadding, strategy, gid) {
	const { yBotBar, yTopBar, yBotD, yTopD, canonicalSW, SWDs } = getVTTAux(strategy);
	return (
		cvt.replace(mgmGroupRegex(GROUP_CVT(gid)), "") +
		mgmGroup(
			GROUP_CVT(gid),
			`${cvtPadding} : ${0}`,
			`${cvtPadding + 1} : ${strategy.BLUEZONE_TOP_CENTER}`,
			`${cvtPadding + 2} : ${strategy.BLUEZONE_BOTTOM_CENTER}`,
			`${cvtPadding + 3} : ${yTopBar}`,
			`${cvtPadding + 4} : ${yBotBar}`,
			`${cvtPadding + 5} : ${yTopD}`,
			`${cvtPadding + 6} : ${yBotD}`,
			`${cvtPadding + 7} : ${strategy.BLUEZONE_TOP_CENTER - strategy.BLUEZONE_BOTTOM_CENTER}`,
			`${cvtPadding + 8} : ${yTopD - yBotD}`,
			`${cvtPadding + 9} : ${canonicalSW}`,
			`${SWDs.map((x, j) => cvtPadding + 10 + j + " : " + x).join("\n")}`
		)
	);
};
