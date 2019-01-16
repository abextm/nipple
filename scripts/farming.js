var patchImplPath = "C:/Users/Abex/Documents/runelite/runelite-client/src/main/java/net/runelite/client/plugins/timetracking/farming/PatchImplementation.java"
// Impl > base multiloc id
var genImpl = {
	BELLADONNA: { objID: 7572, tab: "SPECIAL" },
	MUSHROOM: { objID: 8337, tab: "SPECIAL" },
	CELASTRUS: { objID: 34629, tab: "SPECIAL" },
	HESPORI: { objID: 34630, tab: "SPECIAL" },
	ALLOTMENT: { objID: 33694 },
	HERB: { objID: 33979 },
	FLOWER: { objID: 33649 },
	BUSH: { objID: 34006 },
	FRUIT_TREE: { objID: 34007 },
	HOPS: { objID: 8173 },
	TREE: { objID: 33732 },
	HARDWOOD_TREE: { objID: 30481, tab: "TREE", name: "Hardwood Trees" },
	REDWOOD: { objID: 34055, tab: "TREE", altObjIDs: [34056], name: "Redwood Trees" },
	SPIRIT_TREE: { objID: 33733, tab: "TREE", name: "Spirit Trees" },
	ANIMA: anima,
	CACTUS: { objID: 33761, tab: "SPECIAL", name: "Cactus" },
	SEAWEED: { objID: 30500, tab: "SPECIAL", name: "Seaweed" },
	CALQUAT: { objID: 7807, tab: "FRUIT_TREE", name: "Calquat" },
	GRAPES: grapes,
};
// Notes:
// - Grapes are completely nonworking with this because they don't do anything normally
// - Same with the Anima patch
// - Herbs transmit data for each herb type (except when dead), but the objids don't change
//   so I planted every one and got the id of one stage and guessed the rest. Nobody has complained
//   so its probably right
// - Redwoods generate incorrectly because they also contain state for cutting them
// - Willows generate incorrectly because they have a bunch of extra states for some reason
// - Dead and Diseased snape grass generate wrong because they are fragmented

var itemOverrides = {
	"CABBAGES": "CABBAGE",
	"WATERMELONS": "WATERMELON",
	"POTATOES": "POTATO",
	"POATO_CACTUS": "POTATO_CACTUS",
	"ONIONS": "ONION",
	"BITTERCAP_MUSHROOMS": "MUSHROOM",
	"POISON_IVY_BUSH": "POISON_IVY",
	"CALQUAT": "CALQUAT",
	"JUTE": "JUTE",
	"TREE_STUMP": "_previous_",
	"CALQUAT_TREE": "CALQUAT",
};

var herbs = ["GUAM", "MARRENTILL", "TARROMIN", "HARRALANDER", "RANARR", "TOADFLAX", "IRIT",
	"AVANTOE", "KWUARM", "SNAPDRAGON", "CADANTINE", "LANTADYME", "DWARF_WEED", "TORSTOL",
	"GOUTWEED"];

Array.prototype.flatMap = function (f) {
	return this.map(f).reduce((x, y) => x.concat(y), []);
};

var containsAnySubstring = (...substring) => str => substring.some(s => str.indexOf(s) != -1);
var stripName = n => n.replace(/s$| (seedling|seed|sapling|tree|plant)s?/i, "").toLowerCase();

// Check if the ID is incrementing, descending, or equal throughout the seq's trasmogs
// Normally sequential growth stages have sequential ids
var isIncr = seq => seq.every((o, i) => i > 0 ? seq[i - 1].id < o.id : true);
var isDecr = seq => seq.every((o, i) => i > 0 ? seq[i - 1].id > o.id : true);
var isEqual = seq => seq.every((i, _, a) => i.id == a[0].id);

