import { seedHash, openSimplexNoise, noiseSeed, noise, BIOMES, biomeClimateAt, biomeSample } from './noise.js'
import { blockData, BLOCK_COUNT, blockIds } from './blocks.js'
import {
	win, doc, world, setWorld, p, p2, gl, screen, hitBox, gameMode, setGameMode, Key, glCache,
	settings, generatedChunks, setGeneratedChunks, height, generator, maxHeight,
	blockOutlines, setBlockOutlines, blockFill, setBlockFill, drops, analytics,
	caveNoise, setCaveNoise, worldSeed, setWorldSeed, matrix,
	worlds, selectedWorld, setSelectedWorld, superflat, setSuperflat,
	trees, setTrees, caves, setCaves, version,
	renderedChunks, setRenderedChunks
} from './state.js'
import { Button, addItem, blockDrop } from './ui.js'
import { Chunk, emptySection, fullSection } from './chunk.js'
import {
	BASE_MASK, STATE_MASK, TORCH_HANGING, use3d, computeSky, renderSkybox, DAY_LENGTH
} from './engine.js'
import { block2, initModelView, changeWorldBlock, newWorldBlock } from './player.js'
import { isSupporter, isTorchSupport, fluidWakeAround, renderDrops, renderTnts } from './features.js'

	async function createDatabase() {
		return await new Promise(async (resolve, reject) => {
			let request = window.indexedDB.open("MineKhan", 1)

			request.onupgradeneeded = function(event) {
				let DB = event.target.result
				
				let store = DB.createObjectStore("worlds", { keyPath: "id" })
				store.createIndex("id", "id", { unique: true })
				store.createIndex("data", "data", { unique: false })
			}

			request.onsuccess = function(e) {
				resolve(request.result)
			}

			request.onerror = function(e) {
				console.error(e)
				reject(e)
			}
		})
	}
	async function loadFromDB(id) {
		return await new Promise(async (resolve, reject) => {
			let db = await createDatabase()
			let trans = db.transaction("worlds", "readwrite")
			let store = trans.objectStore("worlds")
			let req = id ? store.get(id) : store.getAll()
			req.onsuccess = function(e) {
				resolve(req.result)
				db.close()
			}
			req.onerror = function(e) { 
				resolve(null)
				db.close()
			}
		})
	}
	async function saveToDB(id, data) {
		return new Promise(async (resolve, reject) => {
			let db = await createDatabase()
			let trans = db.transaction("worlds", "readwrite")
			let store = trans.objectStore("worlds")
			let req = store.put({ id: id, data: data })
			req.onsuccess = function() {
				resolve(req.result)
			}
			req.onerror = function(e) {
				reject(e)
			}
		})
	}
	async function deleteFromDB(id) {
		return new Promise(async (resolve, reject) => {
			let db = await createDatabase()
			let trans = db.transaction("worlds", "readwrite")
			let store = trans.objectStore("worlds")
			let req = store.delete(id)
			req.onsuccess = function() {
				resolve(req.result)
			}
			req.onerror = function(e) {
				reject(e)
			}
		})
	}

	function save() {
		saveToDB(world.id, {
			id: world.id,
			edited: Date.now(),
			name: world.name,
			version: version,
			code: world.getSaveString()
		}).then(() => world.edited = Date.now()).catch(e => console.error(e))
	}

	
	win.saveToDB = saveToDB
	win.loadFromDB = loadFromDB
	win.createDatabase = createDatabase
	win.deleteFromDB = deleteFromDB



	function chunkDist(c) {
		let dx = p.x - c.x
		let dz = p.z - c.z
		if (dx > 16) {
			dx -= 16
		} else if (dx > 0) {
			dx = 0
		}
		if (dz > 16) {
			dz -= 16
		} else if (dz > 0) {
			dz = 0
		}
		return Math.sqrt(dx * dx + dz * dz)
	}
	function sortChunks(c1, c2) { //Sort the list of chunks based on distance from the player
		let dx1 = p.x - c1.x - 8
		let dy1 = p.z - c1.z - 8
		let dx2 = p.x - c2.x - 8
		let dy2 = p.z - c2.z - 8
		return dx1 * dx1 + dy1 * dy1 - (dx2 * dx2 + dy2 * dy2)
	}
	function fillReqs(x, z) {
		// Chunks must all be loaded first.
		var done = true
		for (let i = x - 2; i <= x + 2; i++) {
			for (let j = z - 2; j <= z + 2; j++) {
				let chunk = world.loaded[(i + world.offsetX) * world.lwidth + j + world.offsetZ]
				if (!chunk.generated) {
					world.generateQueue.push(chunk)
					done = false
				}
				if (!chunk.populated && i >= x - 1 && i <= x + 1 && j >= z - 1 && j <= z + 1) {
					world.populateQueue.push(chunk)
					done = false
				}
			}
		}
		return done
	}
	function maxDist(x, z, x2, z2) {
		let ax = Math.abs(x2 - x)
		let az = Math.abs(z2 - z)
		return Math.max(ax, az)
	}
	function renderFilter(chunk) {
		return maxDist(chunk.x >> 4, chunk.z >> 4, p.cx, p.cz) <= settings.renderDistance
	}

	function debug(message) {
		let ellapsed = performance.now() - debug.start
		if (ellapsed > 30) {
			console.log(message, ellapsed.toFixed(2), "milliseconds")
		}
	}

	let fogDist = 16
	class World {
		constructor() {
			setGeneratedChunks(0)
			fogDist = 16
			p.y = superflat ? 6 : (Math.round(noise(8 * generator.smooth, 8 * generator.smooth) * generator.height) + 2 + generator.extra)

			//Initialize the world's arrays
			this.chunks = []
			this.loaded = []
			this.sortedChunks = []
			this.offsetX = 0
			this.offsetZ = 0
			this.lwidth = 0
			this.chunkGenQueue = []
			this.populateQueue = []
			this.generateQueue = []
			this.meshQueue = []
			this.loadFrom = []
			this.lastChunk = ","
			this.time = 150000 // Time of day in milliseconds (150s = morning)
			this.lastRender = 0
		}
		genChunk(chunk) {
			let x = chunk.x >> 4
			let z = chunk.z >> 4
			let trueX = chunk.x
			let trueZ = chunk.z

			if (chunk.generated) {
				return false
			}
			let hide = !loadString
			let smoothness = generator.smooth
			let hilliness = generator.height
			let gen = 0
			for (let i = 0; i < 16; i++) {
				for (let k = 0; k < 16; k++) {
					let wx = trueX + i
					let wz = trueZ + k
					let climate = biomeClimateAt(wx, wz)
					let sample = biomeSample(climate)
					let bi = sample.id
					let biome = BIOMES[bi]
					if (superflat) {
						gen = 4
					} else {
						gen = Math.round(noise(wx * smoothness, wz * smoothness) * hilliness * sample.scale) + generator.extra + Math.round(sample.offset)
					}
					chunk.tops[k * 16 + i] = gen
					chunk.biomes[k * 16 + i] = bi

					chunk.setBlock(i, gen, k, biome.surface)
					let y = gen - 1
					for (let l = 0; l < biome.layers.length; l++) {
						let layer = biome.layers[l]
						for (let j = 0; j < layer[1] && y > 0; j++) {
							chunk.setBlock(i, y, k, layer[0])
							y--
						}
					}
					for (let j = 1; j <= y; j++) {
						chunk.setBlock(i, j, k, blockIds.stone)
					}
					chunk.setBlock(i, 0, k, blockIds.bedrock)
				}
			}
			chunk.generated = true
		}
		getAdjacentSubchunks(x, y, z) {
			let minChunkX = x - 16 >> 4
			let maxChunkX = x + 16 >> 4
			let minChunkY = y - 16 >> 4
			let maxChunkY = y + 16 >> 4
			let minChunkZ = z - 16 >> 4
			let maxChunkZ = z + 16 >> 4
			let section = null
			let ret = []
			for (x = minChunkX; x <= maxChunkX; x++) {
				for (let y = minChunkY; y <= maxChunkY; y++) {
					for (z = minChunkZ; z <= maxChunkZ; z++) {
						if (y < 0) {
							ret.push(fullSection.blocks)
						} else if (this.chunks[x] && this.chunks[x][z]) {
							section = this.chunks[x][z].sections[y] || emptySection
							ret.push(section.blocks)
						} else {
							ret.push(emptySection.blocks)
						}
					}
				}
			}
			return ret
		}
		updateBlock(x, y, z, lazy) {
			let chunk = this.chunks[x >> 4] && this.chunks[x >> 4][z >> 4]
			if (chunk && chunk.buffer) {
				chunk.updateBlock(x & 15, y, z & 15, this, lazy)
			}
		}
		getWorldBlock(x, y, z) {
			if (!this.chunks[x >> 4] || !this.chunks[x >> 4][z >> 4]) {
				return blockIds.air
			}
			return this.chunks[x >> 4][z >> 4].getBlock(x & 15, y, z & 15)
		}
		getBlock(x, y, z) {
			let X = (x >> 4) + this.offsetX
			let Z = (z >> 4) + this.offsetZ
			if (y > maxHeight) {
				return blockIds.air
			} else if (y < 0) {
				return blockIds.bedrock
			} else if (X < 0 || X >= this.lwidth || Z < 0 || Z >= this.lwidth) {
				return this.getWorldBlock(x, y, z)
			}
			return this.loaded[X * this.lwidth + Z].getBlock(x & 15, y, z & 15)
		}
		setBlock(x, y, z, blockID, lazy) {
			if (!this.chunks[x >> 4] || !this.chunks[x >> 4][z >> 4]) {
				return
			}
			let chunk = this.chunks[x >> 4][z >> 4]

			let prevBlock = this.getBlock(x, y, z)
			let xm = x & 15
			let zm = z & 15
			if (blockID) {
				chunk.setBlock(xm, y, zm, blockID, false, !lazy)
			} else {
				chunk.deleteBlock(xm, y, zm, !lazy)
			}

			if (lazy) {
				return
			}

			//Update the 6 adjacent blocks and 1 changed block
			if (xm && xm !== 15 && zm && zm !== 15) {
				chunk.updateBlock(xm - 1, y, zm, this, lazy)
				chunk.updateBlock(xm + 1, y, zm, this, lazy)
				chunk.updateBlock(xm, y - 1, zm, this, lazy)
				chunk.updateBlock(xm, y + 1, zm, this, lazy)
				chunk.updateBlock(xm, y, zm - 1, this, lazy)
				chunk.updateBlock(xm, y, zm + 1, this, lazy)
			}
			else {
				this.updateBlock(x - 1, y, z, lazy)
				this.updateBlock(x + 1, y, z, lazy)
				this.updateBlock(x, y - 1, z, lazy)
				this.updateBlock(x, y + 1, z, lazy)
				this.updateBlock(x, y, z - 1, lazy)
				this.updateBlock(x, y, z + 1, lazy)
			}

			chunk.updateBlock(xm, y, zm, this, lazy)

			// Update the corner chunks so shadows in adjacent chunks update correctly
			if (xm | zm === 0) { this.updateBlock(x - 1, y, z - 1, lazy); }
			if (xm === 15 && zm === 0) { this.updateBlock(x + 1, y, z - 1, lazy); }
			if (xm === 0 && zm === 15) { this.updateBlock(x - 1, y, z + 1, lazy); }
			if (xm & zm === 15) { this.updateBlock(x + 1, y, z + 1, lazy); }

			// Pop off plants (and torches) that just lost their support. In
			// survival the displaced block drops its item.
			let above = this.getBlock(x, y + 1, z)
			let aboveData = blockData[above & STATE_MASK]
			if (aboveData && aboveData.support && !isSupporter(blockID & STATE_MASK)) {
				if (gameMode !== "creative") { addItem(blockDrop(above & BASE_MASK), 1) }
				this.setBlock(x, y + 1, z, 0)
			} else if (aboveData && aboveData.torch && !(above & TORCH_HANGING) && !isTorchSupport(blockID)) {
				// Standing torch whose floor was removed.
				if (gameMode !== "creative") { addItem(blockDrop(above & BASE_MASK), 1) }
				this.setBlock(x, y + 1, z, 0)
			}
			let below = this.getBlock(x, y - 1, z)
			let belowData = blockData[below & STATE_MASK]
			if (belowData && belowData.torch && (below & TORCH_HANGING) && !isTorchSupport(blockID)) {
				// Hanging torch whose ceiling was removed.
				if (gameMode !== "creative") { addItem(blockDrop(below & BASE_MASK), 1) }
				this.setBlock(x, y - 1, z, 0)
			}
			if (prevBlock !== blockID) {
				fluidWakeAround(x, y, z)
			}
		}
		spawnBlock(x, y, z, blockID) {
			//Sets a block anywhere without causing block updates around it. Only to be used in world gen.

			let chunkX = x >> 4
			let chunkZ = z >> 4
			if (!this.chunks[chunkX]) {
				this.chunks[chunkX] = []
			}
			let chunk = this.chunks[chunkX][chunkZ]
			if (!chunk) {
				chunk = new Chunk(chunkX * 16, chunkZ * 16)
				this.chunks[chunkX][chunkZ] = chunk
			}
			if (chunk.buffer) {
				//Only used if spawning a block post-gen
				this.setBlock(x, y, z, blockID, true)
			} else if (!chunk.getBlock(x & 15, y, z & 15)) {
				chunk.setBlock(x & 15, y, z & 15, blockID, false)
			}
		}
		tick() {
			let tickStart = win.performance.now()
			let maxChunkX = (p.x >> 4) + settings.renderDistance
			let maxChunkZ = (p.z >> 4) + settings.renderDistance
			let chunk = maxChunkX + "," + maxChunkZ
			if (chunk !== this.lastChunk) {
				this.lastChunk = chunk
				this.loadChunks()
				this.chunkGenQueue.sort(sortChunks)
			}

			if (Key.leftMouse && !Key.control && p.lastBreak < Date.now() - 250 && screen === "play") {
				changeWorldBlock(0)
			}
			if ((Key.rightMouse || Key.leftMouse && Key.control) && p.lastPlace < Date.now() - 250) {
				newWorldBlock()
			}
			if (Key.leftMouse && p.autoBreak && !Key.control) {
				changeWorldBlock(0)
			}

			for (let i = 0; i < this.sortedChunks.length; i++) {
				this.sortedChunks[i].tick()
			}

			do {
				let doneWork = false
				debug.start = performance.now()
				if (this.meshQueue.length) {
					// Update all chunk meshes.
					let len = this.meshQueue.length - 1
					do {
						this.meshQueue.pop().genMesh()
					} while(this.meshQueue.length)
					doneWork = true
					debug("Meshes")
				}

				if (this.generateQueue.length && !doneWork) {
					let chunk = this.generateQueue.pop()
					this.genChunk(chunk)
					doneWork = true
				}
				if (this.populateQueue.length && !doneWork) {
					let chunk = this.populateQueue[this.populateQueue.length - 1]
					if (!chunk.caves) {
						chunk.carveCaves()
						debug("Carve caves")
					} else if (!chunk.populated) {
						chunk.populate()
						this.populateQueue.pop()
					}
					doneWork = true
				}

				if (this.chunkGenQueue.length && !doneWork) {
					let chunk = this.chunkGenQueue[0]
					if (!fillReqs(chunk.x >> 4, chunk.z >> 4)) {}
					else if (!chunk.loaded) {
						chunk.load()
					} else if (!chunk.optimized) {
						chunk.optimize(this)
						debug("Optimize")
					} else if (!chunk.buffer) {
						chunk.genMesh()
						debug("Initial mesh")
					} else {
						this.chunkGenQueue.shift()
						setGeneratedChunks(generatedChunks + 1)
					}
					doneWork = true
				}
				if (!doneWork) {
					break
				}
			} while(win.performance.now() - tickStart < 5)
		}
		render() {
			// Advance the day/night clock by the real time since the last frame.
			let now = win.performance.now()
			if (!this.lastRender) this.lastRender = now
			let delta = now - this.lastRender
			this.lastRender = now
			if (delta > 100) delta = 0
			this.time = ((this.time + delta) % (DAY_LENGTH * 1000) + DAY_LENGTH * 1000) % (DAY_LENGTH * 1000)

			initModelView(p)
			gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)

			use3d()
			const sky = computeSky(this.time / 1000)
			gl.uniform3f(glCache.uSky, sky.horizonColor[0], sky.horizonColor[1], sky.horizonColor[2])
			gl.uniform3f(glCache.uSun, sky.sun[0], sky.sun[1], sky.sun[2])
			gl.uniform1f(glCache.uSkyBrightness, sky.brightness)

			p2.x = Math.round(p.x)
			p2.y = Math.round(p.y)
			p2.z = Math.round(p.z)

			setRenderedChunks(0)

			let dist = (settings.renderDistance) * 16
			if (this.chunkGenQueue.length) {
				this.chunkGenQueue.sort(sortChunks)
				let chunk = this.chunkGenQueue[0]
				dist = Math.min(dist, chunkDist(chunk))
			}
			if (dist !== fogDist) {
				if (fogDist < dist - 0.1) fogDist += (dist - fogDist) / 120
				else if (fogDist > dist + 0.1) fogDist += (dist - fogDist) / 30
				else fogDist = dist
			}
			gl.uniform3f(glCache.uPos, p.x, p.y, p.z)
			gl.uniform1f(glCache.uDist, fogDist)

			let c = this.sortedChunks
			for (let chunk of c) {
				chunk.render()
			}
			renderDrops()
			renderTnts()

			renderSkybox(this.time / 1000, matrix)
			use3d()

			gl.uniform3f(glCache.uPos, 0, 0, 0)

			if(hitBox.pos) {
				setBlockOutlines(true)
				setBlockFill(false)
				block2(hitBox.pos[0], hitBox.pos[1], hitBox.pos[2], 0, p)
				setBlockOutlines(false)
				setBlockFill(true)
			}
		}
		loadChunks() {
			let renderDistance = settings.renderDistance + 2
			let cx = p.x >> 4
			let cz = p.z >> 4
			p.cx = cx
			p.cz = cz
			let minChunkX = cx - renderDistance
			let maxChunkX = cx + renderDistance
			let minChunkZ = cz - renderDistance
			let maxChunkZ = cz + renderDistance

			this.offsetX = -minChunkX
			this.offsetZ = -minChunkZ
			this.lwidth = renderDistance * 2 + 1
			this.chunkGenQueue.length = 0

			if (this.loaded.length > this.lwidth * this.lwidth) {
				this.loaded.length = this.lwidth * this.lwidth
			}

			let i = 0
			for (let x = minChunkX; x <= maxChunkX; x++) {
				for (let z = minChunkZ; z <= maxChunkZ; z++) {
					let chunk
					if (!this.chunks[x]) {
						this.chunks[x] = []
					}
					if (!this.chunks[x][z]) {
						chunk = new Chunk(x * 16, z * 16)
						if (maxDist(cx, cz, x, z) <= settings.renderDistance) {
							this.chunkGenQueue.push(chunk)
						}
						this.chunks[x][z] = chunk
					}
					chunk = this.chunks[x][z]
					if (!chunk.buffer && !this.chunkGenQueue.includes(chunk) && maxDist(cx, cz, x, z) <= settings.renderDistance) {
						this.chunkGenQueue.push(chunk)
					}
					this.loaded[i++] = chunk
				}
			}
			this.sortedChunks = this.loaded.filter(renderFilter)
			this.sortedChunks.sort(sortChunks)
		}
		getSaveString() {
			let edited = []
			for (let x in this.chunks) {
				for (let z in this.chunks[x]) {
					let chunk = this.chunks[x][z]
					if (chunk.edited) {
						for (let y = 0; y < chunk.sections.length; y++) {
							if (chunk.sections[y].edited) {
								edited.push([ chunk.sections[y], chunk.cleanSections[y] ])
							}
						}
					}
				}
			}

			let pallete = {}
			for (let chunks of edited) {
				let changes = false
				chunks[0].blocks.forEach((id, i) => {
					if (id !== chunks[1][i]) {
						pallete[id] = true
						changes = true
					}
				})
				if (!changes) {
					chunks[0].edited = false
				}
			}

			let blocks = Object.keys(pallete).map(n => Number(n))
			pallete = {}
			blocks.forEach((block, index) => pallete[block] = index)

			let rnd = Math.round
			let options = p.flying | superflat << 1 | p.spectator << 2 | caves << 3 | trees << 4 | (gameMode === "creative" ? 1 : 0) << 5

			let str = world.name + ";" + worldSeed.toString(36) + ";"
				+ rnd(p.x).toString(36) + "," + rnd(p.y).toString(36) + "," + rnd(p.z).toString(36) + ","
				+ (p.rx * 100 | 0).toString(36) + "," + (p.ry * 100 | 0).toString(36) + "," + options.toString(36) + "," + rnd(world.time || 0).toString(36) + ";"
				+ version + ";"
				+ blocks.map(b => b.toString(36)).join(",") + ";"

			for (let i = 0; i < edited.length; i++) {
				if (!edited[i][0].edited) {
					continue
				}
				let real = edited[i][0]
				let blocks = real.blocks
				let original = edited[i][1]
				str += (real.x / 16).toString(36) + "," + (real.y / 16).toString(36) + "," + (real.z / 16).toString(36) + ","
				for (let j = 0; j < original.length; j++) {
					if (blocks[j] !== original[j]) {
						str += (pallete[blocks[j]] << 12 | j).toString(36) + ","
					}
				}
				str = str.substr(0, str.length - 1); //Remove trailing comma
				str += ";"
			}
			if (str.match(/;$/)) str = str.substr(0, str.length - 1)
			return str
		}
		loadSave(str) {
			let data = str.split(";")
			if (!str.includes("Alpha")) {
				return this.loadOldSave(str)
			}

			this.name = data.shift()
			setWorldSeed(parseInt(data.shift(), 36))
			seedHash(worldSeed)
			setCaveNoise(openSimplexNoise(worldSeed))
			noiseSeed(worldSeed)

			let playerData = data.shift().split(",")
			p.x = parseInt(playerData[0], 36)
			p.y = parseInt(playerData[1], 36)
			p.z = parseInt(playerData[2], 36)
			p.rx = parseInt(playerData[3], 36) / 100
			p.ry = parseInt(playerData[4], 36) / 100
			let options = parseInt(playerData[5], 36)
			p.flying = options & 1
			p.spectator = options >> 2 & 1
			setSuperflat(Boolean(options >> 1 & 1))
			setCaves(Boolean(options >> 3 & 1))
			setTrees(Boolean(options >> 4 & 1))
			setGameMode(options >> 5 & 1 ? "creative" : "survival")
			if (gameMode === "survival") {
				p.flying = false
				p.spectator = false
			}
			this.time = parseInt(playerData[6], 36)
			if (!(this.time >= 0)) this.time = 150000

			let version = data.shift()
			this.version = version

			// if (version.split(" ")[1].split(".").join("") < 70) {
			// 	alert("This save code is for an older version. 0.7.0 or later is needed")
			// }

			let pallete = data.shift().split(",").map(n => parseInt(n, 36))
			this.loadFrom = []

			for (let i = 0; data.length; i++) {
				let blocks = data.shift().split(",")
				this.loadFrom.push({
					x: parseInt(blocks.shift(), 36),
					y: parseInt(blocks.shift(), 36),
					z: parseInt(blocks.shift(), 36),
					blocks: [],
				})
				for (let j = 0; j < blocks.length; j++) {
					let block = parseInt(blocks[j], 36)
					let index = block & 0xffffff
					let pid = block >> 12
					this.loadFrom[i].blocks[index] = pallete[pid]
				}
			}
		}
		loadOldSave(str) {
			let data = str.split(";");
			setWorldSeed(parseInt(data.shift(), 36));
			this.id = Date.now()
			this.name = "Old World " + (Math.random() * 1000 | 0)
			seedHash(worldSeed);
			setCaveNoise(openSimplexNoise(worldSeed));
			noiseSeed(worldSeed);
			let playerData = data.shift().split(",");
			p.x = parseInt(playerData[0], 36);
			p.y = parseInt(playerData[1], 36);
			p.z = parseInt(playerData[2], 36);
			p.rx = parseInt(playerData[3], 36) / 100;
			p.ry = parseInt(playerData[4], 36) / 100;
			let editCount = parseInt(data.shift(), 36);

			this.loadFrom = [];

			let coords = data.shift().split(",").map(function(n) {
				return parseInt(n, 36);
			});
			for (let j = 0; j < coords.length; j += 3) {
				this.loadFrom.push({
					x: coords[j],
					y: coords[j + 1],
					z: coords[j + 2],
					blocks: [],
				})
			}

			for (let i = 0; data.length > 0; i++) {
				let blocks = data.shift().split(",");
				for (let j = 0; j < blocks.length; j++) {
					let block = parseInt(blocks[j], 36);
					let index = block >> 8;
					let id = block & 0x7f | (block & 0x80) << 1;
					this.loadFrom[i].blocks[index] = id;
				}
			}
		}
	}

	let defineWorld = function() {
		let tickStart = win.performance.now()
		world.tick()
		analytics.totalTickTime += win.performance.now() - tickStart
		let renderStart = win.performance.now()
		world.render()
		analytics.totalRenderTime += win.performance.now() - renderStart
	}



	function initWorldsMenu() {
		while (window.worlds.firstChild) {
			window.worlds.removeChild(window.worlds.firstChild)
		}
		setSelectedWorld(0)
		window.boxCenterTop.value = ""

		const deselect = () => {
			let elem = document.getElementsByClassName("selected")
			if (elem && elem[0]) {
				elem[0].classList.remove("selected")
			}
		}

		function addWorld(name, version, size, id, edited) {
			let div = doc.createElement("div")
			div.className = "world"
			div.onclick = e => {
				deselect()
				div.classList.add("selected")
				setSelectedWorld(id)
			}
			let br = "<br>"
			div.id = id
			div.innerHTML = "<strong>" + name + "</strong>" + br
			
			if (edited){
				let str = (new Date(edited).toLocaleDateString(undefined, {
					year: "numeric",
					month: "short",
					day: "numeric",
					hour: "numeric",
					minute: "2-digit"
				}))
				div.innerHTML += str + br
			}
			div.innerHTML += version + br
			div.innerHTML += `${size.toLocaleString()} bytes used`
			
			window.worlds.appendChild(div)
		}

		for (let k in worlds) delete worlds[k]
		if (loadString) {
			try {
				let tempWorld = new World()
				tempWorld.loadSave(loadString)
				let now = Date.now()
				addWorld(`${tempWorld.name} (Pre-loaded)`, tempWorld.version, loadString.length, now)
				worlds[now] = {
					code: loadString,
					id: now
				}
			}
			catch(e) {
				console.log("Unable to load hardcoded save.")
				console.error(e)
			}
		}
		loadFromDB().then(res => {
			if(res && res.length) {
				let index = res.findIndex(obj => obj.id === "settings")
				if (index >= 0) {
					Object.assign(settings, res[index].data) // Stored data overrides any hardcoded settings
					p.FOV(settings.fov)
					res.splice(index, 1)
				}
			}
			
			if (res && res.length) {
				res = res.map(d => d.data).filter(d => d && d.code).sort((a, b) => b.edited - a.edited)
				for (let data of res) {
					addWorld(data.name, data.version, (data.code.length + 60), data.id, data.edited)
					worlds[data.id] = data
				}
			}
			window.worlds.onclick = Button.draw
			window.boxCenterTop.onkeyup = Button.draw
		}).catch(e => console.error(e))

		setSuperflat(false)
		setTrees(true)
		setCaves(true)
	}
	


export {
	createDatabase, loadFromDB, saveToDB, deleteFromDB, save,
	chunkDist, sortChunks, fillReqs, maxDist, renderFilter, debug, fogDist,
	World, defineWorld, initWorldsMenu
}
