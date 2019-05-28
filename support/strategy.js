"use strict";

const DEADLY = 1e12;

class HintingStrategy {
	constructor() {
		this.FULLHINT = 0;
		this.UPM = 1000;
		this.BLUEZONE_WIDTH = 15;
		this.PPEM_MIN = 12;
		this.PPEM_MIT = 18;
		this.SPARE_PIXLS = 3;
		this.PPEM_MAX = 40;
		this.PPEM_LOCK_BOTTOM = 28;
		this.CANONICAL_STEM_WIDTH = 65;
		this.CANONICAL_STEM_WIDTH_SMALL = 65;
		this.CANONICAL_STEM_WIDTH_LARGE_ADJ = 0;
		this.CANONICAL_STEM_WIDTH_DENSE = 65;
		this.ABSORPTION_LIMIT = 65;
		this.STEM_SIDE_MIN_RISE = 40;
		this.STEM_SIDE_MIN_DESCENT = 60;
		this.STEM_CENTER_MIN_RISE = 40;
		this.STEM_CENTER_MIN_DESCENT = 60;
		this.STEM_SIDE_MIN_DIST_RISE = 30;
		this.STEM_SIDE_MIN_DIST_DESCENT = 30;
		this.BOTTOM_UNIFY_FORCE = 100;
		this.BOTTOM_UNIFY_FORCE_DIAG = 75;
		this.TOP_UNIFY_FORCE = 50;
		this.TOP_UNIFY_FORCE_DIAG = 50;
		this.SLOPE_FUZZ = 0.144;
		this.SLOPE_FUZZ_POS = 0.156;
		this.SLOPE_FUZZ_POST = 0.25;
		this.SLOPE_FUZZ_NEG = 0.075;
		this.SLOPE_FUZZ_K = 0.035;
		this.SLOPE_FUZZ_R = 0.01;
		this.SLOPE_FUZZ_P = 0.005;
		this.MINIMAL_STROKE_WIDTH_PIXELS = 0.625;
		this.MAX_SW_OVERFLOW_CPXS = 50;
		this.MAX_SW_SHRINK_CPXS = 50;
		this.X_FUZZ = 7;
		this.Y_FUZZ = 7;
		this.Y_FUZZ_DIAG = 15;
		this.BLUEZONE_BOTTOM_CENTER = -67;
		this.BLUEZONE_BOTTOM_LIMIT = -55;
		this.BLUEZONE_TOP_CENTER = 831;
		this.BLUEZONE_TOP_LIMIT = 793;
		this.POPULATION_LIMIT = 128;
		this.EVOLUTION_STAGES = 2048;
		this.STEADY_STAGES_X = 4;
		this.STEADY_STAGES_MAX = 12;
		this.CANONICAL_STEM_WIDTH_LIMIT_X = 1.5;
		this.COEFF_A_MULTIPLIER = 1;
		this.COEFF_A_SAME_RADICAL = 4000;
		this.COEFF_A_SHAPE_LOST = 25;
		this.COEFF_A_SHAPE_LOST_XX = DEADLY;
		this.COEFF_A_SHAPE_LOST_XR = DEADLY;
		this.COEFF_A_TOPBOT_MERGED = 3;
		this.COEFF_A_TOPBOT_MERGED_SR = 15;
		this.COEFF_A_FEATURE_LOSS = 1000;
		this.COEFF_A_FEATURE_LOSS_XR = 30;
		this.COEFF_A_RADICAL_MERGE = 1;
		this.COEFF_OVERSEP = 10000;
		this.COEFF_C_MULTIPLIER = 100;
		this.COEFF_C_SHAPE_LOST_XX = 250;
		this.COEFF_C_FEATURE_LOSS = 12;
		this.COEFF_C_SAME_RADICAL = 6;
		this.COEFF_S = DEADLY;
		this.COEFF_DISTORT = 5;
		this.COEFF_PBS_MIN_PROMIX = 3;
		this.COEFF_TOP_BOT_PROMIX = 5;
		this.COEFF_STRICT_TOP_BOT_PROMIX = 30;
		this.ABLATION_IN_RADICAL = 1;
		this.ABLATION_RADICAL_EDGE = 2;
		this.ABLATION_GLYPH_EDGE = 30;
		this.ABLATION_GLYPH_HARD_EDGE = 50;
		this.COEFF_PORPORTION_DISTORTION = 8;
		this.REBALANCE_PASSES = 16;
		this.MIN_OVERLAP_RATIO = 0.2;
		this.STROKE_SEGMENTS_MIN_OVERLAP = 0.0875;
		this.COLLISION_MIN_OVERLAP_RATIO = 0.15;
		this.SIDETOUCH_LIMIT = 0.05;
		this.TBST_LIMIT = 0.25;
		this.DO_SHORT_ABSORPTION = true;
		this.DONT_ADJUST_STEM_WIDTH = false;
		this.WIDTH_ALLOCATION_PASSES = 5;
		this.STACK_DEPTH = 200;
		this.PRIORITIZE_POSKEY_AT_BOTTOM = 0;
		this.RISE = 0;
		this.SINK = 0;
		this.RISE_DIAGH = 0;
		this.SINK_DIAGL = 0;
		this.GRAVITY = 0;
		this.CONCENTRATE = 0;
		this.CHEBYSHEV_4 = 0;
		this.CHEBYSHEV_5 = 0;
		this.TOP_CUT = 0;
		this.BOTTOM_CUT = 0;
		this.TOP_CUT_DIAGH = 0;
		this.BOTTOM_CUT_DIAGL = 0;
		this.TOP_CUT_DIAG_DIST = 0;
		this.BOTTOM_CUT_DIAG_DIST = 0;
		this.X_EXPAND = 0;
		this.DONT_COORDINATE_WIDTHS = 0;
		this.CLEAN_IPSA_TOL = 0.25;
	}
}

HintingStrategy.defaultStrategy = new HintingStrategy();
HintingStrategy.from = function(argv, parameterFile) {
	let strategy = new HintingStrategy();

	if (parameterFile && parameterFile.hinting) {
		for (let k in parameterFile.hinting) {
			strategy[k] = parameterFile.hinting[k];
		}
	} else {
		for (let prop in strategy) {
			if (argv[prop]) {
				strategy[prop] = isFinite(argv[prop] - 0) ? argv[prop] : strategy[prop];
			}
		}
	}
	return strategy;
};

module.exports = HintingStrategy;
