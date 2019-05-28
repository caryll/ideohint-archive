const monoip = require("../support/monotonic-interpolate");
const Renderer = require("./render");

// models
let config = {};
let input;
let canvas;

const render = (function() {
	var worker = null;
	function render() {
		if (worker) {
			worker.terminate();
		}
		if (!input || !input.length) return;
		worker = new Worker("./worker-hint.packed.js");
		worker.onmessage = function(message) {
			// worker = null;
			console.log(message.data);
			Renderer.renderPreview(canvas, message.data, config.strategy);
		};
		worker.postMessage({ input, strategy: config.strategy });
	}
	return render;
})();

var strategyControlTypes = {
	RISE: "VQ",
	SINK: "VQ",
	RISE_DIAGH: "VQ",
	SINK_DIAGL: "VQ",
	TOP_CUT: "VQ",
	BOTTOM_CUT: "VQ",
	TOP_CUT_DIAGH: "VQ",
	TOP_CUT_DIAG_DIST: "VQ",
	BOTTOM_CUT_DIAGL: "VQ",
	BOTTOM_CUT_DIAG_DIST: "VQ",
	GRAVITY: "VQ",
	CONCENTRATE: "VQ",
	CHEBYSHEV_4: "VQ",
	CHEBYSHEV_5: "VQ",
	CANONICAL_STEM_WIDTH: "VQ",
	CANONICAL_STEM_WIDTH_DENSE: "VQ",
	TOP_UNIFY_FORCE: "VQ",
	TOP_UNIFY_FORCE_DIAG: "VQ",
	BOTTOM_UNIFY_FORCE: "VQ",
	BOTTOM_UNIFY_FORCE_DIAG: "VQ",
	MAX_SW_OVERFLOW_CPXS: "VQ",
	MAX_SW_SHRINK_CPXS: "VQ"
};

var strategyControlGroups = [
	["UPM", "BLUEZONE_WIDTH"],
	[
		"BLUEZONE_TOP_CENTER",
		"BLUEZONE_TOP_LIMIT",
		"BLUEZONE_BOTTOM_CENTER",
		"BLUEZONE_BOTTOM_LIMIT"
	],
	[
		"TOP_CUT",
		"BOTTOM_CUT",
		"TOP_CUT_DIAGH",
		"BOTTOM_CUT_DIAGL",
		"TOP_CUT_DIAG_DIST",
		"BOTTOM_CUT_DIAG_DIST",
		"TOP_UNIFY_FORCE",
		"TOP_UNIFY_FORCE_DIAG",
		"BOTTOM_UNIFY_FORCE",
		"BOTTOM_UNIFY_FORCE_DIAG"
	],
	[
		"RISE",
		"SINK",
		"RISE_DIAGH",
		"SINK_DIAGL",
		"GRAVITY",
		"CONCENTRATE",
		"CHEBYSHEV_4",
		"CHEBYSHEV_5"
	],
	[
		"CANONICAL_STEM_WIDTH",
		"CANONICAL_STEM_WIDTH_DENSE",
		"MAX_SW_OVERFLOW_CPXS",
		"MAX_SW_SHRINK_CPXS"
	],
	[
		"STEM_SIDE_MIN_RISE",
		"STEM_SIDE_MIN_DESCENT",
		"STEM_CENTER_MIN_RISE",
		"STEM_CENTER_MIN_DESCENT",
		"STEM_SIDE_MIN_DIST_RISE",
		"STEM_SIDE_MIN_DIST_DESCENT"
	],
	[
		"ABSORPTION_LIMIT",
		"SLOPE_FUZZ",
		"SLOPE_FUZZ_R",
		"SLOPE_FUZZ_POS",
		"SLOPE_FUZZ_POST",
		"SLOPE_FUZZ_NEG",
		"Y_FUZZ",
		"Y_FUZZ_DIAG"
	]
];

