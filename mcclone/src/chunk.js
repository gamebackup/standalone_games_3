import { blockData, BLOCK_COUNT, blockIds } from './blocks.js'
import {
	world, p, gl, tex, textureMap, textureCoords, bigArray, screen, glCache, place,
	caves, superflat, trees, win, renderedChunks, setRenderedChunks
} from './state.js'
import {
	CUBE, SLAB, STAIR, FLIP, NORTH, SOUTH, EAST, WEST, ROTATION, BASE_MASK, STATE_MASK,
	DOOR_UPPER, DOOR_OPEN, DOOR_HINGE, DOOR_FACING, TRAPDOOR_BOTTOM, TRAPDOOR_OPEN, TRAPDOOR_FACING,
	TORCH_HANGING, LIGHT_MAX, LIGHT_LIFT, Block, Sides
} from './engine.js'
import { BIOMES, BIOME_PLAINS, random, randomSeed, hash } from './noise.js'
import { isCave, carveSphere } from './player.js'
import { placeVillageStructure } from './structures.js'


	function getBlock(x, y, z, blocks) {
		return blocks[((x >> 4) + 1) * 9 + ((y >> 4) + 1) * 3 + (z >> 4) + 1][((x & 15) << 8) + ((y & 15) << 4) + (z & 15)]
	}
	/**
	 * Returns a 1 if the face is exposed and should be drawn, or a 0 if the face is hidden
	 * 
	 * @param {number} x - The X coordinate of the block that may be covering a face
	 * @param {number} y - The Y coordinate of the block that may be covering a face
	 * @param {number} z - The Z coordinate of the block that may be covering a face
	 * @param {Collection} blocks - Some collection of blocks that can return the block at (x, y, z)
	 * @param {number} type - The blockstate of the block that's being considered for face culling
	 * @param {function} func - The function that can be called to return a block from the blocks collection
	*/
	function hideFace(x, y, z, blocks, type, func, sourceDir, dir) {
		let block = func.call(world, x, y, z, blocks)
		if (!block) {
			return 1
		}

		let data = blockData[block]
		let sourceData = blockData[type]
		if (!data) {
			return 1
		}

		let sourceRange = 3
		let hiderRange = 3
		if (func !== getBlock || screen === "loading") {
			// getBlock is only used during the optimize phase of worldGen
			sourceRange = sourceData.shape.cull[sourceDir]
			hiderRange = data.shape.cull[dir]
		}

		if ((sourceRange & hiderRange) !== sourceRange || sourceRange === 0 || block !== type && data.transparent || data.transparent && data.shadow) {
			return 1
		}
		return 0
	}
	let getShadows = {
		shade: [ 1, 0.85, 0.7, 0.6, 0.3 ],
		ret: [],
		blocks: [],
		top: function(x, y, z, block) { // Actually the bottom... How did these get flipped?
			let blocks = this.blocks
			let ret = this.ret
			blocks[0] = blockData[getBlock(x-1, y-1, z-1, block)].shadow
			blocks[1] = blockData[getBlock(x, y-1, z-1, block)].shadow
			blocks[2] = blockData[getBlock(x+1, y-1, z-1, block)].shadow
			blocks[3] = blockData[getBlock(x-1, y-1, z, block)].shadow
			blocks[4] = blockData[getBlock(x, y-1, z, block)].shadow
			blocks[5] = blockData[getBlock(x+1, y-1, z, block)].shadow
			blocks[6] = blockData[getBlock(x-1, y-1, z+1, block)].shadow
			blocks[7] = blockData[getBlock(x, y-1, z+1, block)].shadow
			blocks[8] = blockData[getBlock(x+1, y-1, z+1, block)].shadow

			ret[0] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]]*0.75
			ret[1] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]]*0.75
			ret[2] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]]*0.75
			ret[3] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]]*0.75
			return ret
		},
		bottom: function(x, y, z, block) { // Actually the top
			let blocks = this.blocks
			let ret = this.ret
			blocks[0] = blockData[getBlock(x-1, y+1, z-1, block)].shadow
			blocks[1] = blockData[getBlock(x, y+1, z-1, block)].shadow
			blocks[2] = blockData[getBlock(x+1, y+1, z-1, block)].shadow
			blocks[3] = blockData[getBlock(x-1, y+1, z, block)].shadow
			blocks[4] = blockData[getBlock(x, y+1, z, block)].shadow
			blocks[5] = blockData[getBlock(x+1, y+1, z, block)].shadow
			blocks[6] = blockData[getBlock(x-1, y+1, z+1, block)].shadow
			blocks[7] = blockData[getBlock(x, y+1, z+1, block)].shadow
			blocks[8] = blockData[getBlock(x+1, y+1, z+1, block)].shadow

			ret[0] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]]
			ret[1] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]]
			ret[2] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]]
			ret[3] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]]
			return ret
		},
		north: function(x, y, z, block) {
			let blocks = this.blocks
			let ret = this.ret
			blocks[0] = blockData[getBlock(x-1, y-1, z+1, block)].shadow
			blocks[1] = blockData[getBlock(x, y-1, z+1, block)].shadow
			blocks[2] = blockData[getBlock(x+1, y-1, z+1, block)].shadow
			blocks[3] = blockData[getBlock(x-1, y, z+1, block)].shadow
			blocks[4] = blockData[getBlock(x, y, z+1, block)].shadow
			blocks[5] = blockData[getBlock(x+1, y, z+1, block)].shadow
			blocks[6] = blockData[getBlock(x-1, y+1, z+1, block)].shadow
			blocks[7] = blockData[getBlock(x, y+1, z+1, block)].shadow
			blocks[8] = blockData[getBlock(x+1, y+1, z+1, block)].shadow

			ret[0] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]]*0.95
			ret[1] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]]*0.95
			ret[2] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]]*0.95
			ret[3] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]]*0.95
			return ret
		},
		south: function(x, y, z, block) {
			let blocks = this.blocks
			let ret = this.ret
			blocks[0] = blockData[getBlock(x-1, y-1, z-1, block)].shadow
			blocks[1] = blockData[getBlock(x-1, y, z-1, block)].shadow
			blocks[2] = blockData[getBlock(x-1, y+1, z-1, block)].shadow
			blocks[3] = blockData[getBlock(x, y-1, z-1, block)].shadow
			blocks[4] = blockData[getBlock(x, y, z-1, block)].shadow
			blocks[5] = blockData[getBlock(x, y+1, z-1, block)].shadow
			blocks[6] = blockData[getBlock(x+1, y-1, z-1, block)].shadow
			blocks[7] = blockData[getBlock(x+1, y, z-1, block)].shadow
			blocks[8] = blockData[getBlock(x+1, y+1, z-1, block)].shadow

			ret[0] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]]*0.95
			ret[1] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]]*0.95
			ret[2] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]]*0.95
			ret[3] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]]*0.95
			return ret
		},
		east: function(x, y, z, block) {
			let blocks = this.blocks
			let ret = this.ret
			blocks[0] = blockData[getBlock(x+1, y-1, z-1, block)].shadow
			blocks[1] = blockData[getBlock(x+1, y, z-1, block)].shadow
			blocks[2] = blockData[getBlock(x+1, y+1, z-1, block)].shadow
			blocks[3] = blockData[getBlock(x+1, y-1, z, block)].shadow
			blocks[4] = blockData[getBlock(x+1, y, z, block)].shadow
			blocks[5] = blockData[getBlock(x+1, y+1, z, block)].shadow
			blocks[6] = blockData[getBlock(x+1, y-1, z+1, block)].shadow
			blocks[7] = blockData[getBlock(x+1, y, z+1, block)].shadow
			blocks[8] = blockData[getBlock(x+1, y+1, z+1, block)].shadow

			ret[0] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]]*0.8
			ret[1] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]]*0.8
			ret[2] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]]*0.8
			ret[3] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]]*0.8
			return ret
		},
		west: function(x, y, z, block) {
			let blocks = this.blocks
			let ret = this.ret
			blocks[0] = blockData[getBlock(x-1, y-1, z-1, block)].shadow
			blocks[1] = blockData[getBlock(x-1, y, z-1, block)].shadow
			blocks[2] = blockData[getBlock(x-1, y+1, z-1, block)].shadow
			blocks[3] = blockData[getBlock(x-1, y-1, z, block)].shadow
			blocks[4] = blockData[getBlock(x-1, y, z, block)].shadow
			blocks[5] = blockData[getBlock(x-1, y+1, z, block)].shadow
			blocks[6] = blockData[getBlock(x-1, y-1, z+1, block)].shadow
			blocks[7] = blockData[getBlock(x-1, y, z+1, block)].shadow
			blocks[8] = blockData[getBlock(x-1, y+1, z+1, block)].shadow

			ret[0] = this.shade[blocks[7] + blocks[8] + blocks[4] + blocks[5]]*0.8
			ret[1] = this.shade[blocks[5] + blocks[4] + blocks[2] + blocks[1]]*0.8
			ret[2] = this.shade[blocks[4] + blocks[3] + blocks[1] + blocks[0]]*0.8
			ret[3] = this.shade[blocks[6] + blocks[7] + blocks[3] + blocks[4]]*0.8
			return ret
		},
	}

	function interpolateShadows(shadows, x, y) {
		let sx = (shadows[1] - shadows[0]) * x + shadows[0]
		let sx2 = (shadows[3] - shadows[2]) * x + shadows[2]
		return (sx2 - sx) * y + sx
	}

	class Section {
		constructor(x, y, z, size, chunk) {
			this.x = x
			this.y = y
			this.z = z
			this.size = size
			this.arraySize = size * size * size
			this.blocks = new Int32Array(this.arraySize)
			this.compressed = new Uint8Array(this.arraySize)
			this.renderData = []
			this.renderLength = 0
			this.faces = 0
			this.hasVisibleBlocks = false
			this.chunk = chunk
			this.edited = false
			this.caves = !caves
			this.pallete = [0]
			this.palleteMap = {"0": 0}
			this.palleteSize = 0
			this.light = null
			this.lightDirty = true
			this.hasLight = false
		}
		getBlock(x, y, z) {
			let s = this.size
			return this.blocks[x * s * s + y * s + z]
		}
		setBlock(x, y, z, blockId) {
			let s = this.size
			this.blocks[x * s * s + y * s + z] = blockId
		}
		deleteBlock(x, y, z) {
			let s = this.size
			this.blocks[x * s * s + y * s + z] = 0
		}
		// Recompute the emissive lightmap for this section. Light starts at the
		// emitting blocks and falls off by one per cell, passing only through
		// transparent blocks. Blocks outside the section are ignored, so light
		// does not cross section borders (a minor cosmetic limitation).
		relight() {
			let s = this.size
			let light = this.light || new Uint8Array(s * s * s)
			light.fill(0)
			let blocks = this.blocks
			let queue = []
			let head = 0
			let tail = 0
			for (let i = 0; i < s * s * s; i++) {
				let data = blockData[blocks[i] & STATE_MASK]
				if (data && data.light) {
					light[i] = data.light
					queue[tail++] = i
				}
			}
			this.hasLight = head < tail
			if (!this.hasLight) {
				this.light = light
				return
			}
			let passes = new Uint8Array(s * s * s)
			for (let i = 0; i < s * s * s; i++) {
				let data = blocks[i] ? blockData[blocks[i] & STATE_MASK] : null
				passes[i] = !data || data.transparent ? 1 : 0
			}
			while (head < tail) {
				let curIdx = queue[head++]
				let cur = light[curIdx]
				let lower = cur - 1
				if (lower <= 0) {
					continue
				}
				// index layout: x * s*s + y * s + z
				let x = curIdx / (s * s) | 0
				let rem = curIdx % (s * s)
				let y = rem / s | 0
				let z = rem % s
				let xo = x > 0, xs = x < s - 1, yo = y > 0, ys = y < s - 1, zo = z > 0, zs = z < s - 1
				if (xo) { let n = curIdx - s * s; if (passes[n] && light[n] < lower) { light[n] = lower; queue[tail++] = n } }
				if (xs) { let n = curIdx + s * s; if (passes[n] && light[n] < lower) { light[n] = lower; queue[tail++] = n } }
				if (yo) { let n = curIdx - s;    if (passes[n] && light[n] < lower) { light[n] = lower; queue[tail++] = n } }
				if (ys) { let n = curIdx + s;    if (passes[n] && light[n] < lower) { light[n] = lower; queue[tail++] = n } }
				if (zo) { let n = curIdx - 1;    if (passes[n] && light[n] < lower) { light[n] = lower; queue[tail++] = n } }
				if (zs) { let n = curIdx + 1;    if (passes[n] && light[n] < lower) { light[n] = lower; queue[tail++] = n } }
			}
			this.light = light
		}
		optimize() {
			let visible = false
			let pos = 0
			let xx = this.x
			let yy = this.y
			let zz = this.z
			let blockState = 0
			let palleteIndex = 0
			let index = 0
			let s = this.size
			let blocks = this.blocks
			this.hasVisibleBlocks = false
			this.renderLength = 0
			let localBlocks = world.getAdjacentSubchunks(xx, yy, zz)

			//Check all the blocks in the subchunk to see if they're visible.
			for (let i = 0; i < s; i++) {
				for (let j = 0; j < s; j++) {
					for (let k = 0; k < s; k++, index++) {
						blockState = blocks[index]

						if (this.palleteMap[blockState] === undefined) {
							this.palleteMap[blockState] = this.pallete.length
							palleteIndex = this.pallete.length
							this.pallete.push(blockState)
						} else {
							palleteIndex = this.palleteMap[blockState]
						}

						visible = blockState && (hideFace(i-1, j, k, localBlocks, blockState, getBlock, "west", "east")
						| hideFace(i+1, j, k, localBlocks, blockState, getBlock, "east", "west") << 1
						| hideFace(i, j-1, k, localBlocks, blockState, getBlock, "bottom", "top") << 2
						| hideFace(i, j+1, k, localBlocks, blockState, getBlock, "top", "bottom") << 3
						| hideFace(i, j, k-1, localBlocks, blockState, getBlock, "south", "north") << 4
						| hideFace(i, j, k+1, localBlocks, blockState, getBlock, "north", "south") << 5)
						if (visible) {
							pos = (i | j << 4 | k << 8) << 19
							this.renderData[this.renderLength++] = 1 << 31 | pos | visible << 13 | palleteIndex
							this.hasVisibleBlocks = true
						}
					}
				}
			}
		}
		updateBlock(x, y, z, world) {
			this.lightDirty = true
			if (!world.meshQueue.includes(this.chunk)) {
				world.meshQueue.push(this.chunk)
			}
			let i = x
			let j = y
			let k = z
			let s = this.size
			x += this.x
			y += this.y
			z += this.z
			let blockState = this.blocks[i * s * s + j * s + k]
			let visible = blockState && (hideFace(x-1, y, z, 0, blockState, world.getBlock, "west", "east")
			| hideFace(x+1, y, z, 0, blockState, world.getBlock, "east", "west") << 1
			| hideFace(x, y-1, z, 0, blockState, world.getBlock, "bottom", "top") << 2
			| hideFace(x, y+1, z, 0, blockState, world.getBlock, "top", "bottom") << 3
			| hideFace(x, y, z-1, 0, blockState, world.getBlock, "south", "north") << 4
			| hideFace(x, y, z+1, 0, blockState, world.getBlock, "north", "south") << 5)
			let pos = (i | j << 4 | k << 8) << 19
			let index = -1

			// Find index of current block in this.renderData
			for (let i = 0; i < this.renderLength; i++) {
				if ((this.renderData[i] & 0x7ff80000) === pos) {
					index = i
					break
				}
			}

			// Update pallete
			if (this.palleteMap[blockState] === undefined) {
				this.palleteMap[blockState] = this.pallete.length
				this.pallete.push(blockState)
			}

			if (index < 0 && !visible) {
				// Wasn't visible before, isn't visible after.
				return
			}
			if (!visible) {
				// Was visible before, isn't visible after.
				this.renderData.splice(index, 1)
				this.renderLength--
				this.hasVisibleBlocks = !!this.renderLength
				return
			}
			if (visible && index < 0) {
				// Wasn't visible before, is visible after.
				index = this.renderLength++
				this.hasVisibleBlocks = true
			}
			this.renderData[index] = 1 << 31 | pos | visible << 13 | this.palleteMap[blockState]
		}
		genMesh(barray, index) {
			if (this.lightDirty) {
				this.relight()
				this.lightDirty = false
			}
			if (!this.renderLength) {
				return index
			}
			let length = this.renderLength
			let rData = this.renderData
			let x = 0, y = 0, z = 0, loc = 0, data = 0, sides = 0, tex = null, x2 = 0, y2 = 0, z2 = 0, verts = null, texVerts = null, texShapeVerts = null, tx = 0, ty = 0
			let wx = this.x, wy = this.y, wz = this.z
			let blocks = world.getAdjacentSubchunks(wx, wy, wz)
			let block = null

			let shadows = null
			let blockSides = Object.keys(Block)
			let side = ""
			let shapeVerts = null
			let shapeTexVerts = null
			let pallete = this.pallete
			let intShad = interpolateShadows
			
			for (let i = 0; i < length; i++) {
				data = rData[i]
				block = blockData[pallete[data & 0x1fff]]
				tex = block.textures
				sides = data >> 13 & 0x3f
				loc = data >> 19 & 0xfff
				x = loc & 15
				y = loc >> 4 & 15
				z = loc >> 8 & 15

				x2 = x + this.x
				y2 = y + this.y
				z2 = z + this.z

				shapeVerts = block.shape.verts
				shapeTexVerts = block.shape.texVerts

				let texNum = 0
				for (let n = 0; n < 6; n++) {
					side = blockSides[n]
					if (sides & Block[side]) {
						shadows = getShadows[side](x, y, z, blocks)
						if (this.hasLight) {
							// Light a face from the cell it opens into, lifting it
							// from the ambient minimum up to full brightness.
							let lx = x, ly = y, lz = z
							if (side === "north") lz--
							else if (side === "south") lz++
							else if (side === "east") lx++
							else if (side === "west") lx--
							else if (side === "top") ly++
							else ly--
							let lightCell
							if (lx >= 0 && lx < 16 && ly >= 0 && ly < 16 && lz >= 0 && lz < 16) {
								lightCell = this.light[lx * 256 + ly * 16 + lz]
							} else {
								lightCell = this.light[x * 256 + y * 16 + z]
							}
							if (lightCell) {
								let lift = LIGHT_LIFT + (1 - LIGHT_LIFT) * lightCell / LIGHT_MAX
								shadows[0] = Math.max(shadows[0], lift)
								shadows[1] = Math.max(shadows[1], lift)
								shadows[2] = Math.max(shadows[2], lift)
								shadows[3] = Math.max(shadows[3], lift)
							}
						}
						let directionalFaces = shapeVerts[Sides[side]]
						// if (directionalFaces.length > 1) {
						// 	let average = (shadows[0] + shadows[1] + shadows[2] + shadows[3]) / 4
						// 	shadows[0] = average
						// 	shadows[1] = average
						// 	shadows[2] = average
						// 	shadows[3] = average
						// }
						for (let facei = 0; facei < directionalFaces.length; facei++) {
							verts = directionalFaces[facei]
							texVerts = textureCoords[textureMap[tex[texNum]]]
							tx = texVerts[0]
							ty = texVerts[1]
							texShapeVerts = shapeTexVerts[n][facei]

							barray[index] = verts[0] + x2
							barray[index+1] = verts[1] + y2
							barray[index+2] = verts[2] + z2
							barray[index+3] = tx + texShapeVerts[0]
							barray[index+4] = ty + texShapeVerts[1]
							barray[index+5] = shadows[0]

							barray[index+6] = verts[3] + x2
							barray[index+7] = verts[4] + y2
							barray[index+8] = verts[5] + z2
							barray[index+9] = tx + texShapeVerts[2]
							barray[index+10] = ty + texShapeVerts[3]
							barray[index+11] = shadows[1]

							barray[index+12] = verts[6] + x2
							barray[index+13] = verts[7] + y2
							barray[index+14] = verts[8] + z2
							barray[index+15] = tx + texShapeVerts[4]
							barray[index+16] = ty + texShapeVerts[5]
							barray[index+17] = shadows[2]

							barray[index+18] = verts[9] + x2
							barray[index+19] = verts[10] + y2
							barray[index+20] = verts[11] + z2
							barray[index+21] = tx + texShapeVerts[6]
							barray[index+22] = ty + texShapeVerts[7]
							barray[index+23] = shadows[3]
							index += 24
						}
					}
					texNum++
				}
			}
			return index
		}
		carveCaves() {
			let wx = this.x + 16, wz = this.z + 16, wy = this.y + 16
			// The carve spheres are 3.5 blocks in radius, so sampling the noise
			// every second block still overlaps and leaves connected caves. This
			// is eight times less noise work, which is what lets chunk generation
			// keep up with the player instead of stalling the world.
			for (let x = this.x, xx = 0; x < wx; x += 2, xx += 2) {
				for (let z = this.z, zz = 0; z < wz; z += 2, zz += 2) {
					wy = this.chunk.tops[zz * 16 + xx]
					for (let y = this.y; y < wy; y += 2) {
						if (isCave(x, y, z)) {
							carveSphere(x, y, z)
						}
					}
				}
			}
			this.caves = true
		}
		tick() {
			for (let i = 0; i < 3; i++) {
				let rnd = Math.random() * this.blocks.length | 0
				if ((this.blocks[rnd]) === blockIds.grass) {
					// Spread grass

					let x = (rnd >> 8) + this.x
					let y = (rnd >> 4 & 15) + this.y
					let z = (rnd & 15) + this.z
					if (!blockData[world.getBlock(x, y + 1, z)].transparent) {
						world.setBlock(x, y, z, blockIds.dirt, false)
						return
					}

					let rnd2 = Math.random() * 27 | 0
					let x2 = rnd2 % 3 - 1
					rnd2 = (rnd2 - x2 - 1) / 3
					let y2 = rnd2 % 3 - 1
					rnd2 = (rnd2 - y2 - 1) / 3
					z += rnd2 - 1
					x += x2
					y += y2

					if (world.getBlock(x, y, z) === blockIds.dirt && world.getBlock(x, y + 1, z) === blockIds.air) {
						world.setBlock(x, y, z, blockIds.grass, false)
					}
				}
			}
		}
	}
	let emptySection = new Section(0, 0, 0, 16)
	let fullSection = new Section(0, 0, 0, 16)
	fullSection.blocks.fill(blockIds.bedrock)

	class Chunk {
		constructor(x, z) {
			this.x = x
			this.z = z
			this.maxY = 0
			this.minY = 255
			this.sections = []
			this.cleanSections = []
			this.tops = new Uint8Array(16 * 16); // Store the heighest block at every (x,z) coordinate
			this.biomes = new Uint8Array(16 * 16); // Biome id at every (x,z) column
			this.optimized = false
			this.generated = false; // Terrain
			this.populated = superflat; // Trees and ores
			this.lazy = false
			this.edited = false
			this.loaded = false
			this.caves = !caves
		}
		getBlock(x, y, z) {
			let s = y >> 4
			return this.sections.length > s ? this.sections[s].getBlock(x, y & 15, z) : 0
		}
		setBlock(x, y, z, blockID, hidden, user) {
			if (!this.sections[y >> 4]) {
				do {
					this.sections.push(new Section(this.x, this.sections.length * 16, this.z, 16, this))
				} while (!this.sections[y >> 4])
			}
			if (user && !this.sections[y >> 4].edited) {
				this.cleanSections[y >> 4] = this.sections[y >> 4].blocks.slice()
				this.sections[y >> 4].edited = true
				this.edited = true
			}
			this.sections[y >> 4].setBlock(x, y & 15, z, blockID, hidden)
		}
		optimize() {
			for (let i = 0; i < this.sections.length; i++) {
				this.sections[i].optimize()
			}
			if (!world.meshQueue.includes(this)) {
				world.meshQueue.push(this)
			}
			this.optimized = true
		}
		render() {
			if (!this.buffer) {
				return
			}
			if (p.canSee(this.x, this.minY, this.z, this.maxY)) {
				setRenderedChunks(renderedChunks + 1)
				gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
				gl.vertexAttribPointer(glCache.aVertex, 3, gl.FLOAT, false, 24, 0)
				gl.vertexAttribPointer(glCache.aTexture, 2, gl.FLOAT, false, 24, 12)
				gl.vertexAttribPointer(glCache.aShadow, 1, gl.FLOAT, false, 24, 20)
				gl.drawElements(gl.TRIANGLES, 6 * this.faces, gl.UNSIGNED_INT, 0)
			}
		}
		updateBlock(x, y, z, world, lazy) {
			if (this.buffer) {
				this.lazy = lazy
				if (this.sections.length > y >> 4) {
					this.sections[y >> 4].updateBlock(x, y & 15, z, world)
				}
			}
		}
		deleteBlock(x, y, z, user) {
			if (!this.sections[y >> 4]) {
				return
			}
			if (user && !this.sections[y >> 4].edited) {
				this.cleanSections[y >> 4] = this.sections[y >> 4].blocks.slice()
				this.sections[y >> 4].edited = true
				this.edited = true
			}
			this.sections[y >> 4].deleteBlock(x, y & 15, z)
			this.minY = y < this.minY ? y : this.minY
			this.maxY = y > this.maxY ? y : this.maxY
		}
		carveCaves() {
			for (let i = 0; i < this.sections.length; i++) {
				if (!this.sections[i].caves) {
					this.sections[i].carveCaves()
					if (i + 1 >= this.sections.length) {
						this.caves = true
					}
					return
				}
			}
		}
		populate() {
			randomSeed(hash(this.x, this.z) * 210000000)
			let wx = 0, wz = 0, ground = 0, top = 0, rand = 0, place = false

			for (let i = 0; i < 16; i++) {
				for (let k = 0; k < 16; k++) {
					wx = this.x + i
					wz = this.z + k
					ground = this.tops[k * 16 + i]
					let biome = BIOMES[this.biomes[k * 16 + i]] || BIOMES[BIOME_PLAINS]
					if (trees && biome.trees && random() < biome.treeChance && this.getBlock(i, ground, k)) {

						top = ground + Math.floor(4.5 + random(2.5))
						rand = Math.floor(random(4096))
						let tree = biome.trees[random() * biome.trees.length | 0] || blockIds.oakLog
						let leafBlock = biome.leaves || blockIds.leaves
						let soil = biome.layers && biome.layers[0] ? biome.layers[0][0] : blockIds.dirt

						//Center
						for (let j = ground + 1; j <= top; j++) {
							this.setBlock(i, j, k, tree)
						}
						this.setBlock(i, top + 1, k, leafBlock)
						this.setBlock(i, ground, k, soil)

						//Bottom leaves
						for (let x = -2; x <= 2; x++) {
							for (let z = -2; z <= 2; z++) {
								if (x || z) {
									if ((x * z & 7) === 4) {
										place = rand & 1
										rand >>>= 1
										if (place) {
											world.spawnBlock(wx + x, top - 2, wz + z, leafBlock)
										}
									} else {
										world.spawnBlock(wx + x, top - 2, wz + z, leafBlock)
									}
								}
							}
						}

						//2nd layer leaves
						for (let x = -2; x <= 2; x++) {
							for (let z = -2; z <= 2; z++) {
								if (x || z) {
									if ((x * z & 7) === 4) {
										place = rand & 1
										rand >>>= 1
										if (place) {
											world.spawnBlock(wx + x, top - 1, wz + z, leafBlock)
										}
									} else {
										world.spawnBlock(wx + x, top - 1, wz + z, leafBlock)
									}
								}
							}
						}

						//3rd layer leaves
						for (let x = -1; x <= 1; x++) {
							for (let z = -1; z <= 1; z++) {
								if (x || z) {
									if (x & z) {
										place = rand & 1
										rand >>>= 1
										if (place) {
											world.spawnBlock(wx + x, top, wz + z, leafBlock)
										}
									} else {
										world.spawnBlock(wx + x, top, wz + z, leafBlock)
									}
								}
							}
						}

						//Top leaves
						world.spawnBlock(wx + 1, top + 1, wz, leafBlock)
						world.spawnBlock(wx, top + 1, wz - 1, leafBlock)
						world.spawnBlock(wx, top + 1, wz + 1, leafBlock)
						world.spawnBlock(wx - 1, top + 1, wz, leafBlock)
					}

					// Blocks of each per chunk in Minecraft
					// Coal: 185.5
					// Iron: 111.5
					// Gold: 10.4
					// Redstone: 29.1
					// Diamond: 3.7
					// Lapis: 4.1
					ground -= 4

					if (random() < 3.7 / 256) {
						let y = (random() * 16 | 0) + 1
						y = y < ground ? y : ground
						if (this.getBlock(i, y, k)) {
							this.setBlock(i, y < ground ? y : ground, k, blockIds.diamondOre)
						}
					}

					if (random() < 111.5 / 256) {
						let y = (random() * 64 | 0) + 1
						y = y < ground ? y : ground
						if (this.getBlock(i, y, k)) {
							this.setBlock(i, y < ground ? y : ground, k, blockIds.ironOre)
						}
					}

					if (random() < 185.5 / 256) {
						let y = (random() * ground | 0) + 1
						y = y < ground ? y : ground
						if (this.getBlock(i, y, k)) {
							this.setBlock(i, y < ground ? y : ground, k, blockIds.coalOre)
						}
					}

					if (random() < 10.4 / 256) {
						let y = (random() * 32 | 0) + 1
						y = y < ground ? y : ground
						if (this.getBlock(i, y, k)) {
							this.setBlock(i, y < ground ? y : ground, k, blockIds.goldOre)
						}
					}

					if (random() < 29.1 / 256) {
						let y = (random() * 16 | 0) + 1
						y = y < ground ? y : ground
						if (this.getBlock(i, y, k)) {
							this.setBlock(i, y < ground ? y : ground, k, blockIds.redstoneOre)
						}
					}

					if (random() < 4.1 / 256) {
						let y = (random() * 32 | 0) + 1
						y = y < ground ? y : ground
						if (this.getBlock(i, y, k)) {
							this.setBlock(i, y < ground ? y : ground, k, blockIds.lapisOre)
						}
					}
				}
			}

			// Sparse flowers on grass. The species is chosen per column, so
			// neighbouring plants of the same kind still read as little patches.
			for (let i = 0; i < 16; i++) {
				for (let k = 0; k < 16; k++) {
					let biome = BIOMES[this.biomes[k * 16 + i]] || BIOMES[BIOME_PLAINS]
					let surf = this.tops[k * 16 + i]
					if (biome.flowers && random() < biome.flowerChance && this.getBlock(i, surf, k) === biome.surface && !this.getBlock(i, surf + 1, k)) {
						let flower = biome.flowers[random() * biome.flowers.length | 0]
						this.setBlock(i, surf + 1, k, flower)
					}
				}
			}

			// Village buildings only occur inside rare "village" cells, so they
			// cluster into small groups separated by wide empty stretches.
			let gx = Math.floor((this.x >> 4) / 3), gz = Math.floor((this.z >> 4) / 3)
			let village = Math.abs(hash(gx * 1013 + gz, gz * 1013 - gx)) % 1
			if (village < 0.04 && random() < 0.6) placeVillageStructure(this, random)

			this.populated = true
		}
		genMesh() {
			let start = win.performance.now()
			let barray = bigArray
			let index = 0
			for (let i = 0; i < this.sections.length; i++) {
				index = this.sections[i].genMesh(barray, index)
			}
			let arrayDone = win.performance.now()

			if (!this.buffer) {
				this.buffer = gl.createBuffer()
			}
			let data = barray.slice(0, index)

			let maxY = 0
			let minY = 255
			let y = 0
			for (let i = 1; i < data.length; i += 6) {
				y = data[i]
				maxY = Math.max(maxY, y)
				minY = Math.min(minY, y)
			}
			this.maxY = maxY
			this.minY = minY
			this.faces = data.length / 24
			gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
			gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
			this.lazy = false
		}
		tick() {
			if (this.edited) {
				for (let i = 0; i < this.sections.length; i++) {
					if (this.sections[i].edited) {
						this.sections[i].tick()
					}
				}
			}
		}
		load() {
			let chunkX = this.x >> 4
			let chunkZ = this.z >> 4
			let load = null
			
			for (let i = 0; i < world.loadFrom.length; i++) {
				load = world.loadFrom[i]
				if (load.x === chunkX && load.z === chunkZ) {
					let y = load.y * 16
					for (let j in load.blocks) {
						world.setBlock((j >> 8 & 15) + this.x, (j >> 4 & 15) + y, (j & 15) + this.z, load.blocks[j])
					}
					world.loadFrom.splice(i--, 1)
				}
			}
			this.loaded = true
		}
	}


export {
	getBlock, hideFace, getShadows, interpolateShadows,
	Section, emptySection, fullSection, Chunk
}
