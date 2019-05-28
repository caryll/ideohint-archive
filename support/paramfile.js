"use strict"

var fs = require('fs');
var toml = require('toml');

exports.from = function (argv) {
	if (argv.parameters) {
		try {
			return toml.parse(fs.readFileSync(argv.parameters))
		} catch (e) {
			return null;
		}
	} else {
		return null
	}
}