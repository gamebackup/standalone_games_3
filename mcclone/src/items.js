import { blockData, blockIds } from './blocks.js'
import { recipes, textureMap, win } from './state.js'

const BASE_MASK = 0x3ff
const MAX_STACK = 64
const ITEM_ID_BASE = 0x2000

let itemData = []
let itemIds = {}

function defineItem(data) {
	let id = ITEM_ID_BASE + itemData.length
	itemData.push(data)
	itemIds[data.name] = id
	return id
}

function isItem(id) { return id >= ITEM_ID_BASE }
function itemDef(id) { return itemData[id - ITEM_ID_BASE] }
function itemName(id) { let d = itemDef(id); return d ? d.name : undefined }
function itemTexture(id) { let d = itemDef(id); return d ? d.texture : undefined }
function itemStack(id) { let d = itemDef(id); return d ? (d.stack === undefined ? 64 : d.stack) : 1 }

defineItem({ name: "bucket", texture: "bucket", stack: 16, behavior: "bucket", bucketType: "empty" })
defineItem({ name: "waterBucket", texture: "waterBucket", stack: 1, behavior: "bucket", bucketType: "water" })
defineItem({ name: "lavaBucket", texture: "lavaBucket", stack: 1, behavior: "bucket", bucketType: "lava" })
defineItem({ name: "coal", texture: "coal", stack: 64 })
defineItem({ name: "ironIngot", texture: "ironIngot", stack: 64 })
defineItem({ name: "goldIngot", texture: "goldIngot", stack: 64 })
defineItem({ name: "diamond", texture: "diamond", stack: 64 })
defineItem({ name: "stick", texture: "stick", stack: 64 })

const TOOL_TIERS = ["wooden", "stone", "iron", "golden", "diamond", "netherite"]
const TOOL_KINDS = ["pickaxe", "axe", "shovel", "sword", "hoe"]
for (let t of TOOL_TIERS) {
	for (let o of TOOL_KINDS) {
		let n = t + o[0].toUpperCase() + o.slice(1)
		defineItem({ name: n, texture: n, stack: 1, behavior: "tool", tool: o, tier: t })
	}
}

const FOODS = { apple: 4, bread: 5, carrot: 3, potato: 1, bakedPotato: 5, goldenApple: 4, melonSlice: 2 }
for (let name in FOODS) defineItem({ name: name, texture: name, stack: 64, behavior: "food", food: FOODS[name] })

defineItem({ name: "wheat", texture: "wheat", stack: 64 })
defineItem({ name: "wheatSeeds", texture: "wheatSeeds", stack: 64 })
defineItem({ name: "sugar", texture: "sugar", stack: 64 })

for (let name of ["rawIron", "rawCopper", "rawGold", "copperIngot", "charcoal", "emerald", "lapisLazuli", "redstone", "quartz", "netheriteIngot", "netheriteScrap", "flint", "string", "gunpowder", "bone", "clayBall", "brick", "feather", "leather", "egg", "glowstoneDust", "paper", "book", "slimeBall"]) {
	defineItem({ name: name, texture: name, stack: 64 })
}

defineItem({ name: "flintAndSteel", texture: "flintAndSteel", stack: 1, behavior: "igniter" })

function idIsItem(id) { return isItem(id) }
function idTexture(id) {
	if (isItem(id)) return itemTexture(id)
	let b = blockData[id & BASE_MASK]
	return b ? (b.textures ? b.textures[0] : b.name) : undefined
}
function idStack(id) { return isItem(id) ? itemStack(id) : MAX_STACK }
function idAtlasSlot(id) { let t = idTexture(id); return t === undefined ? undefined : textureMap[t] }

if (win) {
	win.itemData = itemData
	win.itemIds = itemIds
	win.isItem = isItem
	win.itemName = itemName
	win.itemTexture = itemTexture
	win.itemStack = itemStack
	win.idIsItem = idIsItem
	win.idTexture = idTexture
	win.idStack = idStack
	win.idAtlasSlot = idAtlasSlot
}

