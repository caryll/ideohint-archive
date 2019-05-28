"use strict"

function pushargs(tt) {
	var vals = [];
	for (var j = 1; j < arguments.length; j++) vals = vals.concat(arguments[j]);
	if (!vals.length) return;
	var datatype = 'B';
	var shortpush = vals.length <= 8;
	for (var j = 0; j < vals.length; j++) if (vals[j] < 0 || vals[j] > 255) datatype = 'W';
	if (shortpush) {
		tt.push('PUSH' + datatype + '_' + vals.length);
		for (var j = 0; j < vals.length; j++) tt.push(vals[j])
	} else if (vals.length < 250) {
		tt.push('NPUSH' + datatype);
		tt.push(vals.length);
		for (var j = 0; j < vals.length; j++) tt.push(vals[j])
	}
};
function invokesToInstrs(invocations, limit) {
	var stackSofar = [];
	var actionsSofar = [];
	var instrs = [];
	for (var j = 0; j < invocations.length; j++) {
		var arg = invocations[j][0];
		var action = invocations[j][1];
		if (stackSofar.length + arg.length > limit) {
			pushargs(instrs, stackSofar);
			instrs = instrs.concat(actionsSofar);
			stackSofar = [];
			actionsSofar = [];
		}
		stackSofar = arg.concat(stackSofar);
		actionsSofar = actionsSofar.concat(action);
	};
	pushargs(instrs, stackSofar);
	instrs = instrs.concat(actionsSofar);
	return instrs;
}
function pushInvokes(tt, invocations, STACK_DEPTH) {
	var invokeInstrs = invokesToInstrs(invocations, STACK_DEPTH);
	for (var j = 0; j < invokeInstrs.length; j++) {
		tt.push(invokeInstrs[j])
	}
	invocations.length = 0;
}

exports.pushargs = pushargs;
exports.invokesToInstrs = invokesToInstrs;
exports.pushInvokes = pushInvokes;