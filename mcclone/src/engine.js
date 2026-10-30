import { blockData, BLOCK_COUNT } from './blocks.js'
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
const ATLAS_TILES = 32
const ATLAS_MASK = ATLAS_TILES - 1
const ATLAS_SHIFT = Math.log2(ATLAS_TILES)
const ATLAS_SCALE = 1 / ATLAS_TILES

const CUBE     = 0
 	const SLAB     = 0x400 // 11th bit
 	const STAIR    = 0x800 // 12th bit
 	const FLIP     = 0x1000 // 13th bit
 	const NORTH    = 0 // 14th and 15th bits for the 4 directions
 	const SOUTH    = 0x2000
 	const EAST     = 0x4000
 	const WEST     = 0x6000
 	const ROTATION = 0x6000
 	// Block state encoding: base block ids live in bits 0-9 (up to 1024 blocks),
 	// owning state lives in bits 10-14. This is the "15-bit palette" layout.
 	const BASE_MASK  = 0x3ff  // the base block id
 	const STATE_MASK = 0x7fff // the full block state (base id | owning bits)
 	// Door state bits. Doors own bits 10-14 (they never use slab/stair/flip),
 	// so these aliases are safe to reuse for their own variant states.
 	const DOOR_UPPER = 0x400 // top half of the door
 	const DOOR_OPEN  = 0x800 // swung open
 	const DOOR_HINGE = 0x1000 // right-hand hinge (else left-hand)
 	const DOOR_FACING = 0x6000 // the four facing directions (NORTH/SOUTH/EAST/WEST bits)
 	// Trapdoor state bits (also own bits 10-14).
 	const TRAPDOOR_BOTTOM = 0x400 // hangs from the underside of its cell
 	const TRAPDOOR_OPEN   = 0x800 // folded up against an edge
 	const TRAPDOOR_FACING = 0x6000
	// Torch state bit (owns bit 10): hanging from the block above vs standing.
	const TORCH_HANGING = 0x400
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

		// Reflect over the y plane; returns a new shape object
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
					let face = side[j].slice().reverse()
					let c = []
					pos[i][j] = c
					for (let k = 0; k < face.length; k += 3) {
						c[k] = face[k + 2]
						c[k + 1] = -face[k + 1]
						c[k + 2] = face[k]
					}
					let minmax = compareArr(c, [])
					c.max = minmax.splice(3, 3)
					c.min = minmax

					tex[i][j] = texVerts[i][j].slice() // Copy texture verts exactly
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
				let q1  = makeQuad(A,  B,  C,  D)
				let q1r = makeQuad(D,  C,  B,  A)
				let q2  = makeQuad(A2, B2, C2, D2)
				let q2r = makeQuad(D2, C2, B2, A2)
				obj.verts = [ [], [], [ q1 ], [ q1r ], [ q2 ], [ q2r ] ]
				obj.texVerts = [ [], [], [ uv.slice() ], [ uv.slice() ], [ uv.slice() ], [ uv.slice() ] ]
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

		// Torches are small glowing posts. They either stand on the block below
		// or hang from the block above (flame pointing down). Every face is drawn
		// double-sided so the culled back face never hides the torch.
		function pushTorchBox(verts, texVerts, x0, y0, z0, x1, y1, z1) {
			let cv = (x, y, z) => [ x / 16 - 0.5, y / 16 - 0.5, z / 16 - 0.5 ]
			let uv = [ ATLAS_SCALE, 0, 0, 0, 0, ATLAS_SCALE, ATLAS_SCALE, ATLAS_SCALE ]
			let faces = [
				[ 0, [ [x0,y1,z0], [x0,y1,z1], [x1,y1,z1], [x1,y1,z0] ] ], // top
				[ 1, [ [x0,y0,z0], [x1,y0,z0], [x1,y0,z1], [x0,y0,z1] ] ], // bottom
				[ 2, [ [x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [x1,y0,z0] ] ], // north
				[ 3, [ [x1,y0,z1], [x1,y1,z1], [x0,y1,z1], [x0,y0,z1] ] ], // south
				[ 4, [ [x1,y0,z0], [x1,y0,z1], [x1,y1,z1], [x1,y1,z0] ] ], // east
				[ 5, [ [x0,y0,z1], [x0,y0,z0], [x0,y1,z0], [x0,y1,z1] ] ]  // west
			]
			for (let f of faces) {
				let pts = f[1]
				let flat = pts.map(q => cv(q[0], q[1], q[2])).flat()
				let flatRev = pts.slice().reverse().map(q => cv(q[0], q[1], q[2])).flat()
				verts[f[0]].push(flat, flatRev)
				texVerts[f[0]].push(uv.slice(), uv.slice())
			}
		}
		function buildTorchShape(hanging) {
			let verts = [ [], [], [], [], [], [] ]
			let texVerts = [ [], [], [], [], [], [] ]
			if (hanging) {
				pushTorchBox(verts, texVerts, 7, 7, 7, 9, 16, 9)   // post
				pushTorchBox(verts, texVerts, 6, 3, 6, 10, 7, 10)  // flame
			} else {
				pushTorchBox(verts, texVerts, 7, 0, 7, 9, 9, 9)    // post
				pushTorchBox(verts, texVerts, 6, 9, 6, 10, 13, 10) // flame
			}
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
		// the fluid level (2..14px); a full source uses the normal cube.
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
			shapes["fluid" + h] = buildFluidShape(h * 2)
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
				// Fluids own bits 10-12: level 1..7 (a full/source block uses the
				// base id with no level bits). Lower levels use a shorter box.
				baseBlock.shape = shapes.cube
				baseBlock.rayShape = shapes.cube
				let flow = baseBlock.liquid === "lava" ? "lavaFlow" : "waterFlow"
				for (let level = 1; level <= 7; level++) {
					let variant = Object.create(baseBlock)
					variant.shape = shapes["fluid" + level]
					variant.textures = [ flow, flow, flow, flow, flow, flow ]
					variant.flowing = true
					blockData[i | (level << 10)] = variant
				}
				continue
			}
			if (baseBlock.fence) {
				baseBlock.shape = shapes.fence0
				baseBlock.rayShape = shapes.cube
				baseBlock.collisionShape = shapes.cube
				for (let m = 1; m < 16; m++) {
					let variant = Object.create(baseBlock)
					variant.shape = shapes["fence" + m]
					blockData[i | (m << 10)] = variant
				}
				continue
			}
			if (baseBlock.facing) {
				// Facing blocks (pumpkins) show their carved/front face on a single
				// horizontal side, chosen by the state bits, and the side texture on
				// the other three. The top/bottom keep the stem texture.
				baseBlock.shape = shapes.cube
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
				// x upper/lower half (2). The closed door sits at the facing edge;
				// the open door swings to a perpendicular edge that depends on the
				// hinge.
				let topTex = baseBlock.textures[0].replace("DoorBottom", "DoorTop")
				let topTextures = [ topTex, topTex, topTex, topTex, topTex, topTex ]
				let facings = [ NORTH, SOUTH, EAST, WEST ]
				let closedByFacing = {
					[NORTH]: shapes.doorNorth,
					[SOUTH]: shapes.doorSouth,
					[EAST]: shapes.doorEast,
					[WEST]: shapes.doorWest,
				}
				// Open door panel edge for each (facing, hinge).
				let openByHinge = {
					// facing NORTH/SOUTH: panel spans x, opens to west/east edge
					[NORTH]: [ shapes.doorWest, shapes.doorEast ],
					[SOUTH]: [ shapes.doorWest, shapes.doorEast ],
					// facing EAST/WEST: panel spans z, opens to north/south edge
					[EAST]: [ shapes.doorNorth, shapes.doorSouth ],
					[WEST]: [ shapes.doorNorth, shapes.doorSouth ],
				}
				for (let f = 0; f < facings.length; f++) {
					let facing = facings[f]
					for (let open = 0; open < 2; open++) {
						let openShapes = open ? openByHinge[facing] : null
						for (let hinge = 0; hinge < 2; hinge++) {
							let shape = open ? openShapes[hinge] : closedByFacing[facing]
							let state = facing | (open ? DOOR_OPEN : 0) | (hinge ? DOOR_HINGE : 0)
							let lower = Object.create(baseBlock)
							lower.shape = shape
							lower.collisionShape = shape
							lower.rayShape = shape
							blockData[i | state] = lower
							let upper = Object.create(lower)
							upper.textures = topTextures
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
			let slabBlock = Object.create(baseBlock)
			let stairBlock = Object.create(baseBlock)
			slabBlock.shape = shapes.slab
			baseBlock.shape = shapes.cube
			stairBlock.shape = shapes.stair
			blockData[i | SLAB] = slabBlock
			blockData[i | STAIR] = stairBlock
			let v = slabBlock.shape.varients
			for (let j = 0; j < v.length; j++) {
				if (v[j]) {
					let block = Object.create(baseBlock)
					block.shape = v[j]
					blockData[i | SLAB | j << 12] = block
				}
			}
			v = stairBlock.shape.varients
			for (let j = 0; j < v.length; j++) {
				if (v[j]) {
					let block = Object.create(baseBlock)
					block.shape = v[j]
					blockData[i | STAIR | j << 12] = block
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
		let texOrder = [1, 2, 3]
		let shadows = [1, 0.4, 0.7]
		let scale = 0.16 / height * inventory.size
		for (let i = 1; i < BLOCK_COUNT; i++) {
			let data = []
			let block = blockData[i]
			if (!block || !block.textures) continue
			let texs = block.textures
			if (typeof texs === "string") texs = [texs, texs, texs, texs, texs, texs]

			// normal
			for (let j = 11; j >= 0; j--) {
				data.push(-hexagonVerts[j * 3 + 0] * scale)
				data.push(hexagonVerts[j * 3 + 1] * scale)
				data.push(0.1666666)
				let t = block.door ? (texs[0] || texs[1] || texs[2]) : (texs[texOrder[Math.floor(j / 4)]] || texs[0])
				if (!t) continue
				let tm = textureMap[t]
				if (tm === undefined || !textureCoords[tm]) continue
				data.push(textureCoords[tm][(j * 2 + 0) % 8])
				data.push(textureCoords[tm][(j * 2 + 1) % 8])
				data.push(shadows[Math.floor(j / 4)])
			}
			let buffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
			blockIcons[i] = buffer
			blockIcons.lengths[i] = 6 * 3

			// slab
			data = []
			for (let j = 11; j >= 0; j--) {
				let t = block.door ? (texs[0] || texs[1] || texs[2]) : (texs[texOrder[Math.floor(j / 4)]] || texs[0])
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
			buffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
			blockIcons[i | SLAB] = buffer
			blockIcons.lengths[i | SLAB] = 6 * 3

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
			buffer = gl.createBuffer()
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
			blockIcons[i | STAIR] = buffer
			blockIcons.lengths[i | STAIR] = 6 * 6
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
	CUBE, SLAB, STAIR, FLIP, NORTH, SOUTH, EAST, WEST, ROTATION, BASE_MASK, STATE_MASK,
	DOOR_UPPER, DOOR_OPEN, DOOR_HINGE, DOOR_FACING, TRAPDOOR_BOTTOM, TRAPDOOR_OPEN, TRAPDOOR_FACING,
	TORCH_HANGING, LIGHT_MAX, LIGHT_LIFT, MAX_STACK, DAY_LENGTH,
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
