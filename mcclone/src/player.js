import { blockData, BLOCK_COUNT, blockIds } from './blocks.js'
import {
	win, world, p, setP, p2, setP2, gl, tex, textureMap, texCoordsBuffers, hitBox,
	holding, gameMode, Key, modelView, glCache, move, place,
	currentFov, setCurrentFov, settings, width, height, maxHeight,
	blockOutlines, blockFill, caveNoise, sideEdgeBuffers, matrix, projection,
	defaultModelView, program3D, superflat, inventory, reach, screen
} from './state.js'
import { generator } from './state.js'
import {
	CUBE, SLAB, STAIR, FLIP, NORTH, SOUTH, EAST, WEST, ROTATION, BASE_MASK, STATE_MASK,
	DOOR_UPPER, DOOR_OPEN, DOOR_HINGE, DOOR_FACING, TRAPDOOR_BOTTOM, TRAPDOOR_OPEN, TRAPDOOR_FACING,
	TORCH_HANGING, LIGHT_MAX, LIGHT_LIFT, uniformMatrix, Block, Sides, vertexAttribPointer
} from './engine.js'
import { PVector, noise } from './noise.js'
import {
	isDoorState, isTrapState, toggleDoor, toggleTrapdoor, placeDoor, placeTrapdoor, inCobweb,
	playerFluid, refreshFences, placementMode, isTorchSupport, isSupporter, facingToPlayer,
	bucketUse, isTntBlock, primeTnt
} from './features.js'
import { consumeHeld, heldStack, addItem, blockDrop } from './ui.js'
import { isItem, itemDef } from './items.js'

const vec1 = new PVector(), vec2 = new PVector(), vec3 = new PVector()

