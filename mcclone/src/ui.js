import { blockData, BLOCK_COUNT, blockIds } from './blocks.js'
import {
	win, doc, gl, world, setWorld, p, p2, screen, setScreen, previousScreen, setPreviousScreen,
	gameMode, setGameMode, newWorldGameMode, setNewWorldGameMode,
	commandOpen, setCommandOpen, inventory, hitBox, invBg, setInvBg, invBgReady, setInvBgReady,
	generatedChunks, mouseX, mouseY, mouseDown, setMouseDown, width, height,
	updateHUD, setUpdateHUD, freezeFrame, setFreezeFrame, glCache, setMaxLoad, renderedChunks, setRenderedChunks,
	creativeScroll, setCreativeScroll, creativeSearch, setCreativeSearch,
	creativeSearchActive, setCreativeSearchActive, creativeDrag, setCreativeDrag,
	creativeIdsCache, setCreativeIdsCache, creativeIdsKey, setCreativeIdsKey,
	analytics, recipes, settings, setCurrentFov, holding, setHolding,
	sky, worlds, selectedWorld, setSelectedWorld, maxLoad,
	fluidsReady, setFluidsReady, superflat, setSuperflat,
	trees, setTrees, caves, setCaves, version, mainbg, dirtbg
} from './state.js'
import {
	CUBE, SLAB, STAIR, FLIP, NORTH, SOUTH, EAST, WEST, ROTATION, BASE_MASK, STATE_MASK,
	DOOR_UPPER, DOOR_OPEN, DOOR_HINGE, DOOR_FACING, TRAPDOOR_BOTTOM, TRAPDOOR_OPEN, TRAPDOOR_FACING,
	TORCH_HANGING, LIGHT_MAX, LIGHT_LIFT, MAX_STACK, DAY_LENGTH,
	blockIcons, uniformMatrix, getPointer, releasePointer, use3d
} from './engine.js'
import { isItem, itemDef, itemTexture, idIsItem, idTexture, idStack, idAtlasSlot } from './items.js'
import { BIOMES, biomeAt } from './noise.js'
import { saveToDB, deleteFromDB, defineWorld, save, World, sortChunks, initWorldsMenu } from './world.js'
import { updateDrops, updateTnts, tickFluids, placementMode } from './features.js'
import { controls, runGravity, resolveContactsAndUpdatePosition, initModelView, FOV, timeString } from './player.js'

let canvas = typeof document !== "undefined" ? document.getElementById("overlay") : null
let ctx = canvas ? canvas.getContext("2d") : null
let savebox = typeof document !== "undefined" ? document.getElementById("savebox") : null
let boxCenterTop = typeof document !== "undefined" ? document.getElementById("boxcentertop") : null
let saveDirections = typeof document !== "undefined" ? document.getElementById("savedirections") : null
let message = typeof document !== "undefined" ? document.getElementById("message") : null
let worldsDom = typeof document !== "undefined" ? document.getElementById("worlds") : null
let quota = typeof document !== "undefined" ? document.getElementById("quota") : null
let hoverbox = typeof document !== "undefined" ? document.getElementById("onhover") : null

