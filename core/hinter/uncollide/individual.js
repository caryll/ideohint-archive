"use strict";

const DIAG_BIAS_PIXELS = 1 / 6;
const DIAG_BIAS_PIXELS_NEG = 0.35;
const REALLY_FLAT = 1 / 10;
const PRETTY_FLAT = 1 / 3;
const NOT_REALLY_FLAT = 4 / 5;
const SLIGHTLY_SLANTED = 6 / 5;
const ABLATION_MARK = 1 / 65536;

function twoPartsOfDiag(aa, ab) {
	return aa.rid && aa.rid === ab.rid;
}

class Individual {
	constructor(y, env, unbalanced) {
		if (y) {
			this.gene = y;
			this.unbalanced = unbalanced;
			this.collidePotential =
				this.getCollidePotential(env) + this.getSevereDistortionPotential(env);
			this.ablationPotential = this.getAblationPotential(env);
		}
	}
	clone() {
		let idv = new Individual();
		idv.gene = [...this.gene];
		idv.unbalanced = this.unbalanced;
		idv.collidePotential = this.collidePotential;
		idv.ablationPotential = this.ablationPotential;
		return idv;
	}
	getFitness() {
		return (
			1 / (1 + Math.max(0, this.collidePotential + this.ablationPotential * ABLATION_MARK))
		);
	}
	compare(that) {
		if (this.collidePotential < that.collidePotential) return 1;
		if (this.collidePotential > that.collidePotential) return -1;
		if (this.ablationPotential < that.ablationPotential) return 1;
		if (this.ablationPotential > that.ablationPotential) return -1;
		return 0;
	}
	better(that) {
		return this.compare(that) > 0;
	}

	getCollidePotential(env) {
		const y = this.gene,
			A = env.A,
			C = env.C,
			F = env.F,
			S = env.S,
			n = y.length,
			avails = env.avails,
			ppem = env.ppem,
			sol = env.stemOverlapLengths,
			dov = env.directOverlaps;
		let nCol = 0;
		let pA = 0,
			pC = 0,
			pB = 0;
		for (let j = 0; j < n; j++) {
			const aj = avails[j];
			for (let k = 0; k < j; k++) {
				const ak = avails[k];
				if (dov[j][k] && F[j][k] > 4 && y[j] <= 1 + y[k] + aj.properWidth) {
					const d = 2 - (y[j] - aj.properWidth - y[k]);
					pC += C[j][k] * d * d; // Collide
					if (C[j][k]) nCol += sol[j][k] * ppem * ppem * 0.04;
				}
				if (
					Math.abs(aj.y0px - ak.y0px) < 1 / 4 &&
					y[j] !== y[k] &&
					aj.atGlyphTop &&
					ak.atGlyphTop &&
					!twoPartsOfDiag(aj, ak)
				) {
					pB += S[j][k];
				}
				if (y[j] === y[k]) {
					pA += A[j][k]; // Annexation
				} else if (y[j] <= y[k] + aj.properWidth) {
					const d = 1 - (y[j] - aj.properWidth - y[k]);
					pC += C[j][k] * d * d * (dov[j][k] ? 1 : 1 / 10); // Collide
					if (C[j][k]) {
						nCol += sol[j][k] * ppem * ppem * 0.04;
					}
				}
			}
		}
		return pA + pC * nCol * nCol + pB;
	}

