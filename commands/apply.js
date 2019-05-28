"use strict";

const fs = require("fs");
const readline = require("readline");
const devnull = require("dev-null");
const oboe = require("oboe");
const { instruct, vtt: { talk, generateCVT, generateFPGM } } = require("../instructor");
const stringifyToStream = require("../support/stringify-to-stream");
const cvtlib = require("../instructor/cvt");

const hashContours = require("../core/otdParser").hashContours;

exports.command = "apply";
exports.describe = "Apply hints to font dump.";
exports.builder = function(yargs) {
	return yargs
		.alias("o", "output-into")
		.alias("?", "help")
		.alias("p", "parameters")
		.describe("help", "Displays this help.")
		.describe("o", "Output otd path. When absent, the result OTD will be written to STDOUT.")
		.describe("parameters", "Specify parameter file (in TOML).")
		.boolean(["noCVTAnchoring"])
		.describe("noCVTAnchoring", "Disable CVT anchoring for large size.")
		.describe("CVT_PADDING", "Specify CVT Padding.");
};
exports.handler = function(argv) {
	const hgiStream = argv._[2] ? fs.createReadStream(argv._[1], "utf-8") : process.stdin;
	const rl = readline.createInterface(hgiStream, devnull());
	const parameterFile = require("../support/paramfile").from(argv);
	const strategy = require("../support/strategy").from(argv, parameterFile);

	const instructingOptions = {
		cvtPadding: cvtlib.getPadding(argv, parameterFile),
		fpgmPadding: cvtlib.getFpgmPadding(argv, parameterFile),
		noCVTAnchoring: argv.noCVTAnchoring
	};
	const activeInstructions = {};

	rl.on("line", function(line) {
		const dataStr = line.trim();
		if (!dataStr) return;
		const data = JSON.parse(dataStr);
		activeInstructions[data.hash] = data;
	});
	rl.on("close", function() {
		pass_weaveOTD(activeInstructions);
	});

	function pass_weaveOTD(activeInstructions) {
		const otdPath = argv._[2] ? argv._[2] : argv._[1];
		process.stderr.write("Weaving OTD " + otdPath + "\n");
		const instream = fs.createReadStream(otdPath, "utf-8");
		let foundCVT = false;

		oboe(instream)
			.on("node", "cvt_", function(cvt) {
				foundCVT = true;
				return cvtlib.createCvt(cvt, strategy, instructingOptions.cvtPadding);
			})
			.on("node", "maxp", function(maxp) {
				if (maxp.maxStackElements < strategy.STACK_DEPTH + 20) {
					maxp.maxStackElements = strategy.STACK_DEPTH + 20;
				}
				return maxp;
			})
			.on("done", function(otd) {
				if (!foundCVT) {
					otd.cvt_ = cvtlib.createCvt([], strategy, instructingOptions.cvtPadding);
				}
				if (otd.glyf) {
					for (let g in otd.glyf) {
						try {
							const glyph = otd.glyf[g];
							if (!glyph.contours || !glyph.contours.length) continue;
							const hash = hashContours(glyph.contours);
							if (argv.just_modify_cvt || !activeInstructions[hash]) continue;
							const airef = activeInstructions[hash];
							if (otd.TSI_23) {
								// Prefer VTTTalk than TTF
								if (!otd.TSI_23.glyphs) otd.TSI_23.glyphs = {};
								otd.TSI_23.glyphs[g] = (
									airef.VTTTalk ||
									talk(
										airef.ideohint_decision,
										strategy,
										glyph.contours,
										instructingOptions
									) ||
									""
								).replace(/\n/g, "\r"); // vtt uses CR
								glyph.instructions = [];
								if (otd.TSI_01 && otd.TSI_01.glyphs) {
									otd.TSI_01.glyphs[g] = "";
								}
							} else {
								glyph.instructions =
									airef.TTF_instructions ||
									instruct(airef.ideohint_decision, strategy, instructingOptions);
							}
						} catch (e) {
							console.error(e);
						}
					}
				}
				if (otd.TSI_01 && otd.TSI_01.extra && otd.TSI_01.extra.cvt) {
					otd.TSI_01.extra.cvt = generateCVT(
						otd.TSI_01.extra.cvt,
						instructingOptions.cvtPadding,
						strategy,
						argv.VTT_CVT_GROUP
					);
					otd.TSI_01.extra.fpgm = generateFPGM(
						otd.TSI_01.extra.fpgm,
						instructingOptions.fpgmPadding,
						argv.VTT_FPGM_GROUP
					);
				}
				if (argv.padvtt && !otd.TSI_01) {
					otd.TSI_01 = { glyphs: {}, extra: {} };
					otd.TSI_23 = { glyphs: {}, extra: {} };
				}
				var outStream = argv.o
					? fs.createWriteStream(argv.o, { encoding: "utf-8" })
					: process.stdout;
				stringifyToStream(otd, outStream, outStream === process.stdout)();
			})
			.on("fail", function(e) {
				console.error(e);
			});
	}
};
