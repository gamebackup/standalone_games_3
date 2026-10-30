import { blockData, BLOCK_COUNT, blockIds } from './blocks.js'
import {
	win, world, p, gl, tex, textureMap, texCoordsBuffers, hitBox, holding, gameMode,
	place, maxHeight, blockFill, blockMode, program3D, sideEdgeBuffers, dropEdgeBuffers
} from './state.js'
import {
	CUBE, SLAB, STAIR, FLIP, NORTH, SOUTH, EAST, WEST, ROTATION, BASE_MASK, STATE_MASK,
	DOOR_UPPER, DOOR_OPEN, DOOR_HINGE, DOOR_FACING, TRAPDOOR_BOTTOM, TRAPDOOR_OPEN, TRAPDOOR_FACING,
	TORCH_HANGING, LIGHT_MAX, LIGHT_LIFT, uniformMatrix, Block, Sides, vertexAttribPointer
} from './engine.js'
import { idStack, idTexture, itemDef, itemIds } from './items.js'
import { heldStack, consumeHeld, addItem } from './ui.js'

	// Dropped item entities ("Q" drops one item from the held stack)
	let drops = []
	let dropLastFrame = 0
	let dropStats = { draws: 0 }
	const DROP_MERGE = 0.75
	const DROP_DESPAWN = 300000
	function spawnDrop(id, count) {
		if (!id || count <= 0) return
		let e = {
			id: id,
			count: count,
			x: p.x - Math.sin(p.ry) * 0.5,
			y: p.y + 0.3,
			z: p.z + Math.cos(p.ry) * 0.5,
			vx: p.direction.x * 0.3,
			vy: 0.35,
			vz: p.direction.z * 0.3,
			onGround: false,
			age: 0,
			spin: Math.random() * 6.28318
		}
		for (let i = 0; i < drops.length; i++) {
			let d = drops[i]
			if (d.id !== id || !d.onGround) continue
			let dx = d.x - e.x, dy = d.y - e.y, dz = d.z - e.z
			if (dx * dx + dy * dy + dz * dz < DROP_MERGE * DROP_MERGE) {
				let add = Math.min(idStack(id) - d.count, e.count)
				d.count += add
				e.count -= add
				if (e.count <= 0) return
			}
		}
		drops.push(e)
	}
	function dropHeld() {
		let st = heldStack()
		if (!st || st.count <= 0) return
		let id = st.id
		consumeHeld(1)
		spawnDrop(id, 1)
	}
	function isDropSolid(x, y, z) {
		let b = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))
		if (!b) return false
		let block = blockData[b & BASE_MASK]
		if (!block || block.liquid) return false
		return !!block.collisionShape || block.transparent !== true
	}
	function updateDrops() {
		if (!drops.length) return
		let now = win.performance.now()
		let elapsed = dropLastFrame ? now - dropLastFrame : 33
		let dt = elapsed / 33
		if (dt < 0) dt = 0
		dt = dt > 2 ? 2 : dt
		dropLastFrame = now
		for (let i = drops.length - 1; i >= 0; i--) {
			let e = drops[i]
			e.age += elapsed
			if (e.onGround) {
				if (!isDropSolid(e.x, e.y - 0.02, e.z)) {
					e.onGround = false
					e.vy = 0
				}
			} else {
				e.vy -= 0.045 * dt
				if (e.vy < -1) e.vy = -1
				e.x += e.vx * dt
				e.y += e.vy * dt
				e.z += e.vz * dt
				let drag = Math.pow(0.82, dt)
				e.vx *= drag
				e.vz *= drag
				if (e.vy <= 0 && isDropSolid(e.x, e.y - 0.02, e.z)) {
					e.y = Math.floor(e.y - 0.02) + 1.02
					e.vy = 0
					e.vx = 0
					e.vz = 0
					e.onGround = true
				}
			}
			if (e.age > 600) {
				let dx = p.x - e.x, dy = p.y + 0.6 - e.y, dz = p.z - e.z
				if (dx * dx + dy * dy + dz * dz < 1) {
					let leftover = addItem(e.id, e.count)
					if (!leftover) {
						drops.splice(i, 1)
						continue
					}
					e.count = leftover
				}
			}
			if (e.age > DROP_DESPAWN) {
				drops.splice(i, 1)
			}
		}
	}
	function drawDropCube(x, y, z, tex) {
		if (!blockFill || !dropEdgeBuffers) return
		let u = texCoordsBuffers[textureMap[tex]]
		if (!u) return
		dropStats.draws++
		p.transformation.translate(x, y, z)
		uniformMatrix("view3d", program3D, "uView", false, p.getMatrix())
		for (let side in Block) {
			vertexAttribPointer("aVertex", program3D, "aVertex", 3, dropEdgeBuffers[Sides[side]])
			vertexAttribPointer("aTexture", program3D, "aTexture", 2, u)
			gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0)
		}
		p.transformation.translate(-x, -y, -z)
	}
	function renderDrops() {
		if (!drops.length || !dropEdgeBuffers) return
		for (let i = 0; i < drops.length; i++) {
			let e = drops[i]
			let tex = idTexture(e.id)
			if (!tex || textureMap[tex] === undefined) continue
			drawDropCube(e.x, e.y + 0.15 + Math.sin(e.age / 250) * 0.04, e.z, tex)
		}
	}
	// TNT: an ignited TNT block becomes a short-lived lit entity that falls,
	// blinks, and then explodes, destroying nearby blocks and knocking the player.
	let tnts = []
	let tntLastFrame = 0
	const TNT_FUSE = 3500
	const TNT_RADIUS = 4
	function isTntBlock(block) {
		return (block & BASE_MASK) === blockIds.tnt
	}
	function primeTnt(x, y, z, fuseMs) {
		if (!isTntBlock(world.getBlock(x, y, z))) {
			return false
		}
		world.setBlock(x, y, z, 0)
		tnts.push({
			x: x, y: y, z: z,
			vx: 0, vy: 0.2, vz: 0,
			fuse: fuseMs === undefined ? TNT_FUSE : fuseMs,
			onGround: false
		})
		return true
	}
	function drawTntCube(x, y, z, tex) {
		if (!blockFill || !sideEdgeBuffers) return
		let u = texCoordsBuffers[textureMap[tex]]
		if (!u) return
		p.transformation.translate(x, y, z)
		uniformMatrix("view3d", program3D, "uView", false, p.getMatrix())
		for (let side in Block) {
			vertexAttribPointer("aVertex", program3D, "aVertex", 3, sideEdgeBuffers[Sides[side]])
			vertexAttribPointer("aTexture", program3D, "aTexture", 2, u)
			gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0)
		}
		p.transformation.translate(-x, -y, -z)
	}
	function renderTnts() {
		if (!tnts.length || !blockFill || !sideEdgeBuffers) return
		for (let i = 0; i < tnts.length; i++) {
			let e = tnts[i]
			// Flash between the side and top textures as the fuse runs down.
			let tex = "tntSides"
			if (e.fuse < 1200 && (Math.floor(e.fuse / 100) & 1)) tex = "tntTop"
			if (textureMap[tex] === undefined) tex = "tntSides"
			drawTntCube(e.x, e.y, e.z, tex)
		}
	}
	function updateTnts() {
		if (!tnts.length) return
		let now = win.performance.now()
		let dt = (now - (tntLastFrame || now - 33)) / 33
		if (dt < 0) dt = 0
		dt = dt > 2 ? 2 : dt
		let dtMs = tntLastFrame ? now - tntLastFrame : 0
		tntLastFrame = now
		for (let i = tnts.length - 1; i >= 0; i--) {
			let e = tnts[i]
			e.fuse -= dtMs
			if (e.onGround) {
				if (!isDropSolid(e.x + 0.5, e.y - 0.02, e.z + 0.5)) {
					e.onGround = false
					e.vy = 0
				}
			} else {
				e.vy -= 0.045 * dt
				if (e.vy < -1) e.vy = -1
				e.x += e.vx * dt
				e.y += e.vy * dt
				e.z += e.vz * dt
				let drag = Math.pow(0.82, dt)
				e.vx *= drag
				e.vz *= drag
				if (e.vy <= 0 && isDropSolid(e.x + 0.5, e.y - 0.02, e.z + 0.5)) {
					e.y = Math.floor(e.y - 0.02) + 1
					e.vy = 0
					e.vx = 0
					e.vz = 0
					e.onGround = true
				}
			}
			if (e.fuse <= 0) {
				tnts.splice(i, 1)
				explodeTnt(e.x + 0.5, e.y + 0.5, e.z + 0.5)
			}
		}
	}
	function explodeTnt(x, y, z) {
		let r = TNT_RADIUS
		let r2 = r * r
		let cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z)
		let chained = []
		for (let dx = -r; dx <= r; dx++) {
			for (let dy = -r; dy <= r; dy++) {
				for (let dz = -r; dz <= r; dz++) {
					let d2 = dx * dx + dy * dy + dz * dz
					if (d2 > r2) continue
					let bx = cx + dx, by = cy + dy, bz = cz + dz
					if (by <= 1 || by >= maxHeight) continue
					let b = world.getBlock(bx, by, bz)
					if (!b) continue
					let base = b & BASE_MASK
					if (base === blockIds.bedrock || base === blockIds.obsidian) continue
					// Blast resistance falls off with distance; outer blocks may survive.
					let dist = Math.sqrt(d2)
					if (dist > r * 0.7 && Math.random() < (dist / r) * 0.7) continue
					if (base === blockIds.tnt) {
						// Chain reactions: light neighbouring TNT with a short fuse.
						chained.push([ bx, by, bz ])
						continue
					}
					world.setBlock(bx, by, bz, 0)
				}
			}
		}
		for (let i = 0; i < chained.length; i++) {
			primeTnt(chained[i][0], chained[i][1], chained[i][2], 300 + Math.random() * 700)
		}
		// Knock the player away from the blast.
		let pdx = p.x - x, pdy = (p.y + 0.9) - y, pdz = p.z - z
		let pd = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz)
		let reach = r + 3
		if (pd < reach) {
			if (pd < 0.0001) { pdx = 0; pdy = 1; pdz = 0; pd = 1 }
			let f = 1 - pd / reach
			p.velocity.x += pdx / pd * f * 0.9
			p.velocity.y += pdy / pd * f * 0.7 + 0.15
			p.velocity.z += pdz / pd * f * 0.9
		}
	}
	function isSupporter(block) {
		block = block & BASE_MASK
		return block === blockIds.grass || block === blockIds.dirt ||
			block === blockIds.podzol || block === blockIds.coarseDirt ||
			block === blockIds.rootedDirt || block === blockIds.mycelium ||
			block === blockIds.mossBlock || block === blockIds.mud
	}
	// Torches need a full (non-plant) block on the side they attach to.
	function isTorchSupport(block) {
		if (!block) {
			return false
		}
		let data = blockData[block & STATE_MASK]
		return !!data && !data.cross && !data.torch && !data.fence && !data.door && !data.trap
	}
	// Blocks that own their shape (plants, fences, doors, trapdoors) ignore the slab/stair mode.
	function placementMode(id) {
		let data = blockData[id & STATE_MASK]
		if (!data) return blockMode
		if (data.cross || data.fence || data.door || data.trap || data.torch || data.flat) return CUBE
		if (data.slabOnly) return SLAB
		if (data.stairOnly) return STAIR
		return blockMode
	}
	function isDoorState(block) {
		return !!(block & STATE_MASK) && !!blockData[block & STATE_MASK].door
	}
	function isTrapState(block) {
		return !!(block & STATE_MASK) && !!blockData[block & STATE_MASK].trap
	}
	function toggleDoor(x, y, z) {
		let block = world.getBlock(x, y, z)
		if (!isDoorState(block)) {
			return
		}
		let base = block & BASE_MASK
		let upper = block & DOOR_UPPER
		let otherY = upper ? y - 1 : y + 1
		let other = otherY >= 0 && otherY < maxHeight ? world.getBlock(x, otherY, z) : 0
		if (other && (other & BASE_MASK) === base && isDoorState(other)) {
			world.setBlock(x, otherY, z, (other & ~DOOR_OPEN) | (block & DOOR_OPEN ? 0 : DOOR_OPEN))
		}
		world.setBlock(x, y, z, (block & ~DOOR_OPEN) | (block & DOOR_OPEN ? 0 : DOOR_OPEN))
		refreshFences(x, y, z)
		p.lastPlace = Date.now()
	}
	function placeDoor(baseId, x, y, z) {
		if (y + 1 >= maxHeight || world.getBlock(x, y + 1, z)) {
			return false
		}
		// Facing is decided exactly like the normal rotate-on-place path.
		let pi = Math.PI / 4
		let facing = NORTH
		if (p.ry > pi) {
			if (p.ry < 3 * pi) facing = WEST
			else if (p.ry < 5 * pi) facing = SOUTH
			else if (p.ry < 7 * pi) facing = EAST
		}
		// Pick the hinge so the door swings away from the player.
		let hinge = 0
		if (facing === NORTH || facing === SOUTH) {
			hinge = p.x >= x + 0.5 ? 0 : DOOR_HINGE
		} else {
			hinge = p.z >= z + 0.5 ? 0 : DOOR_HINGE
		}
		let state = baseId | facing | hinge
		world.setBlock(x, y, z, state)
		world.setBlock(x, y + 1, z, state | DOOR_UPPER)
		refreshFences(x, y, z)
		p.lastPlace = Date.now()
		return true
	}
	// The yaw -> facing mapping used by the normal rotate-on-place path.
	function facingFromYaw() {
		let pi = Math.PI / 4
		if (p.ry <= pi) return NORTH
		if (p.ry < 3 * pi) return WEST
		if (p.ry < 5 * pi) return SOUTH
		if (p.ry < 7 * pi) return EAST
		return NORTH
	}
	// Direction a placed block should face so its front side points at the player.
	function facingToPlayer(x, z) {
		let dx = p.x - (x + 0.5)
		let dz = p.z - (z + 0.5)
		if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? EAST : WEST
		return dz >= 0 ? NORTH : SOUTH
	}
	function toggleTrapdoor(x, y, z) {
		let block = world.getBlock(x, y, z)
		if (!isTrapState(block)) {
			return
		}
		world.setBlock(x, y, z, (block & ~TRAPDOOR_OPEN) | (block & TRAPDOOR_OPEN ? 0 : TRAPDOOR_OPEN))
		refreshFences(x, y, z)
		p.lastPlace = Date.now()
	}
	function placeTrapdoor(baseId, x, y, z, face) {
		// Half is decided by which face was clicked: top -> sits on top,
		// bottom -> hangs from the underside.
		let half = face === "bottom" ? TRAPDOOR_BOTTOM : 0
		let state = baseId | half | facingFromYaw()
		world.setBlock(x, y, z, state)
		refreshFences(x, y, z)
		p.lastPlace = Date.now()
		return true
	}
	function inCobweb() {
		let block = world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))
		let data = blockData[block & STATE_MASK]
		return data && data.web
	}

	// ---------------------------------------------------------------
	// Fluid simulation
	// A fluid source is the plain base id (state 0). Flowing fluid stores
	// its level (1..7) in bits 10-12. When any block changes we mark the
	// cell and its neighbours; a throttled tick settles each affected
	// connected region by a 0-1 BFS out from the sources (falling costs
	// nothing, spreading costs one level per step).
	// ---------------------------------------------------------------
	const FLUID_TICK_MS = 160
	let fluidCellList = []
	let fluidCellSeen = new Set()
	let fluidLastTick = 0
	let fluidsReady = false

	function markFluid(x, y, z) {
		let k = x + "," + y + "," + z
		if (fluidCellSeen.has(k)) return
		fluidCellSeen.add(k)
		fluidCellList.push([ x, y, z ])
	}
	function fluidWakeAround(x, y, z) {
		if (!fluidsReady) return
		markFluid(x, y, z)
		markFluid(x + 1, y, z)
		markFluid(x - 1, y, z)
		markFluid(x, y + 1, z)
		markFluid(x, y - 1, z)
		markFluid(x, y, z + 1)
		markFluid(x, y, z - 1)
	}
	function fluidMaxLevel(type) {
		return type === "lava" ? 4 : 8
	}
	const fluidDirs = [ [ 1, 0, 0 ], [ -1, 0, 0 ], [ 0, 1, 0 ], [ 0, -1, 0 ], [ 0, 0, 1 ], [ 0, 0, -1 ] ]
	function collectFluidComponent(sx, sy, sz, base) {
		let cells = []
		let seen = new Set([ sx + "," + sy + "," + sz ])
		let stack = [ [ sx, sy, sz ] ]
		let limit = 4000
		while (stack.length) {
			let c = stack.pop()
			cells.push(c)
			if (cells.length > limit) return cells
			for (let d = 0; d < 6; d++) {
				let nx = c[0] + fluidDirs[d][0], ny = c[1] + fluidDirs[d][1], nz = c[2] + fluidDirs[d][2]
				let k = nx + "," + ny + "," + nz
				if (seen.has(k)) continue
				if ((world.getBlock(nx, ny, nz) & BASE_MASK) !== base) continue
				seen.add(k)
				stack.push([ nx, ny, nz ])
			}
		}
		return cells
	}
	function settleFluid(cells, base, maxLevel) {
		let dist = new Map()
		let buckets = []
		for (let i = 0; i <= maxLevel; i++) buckets.push([])
		// Sources seed the BFS; a cell is reachable if it is air or the same
		// fluid. Falling (into the cell below) is free, spreading costs a level.
		for (let i = 0; i < cells.length; i++) {
			let c = cells[i]
			if (world.getBlock(c[0], c[1], c[2]) === base) {
				dist.set(c[0] + "," + c[1] + "," + c[2], 0)
				buckets[0].push(c)
			}
		}
		let cap = 4000
		for (let cost = 0; cost < buckets.length; cost++) {
			let b = buckets[cost]
			for (let i = 0; i < b.length; i++) {
				let c = b[i]
				if (dist.get(c[0] + "," + c[1] + "," + c[2]) !== cost) continue
				for (let d = 0; d < 6; d++) {
					let nx = c[0] + fluidDirs[d][0], ny = c[1] + fluidDirs[d][1], nz = c[2] + fluidDirs[d][2]
					let nb = world.getBlock(nx, ny, nz)
					let ndata = blockData[nb & BASE_MASK]
					let passable = nb === 0 || (ndata && ndata.liquid && (nb & BASE_MASK) === base)
					if (!passable) continue
					let ncost = cost + (ny < c[1] ? 0 : 1)
					if (ncost > maxLevel) continue
					let nk = nx + "," + ny + "," + nz
					let cur = dist.has(nk) ? dist.get(nk) : Infinity
					if (ncost < cur) {
						dist.set(nk, ncost)
						buckets[ncost].push([ nx, ny, nz ])
						if (dist.size > cap) return
					}
				}
			}
		}
		// Re-level (or drain) the existing cells.
		for (let i = 0; i < cells.length; i++) {
			let c = cells[i]
			let block = world.getBlock(c[0], c[1], c[2])
			if (block === base) continue
			let cost = dist.get(c[0] + "," + c[1] + "," + c[2])
			let level = (cost === undefined) ? 0 : Math.min(maxLevel - 1, maxLevel - cost)
			if (level < 1) level = 0
			let next = level === 0 ? 0 : (base | (level << 11))
			if (next !== block) world.setBlock(c[0], c[1], c[2], next)
		}
		// Fill newly reachable air cells (one BFS layer per tick for Minecraft-like flow).
		for (let entry of dist) {
			if (entry[1] > 1) continue
			let c = entry[0].split(",")
			let x = Number(c[0]), y = Number(c[1]), z = Number(c[2])
			if (world.getBlock(x, y, z) !== 0) continue
			let level = Math.min(maxLevel - 1, maxLevel - entry[1])
			if (level < 1) continue
			world.setBlock(x, y, z, base | (level << 11))
		}
	}
	function tickFluids() {
		if (!fluidCellList.length) return
		let now = Date.now()
		if (now - fluidLastTick < FLUID_TICK_MS) return
		fluidLastTick = now
		let list = fluidCellList
		fluidCellList = []
		fluidCellSeen = new Set()
		let settled = new Set()
		for (let i = 0; i < list.length; i++) {
			let c = list[i]
			let k = c[0] + "," + c[1] + "," + c[2]
			if (settled.has(k)) continue
			let block = world.getBlock(c[0], c[1], c[2])
			let base = block & BASE_MASK
			let data = blockData[base]
			if (!data || !data.liquid) { settled.add(k); continue }
			let cells = collectFluidComponent(c[0], c[1], c[2], base)
			for (let j = 0; j < cells.length; j++) settled.add(cells[j][0] + "," + cells[j][1] + "," + cells[j][2])
			if (cells.length > 3000) continue
			settleFluid(cells, base, fluidMaxLevel(data.liquid))
		}
	}
	function fluidAt(x, y, z) {
		let data = blockData[world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) & BASE_MASK]
		return data && data.liquid ? data.liquid : null
	}
	function playerFluid() {
		return fluidAt(p.x, p.y + 0.4, p.z) || fluidAt(p.x, p.y + 1.3, p.z)
	}
	function bucketUse(behavior) {
		let def = itemDef(holding)
		if (!def || def.behavior !== "bucket" || !hitBox.pos) return false
		let pos = hitBox.pos
		if (def.bucketType === "empty") {
			let target = world.getBlock(pos[0], pos[1], pos[2])
			let base = target & BASE_MASK
			let data = blockData[base]
			if (!data || !data.liquid || (target & STATE_MASK) !== 0) return false
			world.setBlock(pos[0], pos[1], pos[2], 0)
			consumeHeld(1)
			if (gameMode !== "creative") addItem(itemIds[data.liquid + "Bucket"], 1)
			p.lastPlace = Date.now()
			return true
		}
		let x = pos[0], y = pos[1], z = pos[2]
		switch (hitBox.face) {
			case "top": y += 1; break
			case "bottom": y -= 1; break
			case "south": z -= 1; break
			case "north": z += 1; break
			case "west": x -= 1; break
			case "east": x += 1; break
		}
		if (y <= 0 || y >= maxHeight || world.getBlock(x, y, z)) return false
		world.setBlock(x, y, z, blockIds[def.bucketType])
		consumeHeld(1)
		if (gameMode !== "creative") addItem(itemIds.bucket, 1)
		p.lastPlace = Date.now()
		return true
	}
	const FENCE_BITS = 0x7800
	function isFenceConnectable(block) {
		if (!block) return false
		let data = blockData[block & STATE_MASK]
		if (!data) return false
		return data.fence === true || data.transparent === false
	}
	function updateFence(x, y, z) {
		let block = world.getBlock(x, y, z)
		let data = blockData[block & STATE_MASK]
		if (!data || !data.fence) {
			return
		}
		let mask = 0
		if (isFenceConnectable(world.getBlock(x, y, z + 1))) mask |= 1
		if (isFenceConnectable(world.getBlock(x, y, z - 1))) mask |= 2
		if (isFenceConnectable(world.getBlock(x + 1, y, z))) mask |= 4
		if (isFenceConnectable(world.getBlock(x - 1, y, z))) mask |= 8
		let next = (block & ~FENCE_BITS) | (mask << 11)
		if (next !== block) {
			world.setBlock(x, y, z, next)
		}
	}
	function refreshFences(x, y, z) {
		updateFence(x, y, z)
		updateFence(x, y, z + 1)
		updateFence(x, y, z - 1)
		updateFence(x + 1, y, z)
		updateFence(x - 1, y, z)
	}
	win.refreshFences = refreshFences
	win.tickFluids = tickFluids
	win.markFluid = markFluid
	win.fluidWakeAround = fluidWakeAround
	win.settleFluid = settleFluid
	win.collectFluidComponent = collectFluidComponent
	win.bucketUse = bucketUse
	win.toggleDoor = toggleDoor
	win.placeDoor = placeDoor
	win.isDoorState = isDoorState
	win.toggleTrapdoor = toggleTrapdoor
	win.placeTrapdoor = placeTrapdoor
	win.isTrapState = isTrapState
	win.drops = drops
	win.spawnDrop = spawnDrop
	win.dropHeld = dropHeld
	win.updateDrops = updateDrops
	win.renderDrops = renderDrops
	win.dropStats = dropStats
	win.tnts = tnts
	win.primeTnt = primeTnt
	win.explodeTnt = explodeTnt
	win.updateTnts = updateTnts
	win.isTntBlock = isTntBlock
	win.TNT_RADIUS = TNT_RADIUS


export {
	spawnDrop, dropHeld, isDropSolid, updateDrops, drawDropCube, renderDrops,
	isTntBlock, primeTnt, drawTntCube, renderTnts, updateTnts, explodeTnt,
	isSupporter, isTorchSupport, placementMode, isDoorState, isTrapState,
	toggleDoor, placeDoor, facingFromYaw, facingToPlayer, toggleTrapdoor, placeTrapdoor, inCobweb,
	markFluid, fluidWakeAround, fluidMaxLevel, collectFluidComponent, settleFluid,
	tickFluids, fluidAt, playerFluid, bucketUse,
	isFenceConnectable, updateFence, refreshFences
}