const blockDrops = {
	grass: "dirt", leaves: "dirt", altLeaves: "dirt", grassLeaves: "dirt",
	stone: "cobblestone", deepslate: "cobbledDeepslate",
	coalOre: "coal", deepslateCoalOre: "coal",
	ironOre: "rawIron", deepslateIronOre: "rawIron",
	copperOre: "rawCopper", deepslateCopperOre: "rawCopper",
	goldOre: "rawGold", deepslateGoldOre: "rawGold",
	diamondOre: "diamond", deepslateDiamondOre: "diamond",
	emeraldOre: "emerald", deepslateEmeraldOre: "emerald",
	lapisOre: "lapisLazuli", deepslateLapisOre: "lapisLazuli",
	redstoneOre: "redstone", deepslateRedstoneOre: "redstone",
	netherQuartzOre: "quartz", netherGoldOre: "goldIngot", ancientDebris: "netheriteScrap",
	oakDoor: "oakDoor", ironDoor: "ironDoor", crimsonDoor: "crimsonDoor", warpedDoor: "warpedDoor", chest: "chest",
}
for (let name in blockDrops) {
	let data = blockData[blockIds[name]]
	if (data) data.drops = blockDrops[name]
}

function idDrop(id) {
	let base = id & BASE_MASK
	let data = blockData[base]
	let name = data ? (data.drops || data.name) : undefined
	if (name && blockIds[name] !== undefined) return blockIds[name]
	if (name && itemIds[name] !== undefined) return itemIds[name]
	return base
}

// The 2x2 inventory crafting grid only supports shapeless recipes made from
// identical ingredients, so every recipe below is "N of one item -> output".
const SHAPELESS_RECIPES = [
	[ 'oakLog', 'oakPlanks', 4 ],
	[ 'acaciaLog', 'acaciaPlanks', 4 ],
	[ 'birchLog', 'birchPlanks', 4 ],
	[ 'darkOakLog', 'darkOakPlanks', 4 ],
	[ 'jungleLog', 'junglePlanks', 4 ],
	[ 'spruceLog', 'sprucePlanks', 4 ],
	[ 'cherryLog', 'cherryPlanks', 4 ],
	[ 'crimsonStem', 'crimsonPlanks', 4 ],
	[ 'warpedStem', 'warpedPlanks', 4 ],
]
for (let [ input, output, count ] of SHAPELESS_RECIPES) {
	if (blockIds[input] === undefined || blockIds[output] === undefined) continue
	recipes.push({ in: { id: blockIds[input], count: 1 }, out: { id: blockIds[output], count: count } })
}
const SHAPELESS_COUNTED = [
	[ 'cobblestone', 'stone', 1, 1 ],
	[ 'stone', 'stoneBricks', 4, 4 ],
	[ 'andesite', 'polishedAndesite', 4, 4 ],
	[ 'diorite', 'polishedDiorite', 4, 4 ],
	[ 'granite', 'polishedGranite', 4, 4 ],
	[ 'sand', 'glass', 1, 1 ],
	[ 'sand', 'sandStone', 4, 1 ],
	[ 'sandStone', 'smoothSandStone', 4, 4 ],
]
for (let [ input, output, need, count ] of SHAPELESS_COUNTED) {
	if (blockIds[input] === undefined || blockIds[output] === undefined) continue
	recipes.push({ in: { id: blockIds[input], count: need }, out: { id: blockIds[output], count: count } })
}

if (win) {
	win.blockDrops = blockDrops
	win.idDrop = idDrop
}

export {
	ITEM_ID_BASE, itemData, itemIds, defineItem, isItem, itemDef, itemName,
	itemTexture, itemStack, idIsItem, idTexture, idStack, idAtlasSlot,
	blockDrops, idDrop
}
