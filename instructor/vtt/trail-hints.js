"use strict";

const toposort = require("toposort");

function sortIPSAs(calls) {
	let defs = [],
		edges = [];
	for (let c of calls) {
		if (c.length < 2) continue;
		if (c.length === 2) {
			edges.push(c);
			defs[c[1]] = c;
		} else {
			for (let m = 2; m < c.length; m++) {
				edges.push([c[0], c[m]], [c[1], c[m]]);
				defs[c[m]] = [c[0], c[1], c[m]];
			}
		}
	}
	for (let j = 0; j < defs.length; j++)
		if (defs[j] && defs[j].length > 2)
			for (let k = 0; k < defs.length; k++)
				if (defs[k] && defs[k].length === 2) {
					edges.push([j, k]);
				}
	try {
		let sorted = toposort(edges);
		return sorted.map(j => defs[j]).filter(c => c && c.length >= 2);
	} catch (e) {
		return calls;
	}
}

const TOL = 8;
const MAX_IP_LENGTH = 64;
function reIP(calls, contours) {
	if (!contours) return calls;
	const ipdef = [];
	const indexedPoints = [];
	{
		let n = 0;
		for (let c of contours)
			for (let z of c) {
				indexedPoints[n] = z;
				n++;
			}
	}
	for (let round = 0; round < 64; round++) {
		let modified = false;
		for (let c of calls) {
			if (c.length > 2) {
				for (let k of c.slice(2)) ipdef[k] = c;
			} else if (
				c.length === 2 &&
				indexedPoints[c[0]] &&
				indexedPoints[c[1]] &&
				Math.abs(indexedPoints[c[0]].y - indexedPoints[c[1]].y) < TOL &&
				ipdef[c[0]] &&
				ipdef[c[0]].length < MAX_IP_LENGTH
			) {
				ipdef[c[0]].push(c[1]);
				c.length = 0;
				modified = true;
			}
		}
		if (!modified) break;
	}
	return calls;
}

function collectIPSAs(calls, contours) {
	calls = sortIPSAs(reIP(calls, contours));
	// collect groups
	let groups = [];
	for (let c of calls) {
		if (c.length < 2) continue;
		if (!groups[groups.length - 1] || groups[groups.length - 1].isShift !== (c.length === 2)) {
			groups.push({
				isShift: c.length === 2,
				items: [c]
			});
		} else {
			groups[groups.length - 1].items.push(c);
		}
	}
	groups = groups.map(g => {
		if (g.isShift) {
			g.items = g.items.sort((a, b) => a[0] - b[0]);
		} else {
			g.items = g.items
				.map(c => (c[0] < c[1] ? c : [c[1], c[0], ...c.slice(2)]))
				.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
		}
		return g;
	});

	let answer = [];
	for (let g of groups) {
		let currentInstr = [];
		for (let c of g.items) {
			if (g.isShift) {
				answer.push(c.slice(0));
			} else {
				if (c[0] === currentInstr[0] && c[1] === currentInstr[1]) {
					currentInstr = currentInstr.concat(c.slice(2));
				} else {
					answer.push(currentInstr);
					currentInstr = c.slice(0);
				}
			}
		}
		if (currentInstr.length) answer.push(currentInstr);
	}

	return answer;
}

module.exports = function formTrailHints(si, contours) {
	/// ISALs

	let isalCalls = [];
	for (let s of si.stems) {
		for (let zp of s.posAlign) isalCalls.push([s.posKey.id, zp.id]);
		for (let zp of s.advAlign) isalCalls.push([s.advKey.id, zp.id]);
	}

	/// Diagonal alignments
	let diagAlignCalls = [];
	for (let da of si.diagAligns) {
		if (!da.zs.length) continue;
		// IP METHOD
		for (let z of da.zs) {
			diagAlignCalls.push([da.l, da.r, z]);
		}

		// DALIGN METHOD
		// this.talk(`XAnchor(${da.l})`);
		// this.talk(`XAnchor(${da.r})`);
		// this.talk(`DAlign(${da.l},${da.zs.join(",")},${da.r})`);
	}

	/// Interpolations and Shifts
	const calls = collectIPSAs([...isalCalls, ...diagAlignCalls, ...si.ipsacalls], contours);
	for (let c of calls) {
		if (!c || c.length < 2) continue;
		if (c.length >= 3) {
			// ip
			if (c[0] !== c[1]) this.talk(`YInterpolate(${c[0]},${c.slice(2).join(",")},${c[1]})`);
		} else {
			this.talk(`YShift(${c[0]},${c[1]})`);
		}
	}
};