var impl = Object.keys(genImpl).map(key => {
	var info = genImpl[key];

	if (typeof info === "function") {
		return info();
	}

	var baseObj = objs[info.objID];

	var getOps = seq => seq
		.flatMap(o => o.actions.filter(a => a))
		.filter(a => a)
		.concat(info.altObjIDs ? seq
			.flatMap(o => info.altObjIDs.map(ai => objs[ai].configChangeDest[o.transmogIndex]))
			.filter(i => i >= 0)
			.flatMap(i => objs[i].actions.filter(a => a))
			.filter(a => a)
			: []
		);


	var seps = [];
	var accumulator = [];
	baseObj.configChangeDest.forEach((objID, transmogIndex) => {
		if (objID == -1) {
			if (accumulator.length > 0) {
				seps.push(accumulator);
				accumulator = [];
			}
			return;
		}
		var obj = { ...objs[objID], transmogIndex: transmogIndex };

		if (accumulator.length == 0) {
			accumulator.push(obj);
			return;
		}

		if (stripName(accumulator[0].name) != stripName(obj.name)) {
			seps.push(accumulator);
			accumulator = [obj];
			return;
		}

		var seqPlus = accumulator.concat(obj);
		var ops = seqPlus.map(o => getOps([o])
			.filter(v => v)
			.filter(v => v != "Rake")
			.map(v => containsAnySubstring("Pick", "Harvest", "Chop", "Talk-to", "Clear")(v) ? "Pick" : v)
		[0]);
		var allOpsSame = ops.every((i, _, a) => i == a[0]);

		if (allOpsSame && (ops[0] == "Pick" || isIncr(seqPlus) || isDecr(seqPlus) || isEqual(seqPlus))) {
			accumulator.push(obj);
			return;
		}

		seps.push(accumulator);
		accumulator = [obj];

	});
	if (accumulator.length > 0) {
		seps.push(accumulator);
		accumulator = [];
	}

	var impl = "";
	var weeds = seps[0][0].name;
	var previousItem;
	var knownValues = {};
	var typeIdx = {};
	seps.forEach(seq => {
		var test;
		if (seq.length == 1) {
			test = `value == ${seq[0].transmogIndex}`;
		} else {
			test = `value >= ${seq[0].transmogIndex} && value <= ${seq[seq.length - 1].transmogIndex}`;
		}

		var item = seq[0].name.toUpperCase().replace(/diseased|dead/i, "").trim().replace(/ +/g, "_");
		if (seq[0].name == weeds) {
			item = "WEEDS";
		}

		item = item
			.replace("BERRY_BUSH", "BERRIES")
			.replace(/s$/, "")
			.replace(/_(HOPS|SEEDLING|SEED|PLANT)/, "")
			.replace("HARVESTED_", "")
			.replace(/(OAK|WILLOW|MAPLE|YEW|MAGIC|TEAK|MAHOGANY|REDWOOD|CELASTRUS).*/, "$1")
			.replace(/(APPLE|BANANA|ORANGE|CURRY|PINEAPPLE|PAPAYA|PALM|DRAGONFRUIT).*/, "$1");
		item = itemOverrides[item] || item;
		if (item == "_previous_") {
			item = lastItem;
		}

		var allOps = getOps(seq);
		var firstOp = allOps.find(a => a);

		var cropState = "GROWING";
		if (containsAnySubstring("Pick", "Harvest", "Chop", "Talk-to", "Clear")(firstOp)) {
			cropState = "HARVESTABLE"
		}

		if (seq[0].name.indexOf("Diseased") != -1) {
			cropState = "DISEASED"
		}
		if (seq[0].name.indexOf("Dead") != -1) {
			cropState = "DEAD"
		}

		var stage;
		var incring = isIncr(seq);
		var decring = isDecr(seq);
		var equaling = isEqual(seq);
		if (item == "WEEDS" && !equaling) {
			incring = false;
			decring = true;
		}

		var multistageHarvest = false;
		if (cropState == "HARVESTABLE" && seq.length > 1) {
			multistageHarvest = true;
			if (key == "HERB") {
				incring = false;
				decring = true;
				equaling = false;
			} else {
				incring = true;
				decring = false;
				equaling = false;
			}
		}
		if (!equaling) {
			if (decring) {
				stage = `${seq[seq.length - 1].transmogIndex} - value`;
			} else if (incring) {
				if (seq[0].trasmogIndex == 0) {
					stage = `value`
				} else {
					var v = seq[0].transmogIndex;
					if (["DISEASED", "DEAD"].indexOf(cropState) != -1) {
						// You can't have a diseased/dead plat at stage 0
						v--;
					}
					stage = `value - ${v}`;
				}
			}
		} else {
			var now = knownValues[seq[0].id];
			if (now) {
				stage = now.stage;
			} else if (seq[0].name.toLowerCase().indexOf("stump") != -1) {
				stage = 0;
			} else {
				var neg = knownValues[seq[0].id - 1];
				if (neg && neg.cropState == cropState) {
					stage = neg.stage + 1;
				} else {
					stage = 0;
				}
			}
		}
		if (!multistageHarvest) {
			for (var i = 0; i < seq.length; i++) {
				var value = seq[i].transmogIndex;
				var actual = eval(stage);
				if (knownValues[seq[i].id] && actual != knownValues[seq[i].id].stage) {
					console.log(`mismatched state: ${key}@${value}: ${actual} != ${knownValues[seq[i].id]}`);
				}
				knownValues[seq[i].id] = {
					stage: actual,
					cropState: cropState,
				};
			}
		}

		if (firstOp == "Check-health") {
			stage = `Produce.${item}.getStages() - 1`;
		}

		if (item != "WEEDS") {
			var myTypeIdx = typeIdx[cropState] = (typeIdx[cropState] || 0) + 1;
			if (item == "HERBS") {
				if (cropState != "DEAD") {
					item = herbs[myTypeIdx - 1] || item;
				} else {
					item = "ANYHERB";
				}
			}
		}
		lastItem = item;

		var names = seq.map(o => o.name).filter((v, i, a) => a.indexOf(v) == i);
		var ops = allOps.filter((v, i, a) => a.indexOf(v) == i);
		var ids = seq.map(i => i.id);

		impl += `
				if (${test})
				{
					// ${names}[${ops}] ${ids}
					return new PatchState(Produce.${item}, CropState.${cropState}, ${stage});
				}`;
	});

	return `
	${constify(key)}(Tab.${info.tab || constify(key)}, "${info.name || ""}")
		{
			@Override
			PatchState forVarbitValue(int value)
			{${impl}
				return null;
			}
		}`;
}).join(",");

