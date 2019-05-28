"use strict";

const fs = require("fs");
const readline = require("readline");
const devnull = require("dev-null");
const paramfileLib = require("../support/paramfile");
const strategyLib = require("../support/strategy");

const core = require("../core/index");
const { progress } = require("./support/progress");

const postprocess = require("../core/postprocess");

exports.command = "hint";
exports.describe = "Hint a glyph list file (hgl).";
exports.builder = function(yargs) {
	return yargs
		.alias("o", "output-into")
		.alias("?", "help")
		.alias("p", "parameters")
		.describe("help", "Displays this help.")
		.describe(
			"o",
			"Output HGI file path. When absent, the result HGI file is written to STDOUT."
		)
		.describe(
			"d",
			"Only process dk+m'th glyphs in the feature file. Combine with -m for parallel processing."
		)
		.describe(
			"m",
			"Only process dk+m'th glyphs in the feature file. Combine with -d for parallel processing."
		)
		.describe("parameters", "Specify parameter file (in TOML).");
};

exports.handler = function(argv) {
	readHGL({ argv });
};

function readHGL(_) {
	const argv = _.argv;

	const inStream = argv._[1] ? fs.createReadStream(argv._[1]) : process.stdin;
	const outStream = argv.o ? fs.createWriteStream(argv.o, { encoding: "utf-8" }) : process.stdout;
	const rl = readline.createInterface(inStream, devnull());

	const parameterFile = paramfileLib.from(argv);
	const strategy = strategyLib.from(argv, parameterFile);

	const divide = argv.d || 1;
	const modulo = argv.m || 0;

	const pendings = [];
	const pendingSet = new Set();

	let j = 0;
	rl.on("line", function(line) {
		if (j % divide === modulo % divide) {
			const l = line.trim();
			if (l) {
				const data = JSON.parse(l);
				pendings.push(data);
				pendingSet.add(data.hash);
			}
		}
		j += 1;
	});
	rl.on("close", () => {
		_.taskName = "Hinting " + (argv._[1] || "(stdin)") + " " + modulo + "/" + divide;
		_.strategy = strategy;
		_.pendings = pendings;
		_.pendingSet = pendingSet;
		_.outStream = outStream;
		return readCache(_);
	});
}
function readCache(_) {
	const { argv, pendingSet } = _;
	const cache = new Map();
	_.cache = cache;

	if (!argv.cache || !fs.existsSync(argv.cache)) return setImmediate(() => doHints(_));

	const rl = readline.createInterface(fs.createReadStream(argv.cache), devnull());
	rl.on("line", function(line) {
		const l = line.trim();
		if (!l) return;
		const data = JSON.parse(l);
		if (!pendingSet.has(data.hash)) return;
		if (data.ideohint_version !== "*" && data.ideohint_version !== core.version) return;
		cache.set(data.hash, data);
	});
	rl.on("close", () => doHints(_));
}
function doHints(_) {
	const { taskName, strategy, pendings, outStream, cache } = _;
	progress(taskName, pendings, data => {
		try {
			if (cache.has(data.hash)) {
				const cached = cache.get(data.hash);
				data.ideohint_decision = cached.ideohint_decision;
				data.ideohint_version = cached.ideohint_version;
			} else {
				const contours = data.contours;
				if (!contours) return;
				data.ideohint_decision = core.hintSingleGlyph(contours, strategy);
				postprocess(data.ideohint_decision, data.contours, strategy);
				data.ideohint_version = core.version;
			}
			outStream.write(JSON.stringify(data) + "\n");
		} catch (e) {
			console.error(e);
		}
	});
	if (process.stdout !== outStream) outStream.end();
}
