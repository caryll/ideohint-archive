"use strict";

const fs = require("fs");
const readline = require("readline");
const devnull = require("dev-null");

const cvtlib = require("../instructor/cvt");
const paramLib = require("../support/paramfile");
const strategyLib = require("../support/strategy");
const { instruct, vtt: { talk } } = require("../instructor");

exports.command = "instruct";
exports.describe = "Create instruction file.";
exports.builder = function(yargs) {
	return yargs
		.alias("o", "output-into")
		.alias("?", "help")
		.alias("p", "parameters")
		.describe("help", "Displays this help.")
		.describe("o", "Output otd path. When absent, the result OTD will be written to STDOUT.")
		.describe("parameters", "Specify parameter file (in TOML).")
		.describe("CVT_PADDING", "Specify CVT Padding.")
		.describe("FPGM_PADDING", "Specify FPGM Padding.")
		.boolean(["noCVTAnchoring"])
		.describe("noCVTAnchoring", "Disable CVT anchoring for large size.")
		.describe("sdcutoff", "Specify SD-Cutoff settings.");
};

exports.handler = function(argv) {
	const InStream = () => (argv._[1] ? fs.createReadStream(argv._[1]) : process.stdin);
	const OutStream = () =>
		argv.o ? fs.createWriteStream(argv.o, { encoding: "utf-8" }) : process.stdout;
	let sdCut = new Map([[0, 0]]);
	if (argv.sdcutoff) {
		const sdCutoffJSON = JSON.parse(fs.readFileSync(argv.sdcutoff, "utf-8").trim());
		for (let x in sdCutoffJSON) {
			if (x === "*") {
				sdCut.set(0, sdCutoffJSON[x] - 0);
			} else {
				sdCut.set(x - 0, sdCutoffJSON[x] - 0);
			}
		}
	}
	mapInstrut({ InStream, OutStream, argv, sdCut });
};

function mapInstrut(_) {
	const { InStream, OutStream, argv, sdCut } = _;
	const parameterFile = paramLib.from(argv);
	const strategy = strategyLib.from(argv, parameterFile);

	const rl = readline.createInterface(InStream(), devnull());
	const outStream = OutStream();

	rl.on("line", function(line) {
		try {
			const l = line.trim();
			if (!l) return;
			const data = JSON.parse(l);
			const options = {
				cvtPadding: cvtlib.getPadding(argv, parameterFile),
				fpgmPadding: cvtlib.getFpgmPadding(argv, parameterFile),
				noCVTAnchoring: argv.noCVTAnchoring
			};
			const decision = Object.assign({}, data.ideohint_decision);
			if (data.unicodes) {
				let cutoffPPEM = sdCut.get(0);
				for (let u of data.unicodes) {
					if (sdCut.has(u)) {
						cutoffPPEM = Math.max(cutoffPPEM, sdCut.get(u));
					}
				}
				if (cutoffPPEM) {
					decision.sd = decision.sd.slice(0, cutoffPPEM + 1);
				}
			}
			const hgsData = {
				hash: data.hash,
				name: data.name,
				ideohint_decision: decision,
				TTF_instructions: instruct(decision, strategy, options),
				VTTTalk: talk(decision, strategy, data.contours, options) || ""
			};
			outStream.write(JSON.stringify(hgsData) + "\n");
		} catch (e) {
			console.error(e);
		}
	});
	rl.on("close", function() {
		if (process.stdout !== outStream) outStream.end();
	});
}
