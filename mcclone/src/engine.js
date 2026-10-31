import { blockData, BLOCK_COUNT } from './blocks.js'
import { ITEM_ID_BASE, itemData } from './items.js'
import {
	win, doc, gl, setGl, glCache, program3D, setProgram3D, program2D, setProgram2D,
	programSky, setProgramSky, skyCache, textures, textureMap, dirtBuffer, setDirtBuffer,
	dirtTexture, setDirtTexture, textureCoords, texCoordsBuffers, mainbg, setMainbg,
	dirtbg, setDirtbg, bigArray,
	sideEdgeBuffers, dropEdgeBuffers, indexBuffer, setIndexBuffer,
	modelView, setModelView, projection, defaultModelView, matrix,
	width, height, sky, settings, setCurrentFov, setBlockOutlines, locked, setLocked,
	p, p2, world, inventory, celestialTex
} from './state.js'
import { ensureCelestialTexture, initTextures } from './textures.js'
import { FOV, initModelView, block2 } from './player.js'

// Atlas constants
const ATLAS_TILES = 64
const ATLAS_MASK = ATLAS_TILES - 1
const ATLAS_SHIFT = Math.log2(ATLAS_TILES)
const ATLAS_SCALE = 1 / ATLAS_TILES

const CUBE     = 0
 	const SLAB     = 0x800 // bit 11
 	const STAIR    = 0x1000 // bit 12
 	const FLIP     = 0x2000 // bit 13
 	const NORTH    = 0 // bits 14-15 hold the four directions
 	const SOUTH    = 0x4000
 	const EAST     = 0x8000
 	const WEST     = 0xC000
 	const ROTATION = 0xC000
 	// Vertical facing states. Facing blocks never use slab/stair bits, so the
 	// spare 0x2000 bit distinguishes up/down from the four horizontal states.
 	const FACING_UP = 0x2000
 	const FACING_DOWN = 0x6000
 	// Block state encoding: base block ids live in bits 0-10 (2048 blocks),
 	// owning state lives in bits 11-15. This is the "16-bit palette" layout and
 	// leaves room for the full vanilla block registry (1300+ blocks).
 	const BASE_MASK  = 0x7ff  // the base block id
 	const STATE_MASK = 0xffff // the full block state (base id | owning bits)
 	// Door state bits. Doors own bits 11-15 (they never use slab/stair/flip),
 	// so these aliases are safe to reuse for their own variant states.
 	const DOOR_UPPER = 0x800 // top half of the door
 	const DOOR_OPEN  = 0x1000 // swung open
 	const DOOR_HINGE = 0x2000 // right-hand hinge (else left-hand)
 	const DOOR_FACING = 0xC000 // the four facing directions (NORTH/SOUTH/EAST/WEST bits)
 	// Trapdoor state bits (also own bits 11-15).
 	const TRAPDOOR_BOTTOM = 0x800 // hangs from the underside of its cell
 	const TRAPDOOR_OPEN   = 0x1000 // folded up against an edge
 	const TRAPDOOR_FACING = 0xC000
	// Torch state bit (owns bit 11): hanging from the block above vs standing.
	const TORCH_HANGING = 0x800
	// Fluid bit 14 marks a falling column. Falling fluid renders full-height so
	// a waterfall reads as one continuous sheet instead of stacked shallow slabs.
	const FLUID_FALLING = 0x4000
	// Dynamic lighting: emissive blocks lift face brightness from LIGHT_LIFT up to 1.
	const LIGHT_MAX = 15
	const LIGHT_LIFT = 0.3


const MAX_STACK = 64

function getPointer() {
	setLocked(true)
	if (typeof canvas !== "undefined" && canvas.requestPointerLock) {
		canvas.requestPointerLock()
	}
}