write(patchImplPath, `/*
 * Copyright (c) 2019 Abex
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *     list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright notice,
 *     this list of conditions and the following disclaimer in the documentation
 *     and/or other materials provided with the distribution.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 *  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 *  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 *  ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 *  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 *  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 *  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 *  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
package net.runelite.client.plugins.timetracking.farming;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import net.runelite.client.plugins.timetracking.Tab;

@RequiredArgsConstructor
@Getter
public enum PatchImplementation
{${impl};

	abstract PatchState forVarbitValue(int value);

	private final Tab tab;

	private final String name;
}
`);

function anima() {
	return `
	ANIMA(Tab.SPECIAL, "")
		{
			@Override
			PatchState forVarbitValue(int value)
			{
				if (value >= 0 && value <= 3)
				{
					// Anima patch[Rake,Inspect,Guide] 33983,33982,33981,33980
					return new PatchState(Produce.WEEDS, CropState.GROWING, 3 - value);
				}
				if (value >= 4 && value <= 7)
				{
					// Anima patch[Rake,Inspect,Guide] 33983,33983,33983,33983
					return new PatchState(Produce.WEEDS, CropState.GROWING, 3);
				}
				if (value >= 8 && value <= 16)
				{
					// Attas plant[Inspect,Guide] 33991,33992,33993,33994,33995
					// Attas plant[Inspect,Guide] 33995,33995
					// Withering Attas plant[Inspect,Guide] 33996
					// Dead Attas plant[Clear,Inspect,Guide] 33997
					return new PatchState(Produce.ATTAS, CropState.GROWING, value - 8);
				}
				if (value >= 17 && value <= 25)
				{
					// Iasor plant[Inspect,Guide] 33984,33985,33986,33987,33988
					// Iasor plant[Inspect,Guide] 33988,33988
					// Withering Iasor plant[Inspect,Guide] 33989
					// Dead Iasor plant[Clear,Inspect,Guide] 33990
					return new PatchState(Produce.IASOR, CropState.GROWING, value - 17);
				}
				if (value >= 26 && value <= 34)
				{
					// Kronos plant[Inspect,Guide] 33999,34000,34001,34002,34003
					// Kronos plant[Inspect,Guide] 34003,34003
					// Withering Kronos plant[Inspect,Guide] 34004
					// Dead Kronos plant[Clear,Inspect,Guide] 34005
					return new PatchState(Produce.KRONOS, CropState.GROWING, value - 26);
				}
				if (value >= 35 && value <= 255)
				{
					// Anima patch[Rake,Inspect,Guide] 33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983,33983
					return new PatchState(Produce.WEEDS, CropState.GROWING, 3);
				}
				return null;
			}
		}`;
}

function grapes() {
	return `
	GRAPES(Tab.GRAPE, "")
		{
			@Override
			PatchState forVarbitValue(int value)
			{
				if (value >= 0 && value <= 1)
				{
					// Empty, empty+fertilizer
					return new PatchState(Produce.WEEDS, CropState.GROWING, 3);
				}
				if (value >= 2 && value <= 9)
				{
					return new PatchState(Produce.GRAPE, CropState.GROWING, value - 2);
				}
				if (value == 10)
				{
					return new PatchState(Produce.GRAPE, CropState.GROWING, 7);
				}
				if (value >= 11 && value <= 15)
				{
					return new PatchState(Produce.GRAPE, CropState.HARVESTABLE, value - 11);
				}
				return null;
			}
		}`;
}