	getSevereDistortionPotential(env) {
		return (
			this._getSevereOversepP(env, true) +
			this._getTripletBreakP(env, true) +
			this._getDiagonalBreakP(env) +
			this._getSwapAndSymBreakP(env) +
			this._getSoftBreakP(env) +
			this._getShiftP(env, 1 / 3)
		);
	}
	_getSevereOversepP(env, severe) {
		const y = this.gene,
			avails = env.avails,
			n = y.length,
			D = env.D,
			P = env.P,
			bpx = env.glyphBottomPixels,
			dov = env.directOverlaps;

		let nA = 0;
		for (let j = 0; j < n; j++) {
			for (let k = 0; k < j; k++) {
				if (y[j] === y[k]) nA += D[j][k];
			}
		}
		const severeCoeff = 100 + 10000 * nA;
		const nonSevereCoeff = severe ? 0 : 1;
		let p = 0;
		// Overseparation of bottommost strokes

		for (let j = 0; j < n; j++) {
			if (avails[j].hasGlyphStemAbove) continue;
			const d = y[j] - avails[j].properWidth - bpx;
			const d0 = avails[j].y0px - Math.max(avails[j].w0px, 1) - bpx;
			if (d > 0 && d0 > 0.25 && d > d0) {
				const sep =
					avails[j].plength /
					(1 + avails[j].plength) *
					(d / d0 - 1) *
					(d / d0 - 1) *
					(12 / env.ppem);
				p += sep * (severe && d >= 1.75 * d0 ? severeCoeff : nonSevereCoeff);
			}
		}
		// Overseparation of di-strokes
		for (let j = 0; j < n; j++) {
			for (let k = 0; k < j; k++) {
				if (!dov[j][k]) continue;
				const d = y[j] - avails[j].properWidth - y[k];
				const d0 = avails[j].y0px - Math.max(avails[j].w0px, 1) - avails[k].y0px;
				if (d > 0 && d0 > 0 && d > d0) {
					// Severely separated or compressed
					// Treat as a collision
					const sep = D[j][k] / (1 + P[j][k]) * (d - d0) * (d - d0);
					p += sep * (severe && d >= 1.75 * d0 && d > 1 ? severeCoeff : 1);
				} else if (d > 0 && d0 > 0 && d0 > d) {
					const compress = D[j][k] * (1 + P[j][k]) * (d - d0) * (d - d0);
					p += compress * (severe && d0 >= 2 * d && d0 > 0.75 ? severeCoeff : 1);
				}
			}
		}
		return p;
	}
	_measureTripletDistort(d1, d2, spacejk, spacekw, adjust, severe) {
		let p = 0;
		let pS = 0;
		const finelimit = 1 / 8;
		const dlimit = 1 / 3;
		const dlimitx = 2 / 3;
		const compressLimit = 3 / 4;

		const d = d1 - d2;
		const expanded = spacejk > d1 + compressLimit && spacekw > d2 + compressLimit;
		const compressed = spacejk < d1 - compressLimit && spacekw < d2 - compressLimit;
		if (
			(d >= dlimitx && spacejk <= spacekw) ||
			(d >= dlimit && spacejk < spacekw) ||
			(d <= -dlimitx && spacejk >= spacekw) ||
			(d <= -dlimit && spacejk > spacekw) ||
			(d < dlimit && d > -dlimit && (spacejk - spacekw > 1 || spacejk - spacekw < -1)) ||
			(d < dlimit && d > -dlimit && (compressed || expanded))
		) {
			p += adjust;
		}
		if (d < finelimit && d > -finelimit && spacejk !== spacekw) {
			p += adjust / 3;
			if (spacejk >= 2.25 * spacekw || spacekw >= 2.25 * spacejk) {
				pS += adjust * 64;
			}
		}
		if (spacejk + spacekw < 0.6 * (d1 + d2)) {
			p += adjust * 64;
		}
		if ((spacejk + spacekw) * 0.6 > d1 + d2) {
			p += adjust * 64;
		}
		if (severe) {
			return pS;
		} else {
			return p;
		}
	}

