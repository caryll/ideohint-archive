"use strict";

const fs = require("fs");
const readline = require("readline");
const devnull = require("dev-null");

const core = require("../core/index");

exports.command = "merge <parts..>";
exports.describe = "Update cache";
exports.builder = function(yargs) {
	return yargs
		.alias("o", "output-into")
		.alias("?", "help")
		.describe("help", "Displays this help.")
		.describe("o", "Output cache HGC path.");
};

exports.handler = function(argv) {
	const outStreams = [];
	if (argv.o) {
		if (argv.n) {
			for (let j = 0; j < argv.n; j++) {
				outStreams.push(fs.createWriteStream(argv.o + "." + j, { encoding: "utf-8" }));
			}
		} else {
			outStreams.push(fs.createWriteStream(argv.o, { encoding: "utf-8" }));
		}
	} else {
		outStreams.push(process.stdout);
	}
	function output(data) {
		let item = Math.floor(Math.random() * outStreams.length);
		outStreams[item].write(JSON.stringify(data) + "\n");
	}

	readPart({ cache: new Set(), tasks: argv.parts, outStreams, output });
};

function readPart(_) {
	const { cache, tasks, output } = _;
	if (!tasks.length) return setImmediate(() => finish(_));
	const [current, ...rest] = tasks;
	_.tasks = rest;

	if (!fs.existsSync(current)) return setImmediate(() => readPart(_));
	const rl = readline.createInterface(fs.createReadStream(current), devnull());
	rl.on("line", function(line) {
		const l = line.trim();
		if (!l) return;
		const data = JSON.parse(l);
		if (cache.has(data.hash)) return;
		output(data);
		cache.add(data.hash);
	});
	rl.on("close", () => readPart(_));
}
function finish(_) {
	const { outStreams } = _;
	for (let s of outStreams) {
		if (process.stdout !== s) s.end();
	}
}