function cross(v1, v2, result) {
	let x = v1.x,
		y = v1.y,
		z = v1.z,
		x2 = v2.x,
		y2 = v2.y,
		z2 = v2.z
	result.x = y * z2 - y2 * z
	result.y = z * x2 - z2 * x
	result.z = x * y2 - x2 * y
}

	class Matrix {
		constructor(arr) {
			this.elements = new Float32Array(arr || 16)
		}
		translate(x, y, z) {
			let a = this.elements
			a[3] += a[0] * x + a[1] * y + a[2] * z
			a[7] += a[4] * x + a[5] * y + a[6] * z
			a[11] += a[8] * x + a[9] * y + a[10] * z
			a[15] += a[12] * x + a[13] * y + a[14] * z
		}
		rotX(angle) {
			let elems = this.elements
			let c = Math.cos(angle)
			let s = Math.sin(angle)
			let t = elems[1]
			elems[1] = t * c + elems[2] * s
			elems[2] = t * -s + elems[2] * c
			t = elems[5]
			elems[5] = t * c + elems[6] * s
			elems[6] = t * -s + elems[6] * c
			t = elems[9]
			elems[9] = t * c + elems[10] * s
			elems[10] = t * -s + elems[10] * c
			t = elems[13]
			elems[13] = t * c + elems[14] * s
			elems[14] = t * -s + elems[14] * c
		}
		rotY(angle) {
			let c = Math.cos(angle)
			let s = Math.sin(angle)
			let elems = this.elements
			let t = elems[0]
			elems[0] = t * c + elems[2] * -s
			elems[2] = t * s + elems[2] * c
			t = elems[4]
			elems[4] = t * c + elems[6] * -s
			elems[6] = t * s + elems[6] * c
			t = elems[8]
			elems[8] = t * c + elems[10] * -s
			elems[10] = t * s + elems[10] * c
			t = elems[12]
			elems[12] = t * c + elems[14] * -s
			elems[14] = t * s + elems[14] * c
		}
		transpose() {
			let matrix = this.elements
			let temp = matrix[4]
			matrix[4] = matrix[1]
			matrix[1] = temp

			temp = matrix[8]
			matrix[8] = matrix[2]
			matrix[2] = temp

			temp = matrix[6]
			matrix[6] = matrix[9]
			matrix[9] = temp

			temp = matrix[3]
			matrix[3] = matrix[12]
			matrix[12] = temp

			temp = matrix[7]
			matrix[7] = matrix[13]
			matrix[13] = temp

			temp = matrix[11]
			matrix[11] = matrix[14]
			matrix[14] = temp
		}
		copyArray(from) {
			let to = this.elements
			for (let i = 0; i < from.length; i++) {
				to[i] = from[i]
			}
		}
		copyMatrix(from) {
			let to = this.elements
			from = from.elements
			for (let i = 0; i < from.length; i++) {
				to[i] = from[i]
			}
		}
	}

	class Plane {
		constructor(nx, ny, nz) {
			this.set(nx, ny, nz)
		}
		set(nx, ny, nz) {
			// Pre-computed chunk offsets to reduce branching during culling
			this.dx = nx > 0 ? 16 : 0
			this.dy = ny > 0
			this.dz = nz > 0 ? 16 : 0

			// Normal vector for the plane
			this.nx = nx
			this.ny = ny
			this.nz = nz
		}
	}

	let defaultTransformation = new Matrix([ -10,0,0,0,0,10,0,0,0,0,-10,0,0,0,0,1 ])
	class Camera {
		constructor() {
			this.x = 0
			this.y = 0
			this.z = 0
			this.rx = 0; // Pitch
			this.ry = 0; // Yaw
			this.currentFov = 0
			this.defaultFov = settings.fov
			this.targetFov = settings.fov
			this.step = 0
			this.lastStep = 0
			this.projection = new Float32Array(5)
			this.transformation = new Matrix()
			this.direction = { x: 1, y: 0, z: 0 }; // Normalized direction vector
			this.frustum = [] // The 5 planes of the viewing frustum (there's no far plane)
			for (let i = 0; i < 5; i++) {
				this.frustum.push(new Plane(1, 0, 0))
			}
		}
		FOV(fov, time) {
			if (fov === this.currentFov) return

			if (!fov) {
				let now = Date.now()
				fov = this.currentFov + this.step * (now - this.lastStep)
				this.lastStep = now
				if (Math.sign(this.targetFov - this.currentFov) !== Math.sign(this.targetFov - fov)) {
					fov = this.targetFov
				}
			}
			else if (time) {
				this.targetFov = fov
				this.step = (fov - this.currentFov) / time
				this.lastStep = Date.now()
				return
			} else {
				this.targetFov = fov
			}

			const tang = Math.tan(fov * Math.PI / 360)
			const scale = 1 / tang
			const near = 1
			const far = 1000000
			this.currentFov = fov; // Store the state of the projection matrix
			setCurrentFov(fov)
			this.nearH = near * tang; // This is needed for frustum culling

			this.projection[0] = scale / width * height
			this.projection[1] = scale
			this.projection[2] = -far / (far - near)
			this.projection[3] = -1
			this.projection[4] = -far * near / (far - near)
		}
		transform() {
			this.transformation.copyMatrix(defaultTransformation)
			this.transformation.rotX(this.rx)
			this.transformation.rotY(this.ry)
			this.transformation.translate(-this.x, -this.y, -this.z)
		}
		getMatrix() {
			let proj = this.projection
			let view = this.transformation.elements
			matrix[0]  = proj[0] * view[0]
			matrix[1]  = proj[1] * view[4]
			matrix[2]  = proj[2] * view[8] + proj[3] * view[12]
			matrix[3]  = proj[4] * view[8]
			matrix[4]  = proj[0] * view[1]
			matrix[5]  = proj[1] * view[5]
			matrix[6]  = proj[2] * view[9] + proj[3] * view[13]
			matrix[7]  = proj[4] * view[9]
			matrix[8]  = proj[0] * view[2]
			matrix[9]  = proj[1] * view[6]
			matrix[10] = proj[2] * view[10] + proj[3] * view[14]
			matrix[11] = proj[4] * view[10]
			matrix[12] = proj[0] * view[3]
			matrix[13] = proj[1] * view[7]
			matrix[14] = proj[2] * view[11] + proj[3] * view[15]
			matrix[15] = proj[4] * view[11]
			return matrix
		}
		setDirection() {
			if (this.targetFov !== this.currentFov) {
				this.FOV()
			}
			this.direction.x = -Math.sin(this.ry) * Math.cos(this.rx)
			this.direction.y = Math.sin(this.rx)
			this.direction.z = Math.cos(this.ry) * Math.cos(this.rx)
			this.computeFrustum()
		}
		computeFrustum() {
			let X = vec1
			let dir = this.direction
			X.x = dir.z
			X.y = 0
			X.z = -dir.x
			X.normalize()

			let Y = vec2
			Y.set(dir)
			Y.mult(-1)
			cross(Y, X, Y)

			//Near plane
			this.frustum[0].set(dir.x, dir.y, dir.z)

			let aux = vec3
			aux.set(Y)
			aux.mult(this.nearH)
			aux.add(dir)
			aux.normalize()
			cross(aux, X, aux)
			this.frustum[1].set(aux.x, aux.y, aux.z)

			aux.set(Y)
			aux.mult(-this.nearH)
			aux.add(dir)
			aux.normalize()
			cross(X, aux, aux)
			this.frustum[2].set(aux.x, aux.y, aux.z)

			aux.set(X)
			aux.mult(-this.nearH * width / height)
			aux.add(dir)
			aux.normalize()
			cross(aux, Y, aux)
			this.frustum[3].set(aux.x, aux.y, aux.z)

			aux.set(X)
			aux.mult(this.nearH * width / height)
			aux.add(dir)
			aux.normalize()
			cross(Y, aux, aux)
			this.frustum[4].set(aux.x, aux.y, aux.z)
		}
		canSee(x, y, z, maxY) {
			x -= 0.5
			y -= 0.5
			z -= 0.5
			maxY += 0.5
			let px = 0, py = 0, pz = 0, plane = null
			let cx = p.x, cy = p.y, cz = p.z
			for (let i = 0; i < 5; i++) {
				plane = this.frustum[i]
				px = x + plane.dx
				py = plane.dy ? maxY : y
				pz = z + plane.dz
				if ((px - cx) * plane.nx + (py - cy) * plane.ny + (pz - cz) * plane.nz < 0) {
					return false
				}
			}
			return true
		}
	}

	function trans(matrix, x, y, z) {
		let a = matrix
		a[3] += a[0] * x + a[1] * y + a[2] * z
		a[7] += a[4] * x + a[5] * y + a[6] * z
		a[11] += a[8] * x + a[9] * y + a[10] * z
		a[15] += a[12] * x + a[13] * y + a[14] * z
	}
	function rotX(matrix, angle) {
		// This function is basically multiplying 2 4x4 matrices together,
		// but 1 of them has a bunch of 0's and 1's in it,
		// so I removed all terms that multiplied by 0, and just left off the 1's.
		// mat2 = [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]
		let elems = matrix
		let c = Math.cos(angle)
		let s = Math.sin(angle)
		let t = elems[1]
		elems[1] = t * c + elems[2] * s
		elems[2] = t * -s + elems[2] * c
		t = elems[5]
		elems[5] = t * c + elems[6] * s
		elems[6] = t * -s + elems[6] * c
		t = elems[9]
		elems[9] = t * c + elems[10] * s
		elems[10] = t * -s + elems[10] * c
		t = elems[13]
		elems[13] = t * c + elems[14] * s
		elems[14] = t * -s + elems[14] * c
	}
	function rotY(matrix, angle) {
	//source = c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1
		let c = Math.cos(angle)
		let s = Math.sin(angle)
		let elems = matrix
		let t = elems[0]
		elems[0] = t * c + elems[2] * -s
		elems[2] = t * s + elems[2] * c
		t = elems[4]
		elems[4] = t * c + elems[6] * -s
		elems[6] = t * s + elems[6] * c
		t = elems[8]
		elems[8] = t * c + elems[10] * -s
		elems[10] = t * s + elems[10] * c
		t = elems[12]
		elems[12] = t * c + elems[14] * -s
		elems[14] = t * s + elems[14] * c
	}
	function transpose(matrix) {
		let temp = matrix[4]
		matrix[4] = matrix[1]
		matrix[1] = temp

		temp = matrix[8]
		matrix[8] = matrix[2]
		matrix[2] = temp

		temp = matrix[6]
		matrix[6] = matrix[9]
		matrix[9] = temp

		temp = matrix[3]
		matrix[3] = matrix[12]
		matrix[12] = temp

		temp = matrix[7]
		matrix[7] = matrix[13]
		matrix[13] = temp

		temp = matrix[11]
		matrix[11] = matrix[14]
		matrix[14] = temp
	}
	function matMult() {
	//Multiply the projection matrix by the view matrix; this is optimized specifically for these matrices by removing terms that are always 0.
		let proj = projection
		let view = modelView
		matrix[0] = proj[0] * view[0]
		matrix[1] = proj[0] * view[1]
		matrix[2] = proj[0] * view[2]
		matrix[3] = proj[0] * view[3]
		matrix[4] = proj[5] * view[4]
		matrix[5] = proj[5] * view[5]
		matrix[6] = proj[5] * view[6]
		matrix[7] = proj[5] * view[7]
		matrix[8] = proj[10] * view[8] + proj[11] * view[12]
		matrix[9] = proj[10] * view[9] + proj[11] * view[13]
		matrix[10] = proj[10] * view[10] + proj[11] * view[14]
		matrix[11] = proj[10] * view[11] + proj[11] * view[15]
		matrix[12] = proj[14] * view[8]
		matrix[13] = proj[14] * view[9]
		matrix[14] = proj[14] * view[10]
		matrix[15] = proj[14] * view[11]
	}
	function copyArr(a, b) {
		for (let i = 0; i < a.length; i++) {
			b[i] = a[i]
		}
	}
	function FOV(fov) {
		let tang = Math.tan(fov * 0.5 * Math.PI / 180)
		let scale = 1 / tang
		let near = 1
		let far = 1000000
		setCurrentFov(fov)

		projection[0] = scale / width * height
		projection[5] = scale
		projection[10] = -far / (far - near)
		projection[11] = -1
		projection[14] = -far * near / (far - near)
	}
	function initModelView(camera, x, y, z, rx, ry) {
		if (camera) {
			camera.transform()
			uniformMatrix("view3d", program3D, "uView", false, camera.getMatrix())
		} else {
			copyArr(defaultModelView, modelView)
			rotX(modelView, rx)
			rotY(modelView, ry)
			trans(modelView, -x, -y, -z)
			matMult()
			transpose(matrix)
			uniformMatrix("view3d", program3D, "uView", false, matrix)
		}
	}

	function timeString(millis) {
		if (millis > 300000000000 || !millis) {
			return "never"
		}
		const SECOND = 1000
		const MINUTE = SECOND * 60
		const HOUR = MINUTE * 60
		const DAY = HOUR * 24
		const YEAR = DAY * 365

		if (millis < MINUTE) {
			return "just now"
		}

		let years = Math.floor(millis / YEAR)
		millis -= years * YEAR

		let days = Math.floor(millis / DAY)
		millis -= days * DAY

		let hours = Math.floor(millis / HOUR)
		millis -= hours * HOUR

		let minutes = Math.floor(millis / MINUTE)

		if (years) {
			return `${years} year${years > 1 ? "s" : ""} and ${days} day${days !== 1 ? "s" : ""} ago`
		}
		if (days) {
			return `${days} day${days > 1 ? "s" : ""} and ${hours} hour${hours !== 1 ? "s" : ""} ago`
		}
		if (hours) {
			return `${hours} hour${hours > 1 ? "s" : ""} and ${minutes} minute${minutes !== 1 ? "s" : ""} ago`
		}
		return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
	}
	function roundBits(number) {
		return Math.round(number * 1000000) / 1000000
	}
	function rayTrace(x, y, z, shape) {
		let cf, cd = 1e9; //Closest face and distance
		let m; //Absolute distance to intersection point
		let ix, iy, iz; //Intersection coords
		let minX, minY, minZ, maxX, maxY, maxZ, min, max; //Bounds of face coordinates
		let east = p.direction.x < 0
		let top = p.direction.y < 0
		let north = p.direction.z < 0
		let verts = shape.verts
		let faces = verts[0]

		//Top and bottom faces

		if (top) {
			faces = verts[1]
		}
		if (p.direction.y) {
			for (let face of faces) {
				min = face.min
				minX = min[0]
				minZ = min[2]
				max = face.max
				maxX = max[0]
				maxZ = max[2]
				m = (y + face[1] - p.y) / p.direction.y
				ix = m * p.direction.x + p.x
				iz = m * p.direction.z + p.z
				if (m > 0 && m < cd && ix >= x + minX && ix <= x + maxX && iz >= z + minZ && iz <= z + maxZ) {
					cd = m; //Ray crosses bottom face
					cf = top ? "top" : "bottom"
				}
			}
		}

		//West and East faces
		if (east) {
			faces = verts[4]
		} else {
			faces = verts[5]
		}
		if (p.direction.x) {
			for (let face of faces) {
				min = face.min
				minY = min[1]
				minZ = min[2]
				max = face.max
				maxY = max[1]
				maxZ = max[2]
				m = (x + face[0] - p.x) / p.direction.x
				iy = m * p.direction.y + p.y
				iz = m * p.direction.z + p.z
				if (m > 0 && m < cd && iy >= y + minY && iy <= y + maxY && iz >= z + minZ && iz <= z + maxZ) {
					cd = m
					cf = east ? "east" : "west"
				}
			}
		}

		//South and North faces
		if (north) {
			faces = verts[2]
		} else {
			faces = verts[3]
		}
		if (p.direction.z) {
			for (let face of faces) {
				min = face.min
				minX = min[0]
				minY = min[1]
				max = face.max
				maxX = max[0]
				maxY = max[1]
				m = (z + face[2] - p.z) / p.direction.z
				ix = m * p.direction.x + p.x
				iy = m * p.direction.y + p.y
				if (m > 0 && m < cd && ix >= x + minX && ix <= x + maxX && iy >= y + minY && iy <= y + maxY) {
					cd = m
					cf = north ? "north" : "south"
				}
			}
		}
		return [ cd, cf ]
	}
	function runRayTrace(x, y, z) {
		let block = world.getBlock(x, y, z)
		if (block) {
			let data = blockData[block]
			let shape = data.rayShape || data.shape
			let rt = rayTrace(x, y, z, shape)

			if (rt[1] && rt[0] < hitBox.closest) {
				hitBox.closest = rt[0]
				hitBox.face = rt[1]
				hitBox.pos = [ x, y, z ]
				hitBox.shape = shape
			}
		}
	}
	function lookingAt() {
		// Checks blocks in front of the player to see which one they're looking at
		hitBox.pos = null
		hitBox.closest = 1e9

		if (p.spectator) {
			return
		}
		let blockState = world.getBlock(p2.x, p2.y, p2.z)
		if (blockState) {
			hitBox.pos = [ p2.x, p2.y, p2.z ]
			hitBox.closest = 0
			hitBox.shape = blockData[blockState].rayShape || blockData[blockState].shape
			return
		}

		let pd = p.direction

		// Target block
		let tx = Math.round(pd.x * reach + p.x)
		let ty = Math.round(pd.y * reach + p.y)
		let tz = Math.round(pd.z * reach + p.z)

		let minX = p2.x
		let maxX = 0
		let minY = p2.y
		let maxY = 0
		let minZ = p2.z
		let maxZ = 0

		for (let i = 0; i < reach + 1; i++) {
			if (i > reach) {
				i = reach
			}
			maxX = Math.round(p.x + pd.x * i)
			maxY = Math.round(p.y + pd.y * i)
			maxZ = Math.round(p.z + pd.z * i)
			if (maxX === minX && maxY === minY && maxZ === minZ) {
				continue
			}
			if (minX !== maxX) {
				if (minY !== maxY) {
					if (minZ !== maxZ) {
						runRayTrace(maxX, maxY, maxZ)
					}
					runRayTrace(maxX, maxY, minZ)
				}
				if (minZ !== maxZ) {
					runRayTrace(maxX, minY, maxZ)
				}
				runRayTrace(maxX, minY, minZ)
			}
			if (minY !== maxY) {
				if (minZ !== maxZ) {
					runRayTrace(minX, maxY, maxZ)
				}
				runRayTrace(minX, maxY, minZ)
			}
			if (minZ !== maxZ) {
				runRayTrace(minX, minY, maxZ)
			}
			if (hitBox.pos) {
				return; //The ray has collided; it can't possibly find a closer collision now
			}
			minZ = maxZ
			minY = maxY
			minX = maxX
		}
	}
	let inBox = function(x, y, z, w, h, d) {
		let iy = y - h/2 - p.topH
		let ih = h + p.bottomH + p.topH
		let ix = x - w/2 - p.w
		let iw = w + p.w*2
		let iz = z - d/2 - p.w
		let id = d + p.w*2
		return p.x > ix && p.y > iy && p.z > iz && p.x < ix + iw && p.y < iy + ih && p.z < iz + id
	}
	let onBox = function(x, y, z, w, h, d) {
		let iy = roundBits(y - h/2 - p.topH)
		let ih = roundBits(h + p.bottomH + p.topH)
		let ix = roundBits(x - w/2 - p.w)
		let iw = roundBits(w + p.w*2)
		let iz = roundBits(z - d/2 - p.w)
		let id = roundBits(d + p.w*2)
		return p.x > ix && p.y > iy && p.z > iz && p.x < ix + iw && p.y <= iy + ih && p.z < iz + id
	}
	function collided(x, y, z, vx, vy, vz, block) {
		if(p.spectator) {
			return false
		}
		let shapeData = blockData[block].collisionShape || blockData[block].shape
		if (shapeData.noCollide) {
			return false
		}
		let verts = shapeData.verts
		let px = roundBits(p.x - p.w - x)
		let py = roundBits(p.y - p.bottomH - y)
		let pz = roundBits(p.z - p.w - z)
		let pxx = roundBits(p.x + p.w - x)
		let pyy = roundBits(p.y + p.topH - y)
		let pzz = roundBits(p.z + p.w - z)
		let minX, minY, minZ, maxX, maxY, maxZ, min, max

		//Top and bottom faces
		let faces = verts[0]
		if (vy <= 0) {
			faces = verts[1]
		}
		if (!vx && !vz) {
			for (let face of faces) {
				min = face.min
				minX = min[0]
				minZ = min[2]
				max = face.max
				maxX = max[0]
				maxZ = max[2]
				if (face[1] > py && face[1] < pyy && minX < pxx && maxX > px && minZ < pzz && maxZ > pz) {
					if (vy <= 0) {
						p.onGround = true
						p.y = Math.round((face[1] + y + p.bottomH) * 10000) / 10000
						return false
					} else {
						return true
					}
				}
			}
			return false
		}

		//West and East faces
		if (vx < 0) {
			faces = verts[4]
		} else if (vx > 0) {
			faces = verts[5]
		}
		if (vx) {
			let col = false
			for (let face of faces) {
				min = face.min
				minZ = min[2]
				minY = min[1]
				max = face.max
				maxZ = max[2]
				maxY = max[1]
				if (face[0] > px && face[0] < pxx && minY < pyy && maxY > py && minZ < pzz && maxZ > pz) {
					if (maxY - py > 0.5) {
						p.canStepX = false
					}
					col = true
				}
			}
			return col
		}

		//South and North faces
		if (vz < 0) {
			faces = verts[2]
		} else if (vz > 0) {
			faces = verts[3]
		}
		if (vz) {
			let col = false
			for (let face of faces) {
				min = face.min
				minX = min[0]
				minY = min[1]
				max = face.max
				maxX = max[0]
				maxY = max[1]
				if (face[2] > pz && face[2] < pzz && minY < pyy && maxY > py && minX < pxx && maxX > px) {
					if (maxY - py > 0.5) {
						p.canStepZ = false
					}
					col = true
				}
			}
			return col
		}
	}
	let contacts = {
		array: [],
		size: 0,
		add: function(x, y, z, block) {
			if (this.size === this.array.length) {
				this.array.push([ x, y, z, block ])
			} else {
				this.array[this.size][0] = x
				this.array[this.size][1] = y
				this.array[this.size][2] = z
				this.array[this.size][3] = block
			}
			this.size++
		},
		clear: function() {
			this.size = 0
		},
	}
	let sprintWallHit = function(speed, intoWall) {
		if (!p.sprinting || p.flying || speed <= 0) {
			return
		}
		if (Math.asin(Math.min(1, intoWall / speed)) * 180 / Math.PI <= 8) {
			return
		}
		p.sprinting = false
		p.FOV(settings.fov, 100)
	}
	let resolveContactsAndUpdatePosition = function() {
		let pminX = p2.x - 1
		let pmaxX = p2.x + 1
		let pminY = p2.y - 2
		let pmaxY = p2.y + 1
		let pminZ = p2.z - 1
		let pmaxZ = p2.z + 1
		let block = null
		let vel = p.velocity

		for (let x = pminX; x <= pmaxX; x++) {
			for (let y = pminY; y <= pmaxY; y++) {
				for (let z = pminZ; z <= pmaxZ; z++) {
					let block = world.getBlock(x, y, z)
					if (block) {
						contacts.add(x, y, z, block)
					}
				}
			}
		}

		let dt = (win.performance.now() - p.lastUpdate) / 33
		dt = dt > 2 ? 2 : dt

		p.previousX = p.x
		p.previousY = p.y
		p.previousZ = p.z

		//Check collisions in the Y direction
		p.onGround = false
		p.canStepX = false
		p.canStepZ = false
		p.y += vel.y * dt
		for (let i = 0; i < contacts.size; i++) {
			block = contacts.array[i]
			if (collided(block[0], block[1], block[2], 0, vel.y, 0, block[3])) {
				p.y = p.previousY
				vel.y = 0
				break
			}
		}
		if (p.y === p.previousY && !p.flying) {
			p.canStepX = true
			p.canStepZ = true
		}

		var sneakLock = false, sneakSafe = false
		if (p.sneaking) {
			for (let i = 0; i < contacts.size; i++) {
				block = contacts.array[i]
				if (onBox(block[0], block[1], block[2], 1, 1, 1)) {
					sneakLock = true
					break
				}
			}
		}

		//Check collisions in the X direction
		p.x += vel.x * dt
		for (let i = 0; i < contacts.size; i++) {
			block = contacts.array[i]
			if (collided(block[0], block[1], block[2], vel.x, 0, 0, block[3])) {
				if (p.canStepX && !world.getBlock(block[0], block[1] + 1, block[2]) && !world.getBlock(block[0], block[1] + 2, block[2])) {
					continue
				}
				sprintWallHit(Math.hypot(vel.x, vel.z), Math.abs(vel.x))
				p.x = p.previousX
				vel.x = 0
				break
			}
			if (sneakLock && onBox(block[0], block[1], block[2], 1, 1, 1)) {
				sneakSafe = true
			}
		}

		if (sneakLock && !sneakSafe) {
			p.x = p.previousX
			vel.x = 0
		}
		sneakSafe = false

		//Check collisions in the Z direction
		p.z += vel.z * dt
		for (let i = 0; i < contacts.size; i++) {
			block = contacts.array[i]
			if (collided(block[0], block[1], block[2], 0, 0, vel.z, block[3])) {
				if (p.canStepZ && !world.getBlock(block[0], block[1] + 1, block[2]) && !world.getBlock(block[0], block[1] + 2, block[2])) {
					continue
				}
				sprintWallHit(Math.hypot(vel.x, vel.z), Math.abs(vel.z))
				p.z = p.previousZ
				vel.z = 0
				break
			}
			if (sneakLock && onBox(block[0], block[1], block[2], 1, 1, 1)) {
				sneakSafe = true
			}
		}

		if (sneakLock && !sneakSafe) {
			p.z = p.previousZ
			vel.z = 0
		}

		if (!p.flying) {
			let web = inCobweb()
			let drag = p.onGround ? 0.5 : 0.85
			if (web) {
				// Cobweb clings to the player
				vel.x *= 0.75
				vel.z *= 0.75
				drag = Math.min(drag, 0.15)
			}
			if (playerFluid()) {
				drag = Math.min(drag, 0.55)
			}
			p.velocity.z += (p.velocity.z * drag - p.velocity.z) * dt
			p.velocity.x += (p.velocity.x * drag - p.velocity.x) * dt
		} else {
			let drag = 0.9
			p.velocity.z += (p.velocity.z * drag - p.velocity.z) * dt
			p.velocity.x += (p.velocity.x * drag - p.velocity.x) * dt
			p.velocity.y += (p.velocity.y * 0.8 - p.velocity.y) * dt
			if (p.onGround && !p.spectator) {
				p.flying = false
			}
		}

		p.lastUpdate = win.performance.now()
		contacts.clear()
		lookingAt()
	}
	let runGravity = function() {
		if (p.flying) {
			return
		}
		let dt = (win.performance.now() - p.lastUpdate) / 33
		dt = dt > 2 ? 2 : dt
		let fluid = playerFluid()
		if(p.onGround) {
			if(Key[" "]) {
				p.velocity.y = p.jumpSpeed
				p.onGround = false
			} else {
				p.velocity.y = 0
			}
		} else {
			let gravity = inCobweb() ? p.gravityStength * 0.25 : p.gravityStength
			if (fluid === "water") gravity *= 0.3
			else if (fluid === "lava") gravity *= 0.5
			p.velocity.y += gravity * dt
			let minV = -p.maxYVelocity
			if (fluid === "water") minV = -0.16
			else if (fluid === "lava") minV = -0.1
			if(p.velocity.y < minV) {
				p.velocity.y = minV
			}
			if(fluid && Key[" "] && p.velocity.y < 0.12) {
				p.velocity.y = 0.12
			}
		}
	}

	// Screen space offsets used to fatten the block outline.
	// Most browsers clamp gl.lineWidth() to 1, so the width is faked by
	// drawing the outline several times, offset around a circle.
	let outlinePasses = [
		[ 0, 0 ],
		[ 1, 0 ], [ -1, 0 ], [ 0, 1 ], [ 0, -1 ],
		[ 0.7071, 0.7071 ], [ -0.7071, -0.7071 ],
		[ 0.7071, -0.7071 ], [ -0.7071, 0.7071 ]
	]
	function box2(sides, tex) {
		if (blockFill) {
			let i = 0
			for (let side in Block) {
				if (sides & Block[side]) {
					vertexAttribPointer("aVertex", program3D, "aVertex", 3, sideEdgeBuffers[Sides[side]])
					vertexAttribPointer("aTexture", program3D, "aTexture", 2, texCoordsBuffers[textureMap[tex[i]]])
					gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0)
				}
				i++
			}
		}
		if (blockOutlines) {
			vertexAttribPointer("aVertex", program3D, "aVertex", 3, hitBox.shape.buffer)
			vertexAttribPointer("aTexture", program3D, "aTexture", 2, texCoordsBuffers[textureMap.hitbox])
			// Pass offsets are in half pixels, which makes the outline one
			// pixel thinner than a full-pixel fattening.
			let px = 1 / width
			let py = 1 / height
			for (let pass = 0; pass < outlinePasses.length; pass++) {
				gl.uniform2f(glCache.uLineOffset, outlinePasses[pass][0] * px, outlinePasses[pass][1] * py)
				for (let i = 0; i < hitBox.shape.size; i++) {
					gl.drawArrays(gl.LINE_LOOP, i * 4, 4)
				}
			}
			gl.uniform2f(glCache.uLineOffset, 0, 0)
		}
	}
	function block2(x, y, z, t, camera) {
		if (camera) {
			camera.transformation.translate(x, y, z)
			uniformMatrix("view3d", program3D, "uView", false, camera.getMatrix())
		} else {
			//copyArr(modelView, matrix)
			trans(modelView, x, y, z)
			matMult()
			trans(modelView, -x, -y, -z)
			transpose(matrix)
			uniformMatrix("view3d", program3D, "uView", false, matrix)
		}
		box2(0xff, blockData[t].textures)
	}

	function changeWorldBlock(t) {
		let pos = hitBox.pos
		if(pos && pos[1] > 0 && pos[1] < maxHeight) {
			let shape = t && blockData[t].shape
			if (t && shape.rotate) {
				let pi = Math.PI / 4
				if (p.ry <= pi) {} // North; default
				else if (p.ry < 3 * pi) {
					t |= WEST
				} else if (p.ry < 5 * pi) {
					t |= SOUTH
				} else if (p.ry < 7 * pi) {
					t |= EAST
				}
			}

			if (t && shape.flip && hitBox.face !== "top" && (hitBox.face === "bottom" || (p.direction.y * hitBox.closest + p.y) % 1 < 0.5)) {
				t |= FLIP
			}

			let old = world.getBlock(hitBox.pos[0], hitBox.pos[1], hitBox.pos[2])
			if (!t && old && isDoorState(old)) {
				// Breaking a door takes out both halves at once.
				let base = old & BASE_MASK
				let otherY = hitBox.pos[1] + (old & DOOR_UPPER ? -1 : 1)
				let other = otherY >= 0 && otherY < maxHeight ? world.getBlock(hitBox.pos[0], otherY, hitBox.pos[2]) : 0
				if (other && isDoorState(other) && (other & BASE_MASK) === base) {
					world.setBlock(hitBox.pos[0], otherY, hitBox.pos[2], 0)
				}
			}
			world.setBlock(hitBox.pos[0], hitBox.pos[1], hitBox.pos[2], t)
			refreshFences(hitBox.pos[0], hitBox.pos[1], hitBox.pos[2])
			if (t) {
				p.lastPlace = Date.now()
			} else {
				p.lastBreak = Date.now()
				if (old && gameMode !== "creative") {
					addItem(blockDrop(old), 1)
				}
			}
		}
	}
	// Right-click in the world: use the held item first (buckets, flint and
	// steel, doors, trapdoors), otherwise place the held block.
	function useHeld() {
		if (!hitBox.pos || screen !== "play") {
			return false
		}
		let pos = hitBox.pos
		let target = world.getBlock(pos[0], pos[1], pos[2])
		let def = isItem(holding) ? itemDef(holding) : null
		if (def && def.behavior === "bucket" && bucketUse()) {
			p.interactHold = true
			return true
		}
		if (target && isTntBlock(target) && def && def.name === "flintAndSteel") {
			if (primeTnt(pos[0], pos[1], pos[2])) {
				p.lastPlace = Date.now()
				p.interactHold = true
				return true
			}
		}
		if (isDoorState(target)) {
			toggleDoor(pos[0], pos[1], pos[2])
			p.interactHold = true
			return true
		}
		if (isTrapState(target)) {
			toggleTrapdoor(pos[0], pos[1], pos[2])
			p.interactHold = true
			return true
		}
		if (holding) {
			newWorldBlock()
			return true
		}
		return false
	}
	function newWorldBlock() {
		if(!hitBox.pos || !holding) {
			return
		}
		if (isItem(holding)) {
			// Items (tools, food, materials, flint and steel) are not placeable blocks.
			return
		}
		let pos = hitBox.pos, x= pos[0], y = pos[1], z = pos[2]
		switch(hitBox.face) {
			case "top":
				y += 1
				break
			case "bottom":
				y -= 1
				break
			case "south":
				z -= 1
				break
			case "north":
				z += 1
				break
			case "west":
				x -= 1
				break
			case "east":
				x += 1
				break
		}
		if (!inBox(x, y, z, 1, 1, 1) && !world.getBlock(x, y, z) && y > 0 && y < maxHeight) {
			let state = holding < 0x800 ? (holding | placementMode(holding)) : holding
			// Plants may only be placed on top of a supporting block.
			let held = holding < 0x800 ? blockData[holding] : null
			if (held && held.torch) {
				// Torches hang from the block they are placed against
				// (bottom face) or stand on the block below; they cannot float.
				let hanging = hitBox.face === "bottom"
				let attach = hanging ? world.getBlock(x, y + 1, z) : world.getBlock(x, y - 1, z)
				if (!isTorchSupport(attach)) {
					return
				}
				pos[0] = x
				pos[1] = y
				pos[2] = z
				changeWorldBlock(holding | (hanging ? TORCH_HANGING : 0))
				if (gameMode !== "creative") {
					consumeHeld(1)
				}
				return
			}
			if (held && held.support && (hitBox.face !== "top" || !isSupporter(world.getBlock(x, y - 1, z)))) {
				return
			}
			if (held && held.facing) {
				// Pumpkins place with their carved face toward the player.
				pos[0] = x
				pos[1] = y
				pos[2] = z
				changeWorldBlock(holding | facingToPlayer(x, z))
				if (gameMode !== "creative") {
					consumeHeld(1)
				}
				return
			}
			if (held && held.door) {
				// Doors occupy two blocks: place the top half together with the bottom.
				if (!placeDoor(holding, x, y, z)) {
					return
				}
			} else if (held && held.trap) {
				placeTrapdoor(holding, x, y, z, hitBox.face)
			} else {
				pos[0] = x
				pos[1] = y
				pos[2] = z
				changeWorldBlock(state)
			}
			if (gameMode !== "creative") {
				consumeHeld(1)
			}
		}
	}

	// Save the coords for a small sphere used to carve out caves
	let sphere;
	{
		let blocks = []
		let radius = 3.5
		let radsq = radius * radius
		for (let i = -radius; i <= radius; i++) {
			for (let j = -radius; j <= radius; j++) {
				for (let k = -radius; k <= radius; k++) {
					if (i*i + j*j + k*k < radsq) {
						blocks.push(i|0, j|0, k|0)
					}
				}
			}
		}
		sphere = new Int8Array(blocks)
	}

	function isCave(x, y, z) {
		// Generate a 3D rigid multifractal noise shell.
		// Then generate another one with different coordinates.
		// Overlay them on top of each other, and the overlapping parts should form a cave-like structure.
		// This is extremely slow, and requires generating 2 noise values for every single block in the world.
		// TODO: replace with a crawler system of some sort, that will never rely on a head position in un-generated chunks.
		let smooth = 0.02
		// carveCaves samples every second block. The wider band keeps the
		// number of cave centers per volume close to a full-resolution scan.
		let caveSize = 0.015
		let cave1 = Math.abs(0.5 - caveNoise(x * smooth, y * smooth, z * smooth)) < caveSize
		if (!cave1) {
			return false
		}
		// The second sample is only needed where the first one already matched.
		return Math.abs(0.5 - caveNoise(y * smooth, z * smooth, x * smooth)) < caveSize
	}
	function carveSphere(x, y, z) {
		if (y > 3) {
			for (let i = 0; i < sphere.length; i += 3) {
				world.setBlock(x + sphere[i], y + sphere[i + 1], z + sphere[i + 2], blockIds.air, true)
			}
		}
	}


	let controls = function() {
		move.x = 0
		move.z = 0
		let dt = (win.performance.now() - p.lastUpdate) / 33
		dt = dt > 2 ? 2 : dt

		if(Key.w) move.z += p.speed
		if(Key.s) move.z -= p.speed
		if(Key.a) move.x += p.speed
		if(Key.d) move.x -= p.speed
		if (p.flying) {
			if(Key[" "]) p.velocity.y += 0.06 * dt
			if(Key.shift) p.velocity.y -= 0.06 * dt
		}
		if(Key.arrowleft) p.ry -= 0.1 * dt
		if(Key.arrowright) p.ry += 0.1 * dt
		if(Key.arrowup) p.rx += 0.1 * dt
		if(Key.arrowdown) p.rx -= 0.1 * dt

		let now = Date.now()
		if (!p.sprinting && !p.sneaking && Key.w && now - p.sprintRequest < 350) {
			p.sprinting = true
			p.sprintRequest = 0
			p.FOV(settings.fov * 1.15, 250)
		}
		if (p.sprinting && (!Key.w || Key.s)) {
			p.sprinting = false
			p.FOV(settings.fov, 100)
		}

		if(p.sprinting) {
			move.x *= p.sprintSpeed
			move.z *= p.sprintSpeed
		}
		if(p.flying) {
			move.x *= p.flySpeed
			move.z *= p.flySpeed
		}
		if (!move.x && !move.z) {
			if (p.sprinting) {
				p.FOV(settings.fov, 100)
			}
			p.sprinting = false
		} else if(Math.abs(move.x) > 0 && Math.abs(move.z) > 0) {
			move.x *= move.ang
			move.z *= move.ang
		}

		//Update the velocity, rather than the position.
		let co = Math.cos(p.ry)
		let si = Math.sin(p.ry)
		let friction = p.onGround ? 1 : 0.3
		p.velocity.x += (co * move.x - si * move.z) * friction * dt
		p.velocity.z += (si * move.x + co * move.z) * friction * dt

		const TAU = Math.PI * 2
		const PI1_2 = Math.PI / 2
		while(p.ry > TAU) p.ry -= TAU
		while(p.ry < 0)   p.ry += TAU
		if(p.rx > PI1_2)  p.rx = PI1_2
		if(p.rx < -PI1_2) p.rx = -PI1_2

		p.setDirection()
	}

	// Mouse sensitivity variable, used for the settings buttons and in the "mmoved" function
	let mouseS = 300


	function initPlayer() {
		setP(new Camera())
		p.speed = 0.075
		p.velocity = new PVector(0, 0, 0)
		p.pos = new Float32Array(3)
		p.sprintSpeed = 1.3
		p.lastForwardTap = 0
		p.sprintRequest = 0
		p.flySpeed = 2.5
		p.x = 8
		p.y = superflat ? 6 : (Math.round(noise(8 * generator.smooth, 8 * generator.smooth) * generator.height) + 2 + generator.extra)
		p.z = 8
		p.previousX = 8
		p.previousY = 70
		p.previousZ = 8
		p.w = 3 / 8
		p.bottomH = 1.62
		p.topH = 0.18
		p.onGround = false
		p.jumpSpeed = 0.3
		p.sprinting = false
		p.maxYVelocity = 1.5
		p.gravityStength = -0.032
		p.lastUpdate = win.performance.now()
		p.lastBreak = Date.now()
		p.lastPlace = Date.now()
		p.lastJump = Date.now()
		p.autoBreak = false
		p.flying = false
		p.sneaking = false
		p.spectator = false
		
		win.player = p
		win.p2 = p2
		win.inventory = inventory
		Object.defineProperty(win, "gameScreen", { get: () => screen })
	}


export {
	cross, Matrix, Plane, Camera,
	trans, rotX, rotY, transpose, matMult, copyArr, FOV, initModelView,
	timeString, roundBits,
	rayTrace, runRayTrace, lookingAt,
	inBox, onBox, collided, contacts, sprintWallHit,
	resolveContactsAndUpdatePosition, runGravity,
	box2, block2, outlinePasses, changeWorldBlock, newWorldBlock, useHeld,
	sphere, isCave, carveSphere,
	controls, mouseS, initPlayer
}