let controls = {};
controls.NUMERIC = function(ol, key, strategy, initVal, callback) {
	var d = document.createElement("li");
	d.innerHTML += "<span>" + key + "</span>";
	var input = document.createElement("input");
	input.value = initVal;
	input.type = "number";

	input.onchange = function() {
		return callback(input.value - 0);
	};
	function btn(shift) {
		var button = document.createElement("button");
		button.innerHTML = shift > 0 ? "+" + shift : "-" + -shift;
		button.onclick = function() {
			input.value = input.value - 0 + shift;
			return callback(input.value - 0);
		};
		d.appendChild(button);
	}
	btn(-100), btn(-50), btn(-10), btn(-5), btn(-1), btn(-0.1);
	d.appendChild(input);
	btn(0.1), btn(1), btn(5), btn(10), btn(50), btn(100);
	ol.appendChild(d);
};
controls.VQ = function(ol, key, strategy, initVal, callback) {
	var d = document.createElement("li");
	d.className = "VQ";
	d.innerHTML += "<span>" + key + "</span>";

	let vqModel = [],
		panels = [];
	for (let j = strategy.PPEM_MIN; j <= strategy.PPEM_MAX; j++) {
		vqModel[j] = {
			focus: false,
			val: 0
		};
		let panel = document.createElement("label");
		panel.className = "vq-panel";
		panel.innerHTML += j;
		let input = document.createElement("input");
		input.value = vqModel[j].val;
		input.setAttribute("size", 1);
		input.onfocus = function(e) {
			input.value = "";
		};
		input.onchange = function() {
			vqModel[j].val = input.value - 0 || 0;
			vqModel[j].focus = true;
			update();
		};
		panel.oncontextmenu = function(e) {
			vqModel[j].focus = !vqModel[j].focus;
			e.stopPropagation();
			e.preventDefault();
			update();
		};
		panel.onwheel = function(e) {
			if (e.deltaY > 0) {
				vqModel[j].val = (input.value - 0 || 0) - 1;
				vqModel[j].focus = true;
				update();
			} else if (e.deltaY < 0) {
				vqModel[j].val = (input.value - 0 || 0) + 1;
				vqModel[j].focus = true;
				update();
			}
			e.stopPropagation();
			e.preventDefault();
		};
		panels[j] = {
			panel: panel,
			input: input
		};
		panel.appendChild(input);
		d.appendChild(panel);
	}

	if (initVal && initVal instanceof Array) {
		const f = monoip(initVal);
		for (let k of initVal)
			if (vqModel[k[0]]) {
				vqModel[k[0]].focus = true;
				vqModel[k[0]].val = f(k[0]);
			}
	} else if (typeof initVal === "number") {
		vqModel[strategy.PPEM_MIN].focus = true;
		vqModel[strategy.PPEM_MIN].val = initVal;
		vqModel[strategy.PPEM_MAX].focus = true;
		vqModel[strategy.PPEM_MAX].val = initVal;
	}

	function update(nocb, initVal) {
		let a = [];
		if (initVal && initVal instanceof Array) {
			a = [...initVal];
			for (let j = strategy.PPEM_MIN; j <= strategy.PPEM_MAX; j++) {
				panels[j].input.className = vqModel[j].focus ? "focus" : "interpolated";
			}
		} else {
			for (let j = strategy.PPEM_MIN; j <= strategy.PPEM_MAX; j++) {
				if (vqModel[j].focus) a.push([j, vqModel[j].val || 0]);
				panels[j].input.className = vqModel[j].focus ? "focus" : "interpolated";
			}
		}
		const f = monoip(a);
		for (let j = strategy.PPEM_MIN; j <= strategy.PPEM_MAX; j++) {
			panels[j].input.value = vqModel[j].val = Math.round(f(j));
		}
		if (!nocb) {
			setTimeout(function() {
				callback(a);
			}, 0);
		}
	}
	ol.appendChild(d);
	update(true, initVal);
};

function createAdjusters() {
	var container = document.getElementById("adjusters");
	saveloadpanels: {
		const table = document.createElement("table");
		const tr = document.createElement("tr");
		savebutton: {
			const pane = document.createElement("td");
			pane.className = "saver pane";
			const save = document.createElement("button");
			save.innerHTML = "Save Parameters";
			save.onclick = function(e) {
				let buf = ["[hinting]"];
				for (let k in config.strategy) {
					if (config.strategy[k] !== config.defaultStrategy[k] && k !== "gears") {
						buf.push(k + " = " + JSON.stringify(config.strategy[k]));
					}
				}
				$.post(
					"/save",
					{
						to: config.paramPath,
						content: buf.join("\n")
					},
					function() {}
				);
				e.preventDefault();
				e.stopPropagation();
			};
			pane.appendChild(save);
			pane.appendChild(document.createTextNode(" → " + config.paramPath));
			tr.appendChild(pane);
		}
		initLoadButton: {
			const pane = document.createElement("td");
			pane.className = "loader pane";

			const chars = document.createElement("input");
			chars.value = config.w;
			const load = document.createElement("button");
			load.innerHTML = "Load Sample";
			load.onclick = function(e) {
				loadSamples(chars.value);
				e.preventDefault();
				e.stopPropagation();
			};
			pane.appendChild(chars);
			pane.appendChild(load);
			tr.appendChild(pane);
		}
		table.appendChild(tr);
		container.appendChild(table);
	}
	// parameter controllers
	for (var g = 0; g < strategyControlGroups.length; g++) {
		var ol = document.createElement("ol");
		for (var j = 0; j < strategyControlGroups[g].length; j++) {
			const key = strategyControlGroups[g][j];
			const keyType = strategyControlTypes[key] || "NUMERIC";
			controls[keyType](ol, key, config.strategy, config.strategy[key], function(x) {
				config.strategy[key] = x;
				setTimeout(render, 0);
			});
		}
		container.appendChild(ol);
	}
}

function loadSamples(w) {
	Renderer.renderLoading(canvas);
	$.getJSON(
		"/chars?w=" + encodeURIComponent(w) + "&f=" + encodeURIComponent(config.input),
		function(data) {
			input = data.filter(x => x);
			Renderer.clean(canvas);
			setTimeout(render, 0);
		}
	);
}

$.getJSON("/config", function(conf) {
	config = conf;
	canvas = document.getElementById("preview");
	createAdjusters();
	loadSamples(config.w);
});
