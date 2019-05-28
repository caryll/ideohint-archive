"use strict";

function stemPositionToActions(y, w, stems) {
	let actions = [];
	for (let j = 0; j < stems.length; j++) {
		actions[j] = [y[j], w[j]];
	}
	return actions;
}
module.exports = stemPositionToActions;
