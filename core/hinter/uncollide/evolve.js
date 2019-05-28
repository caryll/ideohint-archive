"use strict";

const { xclamp } = require("../../../support/common");

const F = 1;

function getGene(p, a, b, c, avails) {
	const n = p.gene.length;
	const newgene = new Array(n);
	const R = (Math.random() * n) | 0;
	for (let j = 0; j < n; j++) {
		const rn = Math.random();
		if (rn < 0.5 || j === R) {
			newgene[j] = xclamp(
				avails[j].low,
				a.gene[j] + F * (b.gene[j] - c.gene[j]), // no need to round because all genes are integer
				avails[j].high
			);
		} else {
			newgene[j] = p.gene[j];
		}
	}
	return newgene;
}

function crossover(p, a, b, c, env, allowUnbalanced) {
	const newgene = getGene(p, a, b, c, env.avails);
	const idBal = env.createBalancedIndividual(newgene);
	if (allowUnbalanced) {
		const idUnbal = env.createIndividual(newgene, true);
		if (idBal.better(p)) {
			if (idUnbal.better(idBal)) {
				return idUnbal;
			} else {
				return idBal;
			}
		} else {
			if (idUnbal.better(p)) {
				return idUnbal;
			}
		}
	} else {
		if (idBal.better(p)) {
			return idBal;
		}
	}
	return p;
}
// Use a swapchain to avoid re-allochain
function evolve(p, q, odd, env, allowUnbalanced) {
	const population = odd ? p : q;
	const background = odd ? q : p;
	// Crossover
	for (let c = 0; c < population.length; c++) {
		let j1 = 0 | (Math.random() * population.length);
		while (j1 === c) {
			j1 = 0 | (Math.random() * population.length);
		}
		let j2 = 0 | (Math.random() * population.length);
		while (j2 === c || j2 === j1) {
			j2 = 0 | (Math.random() * population.length);
		}
		let j3 = 0 | (Math.random() * population.length);
		while (j3 === c || j3 === j2 || j3 === j1) {
			j3 = 0 | (Math.random() * population.length);
		}
		background[c] = crossover(
			population[c],
			population[j1],
			population[j2],
			population[j3],
			env,
			allowUnbalanced
		);
	}
	return background;
}

module.exports = evolve;
