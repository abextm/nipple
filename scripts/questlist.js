// from [clientscript,questlist_init] 1350
var categories = {
	"Free Quests": 2098,
	"Members' Quests": 2099,
	"Miniquests": 2100,
}

Object.keys(categories).map(k=>{
	var eid = categories[k];
	return "//"+k+"\n"+
	enums[eid].intVals.map(sid=>constify(structs[sid].params[610])+"("+sid+", \""+structs[sid].params[610]+"\"),").join("\n")
}).join("\n\n");
