const PROGRESS_LENGTH = 32;

function pad(s, p, n) {
	s = "" + s;
	while (s.length < n) s = p + s;
	return s;
}

function progressbar(u, len) {
	var buf = "";
	for (var j = 1; j <= len; j++) {
		buf += j > u * len ? " " : "#";
	}
	return buf;
}

function showProgressBar(name, currentProgress, j, n, lastUpdateTime) {
	const pb = progressbar(j / n, PROGRESS_LENGTH);
	const now = new Date();
	if (j === n || (pb !== currentProgress && now - lastUpdateTime > 2048)) {
		process.stderr.write(
			"[" + pb + "](#" + pad(j, " ", 5) + "/" + pad(n, " ", 5) + ")" + " of " + name + "\n"
		);
		lastUpdateTime = now;
	}
	return [pb, lastUpdateTime];
}

exports.progress = function progressForEach(name, items, fn) {
	let currentProgress = progressbar(0, PROGRESS_LENGTH);
	let lastUpdateTime = new Date();
	for (let j = 0; j < items.length; j++) {
		fn(items[j], j);
		[currentProgress, lastUpdateTime] = showProgressBar(
			name,
			currentProgress,
			j,
			items.length,
			lastUpdateTime
		);
	}
	currentProgress = showProgressBar(name, currentProgress, items.length, items.length);
};
