#!/usr/bin/env node

var child_process = require("child_process");
var os = require("os");
var command = process.execPath;
var args = [
	"--max-old-space-size=" + Math.floor(os.totalmem() / 1048576),
	require.resolve("./ideohint-main.js"),
	...process.argv.slice(2)
];
child_process.spawnSync(command, args, { stdio: "inherit" });