if (typeof window !== "undefined") {
	window.canvas = canvas
	window.ctx = ctx
	window.savebox = savebox
	window.boxCenterTop = boxCenterTop
	window.saveDirections = saveDirections
	window.message = message
	window.worlds = worldsDom
	window.quota = quota
	window.hoverbox = hoverbox
	if (canvas && ctx) {
		ctx.canvas.width = window.innerWidth
		ctx.canvas.height = window.innerHeight
	}
}

	let fill = function(r, g, b) {
		if (g === undefined) {
			g = r
			b = r
		}
		ctx.fillStyle = "rgb(" + r + ", " + g + ", " + b + ")"
	}
	let stroke = function(r, g, b) {
		if (g === undefined) {
			g = r
			b = r
		}
		ctx.strokeStyle = "rgb(" + r + ", " + g + ", " + b + ")"
	}
	let line = function(x1, y1, x2, y2) {
		ctx.moveTo(x1, y1)
		ctx.lineTo(x2, y2)
	}
	function text(txt, x, y, h) {
		h = h || 0

		let lines = txt.split("\n")
		for (let i = 0; i < lines.length; i++) {
			ctx.fillText(lines[i], x, y + h * i)
		}
	}
	function textSize(size) {
		ctx.font = size + 'px Poppins' // VT323
	}
	let strokeWeight = function(num) {
		ctx.lineWidth = num
	}
	const ARROW = "arrow"
	const HAND = "pointer"
	const CROSS = "crosshair"
	let cursor = function(type) {
		canvas.style.cursor = type
	}


	let drawScreens = {
		"main menu": () => {},
		"options": () => {},
		"play": () => {},
		"pause": () => {},
		"creation menu": () => {},
		"inventory": () => {},
		"multiplayer menu": () => {},
		"comingsoon menu": () => {},
		"loadsave menu": () => {},
	}

	function startLoad() {
		p2.x = p.x; p2.y = p.y; p2.z = p.z
		setMaxLoad(world.loadFrom.length + 9)
	}

	let html = {
		pause: {
			enter: [window.message],
			exit: [window.savebox, window.saveDirections, window.message]
		},
		"loadsave menu": {
			enter: [window.worlds, window.boxCenterTop, window.quota],
			exit: [window.worlds, window.boxCenterTop, window.quota],
			onenter: () => {
				window.boxCenterTop.placeholder = "Enter Save String (Optional)"
				if (navigator && navigator.storage && navigator.storage.estimate) {
					navigator.storage.estimate().then(data => {
						window.quota.innerText = `${data.usage.toLocaleString()} / ${data.quota.toLocaleString()} bytes (${(100 * data.usage / data.quota).toLocaleString(undefined, { maximumSignificantDigits: 2 })}%) of your quota used`
					}).catch(console.error)
				}
				window.boxCenterTop.onmousedown = e => {
					let elem = document.getElementsByClassName("selected")
					if (elem && elem[0]) {
						elem[0].classList.remove("selected")
					}
					setSelectedWorld(0)
					Button.draw()
				}
			},
			onexit: () => {
				window.boxCenterTop.onmousedown = null
			}
		},
		"creation menu": {
			enter: [window.boxCenterTop],
			exit: [window.boxCenterTop],
			onenter: () => {
				window.boxCenterTop.placeholder = "Enter World Name"
				window.boxCenterTop.value = ""
			}
		},
		loading: {
			onenter: startLoad
		},
		editworld: {
			enter: [window.boxCenterTop],
			exit: [window.boxCenterTop],
			onenter: () => {
				window.boxCenterTop.placeholder = "Enter World Name"
				window.boxCenterTop.value = ""
			}
		}
	}

	function changeScene(newScene) {
		setInvBgReady(false)
		setCreativeSearchActive(false)
		setCreativeDrag(null)
		if (screen === "options") {
			saveToDB("settings", settings).catch(e => console.error(e))
		}

		if (html[screen] && html[screen].exit) {
			for (let element of html[screen].exit) {
				element.classList.add("hidden")
			}
		}

		if (html[newScene] && html[newScene].enter) {
			for (let element of html[newScene].enter) {
				element.classList.remove("hidden")
			}
		}

		if (html[newScene] && html[newScene].onenter) {
			html[newScene].onenter()
		}
		if (html[screen] && html[screen].onexit) {
			html[screen].onexit()
		}

		setPreviousScreen(screen)
		setScreen(newScene)
		setMouseDown(false)
		if (newScene === "play") {
			setFluidsReady(true)
		}
		drawScreens[screen]()
		Button.draw()
		Slider.draw()
	}


	function play() {
		if (gameMode !== "creative") {
			if (inventory.cursor) {
				addItem(inventory.cursor.id, inventory.cursor.count)
				inventory.cursor = null
			}
			updateCraftResult()
			for (let i = 0; i < 4; i++) {
				if (inventory.craft[i]) {
					addItem(inventory.craft[i].id, inventory.craft[i].count)
					inventory.craft[i] = null
				}
			}
		}
		inventory.cursor = null
		updateHolding()
		canvas.onblur()
		p.lastBreak = Date.now()
		setUpdateHUD(true)
		use3d()
		gl.clearColor(sky[0], sky[1], sky[2], 1.0)
		getPointer()
		fill(255, 255, 255)
		textSize(10)
		changeScene("play")
	}



	class Slider {
		constructor(x, y, w, h, scenes, label, min, max, settingName, callback) {
			this.x = x
			this.y = y
			this.h = h
			this.w = Math.max(w, 350)
			this.name = settingName
			this.scenes = Array.isArray(scenes) ? scenes : [scenes]
			this.label = label
			this.min = min
			this.max = max
			this.sliding = false
			this.callback = callback
		}
		draw() {
			if (!this.scenes.includes(screen)) {
				return
			}
			let current = (settings[this.name] - this.min) / (this.max - this.min)

			// Outline
			ctx.beginPath()
			strokeWeight(2)
			stroke(0)
			fill(85)
			ctx.rect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h)
			ctx.stroke()
			ctx.fill()

			// Slider bar
			let value = Math.round(settings[this.name])
			ctx.beginPath()
			fill(130)
			let x = this.x - (this.w - 10) / 2 + (this.w - 10) * current - 5
			ctx.fillRect(x, this.y - this.h / 2, 10, this.h)

			//Label
			fill(255, 255, 255)
			textSize(16)
			ctx.textAlign = 'center'
			text(`${this.label}: ${value}`, this.x, this.y + this.h / 8)
		}
		click() {
			if (!mouseDown || !this.scenes.includes(screen)) {
				return false
			}

			if (mouseX > this.x - this.w / 2 && mouseX < this.x + this.w / 2 && mouseY > this.y - this.h / 2 && mouseY < this.y + this.h / 2) {
				let current = (mouseX - this.x + this.w / 2) / this.w
				if (current < 0) current = 0
				if (current > 1) current = 1
				this.sliding = true
				settings[this.name] = current * (this.max - this.min) + this.min
				this.callback(current * (this.max - this.min) + this.min)
				this.draw()
			}
		}
		drag() {
			if (!this.sliding || !this.scenes.includes(screen)) {
				return false
			}

			let current = (mouseX - this.x + this.w / 2) / this.w
			if (current < 0) current = 0
			if (current > 1) current = 1
			settings[this.name] = current * (this.max - this.min) + this.min
			this.callback(current * (this.max - this.min) + this.min)
		}
		release() {
			this.sliding = false
		}

		static draw() {
			for (let slider of Slider.all) {
				slider.draw()
			}
		}
		static click() {
			for (let slider of Slider.all) {
				slider.click()
			}
		}
		static release() {
			for (let slider of Slider.all) {
				slider.release()
			}
		}
		static drag() {
			if (mouseDown) {
				for (let slider of Slider.all) {
					slider.drag()
				}
			}
		}
		static add(x, y, w, h, scenes, label, min, max, defaut, callback) {
			Slider.all.push(new Slider(x, y, w, h, scenes, label, min, max, defaut, callback))
		}
	}
	Slider.all = []
	class Button {
		constructor(x, y, w, h, labels, scenes, callback, disabled, hoverText) {
			this.x = x
			this.y = y
			this.h = h
			this.w = w
			this.index = 0
			this.disabled = disabled || (() => false)
			this.hoverText = !hoverText || typeof hoverText === "string" ? (() => hoverText) : hoverText
			this.scenes = Array.isArray(scenes) ? scenes : [scenes]
			this.labels = Array.isArray(labels) ? labels : [labels]
			this.callback = callback
		}

		mouseIsOver() {
			return mouseX >= this.x - this.w / 2 && mouseX <= this.x + this.w / 2 && mouseY >= this.y - this.h / 2 && mouseY <= this.y + this.h / 2
		}
		draw() {
			if (!this.scenes.includes(screen)) {
				return
			}
			let hovering = this.mouseIsOver()
			let disabled = this.disabled()
			let hoverText = this.hoverText()

			// Outline
			ctx.beginPath()
			if (hovering && !disabled) {
				strokeWeight(7)
				stroke(255)
				cursor(HAND)
			} else {
				strokeWeight(3)
				stroke(0)
			}
			if (disabled) {
				fill(60)
			} else {
				fill(120)
			}
			ctx.rect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h)
			ctx.stroke()
			ctx.fill()

			//Label
			fill(255)
			textSize(16)
			ctx.textAlign = 'center'
			text(this.labels[this.index], this.x, this.y + this.h / 8)
			
			if (hovering && hoverText) {
				hoverbox.innerText = hoverText
				hoverbox.classList.remove("hidden")
				if (mouseY < height / 2) {
					hoverbox.style.bottom = ""
					hoverbox.style.top = mouseY + 10 + "px"
				} else {
					hoverbox.style.top = ""
					hoverbox.style.bottom = height - mouseY + 10 + "px"
				}
				if (mouseX < width / 2) {
					hoverbox.style.right = ""
					hoverbox.style.left = mouseX + 10 + "px"
				} else {
					hoverbox.style.left = ""
					hoverbox.style.right = width - mouseX + 10 + "px"
				}
			}
		}
		click() {
			if (this.disabled() || !mouseDown || !this.scenes.includes(screen)) {
				return false
			}

			if (this.mouseIsOver()) {
				this.index = (this.index + 1) % this.labels.length
				this.callback(this.labels[this.index])
				return true
			}
		}

		static draw() {
			hoverbox.classList.add("hidden")
			for (let button of Button.all) {
				button.draw()
			}
		}
		static click() {
			for (let button of Button.all) {
				if (button.click()) {
					Button.draw()
					break
				}
			}
		}
		static add(x, y, w, h, labels, scenes, callback, disabled, hoverText) {
			Button.all.push(new Button(x, y, w, h, labels, scenes, callback, disabled, hoverText))
		}
	}
	Button.all = []

	var initEverything
	function initButtons() {
		Button.all = []
		Slider.all = []
		const nothing = () => false
		const always = () => true

		// Main menu buttons
		Button.add(width / 2, height / 2 - 20, 400, 40, "Singleplayer", "main menu", r => changeScene("loadsave menu"))
		Button.add(width / 2, height / 2 + 35, 400, 40, "Multiplayer", "main menu", nothing, always, "Multiplayer isn't possible at this time.")
		Button.add(width / 2, height / 2 + 90, 400, 40, "Options", "main menu", r => changeScene("options"))

		// Creation menu buttons
		Button.add(width / 2, 135, 300, 40, ["World Type: Normal", "World Type: Superflat"], "creation menu", r => setSuperflat(r === "World Type: Superflat"))
		Button.add(width / 2, 185, 300, 40, ["Trees: On", "Trees: Off"], "creation menu", r => setTrees(r === "Trees: On"), function() {
			if (superflat) {
				this.index = 1
				setTrees(false)
			}
			return superflat
		})
		Button.add(width / 2, 235, 300, 40, ["Caves: On", "Caves: Off"], "creation menu", r => setCaves(r === "Caves: On"), function() {
			if (superflat) {
				this.index = 1
				setCaves(false)
			}
			return superflat
		})
		Button.add(width / 2, 285, 300, 40, ["Game Mode: Creative", "Game Mode: Survival"], "creation menu", r => setNewWorldGameMode(r === "Game Mode: Survival" ? "survival" : "creative"), nothing, "Choose the game mode for new worlds.\n\nCreative: unlimited blocks, breaking and placing never consumes items. Press E for the full block palette.\n\nSurvival: break blocks to collect them, place blocks to spend them, and craft in the inventory with E.\n\nYou can switch anytime in-game with /gamemode creative or /gamemode survival.")
		Button.add(width / 2, 335, 300, 40, "Difficulty: Peaceful", "creation menu", nothing, always, "Coming soon\n\nPlease stop asking for mobs. Adding them will take a very long time. I know a lot of people want them, so just be patient.")
		Button.add(width / 2, height - 90, 300, 40, "Create New World", "creation menu", r => {
			setWorld(new World())
			world.id = Date.now()
			setGameMode(newWorldGameMode)
			let name = boxCenterTop.value || "World"
			let number = ""
			while(true) {
				let match = false
				for (let id in worlds) {
					if (worlds[id].name === name + number) {
						match = true
						break
					}
				}
				if (match) {
					number = number ? number + 1 : 1
				} else {
					name = name + number
					break
				}
			}
			world.name = name.replace(/;/g, "\u037e")
			win.world = world
			world.loadChunks()
			world.chunkGenQueue.sort(sortChunks)
			changeScene("loading")
		})
		Button.add(width / 2, height - 40, 300, 40, "Cancel", "creation menu", r => changeScene(previousScreen))

		// Loadsave menu buttons
		const selected = () => !selectedWorld || !worlds[selectedWorld]
		let w4 = Math.min(width / 4 - 10, 220)
		let x4 = w4 / 2 + 5
		let w2 = Math.min(width / 2 - 10, 450)
		let x2 = w2 / 2 + 5
		let mid = width / 2
		Button.add(mid - 3 * x4, height - 30, w4, 40, "Edit", "loadsave menu", r => changeScene("editworld"), () => (selected() || !worlds[selectedWorld].edited))
		Button.add(mid - x4, height - 30, w4, 40, "Delete", "loadsave menu", r => {
			if (worlds[selectedWorld] && confirm(`Are you sure you want to delete ${worlds[selectedWorld].name}?`)) {
				deleteFromDB(selectedWorld)
				window.worlds.removeChild(document.getElementById(selectedWorld))
				delete worlds[selectedWorld]
				setSelectedWorld(0)
			}
		}, () => (selected() || !worlds[selectedWorld].edited), "Delete the world forever.")
		Button.add(mid + x4, height - 30, w4, 40, "Export", "loadsave menu", r => {
			boxCenterTop.value = worlds[selectedWorld].code
		}, selected, "Export the save code into the text box above for copy/paste.")
		Button.add(mid + 3 * x4, height - 30, w4, 40, "Cancel", "loadsave menu", r => changeScene("main menu"))
		Button.add(mid - x2, height - 75, w2, 40, "Play Selected World", "loadsave menu", r => {
			setWorld(new World())
			win.world = world

			let code
			if (!selectedWorld) {
				code = boxCenterTop.value
			} else {
				let data = worlds[selectedWorld]
				if (data) {
					code = data.code
					world.id = data.id
					world.edited = data.edited
				}
			}
			
			if (code) {
				try {
					world.loadSave(code)
					world.id = world.id || Date.now()
				}
				catch(e) {
					alert("Unable to load save")
					return
				}
				changeScene("loading")
			}
		}, () => !(!selectedWorld && boxCenterTop.value) && !worlds[selectedWorld])
		Button.add(mid + x2, height - 75, w2, 40, "Create New World", "loadsave menu", r => changeScene("creation menu"))

		Button.add(mid, height / 2, w2, 40, "Save", "editworld", r => {
			let w = worlds[selectedWorld]
			w.name = boxCenterTop.value.replace(/;/g, "\u037e")
			let split = w.code.split(";")
			split[0] = w.name
			w.code = split.join(";")
			saveToDB(w.id, w).then(success => {
				initWorldsMenu()
				changeScene("loadsave menu")
			}).catch(e => console.error(e))
		})
		Button.add(mid, height / 2 + 50, w2, 40, "Back", "editworld", r => changeScene(previousScreen))

		// Pause buttons
		Button.add(width / 2, 225, 300, 40, "Resume", "pause", play)
		Button.add(width / 2, 275, 300, 40, "Options", "pause", r => changeScene("options"))
		Button.add(width / 2, 325, 300, 40, "Save", "pause", save, nothing, () => `Save the world to your computer/browser. Doesn't work in incognito.\n\nLast saved ${timeString(Date.now() - world.edited)}.`)
		Button.add(width / 2, 375, 300, 40, "Get Save Code", "pause", r => {
			savebox.classList.remove("hidden")
			saveDirections.classList.remove("hidden")
			savebox.value = world.getSaveString()
		})
		Button.add(width / 2, 425, 300, 40, "Exit Without Saving", "pause", r => {
			savebox.value = world.getSaveString()
			initWorldsMenu()
			changeScene("main menu")
		})
		
		// Options buttons
		Button.add(width / 2, 455, width / 3, 40, "Back", "options", r => changeScene(previousScreen))
		
		// Comingsoon menu buttons
		Button.add(width / 2, 395, width / 3, 40, "Back", "comingsoon menu", r => changeScene(previousScreen))

		// Multiplayer buttons
		Button.add(width / 2, 395, width / 3, 40, "¯\\_(ツ)_/¯", "multiplayer menu", r => changeScene("main menu"))

		// Settings Sliders
		Slider.add(width/2, 245, width / 3, 40, "options", "Render Distance", 1, 32, "renderDistance", val => settings.renderDistance = Math.round(val))
		Slider.add(width/2, 305, width / 3, 40, "options", "FOV", 30, 110, "fov", val => {
			p.FOV(val)
			if (world) {
				p.setDirection()
				world.render()
			}
		})
		Slider.add(width/2, 365, width / 3, 40, "options", "Mouse Sensitivity", 30, 400, "mouseSense", val => settings.mouseSense = val)
	}


	function drawIcon(x, y, id) {
		id = id < 0x400 ? (id | placementMode(id)) : id
		x =  x / (3 * height) - 0.1666 * width / height
		y = y / (3 * height) - 0.1666
		initModelView(null, x, y, 0, 0, 0)

		let buffer = blockIcons[id]
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.vertexAttribPointer(glCache.aVertex, 3, gl.FLOAT, false, 24, 0)
		gl.vertexAttribPointer(glCache.aTexture, 2, gl.FLOAT, false, 24, 12)
		gl.vertexAttribPointer(glCache.aShadow, 1, gl.FLOAT, false, 24, 20)
		gl.drawElements(gl.TRIANGLES, blockIcons.lengths[id], gl.UNSIGNED_INT, 0)
	}

	function heldStack() {
		return inventory.slots[inventory.hotbarSlot]
	}
	function updateHolding() {
		let st = heldStack()
		setHolding(st && st.count > 0 ? st.id : 0)
	}
	function addItem(id, count) {
		if (id && count > 0) {
			for (let i = 0; i < 36 && count > 0; i++) {
				let st = inventory.slots[i]
				if (st && st.id === id && st.count < MAX_STACK) {
					let add = Math.min(MAX_STACK - st.count, count)
					st.count += add
					count -= add
				}
			}
			for (let i = 0; i < 36 && count > 0; i++) {
				if (!inventory.slots[i]) {
					let add = Math.min(MAX_STACK, count)
					inventory.slots[i] = { id: id, count: add }
					count -= add
				}
			}
		}
		updateHolding()
		return count
	}
	// Middle-click picks the targeted block into the hotbar (creative-style).
	function pickBlock() {
		if (!hitBox.pos) return false
		let block = world.getBlock(hitBox.pos[0], hitBox.pos[1], hitBox.pos[2]) & BASE_MASK
		if (!block) return false
		let found = -1
		for (let i = 0; i < 36; i++) {
			if (inventory.slots[i] && inventory.slots[i].id === block) {
				found = i
				break
			}
		}
		if (found >= 0) {
			if (found < 9) {
				inventory.hotbarSlot = found
			} else {
				let tmp = inventory.slots[inventory.hotbarSlot]
				inventory.slots[inventory.hotbarSlot] = inventory.slots[found]
				inventory.slots[found] = tmp
			}
		} else {
			inventory.slots[inventory.hotbarSlot] = { id: block, count: 1 }
		}
		updateHolding()
		setUpdateHUD(true)
		return true
	}
	function invCapacity(id) {
		let cap = 0
		for (let i = 0; i < 36; i++) {
			let st = inventory.slots[i]
			if (!st) cap += MAX_STACK
			else if (st.id === id) cap += MAX_STACK - st.count
		}
		return cap
	}
	function consumeHeld(count) {
		let st = heldStack()
		if (st) {
			st.count -= count
			if (st.count <= 0) {
				inventory.slots[inventory.hotbarSlot] = null
			}
		}
		updateHolding()
	}
	function blockDrop(block) {
		block = block & BASE_MASK
		if (blockData[block] && blockData[block].liquid) {
			return 0
		}
		if (block === blockIds.grass || block === blockIds.leaves || block === blockIds.altLeaves || block === blockIds.grassLeaves) {
			return blockIds.dirt
		}
		if (block === blockIds.stone) {
			return blockIds.cobblestone
		}
		if (block === blockIds.oakDoor || block === blockIds.ironDoor || block === blockIds.crimsonDoor || block === blockIds.warpedDoor || block === blockIds.chest) {
			return block
		}
		return block
	}


	function updateCraftResult() {
		let ids = []
		for (let i = 0; i < 4; i++) {
			if (inventory.craft[i]) {
				ids.push(inventory.craft[i].id)
			}
		}
		inventory.result = null
		if (!ids.length) {
			return
		}
		let id = ids[0]
		for (let i = 1; i < ids.length; i++) {
			if (ids[i] !== id) {
				return
			}
		}
		for (let i = 0; i < recipes.length; i++) {
			if (recipes[i].in.id === id && recipes[i].in.count === ids.length) {
				inventory.result = recipes[i].out
				return
			}
		}
	}
	function consumeCraft() {
		for (let i = 0; i < 4; i++) {
			let c = inventory.craft[i]
			if (c) {
				c.count--
				if (c.count <= 0) {
					inventory.craft[i] = null
				}
			}
		}
	}
	function craftOnce() {
		updateCraftResult()
		let out = inventory.result
		if (!out) {
			return false
		}
		if (!inventory.cursor) {
			inventory.cursor = { id: out.id, count: out.count }
		} else if (inventory.cursor.id === out.id && inventory.cursor.count + out.count <= MAX_STACK) {
			inventory.cursor.count += out.count
		} else {
			return false
		}
		consumeCraft()
		updateCraftResult()
		return true
	}
	function itemName(id) {
		if (isItem(id)) {
			let d = itemDef(id)
			return d ? d.name : "Unknown"
		}
		let data = blockData[id & BASE_MASK]
		if (!data) return "Unknown"
		return data.name.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim()
	}
	function invLayout() {
		let s = inventory.size
		let pad = Math.round(s * 0.6)
		let gap = Math.round(s * 0.5)
		let panelW = 9 * s + 2 * pad
		let panelH = pad + 2 * s + gap + 3 * s + gap + s + pad
		let px = Math.round((width - panelW) / 2)
		let py = Math.round((height - panelH) / 2)
		let craftX = Math.round(px + (panelW - 2 * s) / 2)
		let craftY = py + pad
		return {
			s: s, pad: pad,
			panelX: px, panelY: py, panelW: panelW, panelH: panelH,
			craftX: craftX, craftY: craftY,
			resultX: craftX + 2 * s + gap, resultY: craftY + Math.round(s / 2),
			mainX: px + pad, mainY: craftY + 2 * s + gap,
			hotX: px + pad, hotY: craftY + 2 * s + gap + 3 * s + gap,
		}
	}
	function slotPos(l, region, index) {
		if (region === "hotbar") {
			return { x: l.hotX + index * l.s, y: l.hotY }
		}
		if (region === "main") {
			return { x: l.mainX + (index % 9) * l.s, y: l.mainY + ((index / 9) | 0) * l.s }
		}
		if (region === "craft") {
			return { x: l.craftX + (index % 2) * l.s, y: l.craftY + ((index / 2) | 0) * l.s }
		}
		return { x: l.resultX, y: l.resultY }
	}
	function slotAt(mx, my) {
		let l = invLayout()
		let s = l.s
		let inside = (x, y) => mx >= x && mx < x + s && my >= y && my < y + s
		for (let i = 0; i < 9; i++) {
			if (inside(l.hotX + i * s, l.hotY)) return { region: "hotbar", index: i }
		}
		for (let i = 0; i < 27; i++) {
			let p = slotPos(l, "main", i)
			if (inside(p.x, p.y)) return { region: "main", index: i }
		}
		for (let i = 0; i < 4; i++) {
			let p = slotPos(l, "craft", i)
			if (inside(p.x, p.y)) return { region: "craft", index: i }
		}
		if (inside(l.resultX, l.resultY)) return { region: "result" }
		return null
	}
	function getStack(ref) {
		if (!ref) return null
		if (ref.region === "hotbar") return inventory.slots[ref.index]
		if (ref.region === "main") return inventory.slots[9 + ref.index]
		if (ref.region === "craft") return inventory.craft[ref.index]
		if (ref.region === "result") return inventory.result
		return null
	}
	function setStack(ref, stack) {
		if (!ref) return
		if (ref.region === "hotbar") inventory.slots[ref.index] = stack
		else if (ref.region === "main") inventory.slots[9 + ref.index] = stack
		else if (ref.region === "craft") inventory.craft[ref.index] = stack
	}
	function stackIntoRange(id, count, start, end) {
		for (let i = start; i < end && count > 0; i++) {
			let st = inventory.slots[i]
			if (st && st.id === id && st.count < MAX_STACK) {
				let add = Math.min(MAX_STACK - st.count, count)
				st.count += add
				count -= add
			}
		}
		for (let i = start; i < end && count > 0; i++) {
			if (!inventory.slots[i]) {
				let add = Math.min(MAX_STACK, count)
				inventory.slots[i] = { id: id, count: add }
				count -= add
			}
		}
		return count
	}
	function quickMove(ref) {
		let stack = getStack(ref)
		if (!stack || ref.region === "result") return
		if (ref.region === "craft") {
			let left = stackIntoRange(stack.id, stack.count, 0, 36)
			if (left <= 0) setStack(ref, null)
			else stack.count = left
			return
		}
		let left
		if (ref.region === "hotbar") {
			left = stackIntoRange(stack.id, stack.count, 9, 36)
		} else {
			left = stackIntoRange(stack.id, stack.count, 0, 9)
		}
		if (left <= 0) setStack(ref, null)
		else stack.count = left
	}
	function hotbar() {
		FOV(90)

		for(let i = 0; i < 9; i ++) {
			let st = inventory.slots[i]
			if(st) {
				let x = width / 2 - 9 / 2 * inventory.size + (i + 0.5) * inventory.size + 25
				let y = height - inventory.size
				drawIcon(x, y, st.id)
			}
		}
	}
	function hud() {
		if (p.spectator) {
			return
		}

		hotbar()

		let s = inventory.size
		let x = width / 2 + 0.5
		let y = height / 2 + 0.5

		// Crosshair
		if (!p.spectator) {
			ctx.lineWidth = 1
			ctx.strokeStyle = "white"
			ctx.beginPath()
			ctx.moveTo(x - 10, y)
			ctx.lineTo(x + 10, y)
			ctx.moveTo(x, y - 10)
			ctx.lineTo(x, y + 10)
			ctx.stroke()
		}

		//Hotbar
		x = width / 2 - 9 / 2 * s + 0.5 + 25
		y = height - s * 1.5 + 0.5

		ctx.strokeStyle = "black"
		ctx.lineWidth = 2
		ctx.beginPath()
		ctx.moveTo(x, y)
		ctx.lineTo(x + s * 9, y)
		ctx.moveTo(x, y + s)
		ctx.lineTo(x + s * 9, y + s)
		for(let i = 0; i <= 9; i++) {
			ctx.moveTo(x + i * s, y)
			ctx.lineTo(x + i * s, y + s)
		}
		ctx.stroke()

		ctx.strokeStyle = "white"
		ctx.lineWidth = 2
		ctx.beginPath()

		ctx.strokeRect(width / 2 - 9 / 2 * s + inventory.hotbarSlot * s + 25, height - s * 1.5, s, s)

		ctx.save()
		ctx.textAlign = "right"
		ctx.fillStyle = "white"
		ctx.strokeStyle = "black"
		ctx.lineWidth = 2
		ctx.font = Math.max(10, Math.round(s * 0.4)) + "px Poppins"
		for (let i = 0; i < 9; i++) {
			let st = inventory.slots[i]
			if (st && st.count > 1) {
				let tx = width / 2 - 9 / 2 * s + (i + 1) * s + 25 - 3
				let ty = height - s * 0.5 - 3
				ctx.strokeText(st.count, tx, ty)
				ctx.fillText(st.count, tx, ty)
			}
		}
		ctx.restore()

		let str = "Average Frame Time: " + analytics.displayedFrameTime + "ms\n"
		+ "Worst Frame Time: " + analytics.displayedwFrameTime + "ms\n"
		+ "Render Time: " + analytics.displayedRenderTime + "ms\n"
		+ "Tick Time: " + analytics.displayedTickTime + "ms\n"
		+ "Rendered Chunks: " + renderedChunks.toLocaleString() + " / " + world.loaded.length + "\n"
		+ "Generated Chunks: " + generatedChunks.toLocaleString() + "\n"
		+ "FPS: " + analytics.fps

		if (p.autoBreak) {
			text("Super breaker enabled", 5, height - 89, 12)
		}

		ctx.textAlign = 'right'
		text(p2.x + ", " + p2.y + ", " + p2.z, width - 10, 15, 0)
		ctx.textAlign = 'left'
		text(str, 5, height - 77, 12)
	}
	function drawInv() {
		let l = invLayout()
		let s = l.s

		if (!invBgReady) {
			invBg.width = width
			invBg.height = height
			invBg.getContext("2d").drawImage(gl.canvas, 0, 0)
			setInvBgReady(true)
		}
		ctx.clearRect(0, 0, width, height)
		ctx.drawImage(invBg, 0, 0)
		ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
		ctx.fillRect(0, 0, width, height)

		updateCraftResult()

		let drawSlotBg = (x, y) => {
			ctx.fillStyle = "#8b8b8b"
			ctx.fillRect(x, y, s, s)
			ctx.fillStyle = "#373737"
			ctx.fillRect(x, y, s, 2)
			ctx.fillRect(x, y, 2, s)
			ctx.fillStyle = "#ffffff"
			ctx.fillRect(x, y + s - 2, s, 2)
			ctx.fillRect(x + s - 2, y, 2, s)
		}

		// Panel
		ctx.fillStyle = "#c6c6c6"
		ctx.fillRect(l.panelX, l.panelY, l.panelW, l.panelH)
		ctx.strokeStyle = "#ffffff"
		ctx.lineWidth = 2
		ctx.strokeRect(l.panelX + 1, l.panelY + 1, l.panelW - 2, l.panelH - 2)
		ctx.strokeStyle = "#555555"
		ctx.strokeRect(l.panelX + 0.5, l.panelY + 0.5, l.panelW - 1, l.panelH - 1)

		// Slots
		for (let i = 0; i < 9; i++) drawSlotBg(l.hotX + i * s, l.hotY)
		for (let i = 0; i < 27; i++) {
			let p = slotPos(l, "main", i)
			drawSlotBg(p.x, p.y)
		}
		for (let i = 0; i < 4; i++) {
			let p = slotPos(l, "craft", i)
			drawSlotBg(p.x, p.y)
		}
		drawSlotBg(l.resultX, l.resultY)

		// Craft arrow
		ctx.fillStyle = "#8b8b8b"
		let ax = l.craftX + 2 * s + Math.round(s * 0.16)
		let ay = l.craftY + s
		ctx.beginPath()
		ctx.moveTo(ax, ay - s * 0.18)
		ctx.lineTo(ax + s * 0.22, ay)
		ctx.lineTo(ax, ay + s * 0.18)
		ctx.closePath()
		ctx.fill()

		// Hover highlight
		let hover = slotAt(mouseX, mouseY)
		if (hover) {
			let p = slotPos(l, hover.region, hover.index)
			ctx.strokeStyle = "white"
			ctx.lineWidth = 2
			ctx.strokeRect(p.x + 1, p.y + 1, s - 2, s - 2)
		}

		// Icons (WebGL)
		use3d()
		FOV(90)
		gl.clearColor(0, 0, 0, 0)
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
		gl.disable(gl.DEPTH_TEST)
		for (let i = 0; i < 9; i++) {
			let st = inventory.slots[i]
			if (st) drawIcon(l.hotX + (i + 0.5) * s, l.hotY + s / 2, st.id)
		}
		for (let i = 0; i < 27; i++) {
			let st = inventory.slots[9 + i]
			if (st) {
				let p = slotPos(l, "main", i)
				drawIcon(p.x + s / 2, p.y + s / 2, st.id)
			}
		}
		for (let i = 0; i < 4; i++) {
			let st = inventory.craft[i]
			if (st) {
				let p = slotPos(l, "craft", i)
				drawIcon(p.x + s / 2, p.y + s / 2, st.id)
			}
		}
		if (inventory.result) drawIcon(l.resultX + s / 2, l.resultY + s / 2, inventory.result.id)
		if (inventory.cursor) drawIcon(mouseX, mouseY, inventory.cursor.id)
		gl.enable(gl.DEPTH_TEST)
		ctx.drawImage(gl.canvas, 0, 0)

		// Counts
		ctx.textAlign = "right"
		ctx.fillStyle = "white"
		ctx.strokeStyle = "black"
		ctx.lineWidth = 2
		ctx.font = Math.max(10, Math.round(s * 0.42)) + "px Poppins"
		let drawCount = (x, y, stack) => {
			if (stack && stack.count > 1) {
				ctx.strokeText(stack.count, x + s - 3, y + s - 4)
				ctx.fillText(stack.count, x + s - 3, y + s - 4)
			}
		}
		for (let i = 0; i < 9; i++) drawCount(l.hotX + i * s, l.hotY, inventory.slots[i])
		for (let i = 0; i < 27; i++) {
			let p = slotPos(l, "main", i)
			drawCount(p.x, p.y, inventory.slots[9 + i])
		}
		for (let i = 0; i < 4; i++) {
			let p = slotPos(l, "craft", i)
			drawCount(p.x, p.y, inventory.craft[i])
		}
		if (inventory.result) drawCount(l.resultX, l.resultY, inventory.result)
		if (inventory.cursor) drawCount(mouseX, mouseY, inventory.cursor)

		// Tooltip
		let tip = hover ? getStack(hover) : null
		if (tip) {
			ctx.textAlign = "left"
			ctx.font = Math.max(12, Math.round(s * 0.4)) + "px Poppins"
			let name = itemName(tip.id)
			let tw = ctx.measureText(name).width
			ctx.fillStyle = "rgba(16, 0, 16, 0.94)"
			ctx.fillRect(mouseX + 8, mouseY + 4, tw + 10, 22)
			ctx.fillStyle = "white"
			ctx.fillText(name, mouseX + 13, mouseY + 20)
		}
		ctx.textAlign = "left"
	}
	function clickInv(button, shift) {
		updateCraftResult()
		let ref = slotAt(mouseX, mouseY)
		if (!ref) {
			if (button === 0 && inventory.cursor) {
				addItem(inventory.cursor.id, inventory.cursor.count)
				inventory.cursor = null
			}
			drawScreens.inventory()
			return
		}
		if (ref.region === "result") {
			if (!inventory.result) {
				drawScreens.inventory()
				return
			}
			if (shift) {
				while (inventory.result && invCapacity(inventory.result.id) >= inventory.result.count) {
					let out = inventory.result
					addItem(out.id, out.count)
					consumeCraft()
					updateCraftResult()
				}
			} else {
				craftOnce()
			}
			drawScreens.inventory()
			return
		}
		if (shift) {
			quickMove(ref)
			updateHolding()
			drawScreens.inventory()
			return
		}
		let stack = getStack(ref)
		if (button === 0) {
			if (inventory.cursor) {
				if (!stack) {
					setStack(ref, inventory.cursor)
					inventory.cursor = null
				} else if (stack.id === inventory.cursor.id) {
					let add = Math.min(MAX_STACK - stack.count, inventory.cursor.count)
					stack.count += add
					inventory.cursor.count -= add
					if (inventory.cursor.count <= 0) inventory.cursor = null
				} else {
					setStack(ref, inventory.cursor)
					inventory.cursor = stack
				}
			} else if (stack) {
				inventory.cursor = stack
				setStack(ref, null)
			}
		} else if (button === 2) {
			if (inventory.cursor) {
				if (!stack) {
					setStack(ref, { id: inventory.cursor.id, count: 1 })
					inventory.cursor.count--
					if (inventory.cursor.count <= 0) inventory.cursor = null
				} else if (stack.id === inventory.cursor.id && stack.count < MAX_STACK) {
					stack.count++
					inventory.cursor.count--
					if (inventory.cursor.count <= 0) inventory.cursor = null
				}
			} else if (stack) {
				let half = Math.ceil(stack.count / 2)
				inventory.cursor = { id: stack.id, count: half }
				stack.count -= half
				if (stack.count <= 0) setStack(ref, null)
			}
		}
		updateHolding()
		drawScreens.inventory()
	}

	// Creative inventory: compact survival-style panel with a scrollable, searchable block list
	function creativeIds() {
		let q = creativeSearch.trim().toLowerCase()
		if (q === creativeIdsKey && creativeIdsCache) return creativeIdsCache
		let list = []
		for (let id = 1; id < BLOCK_COUNT; id++) {
			if (q === "" || itemName(id).toLowerCase().includes(q)) list.push(id)
		}
		setCreativeIdsKey(q)
		setCreativeIdsCache(list)
		return list
	}
	function creativeLayout() {
		let s = inventory.size
		let pad = Math.round(s * 0.6)
		let gap = Math.round(s * 0.5)
		let perRow = 9
		let visibleRows = 5
		let searchH = Math.round(s * 0.8)
		let ids = creativeIds()
		let rows = Math.max(1, Math.ceil(ids.length / perRow))
		let panelW = 9 * s + 2 * pad
		let panelH = pad + searchH + gap + visibleRows * s + gap + s + pad
		let px = Math.round((width - panelW) / 2)
		let py = Math.round((height - panelH) / 2)
		let scrollMax = Math.max(0, rows - visibleRows)
		setCreativeScroll(Math.max(0, Math.min(scrollMax, creativeScroll)))
		return {
			s: s, pad: pad, gap: gap, perRow: perRow, rows: rows, visibleRows: visibleRows,
			ids: ids,
			panelX: px, panelY: py, panelW: panelW, panelH: panelH,
			searchX: px + pad, searchY: py + pad, searchW: panelW - 2 * pad, searchH: searchH,
			gridX: px + pad, gridY: py + pad + searchH + gap,
			hotX: px + pad, hotY: py + pad + searchH + gap + visibleRows * s + gap,
			scrollMax: scrollMax,
		}
	}
	function creativeScrollbar(cl) {
		let s = cl.s
		let trackX = cl.gridX + cl.perRow * s + Math.round(s * 0.16)
		let trackY = cl.gridY
		let trackH = cl.visibleRows * s
		let trackW = Math.max(4, Math.round(s * 0.3))
		let thumbH = cl.scrollMax > 0
			? Math.max(Math.round(s * 0.7), Math.round(trackH * cl.visibleRows / cl.rows))
			: trackH
		let thumbY = cl.scrollMax > 0
			? trackY + Math.round((trackH - thumbH) * creativeScroll / cl.scrollMax)
			: trackY
		return { trackX: trackX, trackY: trackY, trackW: trackW, trackH: trackH, thumbY: thumbY, thumbH: thumbH }
	}
	function creativeSlotAt(mx, my, cl) {
		let s = cl.s
		let inside = (x, y) => mx >= x && mx < x + s && my >= y && my < y + s
		for (let i = 0; i < 9; i++) {
			if (inside(cl.hotX + i * s, cl.hotY)) return { region: "hotbar", index: i }
		}
		let top = Math.round(creativeScroll)
		for (let j = 0; j < cl.visibleRows; j++) {
			for (let i = 0; i < cl.perRow; i++) {
				let idx = (top + j) * cl.perRow + i
				if (idx >= cl.ids.length) break
				let x = cl.gridX + i * s
				let y = cl.gridY + j * s
				if (inside(x, y)) return { region: "palette", id: cl.ids[idx], x: x, y: y }
			}
		}
		return null
	}
	function drawCreative() {
		let cl = creativeLayout()
		let s = cl.s
		let top = Math.round(creativeScroll)

		if (!invBgReady) {
			invBg.width = width
			invBg.height = height
			invBg.getContext("2d").drawImage(gl.canvas, 0, 0)
			setInvBgReady(true)
		}
		ctx.clearRect(0, 0, width, height)
		ctx.drawImage(invBg, 0, 0)
		ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
		ctx.fillRect(0, 0, width, height)

		let drawSlotBg = (x, y) => {
			ctx.fillStyle = "#8b8b8b"
			ctx.fillRect(x, y, s, s)
			ctx.fillStyle = "#373737"
			ctx.fillRect(x, y, s, 2)
			ctx.fillRect(x, y, 2, s)
			ctx.fillStyle = "#ffffff"
			ctx.fillRect(x, y + s - 2, s, 2)
			ctx.fillRect(x + s - 2, y, 2, s)
		}

		ctx.fillStyle = "#c6c6c6"
		ctx.fillRect(cl.panelX, cl.panelY, cl.panelW, cl.panelH)
		ctx.strokeStyle = "#ffffff"
		ctx.lineWidth = 2
		ctx.strokeRect(cl.panelX + 1, cl.panelY + 1, cl.panelW - 2, cl.panelH - 2)
		ctx.strokeStyle = "#555555"
		ctx.strokeRect(cl.panelX + 0.5, cl.panelY + 0.5, cl.panelW - 1, cl.panelH - 1)

		// Search bar
		ctx.fillStyle = "#373737"
		ctx.fillRect(cl.searchX, cl.searchY, cl.searchW, cl.searchH)
		ctx.strokeStyle = creativeSearchActive ? "#ffffff" : "#555555"
		ctx.lineWidth = 2
		ctx.strokeRect(cl.searchX + 1, cl.searchY + 1, cl.searchW - 2, cl.searchH - 2)
		ctx.save()
		ctx.beginPath()
		ctx.rect(cl.searchX + 4, cl.searchY, cl.searchW - 8, cl.searchH)
		ctx.clip()
		ctx.textAlign = "left"
		ctx.textBaseline = "middle"
		ctx.font = Math.round(cl.searchH * 0.52) + "px Poppins"
		let ty = cl.searchY + cl.searchH / 2
		if (creativeSearch) {
			ctx.fillStyle = "#ffffff"
			ctx.fillText(creativeSearch, cl.searchX + 8, ty)
			if (creativeSearchActive && Math.floor(Date.now() / 500) % 2 === 0) {
				let w = ctx.measureText(creativeSearch).width
				ctx.fillRect(cl.searchX + 9 + w, cl.searchY + cl.searchH * 0.22, 2, cl.searchH * 0.56)
			}
		} else {
			ctx.fillStyle = "#9a9a9a"
			ctx.fillText("Search blocks...", cl.searchX + 8, ty)
			if (creativeSearchActive && Math.floor(Date.now() / 500) % 2 === 0) {
				ctx.fillStyle = "#ffffff"
				ctx.fillRect(cl.searchX + 8, cl.searchY + cl.searchH * 0.22, 2, cl.searchH * 0.56)
			}
		}
		ctx.restore()
		ctx.textBaseline = "alphabetic"

		for (let j = 0; j < cl.visibleRows; j++) {
			for (let i = 0; i < cl.perRow; i++) {
				let idx = (top + j) * cl.perRow + i
				if (idx >= cl.ids.length) break
				drawSlotBg(cl.gridX + i * s, cl.gridY + j * s)
			}
		}
		for (let i = 0; i < 9; i++) {
			drawSlotBg(cl.hotX + i * s, cl.hotY)
		}

		if (cl.ids.length === 0) {
			ctx.fillStyle = "#555555"
			ctx.textAlign = "center"
			ctx.textBaseline = "middle"
			ctx.font = Math.round(s * 0.45) + "px Poppins"
			ctx.fillText("No blocks found", cl.gridX + 4.5 * s, cl.gridY + cl.visibleRows * s / 2)
			ctx.textBaseline = "alphabetic"
			ctx.textAlign = "left"
		}

		// Scrollbar
		let sb = creativeScrollbar(cl)
		ctx.fillStyle = "#373737"
		ctx.fillRect(sb.trackX, sb.trackY, sb.trackW, sb.trackH)
		if (cl.scrollMax > 0) {
			ctx.fillStyle = "#8b8b8b"
			ctx.fillRect(sb.trackX, sb.thumbY, sb.trackW, sb.thumbH)
			ctx.fillStyle = "#ffffff"
			ctx.fillRect(sb.trackX, sb.thumbY, sb.trackW, 2)
			ctx.fillStyle = "#373737"
			ctx.fillRect(sb.trackX, sb.thumbY + sb.thumbH - 2, sb.trackW, 2)
		}

		let hit = creativeSlotAt(mouseX, mouseY, cl)
		if (hit) {
			let p = hit.region === "hotbar"
				? { x: cl.hotX + hit.index * s, y: cl.hotY }
				: { x: hit.x, y: hit.y }
			ctx.strokeStyle = "white"
			ctx.lineWidth = 2
			ctx.strokeRect(p.x + 1, p.y + 1, s - 2, s - 2)
		}

		use3d()
		FOV(90)
		gl.clearColor(0, 0, 0, 0)
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
		gl.disable(gl.DEPTH_TEST)
		for (let j = 0; j < cl.visibleRows; j++) {
			for (let i = 0; i < cl.perRow; i++) {
				let idx = (top + j) * cl.perRow + i
				if (idx >= cl.ids.length) break
				drawIcon(cl.gridX + (i + 0.5) * s, cl.gridY + (j + 0.5) * s, cl.ids[idx])
			}
		}
		for (let i = 0; i < 9; i++) {
			let st = inventory.slots[i]
			if (st) drawIcon(cl.hotX + (i + 0.5) * s, cl.hotY + s / 2, st.id)
		}
		if (inventory.cursor) drawIcon(mouseX, mouseY, inventory.cursor.id)
		gl.enable(gl.DEPTH_TEST)
		ctx.drawImage(gl.canvas, 0, 0)

		if (hit && hit.region === "palette") {
			ctx.textAlign = "left"
			ctx.font = Math.max(12, Math.round(s * 0.4)) + "px Poppins"
			let name = itemName(hit.id)
			let tw = ctx.measureText(name).width
			ctx.fillStyle = "rgba(16, 0, 16, 0.94)"
			ctx.fillRect(mouseX + 8, mouseY + 4, tw + 10, 22)
			ctx.fillStyle = "white"
			ctx.fillText(name, mouseX + 13, mouseY + 20)
		}
		ctx.textAlign = "left"
	}
	function clickCreative(button, shift) {
		let cl = creativeLayout()
		let hit = creativeSlotAt(mouseX, mouseY, cl)
		if (!hit) {
			inventory.cursor = null
		} else if (hit.region === "palette") {
			inventory.cursor = { id: hit.id, count: 1 }
		} else {
			let ref = { region: "hotbar", index: hit.index }
			let stack = getStack(ref)
			if (inventory.cursor) {
				setStack(ref, inventory.cursor)
				inventory.cursor = stack
			} else if (stack) {
				inventory.cursor = stack
				setStack(ref, null)
			}
		}
		updateHolding()
		drawScreens.inventory()
	}

	function openCommand() {
		if (commandOpen) return
		setCommandOpen(true)
		canvas.onblur()
		releasePointer()
		boxCenterTop.classList.remove("hidden")
		boxCenterTop.value = "/"
		boxCenterTop.focus()
		try { boxCenterTop.setSelectionRange(1, 1) } catch (e) {}
	}
	function closeCommand() {
		if (!commandOpen) return
		setCommandOpen(false)
		boxCenterTop.classList.add("hidden")
		boxCenterTop.value = ""
		getPointer()
	}
	function runCommand(str) {
		let parts = str.trim().replace(/^\/+/, "").split(/\s+/)
		if (!parts[0]) return
		let cmd = parts[0].toLowerCase()
		let reply = ""
		if (cmd === "gamemode" || cmd === "gm") {
			let mode = (parts[1] || "").toLowerCase()
			if (mode === "creative" || mode === "c" || mode === "1") {
				setGameMode("creative")
			} else if (mode === "survival" || mode === "s" || mode === "0") {
				setGameMode("survival")
			} else {
				setGameMode(gameMode === "creative" ? "survival" : "creative")
			}
			if (gameMode === "survival") {
				p.flying = false
				p.spectator = false
			}
			setUpdateHUD(true)
			reply = "Game mode set to " + gameMode
		} else if (cmd === "time") {
			let names = { dawn: 0, morning: 1500, noon: 3000, day: 3000, dusk: 6000, evening: 6000, night: 9000, midnight: 0 }
			let ticks = (DAY_LENGTH * 1000 / 50)
			let sub = (parts[1] || "").toLowerCase()
			if (sub === "set" && parts[2] !== undefined) {
				let v = names[parts[2].toLowerCase()]
				if (v === undefined) v = parseFloat(parts[2])
				if (!isNaN(v)) world.time = ((v * 50) % (DAY_LENGTH * 1000) + DAY_LENGTH * 1000) % (DAY_LENGTH * 1000)
			} else if (sub === "add" && parts[2] !== undefined) {
				let v = parseFloat(parts[2])
				if (!isNaN(v)) world.time = ((world.time + v * 50) % (DAY_LENGTH * 1000) + DAY_LENGTH * 1000) % (DAY_LENGTH * 1000)
			}
			reply = "Time set to " + (Math.round(world.time / 50) % ticks) + "/" + ticks + " ticks"
		} else if (cmd === "biome") {
			let biome = BIOMES[biomeAt(Math.floor(p.x), Math.floor(p.z))]
			reply = "Biome: " + biome.name
		} else if (cmd === "help") {
			reply = "Commands: /gamemode creative | /gamemode survival | /time set dawn|noon|dusk|night | /time add <ticks> | /biome"
		} else {
			reply = "Unknown command: " + cmd
		}
		window.message.innerText = reply
		window.message.classList.remove("hidden")
		clearTimeout(runCommand.msgTimer)
		runCommand.msgTimer = setTimeout(() => window.message.classList.add("hidden"), 2000)
	}
	if (boxCenterTop) {
		boxCenterTop.onkeydown = function(e) {
			if (!commandOpen) return
			e.stopPropagation()
			if (e.key === "Enter") {
				runCommand(boxCenterTop.value)
				closeCommand()
			} else if (e.key === "Escape") {
				closeCommand()
			}
		}
	}


		function title() {
			let title = "MINECRAFT"
			let subtext = "MINECRAFT IN JAVASCRIPT"
			let font = "Poppins"
			strokeWeight(1)
			ctx.textAlign = 'center'

			ctx.font = "bold 120px " + font
			fill(30)
			text(title, width / 2, 158)
			fill(40)
			text(title, width / 2, 155)
			ctx.font = "bold 121px " + font
			fill(50)
			text(title, width / 2, 152)
			fill(70)
			text(title, width / 2, 150)
			fill(90)
			ctx.font = "bold 122px " + font
			text(title, width / 2, 148)
			fill(110)
			text(title, width / 2, 145)

			ctx.font = "bold 32px " + font
			fill(50)
			text(subtext, width / 2-1, 180)
			text(subtext, width / 2+1, 180)
			text(subtext, width / 2, 179)
			text(subtext, width / 2, 181)
			ctx.font = "bold 32px " + font
			fill(150)
			text(subtext, width / 2, 180)
		}
		const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height)
		const dirt = () => { if (dirtbg) ctx.putImageData(dirtbg, 0, 0) }

		drawScreens["main menu"] = () => {
			if (mainbg) ctx.putImageData(mainbg, 0, 0)
			title()
			fill(220)
			ctx.font = "20px Poppins"
			ctx.textAlign = 'left'
			text("JSCraft " + version, width - (width - 2), height - 2)
		}

		drawScreens.play = () => {
			controls()
			runGravity()
			resolveContactsAndUpdatePosition()
			updateDrops()
			updateTnts()
			tickFluids()

			if (updateHUD) {
				clear()
				gl.clearColor(0, 0, 0, 0)
				gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
				hud()
				ctx.drawImage(gl.canvas, 0, 0)
				setUpdateHUD(false)
				setFreezeFrame(false)

				gl.clearColor(sky[0], sky[1], sky[2], 1.0)
			}
			defineWorld()
		}

		drawScreens.loading = () => {
			// This is really stupid, but it basically works by teleporting the player around to each chunk I'd like to load.
			// If chunks loaded from a save aren't generated, they're deleted from the save, so this loads them all.

			let sub = maxLoad - world.loadFrom.length - 9
			let standing = true
			if (world.loadFrom.length) {
				let load = world.loadFrom[0]
				p.x = load.x * 16
				p.y = load.y * 16
				p.z = load.z * 16
				standing = false
			} else {
				p.x = p2.x
				p.y = p2.y
				p.z = p2.z

				let cx = p.x >> 4
				let cz = p.z >> 4

				for (let x = cx - 1; x <= cx + 1; x++) {
					for (let z = cz - 1; z <= cz + 1; z++) {
						if (!world.chunks[x] || !world.chunks[x][z] || !world.chunks[x][z].buffer) {
							standing = false
						} else {
							sub++
						}
					}
				}
			}

			if (standing) {
				play()
				return
			}

			world.tick()

			let progress = Math.round(100 * sub / maxLoad)
			dirt()
			fill(255)
			textSize(30)
			ctx.textAlign = "center"
			text(`Loading... ${progress}% complete (${sub} / ${maxLoad})`, width / 2, height / 2)
		}

		drawScreens.inventory = () => {
			if (gameMode === "creative") {
				drawCreative()
			} else {
				drawInv()
			}
		}

		drawScreens.pause = () => {
			strokeWeight(1)
			clear()
			ctx.drawImage(gl.canvas, 0, 0)

			textSize(60)
			fill(0, 0, 0)
			ctx.textAlign = 'center'
			text("Paused", width / 2, 60)
		}

		drawScreens.options = () => {
			clear()
		}
		drawScreens["creation menu"] = () => {
			dirt()
			ctx.textAlign = 'center'
			textSize(20)
			fill(255)
			text("Create New World", width / 2, 20)
		}
		drawScreens["loadsave menu"] = () => {
			dirt()
			ctx.textAlign = 'center'
			textSize(20)
			fill(255)
			text("Select World", width / 2, 20)
		}
		drawScreens.editworld = dirt

	// Give the font time to load and redraw the homescreen
	setTimeout(e => {
		drawScreens[screen]()
		Button.draw()
		Slider.draw()
	}, 100)



export {
	fill, stroke, line, text, textSize, strokeWeight, cursor,
	Slider, Button, initButtons,
	drawIcon, heldStack, updateHolding, addItem, pickBlock, invCapacity, consumeHeld, blockDrop,
	updateCraftResult, consumeCraft, craftOnce,
	invLayout, slotPos, slotAt, getStack, setStack, stackIntoRange, quickMove,
	hotbar, hud, drawInv, clickInv,
	creativeIds, creativeLayout, creativeScrollbar, creativeSlotAt, drawCreative, clickCreative,
	openCommand, closeCommand, runCommand,
	drawScreens, changeScene, play, title
}
