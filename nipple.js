var fs = require("fs");
var util = require("util");

util.inspect.defaultOptions.depth = 100;
util.inspect.defaultOptions.maxArrayLength = 1000000;

function delim(delim, filename, keys) {
	let contents = fs.readFileSync(filename, { encoding: "utf8" });
	let table = contents.split("\n").map(l => l.split(delim));
	if (keys === true) {
		keys = table[0];
		table = table.slice(1);
	}
	if (keys) {
		return table.map(r => {
			var o = {};
			keys.forEach((k, i) => {
				o[k] = r[i];
			});
			return o;
		});
	}
	return table;
}

//csv(filename) [][]String
//csv(filename, [head,ers]) []{head,ers}
//csv(filename, true) []{head,ers,in,file}
global.csv = (filename, keys) => delim(",", filename, keys);
global.tsv = (filename, keys) => delim("\t", filename, keys);
global.json = filename => JSON.parse(fs.readFileSync(filename));

global.jsonDir = dirname => {
	var out = [];
	fs.readdirSync(dirname, { withFileTypes: true })
		.filter(di => di.isFile())
		.forEach(di => {
			var f = json(dirname + "/" + di.name);
			var id = ~~(/(.*)\.json/.exec(di.name)[1]);
			out[id] = f;
		});
	return out;
}

function lazyGlobalDir(name, fn) {
	var lazy;
	Object.defineProperty(global, name, {
		get: function () {
			if (lazy === undefined) {
				lazy = fn()
			}
			return lazy;
		},
	});
}

lazyGlobalDir("objs", () => jsonDir("object_defs"));
lazyGlobalDir("npcs", () => jsonDir("npc_defs"));
lazyGlobalDir("items", () => jsonDir("item_defs"));
lazyGlobalDir("models", () => jsonDir("models"));
lazyGlobalDir("enums", () => jsonDir("enums"));
lazyGlobalDir("structs", () => jsonDir("structs"));

function formatInterface() {
	var out = {};
	Object.keys(this).forEach(k => {
		if (k === util.inspect.custom) return;
		switch (k) {
			case "id":
				var w = wid(this.id);
				out.id = w[0] + ":" + w[1];
				break;
			default:
				if (k.endsWith("Listener") && Array.isArray(this[k])) {
					out[k] = this[k].map(iv => {
						var v = formatScriptArg(iv);
						if (Array.isArray(v)) {
							return v[0] + ":" + v[1];
						}
						return v;
					});
				} else {
					out[k] = this[k];
				}
		}
	});
	return out;
}
lazyGlobalDir("interfaces", () => {
	return fs.readdirSync("interface_defs", { withFileTypes: true })
		.filter(di => di.isDirectory())
		.map(di => jsonDir("interface_defs/" + di.name)
			.map(i => {
				i[util.inspect.custom] = formatInterface;
				return i;
			})
		).sort((a, b) => a[0].id - b[0].id);
});
lazyGlobalDir("widgets", () => [].concat.apply([], interfaces));

global.filterKeys = function (array) {
	if (!Array.isArray(array)) {
		array = [...arguments];
	}
	return function (i) {
		var o = {};
		array.forEach(k => {
			if (i[k] !== undefined) {
				o[k] = i[k];
			}
		});
		if (i[util.inspect.custom]) {
			o[util.inspect.custom] = i[util.inspect.custom];
		}
		return o;
	};
}
global.varyingKeys = function (v, i, o) {
	var filterFn;
	return (v, i, o) => {
		if (o.length <= 1) {
			return {};
		}
		if (!filterFn) {
			var keys = {};
			for (var i = 0; i < o.length; i++) {
				var n = (i + 1) % o.length;
				Object.keys(o[i])
					.filter(k => !Object.is(o[i][k], o[n][k]))
					.forEach(k => keys[k] = true);
			}
			filterFn = filterKeys(Object.keys(keys));
		}
		return filterFn(v, i, o);
	}
}

global.write = (filename, data) => fs.writeFileSync(filename, data);
global.writeJSON = (filename, data) => write(filename, JSON.stringify(data, null, "  "));

global.constify = str => {
	if (!str) return "NULL";
	str = str.toUpperCase()
		.replace(/ /g, '_')
		.replace(/[^A-Z0-9_]/g, "");
	if (!str) return "NULL";
	if (/^[0-9]/.test(str)) str = "_" + str;
	return str;
}

global.constifyArray = array => {
	var used = {};
	var names = {};
	array.forEach(o => {
		var p = constify(o);
		if (used[p] !== undefined) {
			p = p + "_" + o.id;
		}
		used[p] = true;
		names[o.id] = p;
	});
	return id => names[id];
};

global.wid = (g, c) => c === undefined ? [g >>> 16, g & 0xFFFF] : (g << 16) | c;

var scriptEventTypes = {
	MOUSE_X: -2147483647,
	MOUSE_Y: -2147483646,
	MENU_OP: -2147483644,
	WIDGET_ID: -2147483645,
	WIDGET_INDEX: -2147483643,
	WIDGET_TARGET_ID: -2147483642,
	WIDGET_TARGET_INDEX: -2147483641,
	KEY_CODE: -2147483640,
	KEY_CHAR: -2147483639,
};
var scriptEventLookup = {};
Object.keys(scriptEventTypes).forEach(k => scriptEventLookup[scriptEventTypes[k]] = "^" + k);

global.formatScriptArg = a => {
	if (Array.isArray(a)) {
		return a.map(formatScriptArg);
	}

	if (scriptEventLookup[a]) {
		return scriptEventLookup[a];
	}

	if ((~~a) == a && (a & 0xFFFF) != a) {
		var w = wid(a);
		if (w[0] < 1000 && w[1] < 1000) {
			return w;
		}
	}

	return a;
};
