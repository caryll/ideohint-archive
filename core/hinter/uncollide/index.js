"use strict";

const evolve = require("./evolve");
const { xclamp } = require("../../../support/common");

function populate(y0, env, scale, allowUnbalanced) {
	const n = y0.length;
	const avails = env.avails;

	let initIdv = env.createIndividual(env.balance(y0));
	let population = [initIdv];

	if (allowUnbalanced) {
		let unbalIdv = env.createIndividual(y0, true);
		if (unbalIdv.better(initIdv)) population.push(unbalIdv);
	}

	population.push(env.createIndividual(env.balance(y0.map((y, j) => avails[j].high))));
	population.push(env.createIndividual(env.balance(y0.map((y, j) => avails[j].low))));
	// Random
	const N = population.length;
	for (let c = N; c < scale || c < N * 2; c++) {
		// fill population with random individuals
		const ry = [...y0];
		for (let j = 0; j < n; j++) {
			ry[j] = xclamp(
				avails[j].low,
				Math.floor(avails[j].low + Math.random() * (avails[j].high - avails[j].low + 1)),
				avails[j].high
			);
		}
		const idvBal = env.createIndividual(env.balance(ry));
		population.push(idvBal);
		if (allowUnbalanced) {
			const idvUnbal = env.createIndividual(ry, true);
			if (idvUnbal.better(idvBal)) {
				population.push(idvUnbal);
				c++;
			}
		}
	}
	return population;
}

function selectElite(population) {
	// Hall of fame
	let best = population[0];
	for (let j = 1; j < population.length; j++) {
		if (population[j].better(best)) best = population[j];
	}
	return best;
}

function balancize(idv, env) {
	if (idv.unbalanced) {
		return env.balance(idv.gene);
	} else {
		return idv.gene;
	}
}

function uncollide(yInit, env, terminalStrictness, scale, allowUnbalanced) {
	if (!yInit.length) return yInit;
	const n = yInit.length;
	const avails = env.avails;
	let y0 = [];
	for (let j = 0; j < n; j++) {
		y0[j] = xclamp(avails[j].low, Math.round(yInit[j]), avails[j].high);
	}
	let population = populate(y0, env, scale, allowUnbalanced);
	// Hall of fame
	let best = selectElite(population);
	// "no-improvement" generations
	let steadyStages = 0;
	// Build a swapchain
	let p = population,
		q = [...population];

	// Start evolution
	for (let s = 0; s < env.strategy.EVOLUTION_STAGES; s++) {
		population = evolve(p, q, !(s % 2), env, allowUnbalanced);
		let elite = selectElite(population);
		if (elite.better(best)) {
			steadyStages = 0;
			best = elite;
		} else {
			steadyStages += 1;
		}
		if (steadyStages > terminalStrictness) {
			break;
		}
	}

	return balancize(best, env);
	// return balancize(selectElite(populate(g, env, scale, allowUnbalanced)), env);
}

module.exports = uncollide;
