#!/usr/bin/env node

var yargs = require("yargs")
	.alias("?", "help")
	.command(require("../commands/otd2hgl"))
	.command(require("../commands/hint"))
	.command(require("../commands/apply"))
	.command(require("../commands/merge"))
	.command(require("../commands/visual"))
	.command(require("../commands/cache"))
	.command(require("../commands/instruct"))
	.help().argv;
