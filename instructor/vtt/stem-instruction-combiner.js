"use strict";

const { VTTCall } = require("./encoder");

function ibpType(x) {
	if (typeof x === "string") return "str";
	if (x instanceof VTTCall) return "vttcall";
	return "unknown";
}

function flatten(ary) {
	var ret = [];
	for (var i = 0; i < ary.length; i++) {
		if (Array.isArray(ary[i])) {
			ret = ret.concat(flatten(ary[i]));
		} else {
			ret.push(ary[i]);
		}
	}
	return ret;
}

const ibpCombiner = {
	unknown: xs => xs.join("\n"),
	str: xs => xs.join("\n"),
	vttcall: (xs, fpgmPadding) => {
		const primaryInvokes = [...xs.map(x => x.forms)]
			.filter(a => a.length)
			.reduce((a, b) => [...a, ...b], []);
		if (primaryInvokes.length <= 2) return xs.join("\n");
		let arglist = flatten(primaryInvokes);
		if (!arglist.length) return "";
		if (arglist.length > 256) return xs.join("\n");
		if (arglist.length < 62) {
			return (
				xs
					.map(x => x.comment)
					.filter(x => !!x)
					.join("\n") +
				"\n" +
				`Call(0,${arglist},${fpgmPadding})`
			);
		} else {
			let asm = `ASM("CALL[],0,${arglist},${fpgmPadding}")`;
			if (asm.length < 800) {
				return (
					xs
						.map(x => x.comment)
						.filter(x => !!x)
						.join("\n") +
					"\n" +
					asm
				);
			} else {
				return xs.join("\n");
			}
		}
	}
};

class StemInstructionCombiner {
	constructor(fpgmPadding) {
		this.parts = [];
		this.fpgmPadding = fpgmPadding;
	}
	add(data) {
		for (let p = 0; p < data.length; p++) {
			if (!this.parts[p]) this.parts[p] = [];
			this.parts[p].push(data[p]);
		}
	}
	combine() {
		let ans = "";

		for (let column of this.parts) {
			let m = new Map();
			for (let x of column) {
				let ty = ibpType(x);
				if (!m.has(ty)) m.set(ty, []);
				m.get(ty).push(x);
			}

			for (let [k, v] of m) {
				if (v.length) ans += ibpCombiner[k](v, this.fpgmPadding) + "\n";
			}
		}
		return ans;
	}
}

module.exports = StemInstructionCombiner;