function releasePointer() {
	setLocked(false)
	if (typeof document !== "undefined" && document.exitPointerLock) {
		document.exitPointerLock()
	}
}

	let Block = {
		top: 0x4,
		bottom: 0x8,
		north: 0x20,
		south: 0x10,
		east: 0x2,
		west: 0x1,
	}
	let Sides = {
		top: 0,
		bottom: 1,
		north: 2,
		south: 3,
		east: 4,
		west: 5,
	}

	// GLSL Shader code (written in script tags at the top of the file)
	let vertexShaderSrc3D = document.getElementById("blockVertexShader").text
	let fragmentShaderSrc3D = document.getElementById("blockFragmentShader").text
	let vertexShaderSrc2D = document.getElementById("2dVertexShader").text
	let fragmentShaderSrc2D = document.getElementById("2dFragmentShader").text
	let vertexShaderSrcSky = document.getElementById("skyVertexShader").text
	let fragmentShaderSrcSky = document.getElementById("skyFragmentShader").text

	function createProgramObject(curContext, vetexShaderSource, fragmentShaderSource) {
		let vertexShaderObject = curContext.createShader(curContext.VERTEX_SHADER)
		curContext.shaderSource(vertexShaderObject, vetexShaderSource)
		curContext.compileShader(vertexShaderObject)
		if (!curContext.getShaderParameter(vertexShaderObject, curContext.COMPILE_STATUS)) {
			throw curContext.getShaderInfoLog(vertexShaderObject)
		}

		let fragmentShaderObject = curContext.createShader(curContext.FRAGMENT_SHADER)
		curContext.shaderSource(fragmentShaderObject, fragmentShaderSource)
		curContext.compileShader(fragmentShaderObject)
		if (!curContext.getShaderParameter(fragmentShaderObject, curContext.COMPILE_STATUS)) {
			throw curContext.getShaderInfoLog(fragmentShaderObject)
		}

		let programObject = curContext.createProgram()
		curContext.attachShader(programObject, vertexShaderObject)
		curContext.attachShader(programObject, fragmentShaderObject)
		curContext.linkProgram(programObject)
		if (!curContext.getProgramParameter(programObject, curContext.LINK_STATUS)) {
			throw "Error linking shaders."
		}

		return programObject
	}



	// The sky is drawn as a large cube centered on the camera. Because the shader
	// uses w = 0 for its vertices, only the direction matters, so the sky appears
	// infinitely far away and moves with the player.
	let skyboxVertices = new Float32Array([
		-1, -1, -1,   1, -1, -1,   1, -1,  1,   1, -1,  1,  -1, -1,  1,  -1, -1, -1,
		-1,  1, -1,  -1,  1,  1,   1,  1,  1,   1,  1,  1,   1,  1, -1,  -1,  1, -1,
		 1, -1, -1,   1,  1, -1,   1,  1,  1,   1,  1,  1,   1, -1,  1,   1, -1, -1,
		-1, -1, -1,  -1, -1,  1,  -1,  1,  1,  -1,  1,  1,  -1,  1, -1,  -1, -1, -1,
		-1, -1,  1,   1, -1,  1,   1,  1,  1,   1,  1,  1,  -1,  1,  1,  -1, -1,  1,
		-1, -1, -1,  -1,  1, -1,   1,  1, -1,   1,  1, -1,   1, -1, -1,  -1, -1, -1,
	])

	function objectify(x, y, z, width, height, textureX, textureY) {
		return {
			x: x,
			y: y,
			z: z,
			w: width,
			h: height,
			tx: textureX,
			ty: textureY
		}
	}
	let shapes = {
		/*
			[
				[(-x, -z), (+x, -z), (+x, +z), (-x, +z)], // minX = 0,  minZ = 2,  maxX = 6, maxZ = 8
				[(-x, +z), (+x, +z), (+x, -z), (-x, -z)], // minX = 9,  minZ = 10, maxX = 3, maxZ = 4
				[(+x, +y), (-x, +y), (-x, -y), (+x, -y)], // minX = 6,  minY = 7,  maxX = 0, maxY = 1
				[(-x, +y), (+x, +y), (+x, -y), (-x, -y)], // minX = 9,  minY = 10, maxX = 3, maxY = 4
				[(+y, -z), (+y, +z), (-y, +z), (-y, -z)], // minY = 10, minZ = 11, maxY = 4, maxZ = 5
				[(+y, +z), (+y, -z), (-y, -z), (-y, +z)]  // minY = 7,  minZ = 8,  maxY = 1, maxZ = 2
			]
			*/
		cube: {
			verts: [
				// x, y, z, width, height, textureX, textureY
				// 0, 0, 0 is the corner on the top left of the texture
				[objectify( 0,  0,  0, 16, 16, 0, 0)], //bottom
				[objectify( 0, 16, 16, 16, 16, 0, 0)], //top
				[objectify(16, 16, 16, 16, 16, 0, 0)], //north
				[objectify( 0, 16,  0, 16, 16, 0, 0)], //south
				[objectify(16, 16,  0, 16, 16, 0, 0)], //east
				[objectify( 0, 16, 16, 16, 16, 0, 0)]  //west
			],
			cull: {
				top: 3,
				bottom: 3,
				north: 3,
				south: 3,
				east: 3,
				west: 3
			},
			texVerts: [],
			varients: [],
			buffer: null,
			size: 6
		},
		slab: {
			verts: [
				[objectify( 0, 0,  0, 16, 16, 0, 0)], //bottom
				[objectify( 0, 8, 16, 16, 16, 0, 0)], //top
				[objectify(16, 8, 16, 16, 8, 0, 0)], //north
				[objectify( 0, 8,  0, 16, 8, 0, 0)], //south
				[objectify(16, 8,  0, 16, 8, 0, 0)], //east
				[objectify( 0, 8, 16, 16, 8, 0, 0)]  //west
			],
			cull: {
				top: 0,
				bottom: 3,
				north: 1,
				south: 1,
				east: 1,
				west: 1
			},
			texVerts: [],
			buffer: null,
			size: 6,
			varients: [],
			flip: true,
			rotate: false
		},
		stair: {
			verts: [
				[objectify( 0, 0,  0, 16, 16, 0, 0)], //bottom
				[objectify( 0, 8,  8, 16, 8, 0, 8), objectify( 0, 16,  16, 16, 8, 0, 0)], //top
				[objectify(16, 16, 16, 16, 16, 0, 0)], //north
				[objectify( 0, 8,  0, 16, 8, 0, 8), objectify( 0, 16,  8, 16, 8, 0, 0)], //south
				[objectify(16, 8, 0, 8, 8, 8, 8), objectify(16, 16, 8, 8, 16, 0, 0)], //east
				[objectify( 0, 8, 8, 8, 8, 0, 8), objectify( 0, 16, 16, 8, 16, 8, 0)]  //west
			],
			cull: {
				top: 0,
				bottom: 3,
				north: 3,
				south: 0,
				east: 0,
				west: 0
			},
			texVerts: [],
			buffer: null,
			size: 10,
			varients: [],
			flip: true,
			rotate: true
		},
		cross: {
			// Two diagonal planes, each drawn double-sided (4 quads total).
			// Geometry is built directly in initShapes(); see `custom`.
			verts: [ [], [], [], [], [], [] ],
			texVerts: [],
			cull: {
				top: 0,
				bottom: 0,
				north: 0,
				south: 0,
				east: 0,
				west: 0
			},
			size: 4,
			varients: [],
			custom: true,
			noCollide: true
		},
	}
	win.shapes = shapes

	function compareArr(arr, out) {
		let minX = 1000
		let maxX = -1000
		let minY = 1000
		let maxY = -1000
		let minZ = 1000
		let maxZ = -1000
		let min = Math.min
		let max = Math.max
		let num = 0
		for (let i = 0; i < arr.length; i += 3) {
			num = arr[i]
			minX = minX > num ? num : minX
			maxX = maxX < num ? num : maxX
			num = arr[i + 1]
			minY = minY > num ? num : minY
			maxY = maxY < num ? num : maxY
			num = arr[i + 2]
			minZ = minZ > num ? num : minZ
			maxZ = maxZ < num ? num : maxZ
		}
		out[0] = minX
		out[1] = minY
		out[2] = minZ
		out[3] = maxX
		out[4] = maxY
		out[5] = maxZ
		return out
	}

	function initShapes() {
		function mapCoords(rect, face) {
			let x = rect.x
			let y = rect.y
			let z = rect.z
			let w = rect.w
			let h = rect.h
			let tx = rect.tx
			let ty = rect.ty
			let tex = [tx+w,ty, tx,ty, tx,ty+h, tx+w,ty+h]
			let pos = null
			switch(face) {
				case 0: // Bottom
					pos = [x,y,z, x+w,y,z, x+w,y,z+h, x,y,z+h]
					break
				case 1: // Top
					pos = [x,y,z, x+w,y,z, x+w,y,z-h, x,y,z-h]
					break
				case 2: // North
					pos = [x,y,z, x-w,y,z, x-w,y-h,z, x,y-h,z]
					break
				case 3: // South
					pos = [x,y,z, x+w,y,z, x+w,y-h,z, x,y-h,z]
					break
				case 4: // East
					pos = [x,y,z, x,y,z+w, x,y-h,z+w, x,y-h,z]
					break
				case 5: // West
					pos = [x,y,z, x,y,z-w, x,y-h,z-w, x,y-h,z]
					break
			}
			pos = pos.map(c => c / 16 - 0.5)
			let minmax = compareArr(pos, [])
			pos.max = minmax.splice(3, 3)
			pos.min = minmax
			tex = tex.map(c => c / 16 * ATLAS_SCALE)
			
			return {
				pos: pos,
				tex: tex
			}
		}
		
		// 90 degree clockwise rotation; returns a new shape object
		function rotate(shape) {
			let verts = shape.verts
			let texVerts = shape.texVerts
			let cull = shape.cull
			let pos = []
			let tex = []
			for (let i = 0; i < verts.length; i++) {
				let side = verts[i]
				pos[i] = []
				tex[i] = []
				for (let j = 0; j < side.length; j++) {
					let face = side[j]
					let c = []
					pos[i][j] = c
					for (let k = 0; k < face.length; k += 3) {
						c[k] = face[k + 2]
						c[k + 1] = face[k + 1]
						c[k + 2] = -face[k]
					}
					
					tex[i][j] = texVerts[i][j].slice() // Copy texture verts exactly
					if (i === 0) {
						// Bottom
						c.push(...c.splice(0, 3))
						tex[i][j].push(...tex[i][j].splice(0, 2))
					}
					if (i === 1) {
						// Top
						c.unshift(...c.splice(-3, 3))
						tex[i][j].unshift(...tex[i][j].splice(-2, 2))
					}

					let minmax = compareArr(c, [])
					c.max = minmax.splice(3, 3)
					c.min = minmax
				}
			}
			let temp = tex[2] // North
			tex[2] = tex[5] // North = West
			tex[5] = tex[3] // West = South
			tex[3] = tex[4] // South = East
			tex[4] = temp // East = North

			temp = pos[2] // North
			pos[2] = pos[5] // North = West
			pos[5] = pos[3] // West = South
			pos[3] = pos[4] // South = East
			pos[4] = temp // East = North

			let cull2 = {
				top: cull.top,
				bottom: cull.bottom,
				north: cull.west,
				west: cull.south,
				south: cull.east,
				east: cull.north
			}
			let buffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos.flat(2)), gl.STATIC_DRAW)

			return {
				verts: pos,
				texVerts: tex,
				cull: cull2,
				rotate: true,
				flip: shape.flip,
				buffer: buffer,
				size: shape.size,
				varients: shape.varients
			}
		}

		// Mirror over the y plane; returns a new shape object. This is the
		// upside-down slab/stair variant. A mirror reverses the winding of every
		// face, so each face is walked in reverse; the texture verts are reversed
		// in step to keep every corner on its own sprite point, and each v is
		// flipped inside its tile so the sprite still reads upright on the
		// mirrored face.
		function flip(shape) {
			let verts = shape.verts
			let texVerts = shape.texVerts
			let cull = shape.cull
			let pos = []
			let tex = []
			for (let i = 0; i < verts.length; i++) {
				let side = verts[i]
				pos[i] = []
				tex[i] = []
				for (let j = 0; j < side.length; j++) {
					let face = side[j]
					let uvs = texVerts[i][j]
					let c = []
					let t = []
					for (let k = face.length - 3; k >= 0; k -= 3) {
						c.push(face[k], -face[k + 1], face[k + 2])
					}
					for (let k = uvs.length - 2; k >= 0; k -= 2) {
						t.push(uvs[k], ATLAS_SCALE - uvs[k + 1])
					}
					let minmax = compareArr(c, [])
					c.max = minmax.splice(3, 3)
					c.min = minmax
					pos[i][j] = c
					tex[i][j] = t
				}
			}
			let temp = pos[0] // Bottom
			pos[0] = pos[1] // Bottom = Top
			pos[1] = temp // Top = Bottom

			temp = tex[0] // Bottom
			tex[0] = tex[1] // Bottom = Top
			tex[1] = temp // Top = Bottom

			let cull2 = {
				top: cull.bottom,
				bottom: cull.top,
				north: (cull.north & 1) << 1 | (cull.north & 2) >> 1,
				west: (cull.west & 1) << 1 | (cull.west & 2) >> 1,
				south: (cull.south & 1) << 1 | (cull.south & 2) >> 1,
				east: (cull.east & 1) << 1 | (cull.east & 2) >> 1
			}

			let buffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos.flat(2)), gl.STATIC_DRAW)

			return {
				verts: pos,
				texVerts: tex,
				cull: cull2,
				rotate: shape.rotate,
				flip: shape.flip,
				buffer: buffer,
				size: shape.size,
				varients: shape.varients
			}
		}

		// A quad is a flat array of 12 coords plus .min/.max bounds.
		function makeQuad(a, b, c, d) {
			let f = [ ...a, ...b, ...c, ...d ]
			let minmax = compareArr(f, [])
			f.max = minmax.splice(3, 3)
			f.min = minmax
			return f
		}

		// A single axis-aligned box contributed to a fence shape. `skip` omits
		// the face pointing at a neighbouring fence (avoids coincident faces).
		function fenceBox(verts, x0, y0, z0, x1, y1, z1, skip) {
			if (skip !== "bottom") verts[0].push(objectify(x0, y0, z0, x1 - x0, z1 - z0, 6, 6))
			if (skip !== "top")    verts[1].push(objectify(x0, y1, z1, x1 - x0, z1 - z0, 6, 6))
			if (skip !== "north")  verts[2].push(objectify(x1, y1, z1, x1 - x0, y1 - y0, 6, 0))
			if (skip !== "south")  verts[3].push(objectify(x0, y1, z0, x1 - x0, y1 - y0, 6, 0))
			if (skip !== "east")   verts[4].push(objectify(x1, y1, z0, z1 - z0, y1 - y0, 6, 0))
			if (skip !== "west")   verts[5].push(objectify(x0, y1, z1, z1 - z0, y1 - y0, 6, 0))
		}
		function buildFenceShape(mask) {
			let verts = [ [], [], [], [], [], [] ]
			fenceBox(verts, 6, 0, 6, 10, 16, 10)     // center post, always drawn
			for (let b of [ 6, 12 ]) {               // lower and upper bars
				if (mask & 1) fenceBox(verts, 7, b, 7, 9,  b + 3, 16, "north")
				if (mask & 2) fenceBox(verts, 7, b, 0, 9,  b + 3, 9,  "south")
				if (mask & 4) fenceBox(verts, 7, b, 7, 16, b + 3, 9,  "east")
				if (mask & 8) fenceBox(verts, 0, b, 7, 9,  b + 3, 9,  "west")
			}
			return {
				verts: verts,
				texVerts: [],
				cull: { top: 0, bottom: 0, north: 0, south: 0, east: 0, west: 0 },
				size: 6,
				varients: [],
				rotate: false,
				flip: false
			}
		}
		for (let mask = 0; mask < 16; mask++) {
			shapes["fence" + mask] = buildFenceShape(mask)
		}

		// Doors share geometry with fences and cross blocks: each door half is a
		// 3px-thick panel sitting at one of the four edges of its block cell.
		// There are only four unique panels (north/south/east/west edge), and
		// both the closed and the open door are always one of those four boxes.
		function buildDoorShape(x0, y0, z0, x1, y1, z1) {
			return {
				verts: [
					[objectify(x0, y0, z0, x1 - x0, z1 - z0, 0, 0)],
					[objectify(x0, y1, z1, x1 - x0, z1 - z0, 0, 0)],
					[objectify(x1, y1, z1, x1 - x0, y1 - y0, 0, 0)],
					[objectify(x0, y1, z0, x1 - x0, y1 - y0, 0, 0)],
					[objectify(x1, y1, z0, z1 - z0, y1 - y0, 0, 0)],
					[objectify(x0, y1, z1, z1 - z0, y1 - y0, 0, 0)]
				],
				texVerts: [],
				cull: {
					top: 0,
					bottom: 0,
					north: 0,
					south: 0,
					east: 0,
					west: 0
				},
				size: 6,
				varients: [],
				rotate: false,
				flip: false
			}
		}
		shapes.doorNorth = buildDoorShape( 0, 0,  0, 16, 16, 3)
		shapes.doorSouth = buildDoorShape( 0, 0, 13, 16, 16, 16)
		shapes.doorWest  = buildDoorShape( 0, 0,  0, 3, 16, 16)
		shapes.doorEast  = buildDoorShape(13, 0,  0, 16, 16, 16)
		// Trapdoors are 3px slabs. Closed ones sit at the top or bottom of their
		// cell; open ones fold up against an edge (reusing the door panels).
		shapes.trapTop    = buildDoorShape( 0, 13,  0, 16, 16, 16)
		shapes.trapBottom = buildDoorShape( 0,  0,  0, 16,  3, 16)

		for (let shape in shapes) {
			let obj = shapes[shape]
			let verts = obj.verts
			
			if (obj.custom) {
				// Cross-shaped blocks: two full-block diagonal planes, each
				// drawn front and back so the plant is visible from any angle.
				let s = 0.5
				const A  = [ -s, -s, -s ], B  = [  s, -s,  s ], C  = [  s,  s,  s ], D  = [ -s,  s, -s ]
				const A2 = [  s, -s, -s ], B2 = [ -s, -s,  s ], C2 = [ -s,  s,  s ], D2 = [  s,  s, -s ]
				let uv = [ ATLAS_SCALE, ATLAS_SCALE, 0, ATLAS_SCALE, 0, 0, ATLAS_SCALE, 0 ]
				// The back-facing quad reverses the winding, so its UV list is
				// reversed in lockstep. Every corner then keeps the sprite point
				// it has on the front and the plant stays upright from behind;
				// reusing the front UVs rotates the sprite 180 degrees instead.
				let uvR = [ uv[6], uv[7], uv[4], uv[5], uv[2], uv[3], uv[0], uv[1] ]
				let q1  = makeQuad(A,  B,  C,  D)
				let q1r = makeQuad(D,  C,  B,  A)
				let q2  = makeQuad(A2, B2, C2, D2)
				let q2r = makeQuad(D2, C2, B2, A2)
				obj.verts = [ [], [], [ q1 ], [ q1r ], [ q2 ], [ q2r ] ]
				obj.texVerts = [ [], [], [ uv.slice() ], [ uvR.slice() ], [ uv.slice() ], [ uvR.slice() ] ]
				verts = obj.verts
			} else {
				// Populate the vertex coordinates
				for (let i = 0; i < verts.length; i++) {
					let side = verts[i]
					let texArr = []
					obj.texVerts.push(texArr)
					for (let j = 0; j < side.length; j++) {
						let face = side[j]
						let mapped = mapCoords(face, i)
						side[j] = mapped.pos
						texArr.push(mapped.tex)
					}
				}
			}

			if (obj.rotate) {
				let v = obj.varients
				let east = rotate(obj)
				let south = rotate(east)
				let west = rotate(south)
				v[0] = obj
				v[2] = south
				v[4] = east
				v[6] = west
			}
			if (obj.flip) {
				let v = obj.varients
				v[1] = flip(obj)
				if (obj.rotate) {
					v[3] = flip(v[2])
					v[5] = flip(v[4])
					v[7] = flip(v[6])
				}
			}

			obj.buffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts.flat(2)), gl.STATIC_DRAW)
		}

		// Shapes built after the main pass (fluids, flats) still hold raw
		// objectify() rectangles. Map them into vertex/UV arrays like the rest.
		function finalizeShape(obj) {
			let verts = obj.verts
			for (let i = 0; i < verts.length; i++) {
				let side = verts[i]
				let texArr = []
				obj.texVerts.push(texArr)
				for (let j = 0; j < side.length; j++) {
					let mapped = mapCoords(side[j], i)
					side[j] = mapped.pos
					texArr.push(mapped.tex)
				}
			}
			obj.buffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts.flat(2)), gl.STATIC_DRAW)
			return obj
		}

		// Torches are small glowing posts. They either stand on the block below
		// or hang from the block above (flame pointing down). The model is one
		// thin box whose sides sample the middle 2px of the torch sprite, the way
		// vanilla's torch model does. Stamping the whole 16x16 sprite on every
		// face (the old version used a separate post and flame cube) drew the
		// torch several times on top of itself. Every face is drawn double-sided
		// so the culled back face never hides the torch.
		function pushTorchBox(verts, texVerts, x0, y0, z0, x1, y1, z1, hanging) {
			let cv = (x, y, z) => [ x / 16 - 0.5, y / 16 - 0.5, z / 16 - 0.5 ]
			let scale = ATLAS_SCALE / 16
			// The visible torch occupies x=7..9 of the sprite. Its flame is at
			// the top (y=2..7) and the stick runs to the bottom (y=16).
			let u0 = 7 * scale, u1 = 9 * scale
			let vTop = (hanging ? 16 : 2) * scale
			let vBottom = (hanging ? 2 : 16) * scale
			let capTop = (hanging ? 14 : 2) * scale
			let capBottom = (hanging ? 2 : 14) * scale
			let faces = [
				[ 0, [ [x0,y1,z0], [x0,y1,z1], [x1,y1,z1], [x1,y1,z0] ],
					[ u0,capTop, u0,capTop + 2 * scale, u1,capTop + 2 * scale, u1,capTop ] ], // top
				[ 1, [ [x0,y0,z0], [x1,y0,z0], [x1,y0,z1], [x0,y0,z1] ],
					[ u0,capBottom, u1,capBottom, u1,capBottom + 2 * scale, u0,capBottom + 2 * scale ] ], // bottom
				[ 2, [ [x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [x1,y0,z0] ],
					[ u0,vBottom, u0,vTop, u1,vTop, u1,vBottom ] ], // north
				[ 3, [ [x1,y0,z1], [x1,y1,z1], [x0,y1,z1], [x0,y0,z1] ],
					[ u0,vBottom, u0,vTop, u1,vTop, u1,vBottom ] ], // south
				[ 4, [ [x1,y0,z0], [x1,y0,z1], [x1,y1,z1], [x1,y1,z0] ],
					[ u0,vBottom, u0,vTop, u1,vTop, u1,vBottom ] ], // east
				[ 5, [ [x0,y0,z1], [x0,y0,z0], [x0,y1,z0], [x0,y1,z1] ],
					[ u0,vBottom, u0,vTop, u1,vTop, u1,vBottom ] ]  // west
			]
			for (let f of faces) {
				let pts = f[1]
				let uv = f[2]
				let flat = pts.map(q => cv(q[0], q[1], q[2])).flat()
				let flatRev = pts.slice().reverse().map(q => cv(q[0], q[1], q[2])).flat()
				let uvRev = [ uv[6],uv[7], uv[4],uv[5], uv[2],uv[3], uv[0],uv[1] ]
				verts[f[0]].push(flat, flatRev)
				texVerts[f[0]].push(uv.slice(), uvRev)
			}
		}
		function buildTorchShape(hanging) {
			let verts = [ [], [], [], [], [], [] ]
			let texVerts = [ [], [], [], [], [], [] ]
			pushTorchBox(verts, texVerts, 7, hanging ? 3 : 0, 7, 9, hanging ? 16 : 13, 9, hanging)
			return {
				verts: verts,
				texVerts: texVerts,
				cull: { top: 0, bottom: 0, north: 0, south: 0, east: 0, west: 0 },
				size: 6,
				varients: [],
				rotate: false,
				flip: false,
				noCollide: true
			}
		}
		shapes.torchUp = buildTorchShape(false)
		shapes.torchDown = buildTorchShape(true)

		// Fluids render as a box whose top surface sits at a height determined by
		// the fluid level (2..14px). The full-height source uses the same shape so
		// it can be non-solid like the flowing levels.
		function buildFluidShape(h) {
			return {
				verts: [
					[objectify( 0, 0,  0, 16, 16, 0, 0)], // bottom
					[objectify( 0, h, 16, 16, 16, 0, 0)], // top
					[objectify(16, h, 16, 16, h, 0, 0)],  // north
					[objectify( 0, h,  0, 16, h, 0, 0)],  // south
					[objectify(16, h,  0, 16, h, 0, 0)],  // east
					[objectify( 0, h, 16, 16, h, 0, 0)]   // west
				],
				texVerts: [],
				cull: { top: 0, bottom: 3, north: 1, south: 1, east: 1, west: 1 },
				size: 6,
				varients: [],
				rotate: false,
				flip: false,
				noCollide: true
			}
		}
		for (let h = 1; h <= 7; h++) {
			shapes["fluid" + h] = finalizeShape(buildFluidShape(h * 2))
		}
		shapes.fluidSource = finalizeShape(buildFluidShape(16))

		// Thin horizontal blocks (carpets, rails, pressure plates).
		function buildFlatShape(h) {
			return {
				verts: [
					[objectify( 0, 0,  0, 16, 16, 0, 0)], // bottom
					[objectify( 0, h, 16, 16, 16, 0, 0)], // top
					[objectify(16, h, 16, 16, h, 0, 0)],  // north
					[objectify( 0, h,  0, 16, h, 0, 0)],  // south
					[objectify(16, h,  0, 16, h, 0, 0)],  // east
					[objectify( 0, h, 16, 16, h, 0, 0)]   // west
				],
				texVerts: [],
				cull: { top: 0, bottom: 0, north: 0, south: 0, east: 0, west: 0 },
				buffer: null,
				size: 6,
				varients: [],
				rotate: false,
				flip: false
			}
		}
		shapes.flat = finalizeShape(buildFlatShape(1))
		// Snow layers are two pixels tall. They cover the top of the block below,
		// but they must not cull the bottom face of a block above: that face sits
		// 14 pixels higher, so hiding it would open a hole under anything placed
		// on top of a snow layer.
		let snowLayerShape = buildFlatShape(2)
		snowLayerShape.cull = { top: 0, bottom: 3, north: 3, south: 3, east: 3, west: 3 }
		shapes.snowLayer = finalizeShape(snowLayerShape)

		// Iron bars are a thin lattice, not a cube. These shapes mirror the
		// vanilla multipart models: a central cross-shaped post, small caps at
		// the top and bottom, and one 2px-wide rail per connected side. They are
		// built directly (like torches) so every face can sample the correct
		// strip of the 16x16 bar sprite instead of stretching the whole texture
		// across a block face.
		function pushBarQuad(verts, texVerts, face, points, uv) {
			let scale = ATLAS_SCALE / 16
			let cv = (p) => [ p[0] / 16 - 0.5, p[1] / 16 - 0.5, p[2] / 16 - 0.5 ]
			let front = points.flatMap(cv)
			let back = points.slice().reverse().flatMap(cv)
			let fuv = uv.map(c => c * scale)
			let buv = []
			for (let i = 3; i >= 0; i--) {
				buv.push(fuv[i * 2], fuv[i * 2 + 1])
			}
			verts[face].push(front, back)
			texVerts[face].push(fuv, buv)
		}
		// Vertical planes run along either Z (fixed X) or X (fixed Z). They
		// carry the left or right half of the bar sprite, which is where the
		// repeated vertical bars in vanilla's side models come from.
		function pushBarPlaneZ(verts, texVerts, face, x, z0, z1, u0, u1) {
			pushBarQuad(verts, texVerts, face,
				[ [x, 0, z0], [x, 0, z1], [x, 16, z1], [x, 16, z0] ],
				[ u0, 16, u1, 16, u1, 0, u0, 0 ])
		}
		function pushBarPlaneX(verts, texVerts, face, z, x0, x1, u0, u1) {
			pushBarQuad(verts, texVerts, face,
				[ [x0, 0, z], [x1, 0, z], [x1, 16, z], [x0, 16, z] ],
				[ u0, 16, u1, 16, u1, 0, u0, 0 ])
		}
		function pushBarPlate(verts, texVerts, face, x0, z0, x1, z1, y, u0, v0, u1, v1) {
			pushBarQuad(verts, texVerts, face,
				[ [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1] ],
				[ u0, v0, u1, v0, u1, v1, u0, v1 ])
		}
		function buildBarsShape(mask) {
			let verts = [ [], [], [], [], [], [] ]
			let texVerts = [ [], [], [], [], [], [] ]

			// Central post: two crossed planes and the little end caps that
			// vanilla always draws with the post_ends model.
			pushBarPlaneZ(verts, texVerts, 4, 8, 7, 9, 7, 9)
			pushBarPlaneX(verts, texVerts, 2, 8, 7, 9, 7, 9)
			pushBarPlate(verts, texVerts, 0, 7, 7, 9, 9, 0.5, 7, 7, 9, 9)
			pushBarPlate(verts, texVerts, 1, 7, 7, 9, 9, 15.5, 7, 7, 9, 9)

			// Side rails start at the edge of the post so the transparent
			// planes never z-fight with each other in the centre of the cell.
			if (mask & 1) { // +z
				pushBarPlaneZ(verts, texVerts, 4, 8, 9, 16, 8, 16)
				pushBarQuad(verts, texVerts, 2,
					[ [7, 0, 15.99], [9, 0, 15.99], [9, 16, 15.99], [7, 16, 15.99] ],
					[ 7, 16, 9, 16, 9, 0, 7, 0 ])
				pushBarPlate(verts, texVerts, 0, 7, 9, 9, 16, 0.5, 9, 9, 7, 16)
				pushBarPlate(verts, texVerts, 1, 7, 9, 9, 16, 15.5, 7, 9, 9, 16)
			}
			if (mask & 2) { // -z
				pushBarPlaneZ(verts, texVerts, 5, 8, 0, 7, 0, 8)
				pushBarQuad(verts, texVerts, 3,
					[ [7, 0, 0.01], [9, 0, 0.01], [9, 16, 0.01], [7, 16, 0.01] ],
					[ 9, 16, 7, 16, 7, 0, 9, 0 ])
				pushBarPlate(verts, texVerts, 0, 7, 0, 9, 7, 0.5, 7, 0, 9, 7)
				pushBarPlate(verts, texVerts, 1, 7, 0, 9, 7, 15.5, 9, 0, 7, 7)
			}
			if (mask & 4) { // +x
				pushBarPlaneX(verts, texVerts, 4, 8, 9, 16, 8, 16)
				pushBarQuad(verts, texVerts, 4,
					[ [15.99, 0, 7], [15.99, 0, 9], [15.99, 16, 9], [15.99, 16, 7] ],
					[ 8, 16, 16, 16, 16, 0, 8, 0 ])
				pushBarPlate(verts, texVerts, 0, 9, 7, 16, 9, 0.5, 9, 7, 16, 9)
				pushBarPlate(verts, texVerts, 1, 9, 7, 16, 9, 15.5, 9, 7, 16, 9)
			}
			if (mask & 8) { // -x
				pushBarPlaneX(verts, texVerts, 5, 8, 0, 7, 0, 8)
				pushBarQuad(verts, texVerts, 5,
					[ [0.01, 0, 7], [0.01, 0, 9], [0.01, 16, 9], [0.01, 16, 7] ],
					[ 16, 16, 8, 16, 8, 0, 16, 0 ])
				pushBarPlate(verts, texVerts, 0, 0, 7, 7, 9, 0.5, 0, 7, 7, 9)
				pushBarPlate(verts, texVerts, 1, 0, 7, 7, 9, 15.5, 0, 7, 7, 9)
			}

			return {
				verts: verts,
				texVerts: texVerts,
				cull: { top: 0, bottom: 0, north: 0, south: 0, east: 0, west: 0 },
				size: 6,
				varients: [],
				rotate: false,
				flip: false
			}
		}
		for (let mask = 0; mask < 16; mask++) {
			shapes["bars" + mask] = buildBarsShape(mask)
		}

		for (let i = 0; i < BLOCK_COUNT; i++) {
			let baseBlock = blockData[i]
			if (baseBlock.cross) {
				baseBlock.shape = shapes.cross
				baseBlock.rayShape = shapes.cube
				continue
			}
			if (baseBlock.torch) {
				baseBlock.shape = shapes.torchUp
				baseBlock.rayShape = shapes.cube
				let variant = Object.create(baseBlock)
				variant.shape = shapes.torchDown
				variant.hanging = true
				blockData[i | TORCH_HANGING] = variant
				continue
			}
			if (baseBlock.liquid) {
				// Fluids own bits 11-13: level 1..7 (a full/source block uses the
				// base id with no level bits). Lower levels use a shorter box.
				// Fluids are not solid: the player can walk and swim through them.
				baseBlock.shape = shapes.fluidSource
				baseBlock.rayShape = shapes.fluidSource
				let flow = baseBlock.liquid === "lava" ? "lavaFlow" : "waterFlow"
				for (let level = 1; level <= 7; level++) {
					let variant = Object.create(baseBlock)
					variant.shape = shapes["fluid" + level]
					variant.textures = [ flow, flow, flow, flow, flow, flow ]
					variant.flowing = true
					blockData[i | (level << 11)] = variant
				}
				let falling = Object.create(baseBlock)
				falling.shape = shapes.fluidSource
				falling.textures = [ flow, flow, flow, flow, flow, flow ]
				falling.flowing = true
				falling.falling = true
				blockData[i | FLUID_FALLING] = falling
				continue
			}
			if (baseBlock.fence) {
				baseBlock.shape = shapes.fence0
				baseBlock.rayShape = shapes.cube
				baseBlock.collisionShape = shapes.cube
				for (let m = 1; m < 16; m++) {
					let variant = Object.create(baseBlock)
					variant.shape = shapes["fence" + m]
					blockData[i | (m << 11)] = variant
				}
				continue
			}
			if (baseBlock.bars) {
				baseBlock.shape = shapes.bars0
				baseBlock.rayShape = shapes.cube
				baseBlock.collisionShape = shapes.cube
				for (let m = 1; m < 16; m++) {
					let variant = Object.create(baseBlock)
					variant.shape = shapes["bars" + m]
					blockData[i | (m << 11)] = variant
				}
				continue
			}
			if (baseBlock.facing) {
				// Facing blocks show a different texture on the side they face.
				// Generated vanilla blocks carry a complete per-facing texture set,
				// so every face keeps its own texture (furnace, dispenser, chest...).
				baseBlock.shape = shapes.cube
				if (baseBlock.faceTextures) {
					let facings = [ NORTH, SOUTH, EAST, WEST ]
					let names = [ 'north', 'south', 'east', 'west' ]
					for (let fi = 0; fi < 4; fi++) {
						let texs = baseBlock.faceTextures[names[fi]]
						if (!texs) continue
						if (facings[fi] === NORTH) {
							baseBlock.textures = texs
						} else {
							let variant = Object.create(baseBlock)
							variant.textures = texs
							blockData[i | facings[fi]] = variant
						}
					}
					// Dispensers, droppers, pistons, observers and barrels can
					// also point up or down. Their vertical models carry the
					// front texture on the top/bottom face instead of a side.
					if (baseBlock.verticalFacing) {
						let up = baseBlock.faceTextures.up
						let down = baseBlock.faceTextures.down
						if (up) {
							let variant = Object.create(baseBlock)
							variant.textures = up
							blockData[i | FACING_UP] = variant
						}
						if (down) {
							let variant = Object.create(baseBlock)
							variant.textures = down
							blockData[i | FACING_DOWN] = variant
						}
					}
					continue
				}
				// Legacy fallback: one front texture on the facing side.
				let top = baseBlock.textures[0]
				let side = baseBlock.side
				let front = baseBlock.front
				let frontIndex = { [NORTH]: 2, [SOUTH]: 3, [EAST]: 4, [WEST]: 5 }
				let facings = [ NORTH, SOUTH, EAST, WEST ]
				for (let facing of facings) {
					let textures = [ top, top, side, side, side, side ]
					textures[frontIndex[facing]] = front
					if (facing === NORTH) {
						baseBlock.textures = textures
					} else {
						let variant = Object.create(baseBlock)
						variant.textures = textures
						blockData[i | facing] = variant
					}
				}
				continue
			}
			if (baseBlock.door) {
				// Create all 32 block states: facing (4) x open (2) x hinge (2)
				// x upper/lower half (2). Vanilla models put the closed panel on
				// the side of the cell facing the player, i.e. opposite the door's
				// facing value. An open panel always rotates onto the hinge edge.
				let bottomTex = baseBlock.textures[0]
				let topTex = bottomTex.replace("DoorBottom", "DoorTop")
				let facings = [ NORTH, SOUTH, EAST, WEST ]
				let closedByFacing = {
					[NORTH]: shapes.doorSouth,
					[SOUTH]: shapes.doorNorth,
					[EAST]: shapes.doorWest,
					[WEST]: shapes.doorEast,
				}
				// Open door panel edge for facing x hinge, matching vanilla's
				// left/right hinge models (index 0 = left hinge, 1 = right).
				let openByHinge = {
					[NORTH]: [ shapes.doorWest, shapes.doorEast ],
					[SOUTH]: [ shapes.doorEast, shapes.doorWest ],
					[EAST]: [ shapes.doorNorth, shapes.doorSouth ],
					[WEST]: [ shapes.doorSouth, shapes.doorNorth ],
				}
				for (let f = 0; f < facings.length; f++) {
					let facing = facings[f]
					for (let open = 0; open < 2; open++) {
						let openShapes = open ? openByHinge[facing] : null
						for (let hinge = 0; hinge < 2; hinge++) {
							let shape = open ? openShapes[hinge] : closedByFacing[facing]
							let state = facing | (open ? DOOR_OPEN : 0) | (hinge ? DOOR_HINGE : 0)
							// Left-hinged doors use the horizontally mirrored texture so
							// the handle remains on the side opposite the hinge.
							let bottomTexture = hinge ? bottomTex : bottomTex + "Mirror"
							let topTexture = hinge ? topTex : topTex + "Mirror"
							let lower = Object.create(baseBlock)
							lower.shape = shape
							lower.collisionShape = shape
							lower.rayShape = shape
							lower.textures = [ bottomTexture, bottomTexture, bottomTexture, bottomTexture, bottomTexture, bottomTexture ]
							blockData[i | state] = lower
							let upper = Object.create(lower)
							upper.textures = [ topTexture, topTexture, topTexture, topTexture, topTexture, topTexture ]
							blockData[i | state | DOOR_UPPER] = upper
						}
					}
				}
				let baseShape = closedByFacing[NORTH]
				baseBlock.shape = baseShape
				baseBlock.collisionShape = baseShape
				baseBlock.rayShape = baseShape
				continue
			}
			if (baseBlock.trap) {
				// 16 states: bottom/top half (2) x open/closed (2) x facing (4).
				let closedShapeByHalf = [ shapes.trapTop, shapes.trapBottom ]
				let openShapeByFacing = {
					[NORTH]: shapes.doorNorth,
					[SOUTH]: shapes.doorSouth,
					[EAST]: shapes.doorEast,
					[WEST]: shapes.doorWest,
				}
				let facings = [ NORTH, SOUTH, EAST, WEST ]
				for (let half = 0; half < 2; half++) {
					let closedShape = closedShapeByHalf[half]
					for (let open = 0; open < 2; open++) {
						for (let f = 0; f < facings.length; f++) {
							let facing = facings[f]
							let shape = open ? openShapeByFacing[facing] : closedShape
							let state = (half ? TRAPDOOR_BOTTOM : 0) | (open ? TRAPDOOR_OPEN : 0) | facing
							let variant = Object.create(baseBlock)
							variant.shape = shape
							variant.collisionShape = shape
							variant.rayShape = shape
							blockData[i | state] = variant
						}
					}
				}
				baseBlock.shape = shapes.trapTop
				baseBlock.collisionShape = shapes.trapTop
				baseBlock.rayShape = shapes.trapTop
				continue
			}
			// Snow layers are full-footprint plates; unlike carpets they should
			// not offer slab/stair placement modes.
			if (baseBlock.snowLayer) {
				baseBlock.shape = shapes.snowLayer
				baseBlock.collisionShape = shapes.snowLayer
				baseBlock.rayShape = shapes.snowLayer
				continue
			}
			// Blocks that are already a slab, stair or thin plate keep their own
			// base shape while still offering the slab/stair placement modes.
			if (baseBlock.slabOnly || baseBlock.stairOnly || baseBlock.flat) {
				let baseShape = baseBlock.slabOnly ? shapes.slab : (baseBlock.stairOnly ? shapes.stair : shapes.flat)
				baseBlock.shape = baseShape
				baseBlock.collisionShape = baseShape
				baseBlock.rayShape = baseShape
				// A slab or stair does not fill its cell. If it is left marked
				// opaque, every full block beside it has that whole face culled,
				// which opens an x-ray window over the empty half of the cell.
				baseBlock.transparent = true
				let slabBlock = Object.create(baseBlock)
				let stairBlock = Object.create(baseBlock)
				slabBlock.shape = shapes.slab
				slabBlock.collisionShape = shapes.slab
				slabBlock.rayShape = shapes.slab
				slabBlock.transparent = true
				stairBlock.shape = shapes.stair
				stairBlock.collisionShape = shapes.stair
				stairBlock.rayShape = shapes.stair
				stairBlock.transparent = true
				blockData[i | SLAB] = slabBlock
				blockData[i | STAIR] = stairBlock
				let sv = shapes.slab.varients
				for (let j = 0; j < sv.length; j++) {
					if (!sv[j]) continue
					let block = Object.create(slabBlock)
					block.shape = sv[j]
					// Collisions and ray tracing follow the visible orientation too,
					// otherwise top slabs keep the bottom slab's hitbox.
					block.collisionShape = sv[j]
					block.rayShape = sv[j]
					blockData[i | SLAB | j << 13] = block
				}
				let tv = shapes.stair.varients
				for (let j = 0; j < tv.length; j++) {
					if (!tv[j]) continue
					let block = Object.create(stairBlock)
					block.shape = tv[j]
					// Without this, every rotated or upside-down stair collides
					// and ray-traces as the default north-facing bottom stair.
					block.collisionShape = tv[j]
					block.rayShape = tv[j]
					blockData[i | STAIR | j << 13] = block
				}
				continue
			}
			let slabBlock = Object.create(baseBlock)
			let stairBlock = Object.create(baseBlock)
			slabBlock.shape = shapes.slab
			baseBlock.shape = shapes.cube
			stairBlock.shape = shapes.stair
			// Slabs and stairs are partial blocks, so neighbours must keep the
			// faces they do not cover. Only the full base block is opaque.
			slabBlock.transparent = true
			stairBlock.transparent = true
			blockData[i | SLAB] = slabBlock
			blockData[i | STAIR] = stairBlock
			let v = slabBlock.shape.varients
			for (let j = 0; j < v.length; j++) {
				if (v[j]) {
					let block = Object.create(slabBlock)
					block.shape = v[j]
					blockData[i | SLAB | j << 13] = block
				}
			}
			v = stairBlock.shape.varients
			for (let j = 0; j < v.length; j++) {
				if (v[j]) {
					let block = Object.create(stairBlock)
					block.shape = v[j]
					blockData[i | STAIR | j << 13] = block
				}
			}
		}
	}
	let indexOrder;
	(function() {
		let arr = []
		for (let i = 0; i < 100000; i++) {
			arr.push(0 + i * 4, 1 + i * 4, 2 + i * 4, 0 + i * 4, 2 + i * 4, 3 + i * 4)
		}
		indexOrder = new Uint32Array(arr)
	})()

	let hexagonVerts
	let slabIconVerts
	let stairIconVerts
	let blockIcons
	{
		let side = Math.sqrt(3) / 2
		let s = side
		let q = s / 2
		hexagonVerts = new Float32Array([
			0, 1, 1, side, 0.5, 1, 0, 0, 1, -side, 0.5, 1,
			0, 0, 1, side, 0.5, 1, side, -0.5, 1, 0, -1, 1,
			-side, 0.5, 1, 0, 0, 1, 0, -1, 1, -side, -0.5, 1,
		])

		slabIconVerts = new Float32Array([
			0, 0.5, 1, side, 0, 1, 0, -0.5, 1, -side, 0, 1,
			0, -0.5, 1, side, 0, 1, side, -0.5, 1, 0, -1, 1,
			-side, 0, 1, 0, -0.5, 1, 0, -1, 1, -side, -0.5, 1,
		])

		stairIconVerts = [
			-s,0.5,0,0,1,         0,1,1,0,1,         q,0.75,1,0.5,1,    -q,0.25,0,0.5,1,    // top of the top step
			-q,-0.25,0,0,1,       q,0.25,1,0,1,      s,0,1,0.5,1,        0,-0.5,0,0.5,1,    // top of the bottom step
			-q,0.25,0,0,0.6,      q,0.75,1,0,0.6,    q,0.25,1,0.5,0.6,  -q,-0.25,0,0.5,0.6, // front of the top step
			0,-0.5,0,0,0.6,       s,0,1,0,0.6,       s,-0.5,1,0.5,0.6,   0,-1,0,0.5,0.6,    // front of the bottom step
			-s,0.5,0,0,0.8,      -q,0.25,0.5,0,0.8, -q,-0.75,0.5,1,0.8, -s,-0.5,0,1,0.8,    // side of the top step
			-q,-0.25,0.5,0.5,0.8, 0,-0.5,1,0.5,0.8,  0,-1,1,1,0.8,      -q,-0.75,0.5,1,0.8, // side of the bottom step
		]
	}
	function genIcons() {
		if (!textureMap || Object.keys(textureMap).length === 0) return
		if (!gl || !blockData) return
		blockIcons = [null]
		blockIcons.lengths = []
		// Face order for the isometric inventory icons: top, north, east.
		// Textures are stored [top, bottom, north, south, east, west].
		let texOrder = [0, 2, 4]
		let shadows = [1, 0.4, 0.7]
		let scale = 0.16 / height * inventory.size

		function iconTexture(name) {
			if (!name) return undefined
			let slot = textureMap[name]
			if (slot === undefined || !textureCoords[slot]) return undefined
			return textureCoords[slot]
		}

		// Add a textured quad. The vertex order matches indexOrder:
		// bottom-left, bottom-right, top-right, top-left. `crop` optionally
		// restricts sampling to a sub-rectangle of the tile (u0, v0, u1, v1);
		// thin fence posts/rails use it so the 16x16 plank tile is not crushed
		// into a few pixels and loses its grain.
		function addQuad(data, tex, x0, y0, x1, y1, shade, crop) {
			let c = iconTexture(tex)
			if (!c) return
			let u0 = crop ? crop[0] : 0
			let v0 = crop ? crop[1] : 0
			let u1 = crop ? crop[2] : 1
			let v1 = crop ? crop[3] : 1
			let cu0 = c[0] + (c[2] - c[0]) * u0
			let cu1 = c[0] + (c[2] - c[0]) * u1
			let cv0 = c[1] + (c[5] - c[1]) * v0
			let cv1 = c[1] + (c[5] - c[1]) * v1
			let points = [ [x0, y0], [x1, y0], [x1, y1], [x0, y1] ]
			let uv = [ cu0, cv1, cu1, cv1, cu1, cv0, cu0, cv0 ]
			for (let k = 0; k < 4; k++) {
				data.push(-points[k][0] * scale)
				data.push(points[k][1] * scale)
				data.push(0.1666666)
				data.push(uv[k * 2])
				data.push(uv[k * 2 + 1])
				data.push(shade)
			}
		}

		// A flat sprite is the correct inventory icon for plants, torches,
		// signs, rails, tools and other non-cube items.
		function addSprite(data, tex, halfW, halfH, shade) {
			addQuad(data, tex, -halfW, -halfH, halfW, halfH, shade === undefined ? 1 : shade)
		}

		// Fences, walls and panes get a small front-facing fence instead of a
		// full plank cube. Fence gates get their frame and diagonal brace.
		function addFence(data, tex, gate) {
			// A post is roughly one quarter of a plank tile wide; taking the
			// whole tile made the wood grain vanish into vertical streaks. Rails
			// similarly need only a thin horizontal band of the tile.
			let postUV = [ 0.25, 0, 0.5, 1 ]
			let railUV = [ 0, 0.25, 1, 0.5 ]
			let post = 0.09
			let px = 0.55
			addQuad(data, tex, -px - post, -0.9, -px + post, 0.9, 0.8, postUV)
			addQuad(data, tex, px - post, -0.9, px + post, 0.9, 0.65, postUV)
			if (gate) {
				addQuad(data, tex, -px - post, 0.42, px + post, 0.6, 1, railUV)
				addQuad(data, tex, -px - post, -0.6, px + post, -0.42, 0.75, railUV)
				// Diagonal brace.
				let x0 = -px, y0 = -0.42, x1 = px, y1 = 0.42
				let dx = x1 - x0, dy = y1 - y0
				let len = Math.sqrt(dx * dx + dy * dy)
				let nx = -dy / len * 0.055, ny = dx / len * 0.055
				addQuad(data, tex, x0 + nx, y0 + ny, x1 + nx, y1 + ny, 0.9, [ 0.25, 0.25, 0.75, 0.75 ])
				addQuad(data, tex, x0 - nx, y0 - ny, x1 - nx, y1 - ny, 0.7, [ 0.25, 0.25, 0.75, 0.75 ])
				return
			}
			addQuad(data, tex, -0.8, -0.03, 0.8, 0.16, 0.95, railUV)
			addQuad(data, tex, -0.8, -0.5, 0.8, -0.31, 0.7, railUV)
		}

		// Doors use their bottom and top textures on two vertical panels.
		function addDoor(data, texs) {
			// The base door state uses the mirrored hinge texture. Inventory
			// icons should use the normal handle side, and it also guarantees
			// the texture exists for every generated door type.
			let bottom = (texs[0] || texs[1] || texs[2] || "").replace(/Mirror$/, "")
			let top = bottom ? bottom.replace("DoorBottom", "DoorTop") : bottom
			if (!iconTexture(top)) top = bottom
			addQuad(data, bottom, -0.46, -0.95, 0.46, 0, 1)
			addQuad(data, top, -0.46, 0, 0.46, 0.95, 0.95)
			// A narrow side edge gives the sprite some depth.
			addQuad(data, bottom, 0.46, -0.95, 0.53, 0, 0.6)
			addQuad(data, top, 0.46, 0, 0.53, 0.95, 0.55)
		}

		// Trapdoors, plates and carpets are thin slabs, not full cubes.
		function addPlate(data, topTex, sideTex) {
			let tx = topTex || sideTex
			let sx = sideTex || topTex
			let top = [ [0, 0.3], [0.8, -0.05], [0, -0.4], [-0.8, -0.05] ]
			let bottom = [ [0, -0.05], [0.8, -0.4], [0, -0.75], [-0.8, -0.4] ]
			function plateQuad(a, b, c, d, tex, shade) {
				let coords = iconTexture(tex)
				if (!coords) return
				let pts = [ a, b, c, d ]
				let uv = [ coords[6], coords[7], coords[4], coords[5], coords[2], coords[3], coords[0], coords[1] ]
				for (let k = 0; k < 4; k++) {
					data.push(-pts[k][0] * scale)
					data.push(pts[k][1] * scale)
					data.push(0.1666666)
					data.push(uv[k * 2])
					data.push(uv[k * 2 + 1])
					data.push(shade)
				}
			}
			plateQuad(top[0], top[1], top[2], top[3], tx, 1)
			plateQuad(top[3], top[2], bottom[2], bottom[3], sx, 0.7)
			plateQuad(top[2], top[1], bottom[1], bottom[2], sx, 0.55)
			plateQuad(top[0], top[3], bottom[3], bottom[0], sx, 0.8)
			plateQuad(top[1], top[0], bottom[0], bottom[1], sx, 0.65)
		}

		function makeIcon(id, data) {
			if (!data.length) return
			let buffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
			blockIcons[id] = buffer
			blockIcons.lengths[id] = data.length / 4
		}

		for (let i = 1; i < BLOCK_COUNT; i++) {
			let data = []
			let block = blockData[i]
			if (!block || !block.textures) continue
			let texs = block.textures
			if (typeof texs === "string") texs = [texs, texs, texs, texs, texs, texs]
			let name = block.name || ""

			if (block.cross || block.torch) {
				// A plant/torch texture is already a complete sprite. Putting it
				// on three overlapping cube faces repeated the stem and flame.
				addSprite(data, texs[0] || name, 0.78, 0.78)
			} else if (block.door) {
				addDoor(data, texs)
			} else if (block.fence || /Bars$/.test(name)) {
				// Bamboo fences use their own cut-out texture; the solid planks
				// read much better when the icon is split into posts and rails.
				let fenceTex = /^bambooFence/.test(name) ? "bambooPlanks" : (texs[0] || name)
				addFence(data, fenceTex, /FenceGate/.test(name))
			} else if (/Sign$/.test(name) || /Rail$/.test(name) || /Ladder$/.test(name) || /(Chain|Candle|LightningRod)$/.test(name) || /(CopperLantern|SoulLantern)$/.test(name) || /^(lever|candle|rail|ladder)$/.test(name)) {
				addSprite(data, texs[0] || name, 0.78, 0.78)
			} else if (block.trap || block.flat || /Bed$/.test(name) || /Carpet$/.test(name) || /PressurePlate$/.test(name)) {
				addPlate(data, texs[0] || name, texs[2] || texs[0] || name)
			} else {
				// Normal isometric cube icon.
				for (let j = 11; j >= 0; j--) {
					data.push(-hexagonVerts[j * 3 + 0] * scale)
					data.push(hexagonVerts[j * 3 + 1] * scale)
					data.push(0.1666666)
					let t = texs[texOrder[Math.floor(j / 4)]] || texs[0]
					if (!t) continue
					let tm = textureMap[t]
					if (tm === undefined || !textureCoords[tm]) continue
					data.push(textureCoords[tm][(j * 2 + 0) % 8])
					data.push(textureCoords[tm][(j * 2 + 1) % 8])
					data.push(shadows[Math.floor(j / 4)])
				}
			}
			makeIcon(i, data)

			// slab
			data = []
			for (let j = 11; j >= 0; j--) {
				let t = texs[texOrder[Math.floor(j / 4)]] || texs[0]
				if (!t) continue
				let tm = textureMap[t]
				if (tm === undefined || !textureCoords[tm]) continue
				let texc = textureCoords[tm]
				data.push(-slabIconVerts[j * 3 + 0] * scale)
				data.push(slabIconVerts[j * 3 + 1] * scale)
				data.push(0.1666666)
				data.push(texc[(j * 2 + 0) % 8])
				data.push(texc[(j * 2 + 1) % 8])
				data.push(shadows[Math.floor(j / 4)])
			}
			makeIcon(i | SLAB, data)

			// stair
			data = []
			let v = stairIconVerts
			for (let j = 23; j >= 0; j--) {
				let num = Math.floor(j / 8)
				let st = texs[texOrder[num]] || texs[0]
				if (!st) continue
				let tm2 = textureMap[st]
				if (tm2 === undefined || !textureCoords[tm2]) continue
				let texc2 = textureCoords[tm2]
				let tx = texc2[0]
				let ty = texc2[1]
				data.push(-v[j * 5 + 0] * scale)
				data.push(v[j * 5 + 1] * scale)
				data.push(0.1666666)
				data.push(tx + v[j * 5 + 2] * ATLAS_SCALE)
				data.push(ty + v[j * 5 + 3] * ATLAS_SCALE)
				data.push(shadows[num])
			}
			makeIcon(i | STAIR, data)
		}

		// Non-block items (tools, food, ingots...) are flat sprites, not cubes.
		for (let i = 0; i < itemData.length; i++) {
			let data = []
			addSprite(data, itemData[i].texture, 0.78, 0.78)
			makeIcon(ITEM_ID_BASE + i, data)
		}
	}

	function uniformMatrix(cacheId, programObj, vrName, transpose, matrix) {
		let vrLocation = glCache[cacheId]
		if(vrLocation === undefined) {
			vrLocation = gl.getUniformLocation(programObj, vrName)
			glCache[cacheId] = vrLocation
		}
		gl.uniformMatrix4fv(vrLocation, transpose, matrix)
	}
	function vertexAttribPointer(cacheId, programObj, vrName, size, VBO) {
		let vrLocation = glCache[cacheId]
		if(vrLocation === undefined) {
			vrLocation = gl.getAttribLocation(programObj, vrName)
			glCache[cacheId] = vrLocation
		}
		if (vrLocation !== -1) {
			gl.enableVertexAttribArray(vrLocation)
			gl.bindBuffer(gl.ARRAY_BUFFER, VBO)
			gl.vertexAttribPointer(vrLocation, size, gl.FLOAT, false, 0, 0)

		}
	}






	function use2d() {
		gl.disableVertexAttribArray(glCache.aTexture)
		gl.disableVertexAttribArray(glCache.aShadow)
		gl.disableVertexAttribArray(glCache.aVertex)
		gl.useProgram(program2D)
		
		gl.enableVertexAttribArray(glCache.aVertex2)
		gl.enableVertexAttribArray(glCache.aTexture2)
		gl.enableVertexAttribArray(glCache.aShadow2)
	}
	function use3d() {
		gl.disableVertexAttribArray(glCache.aTexture2)
		gl.disableVertexAttribArray(glCache.aShadow2)
		gl.disableVertexAttribArray(glCache.aVertex2)
		gl.useProgram(program3D)

		// Menus, icons and the hotbar should always be fully lit (no day/night dimming)
		if (glCache.uSkyBrightness !== undefined) {
			gl.uniform1f(glCache.uSkyBrightness, 1.0)
		}

		gl.enableVertexAttribArray(glCache.aVertex)
		gl.enableVertexAttribArray(glCache.aTexture)
		gl.enableVertexAttribArray(glCache.aShadow)
	}

	// Day/night cycle constants (a full day is DAY_LENGTH seconds long)
	const DAY_LENGTH = 600
	const HORIZON_DAY = [0.65, 0.7, 0.8]
	const HORIZON_DAWN = [0.95, 0.35, 0.2]
	function skySmoothstep(edge0, edge1, x) {
		let t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
		return t * t * (3 - 2 * t)
	}
	function computeSky(time) {
		const day = Math.floor(time / DAY_LENGTH)
		time = time % DAY_LENGTH
		if (time < 0) time += DAY_LENGTH
		const cos = Math.cos(time * Math.PI * 2 / DAY_LENGTH)
		const sin = Math.sin(time * Math.PI * 2 / DAY_LENGTH)
		const mag = Math.sqrt(cos * cos + sin * sin * 2)
		let sunset = 1 - Math.abs(cos / mag)
		sunset *= sunset
		const horizonColor = [
			(HORIZON_DAWN[0] - HORIZON_DAY[0]) * sunset + HORIZON_DAY[0],
			(HORIZON_DAWN[1] - HORIZON_DAY[1]) * sunset + HORIZON_DAY[1],
			(HORIZON_DAWN[2] - HORIZON_DAY[2]) * sunset + HORIZON_DAY[2],
		]
		const sun = [sin / mag, cos / mag, sin / mag]
		const brightness = Math.max(skySmoothstep(-0.5, 0.3, -cos / mag), 0.1)
		const moonPhase = ((day % 8) + 8) % 8
		return { time: time, sun: sun, horizonColor: horizonColor, brightness: brightness, moonPhase: moonPhase }
	}
	function renderSkybox(timeSec, view) {
		const sky = computeSky(timeSec)

		gl.useProgram(programSky)
		gl.uniform1f(skyCache.uTime, sky.time)
		gl.uniform3f(skyCache.uSun, sky.sun[0], sky.sun[1], sky.sun[2])
		gl.uniform3f(skyCache.uHorizon, sky.horizonColor[0], sky.horizonColor[1], sky.horizonColor[2])
		gl.uniformMatrix4fv(skyCache.uView, false, view)

		ensureCelestialTexture()
		if (celestialTex) {
			gl.activeTexture(gl.TEXTURE2)
			gl.bindTexture(gl.TEXTURE_2D, celestialTex)
			gl.uniform1i(skyCache.uCelestial, 2)
			gl.uniform1f(skyCache.uHasCelestial, 1)
			gl.uniform1f(skyCache.uMoonPhase, sky.moonPhase)
		} else {
			gl.uniform1f(skyCache.uHasCelestial, 0)
		}

		gl.depthFunc(gl.LEQUAL)
		gl.bindBuffer(gl.ARRAY_BUFFER, skyCache.buffer)
		gl.enableVertexAttribArray(skyCache.aVertex)
		gl.vertexAttribPointer(skyCache.aVertex, 3, gl.FLOAT, false, 0, 0)
		gl.drawArrays(gl.TRIANGLES, 0, 36)
		gl.depthFunc(gl.LESS)
		gl.activeTexture(gl.TEXTURE0)
	}

	let maxLoad = 1
	function startLoad() {
		// Runs when the loading screen is opened; cache the player's position
		p2.x = p.x
		p2.y = p.y
		p2.z = p.z
		maxLoad = world.loadFrom.length + 9
	}
	function initWebgl() {
		if (!win.gl) {
			let canv = document.createElement('canvas')
			canv.width = ctx.canvas.width
			canv.height = ctx.canvas.height
			canv.style.position = "absolute"
			canv.style.zIndex = -1
			canv.style.top = "0px"
			canv.style.left = "0px"
			setGl(canv.getContext("webgl", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false }))
			let ext = gl.getExtension('OES_element_index_uint')
			if (!ext) {
				alert("Please use a supported browser, or update your current browser.")
			}
			gl.viewport(0, 0, canv.width, canv.height)
			gl.enable(gl.DEPTH_TEST)
			gl.enable(gl.BLEND)
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
			win.gl = gl
		} else {
			setGl(win.gl)
		}

		if (!document.body.contains(gl.canvas)) {
			document.body.append(gl.canvas)
		}

		setModelView(new Float32Array(16))
		for (let k in glCache) delete glCache[k]
		setProgram3D(createProgramObject(gl, vertexShaderSrc3D, fragmentShaderSrc3D))
		setProgram2D(createProgramObject(gl, vertexShaderSrc2D, fragmentShaderSrc2D))
		
		gl.useProgram(program2D)
		glCache.uSampler2 = gl.getUniformLocation(program2D, "uSampler")
		glCache.aTexture2 = gl.getAttribLocation(program2D, "aTexture")
		glCache.aVertex2 = gl.getAttribLocation(program2D, "aVertex")
		glCache.aShadow2 = gl.getAttribLocation(program2D, "aShadow")

		gl.useProgram(program3D)
		glCache.uSampler = gl.getUniformLocation(program3D, "uSampler")
		glCache.uPos = gl.getUniformLocation(program3D, "uPos")
		glCache.uDist = gl.getUniformLocation(program3D, "uDist")
		glCache.aShadow = gl.getAttribLocation(program3D, "aShadow")
		glCache.aTexture = gl.getAttribLocation(program3D, "aTexture")
		glCache.aVertex = gl.getAttribLocation(program3D, "aVertex")
		glCache.uLineOffset = gl.getUniformLocation(program3D, "uLineOffset")
		gl.uniform2f(glCache.uLineOffset, 0, 0)

		glCache.uSky = gl.getUniformLocation(program3D, "uSky")
		glCache.uSun = gl.getUniformLocation(program3D, "uSun")
		glCache.uSkyBrightness = gl.getUniformLocation(program3D, "uSkyBrightness")
		gl.uniform1f(glCache.uSkyBrightness, 1.0)
		gl.uniform3f(glCache.uSky, 0.33, 0.54, 0.72)
		gl.uniform3f(glCache.uSun, 0, 1, 0)

		setProgramSky(createProgramObject(gl, vertexShaderSrcSky, fragmentShaderSrcSky))
		gl.useProgram(programSky)
		skyCache.aVertex = gl.getAttribLocation(programSky, "aVertex")
		skyCache.uTime = gl.getUniformLocation(programSky, "uTime")
		skyCache.uView = gl.getUniformLocation(programSky, "uView")
		skyCache.uSun = gl.getUniformLocation(programSky, "uSun")
		skyCache.uHorizon = gl.getUniformLocation(programSky, "uHorizon")
		skyCache.uCelestial = gl.getUniformLocation(programSky, "uCelestial")
		skyCache.uMoonPhase = gl.getUniformLocation(programSky, "uMoonPhase")
		skyCache.uHasCelestial = gl.getUniformLocation(programSky, "uHasCelestial")
		skyCache.buffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, skyCache.buffer)
		gl.bufferData(gl.ARRAY_BUFFER, skyboxVertices, gl.STATIC_DRAW)

		gl.useProgram(program3D)

		gl.uniform1f(glCache.uDist, 1000)

		//Send the block textures to the GPU
		initTextures()
		initShapes()

		// These buffers are only used for drawing the main menu blocks
		for (let k in sideEdgeBuffers) delete sideEdgeBuffers[k]
		for (let side in shapes.cube.verts) {
			let edgeBuffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shapes.cube.verts[side][0]), gl.STATIC_DRAW)
			sideEdgeBuffers[side] = edgeBuffer
		}
		for (let k in dropEdgeBuffers) delete dropEdgeBuffers[k]
		for (let side in shapes.cube.verts) {
			let edgeBuffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shapes.cube.verts[side][0].map(v => v * 0.4)), gl.STATIC_DRAW)
			dropEdgeBuffers[side] = edgeBuffer
		}
		texCoordsBuffers.length = 0
		for (let t in textureCoords) {
			let buff = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, buff)
			gl.bufferData(gl.ARRAY_BUFFER, textureCoords[t], gl.STATIC_DRAW)
			texCoordsBuffers.push(buff)
		}

		//Bind the Vertex Array Object (VAO) that will be used to draw everything
		setIndexBuffer(gl.createBuffer())
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexOrder, gl.STATIC_DRAW)

		//Tell it not to render the insides of blocks
		gl.enable(gl.CULL_FACE)
		gl.cullFace(gl.BACK)

		gl.lineWidth(2)
		setBlockOutlines(false)
		gl.enable(gl.POLYGON_OFFSET_FILL)
		gl.polygonOffset(1, 1)
		gl.clearColor(sky[0], sky[1], sky[2], 1.0)
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
	}
	function initBackgrounds() {
		// Home screen background
		if (!gl || !width || !height) return
		use3d()
		gl.clearColor(sky[0], sky[1], sky[2], 1.0)
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
		FOV(100)
		const HALF_PI = Math.PI / 2
		initModelView(null, 0, 0.5, 0, -HALF_PI / 25, -HALF_PI / 3)
		gl.disableVertexAttribArray(glCache.aShadow)
		gl.vertexAttrib1f(glCache.aShadow, 1.0)
		
		let blocks = [
[7,4,1,7], [7,4,2,7], [7,4,3,7], [7,4,4,7], [7,5,1,7], [7,5,2,7], 
[7,5,3,7], [6,4,0,7], [6,4,1,7], [6,4,2,7], [6,4,3,7], [6,4,4,7], 
[6,5,0,7], [6,5,1,7], [6,5,2,7], [6,5,3,7], [6,5,4,7], [6,6,3,7], 
[6,6,4,7], [6,7,3,7], [5,0,-1,1], [5,0,0,1], [5,0,1,1], [5,0,2,1], 
[5,1,2,29], [5,2,2,29], [5,3,2,29], [5,4,2,29], [5,5,2,29], [5,6,2,29], 
[5,4,0,7], [5,4,1,7], [5,4,3,7], [5,4,4,7], [5,5,0,7], [5,5,1,7], 
[5,5,3,7], [5,5,4,7], [5,6,1,7], [5,6,3,7], [5,7,1,7], [5,7,2,7], 
[5,7,3,7], [4,-1,-1,1], [4,-1,0,1], [4,-1,1,1], [4,-1,2,1], [4,0,3,1], 
[4,0,4,1], [4,0,5,1], [4,0,6,1], [4,0,7,1], [4,0,8,1], [4,0,9,1], 
[4,0,10,1], [4,4,0,7], [4,4,1,7], [4,4,2,7], [4,4,3,7], [4,4,4,7], 
[4,5,0,7], [4,5,1,7], [4,5,2,7], [4,5,3,7], [4,5,4,7], [4,6,1,7], 
[4,6,2,7], [4,6,3,7], [4,7,4,7], [3,-1,-1,1], [3,-1,0,1], [3,-1,1,1], 
[3,-1,2,1], [3,-1,3,1], [3,-1,4,1], [3,0,5,1], [3,0,6,1], [3,0,7,1], 
[3,0,8,1], [3,0,9,1], [3,0,10,1], [3,4,1,7], [3,4,2,7], [3,4,3,7], 
[3,4,4,7], [3,5,1,7], [3,5,2,7], [3,5,3,7], [2,-1,-1,1], [2,-1,0,1], 
[2,-1,1,1], [2,-1,2,1], [2,-1,3,1], [2,-1,4,1], [2,-1,5,1], [2,-1,6,1], 
[2,-1,7,1], [2,0,8,1], [2,0,9,1], [2,0,10,1], [1,-2,-1,1], [1,-2,0,1], 
[1,-2,1,1], [1,-2,2,1], [1,-2,3,1], [1,-1,4,1], [1,-1,5,1], [1,-1,6,1], 
[1,-1,7,1], [1,-1,8,1], [1,-1,9,1], [1,-1,10,1], [0,-2,-1,1], [0,-2,0,1], 
[0,-2,1,1], [0,-2,2,1], [0,-2,3,1], [0,-2,4,1], [0,-2,5,1], [0,-1,6,1], 
[0,-1,7,1], [0,-1,8,1], [0,-1,9,1], [0,-1,10,1], [-1,-2,-1,1], 
[-1,-2,0,1], [-1,-2,1,1], [-1,-2,2,1], [-1,-2,3,1], [-1,-2,4,1], 
[-1,-2,5,1], [-1,-2,6,1], [-1,-2,7,1], [-1,-1,8,1], [-1,-1,9,1], 
[-1,-1,10,1], [-2,-2,-1,1], [-2,-2,0,1], [-2,-2,1,1], [-2,-2,2,1], 
[-2,-2,3,1], [-2,-2,4,1], [-2,-2,5,1], [-2,-2,6,1], [-2,-2,7,1], 
[-2,-2,8,1], [-2,-2,9,1], [-2,-1,10,1], [-3,-2,-1,1], [-3,-2,0,1], 
[-3,-2,1,1], [-3,-2,2,1], [-3,-2,3,1], [-3,-2,4,1], [-3,-2,5,1], 
[-3,-2,6,1], [-3,-2,7,1], [-3,-2,8,1], [-3,-2,9,1], [-3,-2,10,1], 
[-3,-2,11,1], [-3,-2,12,1], [-4,-2,-1,1], [-4,-2,0,1], [-4,-2,1,1], 
[-4,-2,2,1], [-4,-2,3,1], [-4,-2,4,1], [-4,-2,5,1], [-4,-2,6,1], 
[-4,-2,7,1], [-4,-2,8,1], [-4,-2,9,1], [-4,-2,10,1], [-4,-2,11,1], 
[-4,-2,12,1], [-5,-2,-1,1], [-5,-2,0,1], [-5,-2,1,1], [-5,-2,2,1], 
[-5,-2,3,1], [-5,-2,4,1], [-5,-2,5,1], [-5,-2,6,1], [-5,-2,7,1], [-5,-2,8,1], 
[-5,-2,9,1], [-5,-2,10,1], [-5,-2,11,1], [-5,-2,12,1], [-6,-2,-1,1], 
[-6,-2,0,1], [-6,-2,1,1], [-6,-2,2,1], [-6,-2,3,1], [-6,-2,4,1], 
[-6,-2,5,1], [-6,-2,6,1], [-6,-2,7,1], [-6,-2,8,1], [-6,-2,9,1], 
[-6,-2,10,1], [-6,-2,11,1], [-7,-2,3,1], [-7,-2,4,1], [-7,-2,5,1], 
[-7,-2,6,1], [-7,-2,7,1], [-7,-2,8,1], [-7,-2,9,1], [-8,-2,2,1], [-8,-2,3,1], 
[-8,-2,4,1], [-8,-2,5,1], [-8,-2,6,1], [-8,-2,7,1], [-8,-2,8,1]
		]
		
		for (let i = 0; i < blocks.length; i += 1) {
			block2(blocks[i][0], blocks[i][1], blocks[i][2], blocks[i][3])
		}
		
		gl.enableVertexAttribArray(glCache.aShadow)
		let pixels = new Uint8Array(width * height * 4)
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
		setMainbg(ctx.createImageData(width, height))
		let w = width * 4
		for (let i = 0; i < pixels.length; i += 4) {
			let x = i % w
			let y = height - Math.floor(i / w) - 1
			let j = y * w + x
			mainbg.data[j] = pixels[i]
			mainbg.data[j + 1] = pixels[i + 1]
			mainbg.data[j + 2] = pixels[i + 2]
			mainbg.data[j + 3] = pixels[i + 3]
		}

		// Dirt background
		use2d()
		let aspect = width / height
		let stack = height / 96
		let bright = 0.4
		if (dirtBuffer) {
			gl.deleteBuffer(dirtBuffer)
		}
		setDirtBuffer(gl.createBuffer())
		gl.bindBuffer(gl.ARRAY_BUFFER, dirtBuffer)
		let bgCoords = new Float32Array([
			-1, -1, 0, stack, bright,
			1, -1, stack * aspect, stack, bright,
			1, 1, stack * aspect, 0, bright,
			-1, 1, 0, 0, bright
		])
		gl.bufferData(gl.ARRAY_BUFFER, bgCoords, gl.STATIC_DRAW)
		gl.uniform1i(glCache.uSampler2, 1)
		gl.clearColor(0, 0, 0, 1)
		gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
		gl.vertexAttribPointer(glCache.aVertex2, 2, gl.FLOAT, false, 20, 0)
		gl.vertexAttribPointer(glCache.aTexture2, 2, gl.FLOAT, false, 20, 8)
		gl.vertexAttribPointer(glCache.aShadow2, 1, gl.FLOAT, false, 20, 16)
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
		pixels = new Uint8Array(width * height * 4)
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
		setDirtbg(ctx.createImageData(width, height))
		dirtbg.data.set(pixels)
	}


export {
	CUBE, SLAB, STAIR, FLIP, NORTH, SOUTH, EAST, WEST, ROTATION, FACING_UP, FACING_DOWN, BASE_MASK, STATE_MASK,
	DOOR_UPPER, DOOR_OPEN, DOOR_HINGE, DOOR_FACING, TRAPDOOR_BOTTOM, TRAPDOOR_OPEN, TRAPDOOR_FACING,
	TORCH_HANGING, FLUID_FALLING, LIGHT_MAX, LIGHT_LIFT, MAX_STACK, DAY_LENGTH,
	ATLAS_TILES, ATLAS_MASK, ATLAS_SHIFT, ATLAS_SCALE,
	getPointer, releasePointer,
	Block, Sides,
	vertexShaderSrc3D, fragmentShaderSrc3D, vertexShaderSrc2D, fragmentShaderSrc2D,
	vertexShaderSrcSky, fragmentShaderSrcSky, skyboxVertices,
	createProgramObject, objectify, compareArr, uniformMatrix, vertexAttribPointer,
	initShapes, shapes, indexOrder, blockIcons, genIcons,
	use2d, use3d, skySmoothstep, computeSky, renderSkybox,
	initWebgl, initBackgrounds
}
