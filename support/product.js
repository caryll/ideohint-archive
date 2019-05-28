"use strict";

function* productHelper(lists, prefix = []) {
	if (lists.length === 0) {
		yield [];
	} else {
		const [head, ...rest] = lists;
		for (let item of head) {
			const newPrefix = prefix.concat(item);
			if (rest.length) {
				yield* productHelper(rest, newPrefix);
			} else {
				yield newPrefix;
			}
		}
	}
}

function* product(...lists) {
	yield* productHelper(lists);
}

module.exports = product;
