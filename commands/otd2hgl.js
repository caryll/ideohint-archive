"use strict";

var fs = require("fs");
var hashContours = require("../core/otdParser").hashContours;
var JSONStream = require("JSONStream");

function codePointCanBeHandledWithIDH(code) {
	return (
		(code >= 0x2e80 && code <= 0x2fff) || // CJK radicals
		(code >= 0x3192 && code <= 0x319f) || // CJK strokes
		(code >= 0x3300 && code <= 0x9fff) || // BMP ideographs
		(code >= 0xf900 && code <= 0xfa6f) || // CJK compatibility ideographs
		(code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
		(code >= 0x20000 && code <= 0x2ffff) // SIP
	);
}

exports.command = "otd2hgl";
exports.describe = "Prepare HGL file from OpenType Dump.";
exports.builder = function(yargs) {
	yargs.alias("o", "output-into").boolean(["all", "ideo-only"]);
};

exports.handler = function(argv) {
	var outstream = argv.o ? fs.createWriteStream(argv.o, { encoding: "utf-8" }) : process.stdout;

	if (!argv._[1]) return;

	var hasCmap = false;
	var keep = {};
	const unicodes = new Map();
	var selects = argv.select ? argv.select.split("").map(c => c.charCodeAt(0)) : null;

	getCMAPInfo();

	function getCMAPInfo() {
		var sParseCmap = JSONStream.parse(["cmap"]);
		var instream = fs.createReadStream(argv._[1], "utf-8");
		sParseCmap.on("data", function(cmap) {
			hasCmap = true;
			for (var k in cmap) {
				let code = 0;
				const gid = cmap[k];
				if (k[0] == "U" && k[1] == "+") {
					// hex dump
					code = parseInt(k.slice(2), 16);
				} else {
					code = parseInt(k, 10);
				}

				if (selects) {
					if (selects.indexOf(code) >= 0) {
						keep[gid] = true;
					}
				} else if (argv["all"]) {
					keep[gid] = true;
				} else if (codePointCanBeHandledWithIDH(code)) {
					keep[gid] = true;
				}
				// record unicodes
				if (!unicodes.has(gid)) unicodes.set(gid, []);
				unicodes.set(gid, [...unicodes.get(gid), code]);
			}
		});
		sParseCmap.on("end", function() {
			getGSUBinfo();
		});
		instream.pipe(sParseCmap);
	}
	function getGSUBinfo() {
		var sParseCmap = JSONStream.parse(["GSUB"]);
		var instream = fs.createReadStream(argv._[1], "utf-8");
		sParseCmap.on("data", function(gsub) {
			let lookups = gsub.lookups;
			if (!lookups) return;
			for (let passes = 0; passes < 10; passes++) {
				for (let lid in lookups) {
					if (!lookups[lid]) continue;
					if (lookups[lid].type !== "gsub_single") continue;
					for (let subtable of lookups[lid].subtables) {
						for (let g in subtable) {
							if (!keep[g]) continue;
							keep[subtable[g]] = true;
							unicodes.set(subtable[g], unicodes.get(g));
						}
					}
				}
			}
		});
		sParseCmap.on("end", function() {
			mapFrags();
		});
		instream.pipe(sParseCmap);
	}
	function mapFrags() {
		var sParseGlyf = JSONStream.parse(["glyf", { emitKey: true }]);
		var instream = fs.createReadStream(argv._[1], "utf-8");
		sParseGlyf.on("data", function(data) {
			var k = data.key,
				glyph = data.value;
			if (hasCmap && !keep[k]) return;
			if (!glyph.references) return;
			for (let r of glyph.references) {
				if (r.y !== 0) continue;
				keep[r.glyph] = true;
				unicodes.set(r.glyph, unicodes.get(k));
			}
		});
		sParseGlyf.on("end", function() {
			mapGlyf();
		});
		instream.pipe(sParseGlyf);
	}
	function mapGlyf() {
		var sParseGlyf = JSONStream.parse(["glyf", { emitKey: true }]);
		var srcfile = argv._[1];
		var instream = fs.createReadStream(srcfile, "utf-8");
		sParseGlyf.on("data", function(data) {
			var k = data.key,
				glyph = data.value;
			if (!glyph.contours || !glyph.contours.length || (hasCmap && !keep[k])) return;

			if (argv.minheight) {
				let ymax = -0xffff;
				let ymin = 0xffff;
				for (let c of glyph.contours)
					for (let z of c) {
						if (ymax < z.y) ymax = z.y;
						if (ymin > z.y) ymin = z.y;
					}
				if (ymax - ymin < argv.minheight - 0) return;
			}

			var h = hashContours(glyph.contours);

			outstream.write(
				JSON.stringify({
					name: k,
					hash: h,
					srcfile,
					unicodes: unicodes.get(k) || [],
					contours: glyph.contours
				}) + "\n"
			);
		});
		sParseGlyf.on("end", function() {
			outstream.end();
		});
		instream.pipe(sParseGlyf);
	}
};
