"use strict";

const fs = require("fs");
const readline = require("readline");
const devnull = require("dev-null");

exports.command = "hgctrans";
exports.describe = "Transfer HGC";

exports.handler = readSideHGC;

function keyof(data) {
	return data.srcfile + "##" + data.name;
}

function readSideHGC(argv) {
	const cache = new Map();
	const file = argv.hgc;
	const rl = readline.createInterface(fs.createReadStream(file), devnull());
	rl.on("line", function(line) {
		const l = line.trim();
		if (!l) return;
		const data = JSON.parse(l);
		cache.set(keyof(data), data);
	});
	rl.on("close", () =>
		matchHints({
			cache,
			terms: [...argv._],
			nFound: 0,
			nMatch: 0,
			o: fs.createWriteStream(argv.o)
		})
	);
}

const TOL = 20;

function yof(s) {
	return s.posKeyAtTop ? s.posKey.y : s.advKey.y;
}
function cyof(s) {
	return !s.posKeyAtTop ? s.posKey.y : s.advKey.y;
}

function match(a, b) {
	if (a.stems.length !== b.stems.length) return false;
	for (let j = 0; j < a.stems.length; j++) {
		const sa = a.stems[j],
			sb = b.stems[j];
		if (Math.abs(yof(sa) - yof(sb)) > TOL || Math.abs(cyof(sa) - cyof(sb)) > TOL) {
			return false;
		}
	}
	return true;
}

function matchHints(ctx) {
	if (!ctx.terms.length) {
		console.error(`Found   ${ctx.nFound}`);
		console.error(`Matched ${ctx.nMatch}`);
		ctx.o.end();
		return;
	}

	const [file, ...rest] = ctx.terms;
	const rl = readline.createInterface(fs.createReadStream(file), devnull());

	rl.on("line", function(line) {
		const l = line.trim();
		if (!l) return;
		const data = JSON.parse(l);
		if (!ctx.cache.has(keyof(data))) return;
		ctx.nFound++;
		//console.log("deciding item", keyof(data));
		const cached = ctx.cache.get(keyof(data));
		if (!match(cached.ideohint_decision.si, data.ideohint_decision.si)) return;
		const ans = JSON.parse(l);
		ans.ideohint_decision.sd = cached.ideohint_decision.sd;
		ans.ideohint_version = cached.ideohint_version;
		ctx.o.write(JSON.stringify(ans) + "\n");
		ctx.nMatch++;
	});

	rl.on("close", () => {
		ctx.terms = rest;
		matchHints(ctx);
	});
}