	_getTripletBreakP(env, severe) {
		if (env.noAblation) return 0;

		const y = this.gene,
			avails = env.avails,
			triplets = env.triplets,
			quartlets = env.quartlets,
			D = env.D;

		let p = 0;

		// Triplet distortion
		for (let _t = 0; _t < triplets.length; _t++) {
			const [j, k, w] = triplets[_t];
			if (!(y[j] > y[k] && y[k] > y[w])) continue;
			p += this._measureTripletDistort(
				avails[j].y0px - avails[j].w0px - avails[k].y0px,
				avails[k].y0px - avails[k].w0px - avails[w].y0px,
				y[j] - y[k] - avails[j].properWidth,
				y[k] - y[w] - avails[k].properWidth,
				(D[j][k] + D[k][w]) / 2,
				severe
			);
		}
		for (let _t = 0; _t < quartlets.length; _t++) {
			const t = quartlets[_t];
			const j = t[0],
				k = t[1],
				m = t[2],
				w = t[3];
			p += this._measureTripletDistort(
				avails[j].y0px - avails[j].w0px - avails[k].y0px,
				avails[m].y0px - avails[m].w0px - avails[w].y0px,
				y[j] - y[k] - avails[j].properWidth,
				y[m] - y[w] - avails[m].properWidth,
				(D[j][k] + D[m][w]) / 2,
				severe
			);
		}
		return p;
	}
	_getDiagonalBreakP(env) {
		const y = this.gene,
			avails = env.avails,
			n = y.length,
			C = env.C,
			S = env.S;
		let p = 0;
		// Diagonal break
		for (let j = 0; j < n; j++) {
			if (!avails[j].rid) continue;
			for (let k = 0; k < j; k++) {
				if (avails[j].rid !== avails[k].rid) continue;
				if (
					y[j] - y[k] > avails[j].y0px - avails[k].y0px + DIAG_BIAS_PIXELS ||
					y[j] - y[k] < avails[j].y0px - avails[k].y0px - DIAG_BIAS_PIXELS_NEG
				) {
					p += C[j][k]; // diagonal break
				}
				if (
					(y[j] > y[k] &&
						avails[j].y0px - avails[k].y0px <
							(avails[j].hasGlyphStemBelow || avails[k].hasGlyphStemBelow
								? PRETTY_FLAT
								: REALLY_FLAT)) ||
					(y[j] <= y[k] && avails[j].y0px - avails[k].y0px > NOT_REALLY_FLAT) ||
					(y[j] > y[k] + 1 && avails[j].y0px - avails[k].y0px < SLIGHTLY_SLANTED)
				) {
					p += S[j][k]; // severely broken!
				}
			}
		}
		return p;
	}
	_getSwapAndSymBreakP(env) {
		const y = this.gene,
			avails = env.avails,
			n = y.length,
			S = env.S,
			sym = env.symmetry;
		let p = 0;
		for (let j = 0; j < n; j++) {
			for (let k = 0; k < j; k++) {
				if (j !== k && sym[j][k]) {
					if (y[j] !== y[k]) {
						p += S[j][k]; // Symmetry break
					}
				} else {
					if (y[j] < y[k]) {
						p += S[j][k]; // Swap
					} else if (
						((!avails[j].hasGlyphStemAbove && !avails[k].hasGlyphStemAbove) ||
							(!avails[j].hasGlyphStemBelow && !avails[k].hasGlyphStemBelow)) &&
						avails[j].y0 - avails[j].w0 < avails[k].y0 &&
						!(avails[j].rid && avails[j].rid === avails[k].rid) &&
						(avails[j].properWidth > 1
							? y[j] - avails[j].properWidth >= y[k]
							: y[j] - avails[j].properWidth > y[k])
					) {
						// Swap
						// higher stroke being too high for original outline designed like this ↓
						// ------.
						//       |   ,-------
						// ------'   |
						//           `-------
						p += S[j][k];
					}
				}
			}
		}
		return p;
	}
	_getSoftBreakP(env) {
		const y = this.gene,
			avails = env.avails,
			n = y.length;
		let p = 0;
		for (let j = 0; j < n; j++) {
			if (y[j] < avails[j].softLow) {
				p += env.strategy.COEFF_C_MULTIPLIER * env.strategy.COEFF_C_FEATURE_LOSS;
			}
		}
		return p;
	}

	getAblationPotential(env) {
		return (
			this._getSevereOversepP(env, false) +
			this._getTripletBreakP(env) +
			this._getShiftP(env, 0)
		);
	}

	_getShiftP(env, bias) {
		let p = 0;
		const avails = env.avails,
			y = this.gene,
			n = y.length;
		for (let j = 0; j < n; j++) {
			p += Math.max(0, (y[j] - avails[j].center) * (y[j] - avails[j].center) - bias);
		}
		return p;
	}
}

module.exports = Individual;
