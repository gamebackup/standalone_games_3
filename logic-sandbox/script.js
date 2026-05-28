let images = [];
function preloader(){
let manifest=[
{src:"./bulb-on-100.png",id:"bulbOn"},
{src:"./bulb-off-100.png",id:"bulbOff"},
{src:"./switch-on-80.png",id:"switchOn"},
{src:"./switch-off-80.png",id:"switchOff"},
{src:"./and-gate-100.png",id:"andGate"},
{src:"./nand-gate-100.png",id:"nandGate"},
{src:"./or-gate-100.png",id:"orGate"},
{src:"./and-gate-3-100.png",id:"andGate3"},
{src:"./or-gate-3-100.png",id:"orGate3"},
{src:"./and-gate-4-100.png",id:"andGate4"},
{src:"./or-gate-4-100.png",id:"orGate4"},
{src:"./xor-gate-100.png",id:"xorGate"},
{src:"./nor-gate-100.png",id:"norGate"},
{src:"./xnor-gate-100.png",id:"xnorGate"},
{src:"./not-gate-100.png",id:"notGate"},
{src:"./dot.png",id:"dot"},
{src:"./clock.png",id:"clock"},
{src:"./delay.png",id:"delay"},
{src:"./display.png",id:"display"},
{src:"./memory.png",id:"memory"}];

let loader = new createjs.LoadQueue(false);
    loader.loadManifest(manifest,true);
    loader.addEventListener("fileload", fileload);
    loader.addEventListener("complete", complete);
  
  function fileload(event){
  if (event.item.type == "image"){
    images[event.item.id] = event.result;
  }
}

function complete(event) {
event.target.removeEventListener("fileload",fileload);
event.target.removeEventListener("complete",complete);
}
}

// Libraries Used:
// - EaselJS for display and event models
// - GSAP for menu animation

// Instructions
// - Drag from an output connection (blue dot) to an input connection (grey dot) to create a wire.
// - You may have multiple wires branch off an output, but only one wire per input.
// - Click a connector (blue or pink dots) to remove all attached wires.
// - Click (+) button in top-right corner to add new circuits.
// - Note that some circuits are interactive


// Circuit Types

// INPUT / OUTPUT
// - IN: A light with an input to turn it on.
// - OUT: Interactive button with an output.

// LOGIC
// - NOT: Outputs inverted input signal.
// - OR: Output is true when any input is true.
// - AND: Output is only true when both inputs are true.
// - XOR: Output is only true when a single input is true.
// - NOR: Output is true when neither input is true.

// - MEM: One bit memory cell that can be switched on/off from inputs, and holds its state.
// - TCK: A set frequency ticker that pulses a single tick signal every `n` ticks (configurable)
// - DLY: Carries a signal after a delay of `n` ticks (configurable)

// kick off init
document.addEventListener('DOMContentLoaded', function() {
	window.app = AppFactory(Circuit, Wire);
	
	// enable UI import / export
	document.getElementById('importBtn').addEventListener('click', function importClickHandler() {
		var json = window.prompt('Paste JSON and press enter to import - this will reset any current design!');
		if (json) {
			loadProject(json);
		}
	});
	document.getElementById('exportBtn').addEventListener('click', function exportClickHandler() {
		var btn = document.getElementById('exportBtn');
		if (copyTextToClipboard(saveProject())) {
			btn.classList.add('show-copy-msg');
			setTimeout(function() {
				btn.classList.remove('show-copy-msg');
			}, 1000);
		}
	});
	var shareBtn = document.getElementById('shareBtn');
	if (shareBtn) {
		shareBtn.addEventListener('click', function shareClickHandler() {
			var btn = document.getElementById('shareBtn');
			var txt = "https://www.101computing.net/logic-gates-studio/?q=" + saveProject();
			if (txt.length>1400) {
				alert('Cannot generate URL: URL is too long for this circuit. Exporting circuit as JSON data instead...');
			var btn = document.getElementById('exportBtn');
			if (copyTextToClipboard(saveProject())) {
				btn.classList.add('show-copy-msg');
				setTimeout(function() {
					btn.classList.remove('show-copy-msg');
				}, 1000);
			}
			
			} else {
			if (copyTextToClipboard(txt)) {
				btn.classList.add('show-copy-msg');
				setTimeout(function() {
					btn.classList.remove('show-copy-msg');
				}, 1000);
			}
			}
		});
	}
	var newBtn = document.getElementById('newBtn');
	if (newBtn) {
		newBtn.addEventListener('click', function newBtnClickHandler() {
			window.open('https://www.101computing.net/logic-gates-studio/');
		});
	}
	
	document.getElementById('clearBtn').addEventListener('click', function clearClickHandler() {
		if (Circuit.active.length && confirm('Clear all blocks?')) {
			for (var i = Circuit.active.length - 1; i >= 0; i--) {
				Circuit.active[i].remove();
			}
		}
	});

	var tutorialBtn = document.getElementById('tutorialBtn');
	if (tutorialBtn) {
		tutorialBtn.addEventListener('click', function() {
			window.open('tutorial.png');
		});
	}
	
});


function AppFactory(Circuit, Wire) {
	var App = {};

	App.stage = new createjs.Stage('circuits-canvas');
	App.stage.mouseMoveOutside = true;
	App.stage.enableMouseOver();
	createjs.Touch.enable(App.stage);
	
	var ctx = App.stage.canvas.getContext('2d');
	var devicePixelRatio = window.devicePixelRatio || 1;
	var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
													ctx.mozBackingStorePixelRatio ||
													ctx.msBackingStorePixelRatio ||
													ctx.oBackingStorePixelRatio ||
													ctx.backingStorePixelRatio || 1;

	App.scale = devicePixelRatio / backingStoreRatio;
	App.zoom = 1;
	App.effectiveScale = App.scale;
	App.stage.scaleX = App.effectiveScale;
	App.stage.scaleY = App.effectiveScale;

	// how long signal takes to move through a circuit
	App.propagation_delay = 125;
	App.propagation_clock_delay = 125;
	


	// delete button functionality
	App.delete_btn = {
		element: document.getElementById('deleteBtn'),
		show: function show() {
			this.element.classList.add('show');
			return this;
		},
		hide: function hide() {
			this.element.classList.remove('show');
			return this;
		},
		active: function active() {
			this.element.classList.add('active');
			return this;
		},
		inactive: function inactive() {
			this.element.classList.remove('active');
			return this;
		}
	};

	// add menu functionlity
	App.add_menu = (function menuFactory() {
		var Menu = {};

		Menu.is_open = false;
		Menu.add_btn = document.getElementById('addBtn');
		Menu.add_dropdown = document.getElementById('addDropdown');

		Menu.add_btn.addEventListener('click', function() {
			if (Menu.is_open) {
				Menu.hide();
			}
			else{
				Menu.show();
			}
		});

		Menu.show = function show() {
			this.is_open = true;
			menu_tl.play();
		};

		Menu.hide = function hide() {
			this.is_open = false;
			menu_tl.reverse();
		};

		// helper function to build menu
		var btns = [];
		function addMenuBtn(name, factory) {
			var btn = document.createElement('div');
			Menu.add_dropdown.appendChild(btn);
			btn.textContent = name;
			btns.push(btn);

			btn.addEventListener('click', function() {
				var es = App.effectiveScale;
				var cx = window.innerWidth / 2 / es - App.wires.x;
				var cy = window.innerHeight / 2 / es - App.wires.y;
				factory(cx, cy);
			});
		}

		addMenuBtn('INPUT', makeButton);
		addMenuBtn('OUTPUT', makeLight);
		addMenuBtn('NOT', makeNot);
		addMenuBtn('AND', makeAnd);
		addMenuBtn('OR', makeOr);
		addMenuBtn('XOR', makeXor);
		addMenuBtn('NAND', makeNand);		
		addMenuBtn('NOR', makeNor);
		addMenuBtn('XNOR', makeXnor);
		addMenuBtn('LABEL', makeLabel);
		addMenuBtn('MEMORY', makeMemory);
		addMenuBtn('CLOCK', makeTicker);
		addMenuBtn('DELAY', makeDelay);
		addMenuBtn('DISPLAY', makeDisplay);
        addMenuBtn('AND-3', makeAnd3);
		addMenuBtn('AND-4', makeAnd4);
		addMenuBtn('OR-3', makeOr3);
		addMenuBtn('OR-4', makeOr4);
		addMenuBtn('LINK', makeDot);
		addMenuBtn('3x3 PIXEL', makeScreen3x3);
		addMenuBtn('MERGE', makeMerge);
		addMenuBtn('4x4 PIXEL', makeScreen4x4);
		addMenuBtn('SPLIT', makeSplit);
		addMenuBtn('PROBE', makeProbe);
		// create gsap animation to open/close menu
		var menu_tl = new TimelineMax({
			paused: true,
			onStart: function() { Menu.add_dropdown.style.display = 'block'; },
			onReverseComplete: function() { Menu.add_dropdown.style.display = 'none'; }
		});

		menu_tl.staggerFromTo(btns, 0.25, {
			opacity: 0,
			x: 0,
			rotationX: -90,
			scaleX: 0.5,
			scaleY: 0.5
		}, {
			opacity: 1,
			y: 0,
			rotationX: 0,
			scaleX: 1,
			scaleY: 1
		}, 0.025)
		.to(Menu.add_btn, menu_tl.duration(), {
			rotation: 225
		}, 0);

		// menu_tl.timeScale(0.2);

		return Menu;
	})();



	// flag to redraw screen
	App.needs_update = true;
	// refresh stage
	createjs.Ticker.addEventListener('tick', handleTick);
	createjs.Ticker.framerate = 60;
	function handleTick(evt) {
		if (App.needs_update) {
			App.stage.update();
			App.needs_update = false;
		}
	}

	// containers
	App.circuits = new createjs.Container();
	App.wires = new createjs.Container();
	App.stage.addChild(App.wires);
	App.stage.addChild(App.circuits);


	// active wire drawing
	// fake a connector at input end
	App.new_wire = Wire.new({ globalX: 0, globalY: 0 }, { globalX: 0, globalY: 0 });

	// mouse event handlers - scope is set to originating connector
	App.startNewWire = function startNewWire(evt) {
		var temp_pt = App.wires.localToGlobal(this.globalX, this.globalY);
		temp_pt.x /= App.effectiveScale;
		temp_pt.y /= App.effectiveScale;
		App.new_wire.output.globalX = temp_pt.x;
		App.new_wire.output.globalY = temp_pt.y;
		App.new_wire.input.globalX = evt.stageX / App.effectiveScale;
		App.new_wire.input.globalY = evt.stageY / App.effectiveScale;
		App.new_wire.draw(true);
		App.stage.addChild(App.new_wire.gfx);
	};

	App.dragNewWire = function dragNewWire(evt) {
		App.new_wire.input.globalX = evt.stageX / App.effectiveScale;
		App.new_wire.input.globalY = evt.stageY / App.effectiveScale;
		App.new_wire.draw(true);
	};

	App.endNewWire = function endNewWire(evt) {
		App.needs_update = true;
		App.stage.removeChild(App.new_wire.gfx);

		// loop through input connectors of other circuits to see if a connection was made
		var connector;
		var temp_pt = new createjs.Point();
		circuitLoop:
		for (var i = Circuit.active.length - 1; i >= 0; i--) {
			var c = Circuit.active[i];
			// don't check inputs on current circuit unless it's a memory circuit to allow feeback loop
			if ((this.circuit.id !== c.id) || (this.circuit.type=="memory")) {
				inputsLoop:
				for (var n = c.inputs.length - 1; n >= 0; n--) {
					var input_conn = c.inputs[n];
					input_conn.gfx.globalToLocal(evt.stageX, evt.stageY, temp_pt);
					if (input_conn.gfx.hitTest(temp_pt.x, temp_pt.y)) {
						connector = input_conn;
						break circuitLoop;
					}
				}
			}
		}

		// create connection
		if (connector) {
			connector.recycleWires();

			var wire = Wire.new(this, connector);
			this.wires.push(wire);
			connector.wires.push(wire);
			App.wires.addChild(wire.gfx);

			wire.powerChange(this.circuit.has_power);
			if (this.circuit.type=="memory") {this.circuit.broadcastPower();}
		}
	};


	// allow dragging stage
	var dragging_stage = false;
	var stage_offset = new createjs.Point();
	App.stage.on('stagemousedown', function(evt) {
		if (!evt.relatedTarget) {
			dragging_stage = true;
			App.wires.globalToLocal(evt.rawX, evt.rawY, stage_offset);
			// stage_offset.x = evt.rawX - App.wires.x;
			// stage_offset.y = evt.rawY - App.wires.y;
			// console.log(stage_offset);
		}
	});

	App.stage.on('stagemousemove', function(evt) {
		if (dragging_stage) {
			App.needs_update = true;

			var new_x = (evt.rawX / App.effectiveScale) - stage_offset.x;
			var new_y = (evt.rawY / App.effectiveScale) - stage_offset.y;
			App.wires.x = new_x;
			App.wires.y = new_y;
			App.circuits.x = new_x;
			App.circuits.y = new_y;
		}
	});

	App.stage.on('stagemouseup', function(evt) {
		if (dragging_stage) dragging_stage = false;
	});
	
	
	// handle resizing
	function resizeStage() {
		var width = window.innerWidth;
		var height = window.innerHeight;
  	App.stage.canvas.width = width * App.scale;
		App.stage.canvas.height = height * App.scale;
		App.needs_update = true;
	}
	
	resizeStage();
	
	window.addEventListener('resize', resizeStage);

	App.stage.canvas.addEventListener('wheel', function(e) {
		e.preventDefault();
		var delta = e.deltaY > 0 ? 0.9 : 1.1;
		App.zoom = Math.max(0.3, Math.min(3, App.zoom * delta));
		App.effectiveScale = App.scale * App.zoom;
		App.stage.scaleX = App.effectiveScale;
		App.stage.scaleY = App.effectiveScale;
		App.stage.update();
	});


	setTimeout(function() {
		var centerX = window.innerWidth / 2;
		var centerY = window.innerHeight / 2;
		//makeButton(centerX - 150, centerY);
		//	makeLight(centerX + 150, centerY);
	}, 0);


	return App;
}


// --------------------------------------------------
//     CIRCUIT FACTORIES
// --------------------------------------------------

// can be used to make a circuit of any type - used by loadProject
function makeType(type, x, y, other_info) {
	var c;

	switch (type) {
		case 'button':
			c = makeButton(x, y, other_info);
			break;
		case 'light':
			c = makeLight(x, y);
			break;
		case 'not':
			c = makeNot(x, y);
			break;
		case 'or':
			c = makeOr(x, y);
			break;
		case 'and':
			c = makeAnd(x, y);
			break;
		case 'or3':
			c = makeOr3(x, y);
			break;
		case 'and3':
			c = makeAnd3(x, y);
			break;
		case 'or4':
			c = makeOr4(x, y);
			break;
		case 'and4':
			c = makeAnd4(x, y);
			break;
		case 'xor':
			c = makeXor(x, y);
			break;
		case 'nor':
			c = makeNor(x, y);
			break;	
		case 'nand':
			c = makeNand(x, y);
			break;
		case 'xnor':
			c = makeXnor(x, y);
			break;			
		case 'memory':
			c = makeMemory(x, y, other_info);
			break;
		case 'ticker':
			c = makeTicker(x, y, other_info.off_time);
			break;
		case 'delay':
			c = makeDelay(x, y, other_info.delay);
			break;
		case 'label':
			c = makeLabel(x, y, "X");
			break;	
		case 'dot':
			c = makeDot(x, y);
			break;			
		case 'display':
			c = makeDisplay(x, y);
			break;				
		case 'lbl':
			c = makeLabel(x, y, other_info);
			break;	
		case 'screen33':
			c = makeScreen3x3(x, y);
			break;
		case 'screen44':
			c = makeScreen4x4(x, y);
			break;
		case 'probe':
			c = makeProbe(x, y);
			break;
		case 'split':
			c = makeSplit(x, y);
			break;
		case 'merge':
			c = makeMerge(x, y);
			break;
		default:
			throw new Error('makeType: "' + type + '" is not a valid type');
			break;
	}
	return c;
}


function makeButton(x, y, state) {
	var c = new Circuit('button', 0, 1,'');
	c.add(x, y);
	c.has_power = state;
	// create toggle button
	var toggle_btn = new createjs.Shape();
	c.gfx.addChild(toggle_btn);
	c.draggable.addChild(toggle_btn);
	toggle_btn.on('mouseclick', toggleGenerator);
	toggle_btn.on('pressup', toggleGenerator);
	// toggle power state and broadcast change
	function toggleGenerator() {
		c.has_power = !c.has_power;
		c.renderButton();
		c.broadcastPower();
	}
	c.toggleSwitch = function() {
		c.has_power = !c.has_power;
		c.renderButton();
		c.broadcastPower();
	}
	// render toggle button to show current generator state
	c.renderButton = function()  {
	toggle_btn.graphics.clear();
		//toggle_btn.graphics.beginFill('#555');
		//toggle_btn.graphics.drawCircle(0, 0, this.chip_radius);
	  var chip2;
      if (c.has_power) {
   	    chip2 = new createjs.Bitmap(images["switchOn"]);
		} else {
   	    chip2 = new createjs.Bitmap(images["switchOff"]);
		}	
		
		chip2.x=-40;	
	    chip2.y=-40;
		c.gfx.addChild(chip2);
        c.gfx.updateCache();
	}
	c.renderButton();
	return c;
}
function makeLight(x, y) {
	var c = new Circuit('light', 1, 0);
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function determinePowerState(inputs) {
		return inputs[0];
	};
	// create light
	var light_gfx = new createjs.Shape();
	c.draggable.addChild(light_gfx);
	// render toggle button to show current generator state
	c.powerChanged = renderLight;

	function renderLight() {
	
		light_gfx.graphics.clear();
		//light_gfx.graphics.beginFill('#555');
		//light_gfx.graphics.drawCircle(0, -6, c.chip_radius);
		//light_gfx.alpha = 0.01;
	    var chip2;
        if (c.has_power) {
   	      chip2 = new createjs.Bitmap(images["bulbOn"]);
		} else {
   	      chip2 = new createjs.Bitmap(images["bulbOff"]);
		}	
		 chip2.x=-33;	
	     chip2.y=-56;
		 c.gfx.addChild(chip2);
		 c.gfx.updateCache();

	}
	
	renderLight();
	return c;
}

function makeProbe(x, y) {
	var c = new Circuit('probe', 1, 1);
	c.add(x, y);

	var w = 44, h = 34, r = 3;
	var hw = w / 2, hh = h / 2;

	c.chip.graphics.clear();
	c.chip.graphics.beginFill('#555');
	c.chip.graphics.drawRoundRect(-hw, -hh, w, h, r);
	c.chip.alpha = 0.01;

	var pars = new createjs.Shape();
	pars.graphics.setStrokeStyle(1);
	pars.graphics.beginStroke('#000');
	pars.graphics.moveTo(-50, 0);
	pars.graphics.lineTo(-22, 0);
	pars.graphics.moveTo(22, 0);
	pars.graphics.lineTo(50, 0);
	c.gfx.addChild(pars);

	var bg = new createjs.Shape();
	c.draggable.addChild(bg);

	var label = new createjs.Text('0', 'bold 20px Arial', '#FFF');
	label.textAlign = 'center';
	label.y = -10;
	c.gfx.addChild(label);

	c.determinePowerState = function(inputs) {
		return inputs[0];
	};

	c.powerChanged = function() {
		var on = c.has_power;
		var ins = 2;
		bg.graphics.clear();
		bg.graphics.setStrokeStyle(1);
		bg.graphics.beginStroke('#000');
		bg.graphics.beginFill('#444');
		bg.graphics.drawRoundRect(-hw, -hh, w, h, r);
		bg.graphics.beginFill(on ? '#0F0' : '#BBB');
		bg.graphics.drawRoundRect(-hw + ins, -hh + ins, w - ins * 2, h - ins * 2, r);
		label.text = on ? '1' : '0';
		label.color = on ? '#FFF' : '#666';
		c.gfx.updateCache();
	};

	// bring connectors to the top layer
	c.gfx.setChildIndex(c.inputs[0].gfx, c.gfx.getNumChildren() - 1);
	c.gfx.setChildIndex(c.outputs[0].gfx, c.gfx.getNumChildren() - 1);

	c.powerChanged();
	return c;
}

function makeSplit(x, y) {
	var c = new Circuit('split', 1, 2, '');
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function(inputs) {
		return inputs[0];
	};
	c.broadcastPower = function() {
		app.needs_update = true;
		if (this.powerChanged) this.powerChanged(this.has_power);
		var delay = app.propagation_delay;
		for (var i = 0; i < this.outputs.length; i++) {
			var conn = this.outputs[i];
			for (var n = conn.wires.length - 1; n >= 0; n--) {
				setTimeout(conn.wires[n].powerChange.bind(conn.wires[n], this.has_power), this.delay * delay);
			}
		}
	};
	return c;
}

function makeMerge(x, y) {
	var c = new Circuit('merge', 2, 1, '');
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function(inputs) {
		return inputs[0] || inputs[1];
	};
	return c;
}

function makeDisplay(x, y) {
	var c = new Circuit('display', 4, 0);
	c.add(x, y);

	// dummy determination function
	c.determinePowerState = function determinePowerState(inputs) {
		let n=0;
		if (inputs[0]==true) n+=1;
		if (inputs[1]==true) n+=2;
		if (inputs[2]==true) n+=4;
		if (inputs[3]==true) n+=8;
		if ((n==11) || (n==13)) {
		   return n.toString(16).toLowerCase();
		} else {
		   return n.toString(16).toUpperCase();	
		}   
	};
	

	// create light
	var light_gfx = new createjs.Shape();
	c.draggable.addChild(light_gfx);

	// render toggle button to show current generator state
	c.powerChanged = renderLight;
  c.number=0;
	function renderLight() {
		light_gfx.graphics.clear();
		renderLabel();
		c.gfx.updateCache();
	}
	
	var label = new createjs.Text(c.determinePowerState(c.simple_inputs), '50px segments', '#FF00FF');
	label.textAlign = 'center';
	label.cache(-c.chip_radius, 0, c.chip_radius * 2, 40);
	c.draggable.addChild(label);
	label.x = 8;
	label.y = -22;

	function renderLabel() {
		label.text =c.determinePowerState(c.simple_inputs);
		label.updateCache();
		c.gfx.updateCache();
		app.needs_update = true;
	}
	renderLight();
	return c;
}

function makeScreen3x3(x, y) {
	return makePixelScreen(x, y, 3);
}
function makeScreen4x4(x, y) {
	return makePixelScreen(x, y, 4);
}
function makePixelScreen(x, y, size) {
	var type = 'screen' + size + size;
	var c = new Circuit(type, size * size, 0);
	c.add(x, y);

	c.determinePowerState = function(inputs) {
		return inputs.map(function(v) { return v ? '1' : '0'; }).join('');
	};

	var pixel_size = size === 3 ? 32 : 28;
	var gap = size === 3 ? 6 : 5;
	var grid_w = size * pixel_size + (size - 1) * gap;
	var off_x = -grid_w / 2;
	var off_y = -grid_w / 2;

	var bg = new createjs.Shape();
	bg.graphics.beginFill('#222');
	bg.graphics.drawRoundRect(off_x - 6, off_y - 6, grid_w + 12, grid_w + 12, 4);
	c.draggable.addChild(bg);

	var grid = new createjs.Shape();
	c.draggable.addChild(grid);

	c.powerChanged = function() {
		grid.graphics.clear();
		for (var row = 0; row < size; row++) {
			for (var col = 0; col < size; col++) {
				var idx = row * size + col;
				var on = c.simple_inputs[idx];
				grid.graphics.beginFill(on ? '#F0F' : '#444');
				grid.graphics.drawRect(off_x + col * (pixel_size + gap), off_y + row * (pixel_size + gap), pixel_size, pixel_size);
			}
		}
		c.gfx.updateCache();
		app.needs_update = true;
	};

	// reposition each connector outside the grid edge
	var half = grid_w / 2;
	var gap_from_grid, left_far, left_spacing, right_gap;
	if (size === 3) {
		gap_from_grid = 20;
		left_far = 40;
		left_spacing = 20;
		right_gap = 20;
	} else {
		gap_from_grid = 18;
		left_far = 42;
		left_spacing = 20;
		right_gap = 22;
	}
	for (var row = 0; row < size; row++) {
		for (var col = 0; col < size; col++) {
			var idx = row * size + col;
			var px = off_x + col * (pixel_size + gap) + pixel_size / 2;
			var py = off_y + row * (pixel_size + gap) + pixel_size / 2;
			var cx = px, cy = py;
			if (row === 0) {
				cy = -(half + gap_from_grid);
			} else if (row === size - 1) {
				cy = half + gap_from_grid;
			} else if (col < size / 2) {
				cx = -(half + left_far - col * left_spacing);
				cy = py;
			} else {
				cx = half + right_gap + (col - Math.ceil(size / 2)) * left_spacing;
				cy = py;
			}
			c.inputs[idx].gfx.x = cx;
			c.inputs[idx].gfx.y = cy;
		}
	}
	c.setPosition(c.gfx.x, c.gfx.y);

	c.powerChanged();
	return c;
}


function makeLabel(x, y, text) {
	var c = new Circuit('lbl', 0, 0, '');
	c.add(x, y);
	c.has_power = false;

	if (text === undefined) text = "X";

	var box = new createjs.Shape();
	box.cursor = 'pointer';
	box.alpha = 0.5;
	c.box = box;
	c.gfx.addChild(box);
	c.draggable.addChild(box);

	var box2 = new createjs.Shape();
	box2.cursor = 'pointer';
	c.box2 = box2;
	c.gfx.addChild(box2);

	var label = new createjs.Text(text, '18px Arial', '#FFF');
	label.textAlign = 'center';
	c.gfx.addChild(label);
	c.label = label;

	function resizeBoxes() {
		label.text = c.label.text || 'X';
		var textW = Math.max(label.getMeasuredWidth(), 20);

		var pad1 = 20;
		var pad2 = 10;
		var w1 = textW + pad1 * 2;
		var w2 = textW + pad2 * 2;

		box.graphics.clear();
		box.graphics.beginFill("#444");
		box.graphics.drawRoundRect(0, 0, w1, 55, 10);
		box.x = -w1 / 2;
		box.y = -30;

		box2.graphics.clear();
		box2.graphics.beginFill("#111");
		box2.graphics.drawRoundRect(0, 0, w2, 35, 10);
		box2.x = -w2 / 2;
		box2.y = -20;

		label.x = 0;
		label.y = -10;
		label.cache(-w1 / 2, -15, w1, 30);

		var new_radius = Math.max(50, Math.ceil(w1 / 2) + 10);
		c.chip_radius = new_radius;
		c.chip.graphics.clear();
		c.chip.graphics.beginFill('#555');
		c.chip.graphics.drawCircle(0, 0, c.chip_radius);
		c.chip.alpha = 0.01;

		var cache_r = c.chip_radius + 8;
		c.gfx.cache(-cache_r, -cache_r, cache_r * 2, cache_r * 2);
		app.needs_update = true;
	}

	box2.on('click', function() {
		var newText = prompt("Enter the text for your label:", c.label.text);
		if (newText !== null) {
			c.label.text = newText || 'X';
			resizeBoxes();
		}
	});

	resizeBoxes();
	return c;
}

function makeNot(x, y) {
	var c = new Circuit('not', 1, 1, '');
	c.add(x, y);
	c.has_power = true;
	c.determinePowerState = function determinePowerState(inputs) {
		return !inputs[0];
	};
	return c;
}
function makeDot(x, y) {
	var c = new Circuit('dot', 1, 1, '');
	c.add(x, y);
	c.has_power = true;
	c.determinePowerState = function determinePowerState(inputs) {
		return inputs[0];
	};
	return c;
}
function makeOr(x, y) {
	var c = new Circuit('or', 2, 1, '');
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function determinePowerState(inputs) {
		return inputs[0] || inputs[1];
	};
	return c;
}
function makeOr3(x, y) {
	var c = new Circuit('or3', 3, 1, '');
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function determinePowerState(inputs) {
		return inputs[0] || inputs[1] || inputs[2];
	};
	return c;
}
function makeOr4(x, y) {
	var c = new Circuit('or4', 4, 1, '');
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function determinePowerState(inputs) {
		return inputs[0] || inputs[1] || inputs[2] || inputs[3];
	};
	return c;
}



function makeAnd(x, y) {
	var c = new Circuit('and', 2, 1, '');
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function determinePowerState(inputs) {
		return inputs[0] && inputs[1];
	};
	return c;
}
function makeAnd3(x, y) {
	var c = new Circuit('and3', 3, 1, '');
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function determinePowerState(inputs) {
		return inputs[0] && inputs[1] && inputs[2];
	};
	return c;
}
function makeAnd4(x, y) {
	var c = new Circuit('and4', 4, 1, '');
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function determinePowerState(inputs) {
		return inputs[0] && inputs[1] && inputs[2] && inputs[3];
	};
	return c;
}


function makeXor(x, y) {
	var c = new Circuit('xor', 2, 1, '');
	c.add(x, y);
	c.has_power = false;
	c.determinePowerState = function determinePowerState(inputs) {
		return (inputs[0] || inputs[1]) && !(inputs[0] && inputs[1]);
	};
	return c;
}

function makeXnor(x, y) {
	var c = new Circuit('xnor', 2, 1, '');
	c.add(x, y);
	c.has_power = true;
	c.determinePowerState = function determinePowerState(inputs) {
		return (inputs[0] == inputs[1]);
	};
	return c;
}

function makeNor(x, y) {
	var c = new Circuit('nor', 2, 1, '');
	c.add(x, y);
	c.has_power = true;
	c.determinePowerState = function determinePowerState(inputs) {
		return !inputs[0] && !inputs[1];
	};
	return c;
}

function makeNand(x, y) {
	var c = new Circuit('nand', 2, 1, '');
	c.add(x, y);
	c.has_power = true;
	c.determinePowerState = function determinePowerState(inputs) {
		return !inputs[0] || !inputs[1];
	};
	return c;
}

function makeMemory(x, y, edgeTriggered) {
	var c = new Circuit('memory', 2, 2);
	c.add(x, y);

	if (edgeTriggered === undefined) edgeTriggered = false;
	c.data.memory = false;
	c.edgeTriggered = edgeTriggered;
	c.enabler = false;

	c.determinePowerState = function(inputs) {
		if (c.edgeTriggered) {
			if (inputs[0]) {
				if (!c.enabler) {
					c.data.memory = inputs[1];
					c.enabler = true;
				}
			} else {
				c.enabler = false;
			}
		} else {
			if (inputs[0]) {
				c.data.memory = inputs[1];
			}
		}
		return c.data.memory;
	};

	// triangle indicator, toggles edge-triggered mode
	var btn = new createjs.Shape();
	btn.y = 12;
	btn.x = -11;
	var color = c.edgeTriggered ? Wire.on_color : Wire.off_color;
	btn.graphics.beginFill(color);
	btn.graphics.drawPolyStar(0, 0, 8, 3, 0, -90);
	btn.graphics.beginStroke(color);
	btn.graphics.setStrokeStyle(3);
	btn.graphics.moveTo(0, 10);
	btn.graphics.lineTo(0, 0);
	btn.graphics.endStroke();
	c.gfx.addChild(btn);

	btn.on('click', function() {
		c.edgeTriggered = !c.edgeTriggered;
		renderLight();
		c.inputChange();
	});

	function renderLight() {
		var color = c.edgeTriggered ? Wire.on_color : Wire.off_color;
		btn.graphics.clear();
		btn.graphics.beginFill(color);
		btn.graphics.drawPolyStar(0, 0, 8, 3, 0, -90);
		btn.graphics.beginStroke(color);
		btn.graphics.setStrokeStyle(3);
		btn.graphics.moveTo(0, 10);
		btn.graphics.lineTo(0, 0);
		btn.graphics.endStroke();
		c.gfx.updateCache();
		app.needs_update = true;
	}

	c.powerChanged = renderLight;
	renderLight();

	// nudge connectors to align with chip image
	c.inputs[1].gfx.y += 3;  // D (top-left)
	c.inputs[0].gfx.y -= 3;  // E (bottom-left)
	c.outputs[0].gfx.y += 3; // Q (top-right)
	c.outputs[1].gfx.y -= 3; // !Q (bottom-right)
	c.setPosition(c.gfx.x, c.gfx.y);

	return c;
}

function makeTicker(x, y, set_off_time) {
	var c = new Circuit('ticker', 0, 1);
	c.add(x, y);


	// create toggle button
	var toggle_btn = new createjs.Shape();
	c.gfx.addChild(toggle_btn);
	toggle_btn.on('click', toggleGenerator);


	// begin ticking!
	var delay = app.propagation_clock_delay;
	var off_time = c.data.off_time = set_off_time || 10; // propagation ticks
	var on_time = off_time * delay;
	setTimeout(toggleGenerator, off_time * delay);

	// toggle power state and broadcast change
	function toggleGenerator() {
		c.has_power = !c.has_power;
		renderLight(c);
		setTimeout(toggleGenerator, c.has_power ? off_time * delay : off_time * delay); //setTimeout(toggleGenerator, c.has_power ? on_time : off_time * delay);
		c.broadcastPower();
	}

	// create light
	var light_gfx = new createjs.Shape();
	c.draggable.addChild(light_gfx);

	function renderLight() {
		var light_color = c.has_power ? Wire.on_color : Wire.off_color;
		light_gfx.graphics.clear();
		light_gfx.graphics.beginFill(light_color);
		light_gfx.graphics.drawCircle(0, 0, 15);
		c.gfx.updateCache();
	}

	// initial render
	renderLight();

	// create label
	var label = new createjs.Text(off_time, '18px Arial', '#FFF');
	label.textAlign = 'center';
	label.cache(-c.chip_radius, 0, c.chip_radius * 2, 15);
	c.draggable.addChild(label);
	label.x = 0;
	label.y = -8;

	function renderLabel() {
		label.text = off_time;
		label.updateCache();
		c.gfx.updateCache();
		app.needs_update = true;
	}

	// create step buttons
	var up_btn = new createjs.Shape();
	up_btn.y = -22;
	up_btn.graphics.beginFill(Wire.on_color);
	up_btn.graphics.drawPolyStar(0, 0, 8, 3, 0, -90);
	c.gfx.addChild(up_btn);

	var down_btn = new createjs.Shape();
	down_btn.y = 22;
	down_btn.graphics.beginFill(Wire.on_color);
	down_btn.graphics.drawPolyStar(0, 0, 8, 3, 0, 90);
	c.gfx.addChild(down_btn);

	up_btn.on('click', function() {
		off_time++;
		c.data.off_time = off_time;
		renderLabel();
	});

	down_btn.on('click', function() {
		off_time--;
		if (off_time < 1) off_time = 1;
		c.data.off_time = off_time;
		renderLabel();
	});

	c.gfx.updateCache();

	return c;
}

function makeDelay(x, y, delay) {
	var c = new Circuit('delay', 1, 1);
	c.add(x, y);

	c.determinePowerState = function determinePowerState(inputs) {
		return inputs[0];
	};

	// set delay if provided
	if (typeof delay !== 'undefined') c.delay = delay;

	// create label
	var label = new createjs.Text(c.delay, '18px Arial', '#000');
	label.textAlign = 'center';
	label.cache(-c.chip_radius, 0, c.chip_radius * 2, 20);
	c.draggable.addChild(label);
	label.x = 0;
	label.y = -8;

	function renderLabel() {
		label.text = c.delay;
		label.updateCache();
		c.gfx.updateCache();
		app.needs_update = true;
	}

	// create step buttons
	var up_btn = new createjs.Shape();
	up_btn.y = -22;
	up_btn.graphics.beginFill(Wire.on_color);
	up_btn.graphics.drawPolyStar(0, 0, 8, 3, 0, -90);
	c.gfx.addChild(up_btn);

	var down_btn = new createjs.Shape();
	down_btn.y = 22;
	down_btn.graphics.beginFill(Wire.on_color);
	down_btn.graphics.drawPolyStar(0, 0, 8, 3, 0, 90);
	c.gfx.addChild(down_btn);

	up_btn.on('click', function() {
		c.delay++;
		renderLabel();
	});

	down_btn.on('click', function() {
		c.delay--;
		if (c.delay < 1) c.delay = 1;
		renderLabel();
	});

	c.gfx.updateCache();

	return c;
}

var Circuit = (function CircuitFactory() {
	// track unique circuit ids
	var next_circuit_id = 0;

	// constructor
	var Circuit = function Circuit(type, inputs, outputs, label) {
		inputs = inputs || 0;
		outputs = outputs || 0;

	
		// unique circuit id
		this.id = next_circuit_id++;

		// type of circuit
		this.type = type;

		// wrapper helps with rendering cached graphics at high PPI
		// this.gfx_wrap = new createjs.Container();
		// container for all children elements
		this.gfx = new createjs.Container();
		// container for elements that allow dragging circuit
		this.draggable = new createjs.Container();
		this.draggable.mouseChildren = false;

		// chip base (draggable part)
		this.chip_radius = 50;
		this.chip = new createjs.Shape();
		if (type=="lbl") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;	
		} else if (type=="button") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0,this.chip_radius);
		  this.chip.alpha = 0.01;
   	      this.chip2 = new createjs.Bitmap(images["switchOff"]);
	      this.chip2.x=-40;	
	      this.chip2.y=-40;
		} else if (type=="and") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["andGate"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;	
		} else if (type=="nand") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["nandGate"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;	
		} else if (type=="or") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["orGate"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;	
		} else if (type=="and3") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["andGate3"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;	
		} else if (type=="or3") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["orGate3"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;	
		} else if (type=="and4") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["andGate4"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;	
		} else if (type=="or4") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["orGate4"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;	
		} else if (type=="xor") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["xorGate"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;	
		} else if (type=="nor") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["norGate"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;		
		 } else if (type=="xnor") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["xnorGate"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;				
		} else if (type=="not") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["notGate"]);
	      this.chip2.x=-50;	
	      this.chip2.y=-32;	
		} else if (type=="dot") {
		  this.chip_radius = 15;
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
		  this.chip2 = new createjs.Bitmap(images["dot"]);
	      this.chip2.x=-8;	
	      this.chip2.y=-10;
		  var white_dot = new createjs.Shape();
		  white_dot.graphics.beginFill('#FFF');
		  white_dot.graphics.drawCircle(0, 0, 3);
		  this.gfx.addChild(white_dot);
		} else if (type=="light") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, -6, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["bulbOff"]);
	      this.chip2.x=-33;	
	      this.chip2.y=-56;	
		} else if (type=="memory") {
		  this.chip_radius = 62;
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
    	      this.chip2 = new createjs.Bitmap(images["memory"]);
	      this.chip2.x=-60;	
	      this.chip2.y=-40;	  
		} else if (type=="ticker") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["clock"]);
	      this.chip2.x=-38;	
	      this.chip2.y=-39;	  	
		} else if (type=="delay") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
   	      this.chip2 = new createjs.Bitmap(images["delay"]);
	      this.chip2.x=-60;	
	      this.chip2.y=-39;	 
		} else if (type=="display") {
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;		  
    	      this.chip2 = new createjs.Bitmap(images["display"]);
	      this.chip2.x=-56;	
     	      this.chip2.y=-39;	 		  
		} else if (type=="screen33") {
		  this.chip_radius = 95;
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;
		} else if (type=="screen44") {
		  this.chip_radius = 110;
		  this.chip.graphics.beginFill('#555');
		  this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		  this.chip.alpha = 0.01;
		} else {
			this.chip.graphics.setStrokeStyle(2);
			this.chip.graphics.beginStroke('#777');
			this.chip.graphics.beginFill('#555');
			this.chip.graphics.drawCircle(0, 0, this.chip_radius);
		}
		// optional label (also draggable)
		this.label = null;

		// assemble
		this.draggable.addChild(this.chip);
		this.gfx.addChild(this.draggable);
    if ((type=="button") || (type=="light")|| (type=="dot") || (type=="and") || (type=="or") || (type=="and3") || (type=="or3") || (type=="and4") || (type=="or4") || (type=="not") || (type=="xor") || (type=="nand") || (type=="nor") || (type=="xnor") || (type=="memory")) {
		this.gfx.addChild(this.chip2);
		}
	if ((type=="ticker")||(type=="delay")||(type=="display"))	{
		this.gfx.addChild(this.chip2);
	    this.gfx.setChildIndex( this.chip2, 0);
	}		

		// create label if provided
		if (label) {
			this.label = new createjs.Text(label, 'bold 18px Arial', '#FFF');
			this.label.textAlign = 'center';
			var label_rect = this.label.getBounds();
			this.label.cache(label_rect.x, label_rect.y, label_rect.width, label_rect.height);
			this.label.x = 0;
			this.label.y = -8;
			this.draggable.addChild(this.label);
		}

		// whether circuit is broadcasting power
		this.has_power = false;

		// optional callback fired when circuit's power changes
		// -> passed the current power state
		this.powerChanged;

		// connectors
		this.inputs = [];
		this.outputs = [];
		// simple array of booleans corresponding to power states of inputs (initially all false)
		// updated by inputChange()
		this.simple_inputs = [];

		// how many ticks required for signal to propagate through chip
		this.delay = 0;

		// arbitrary data store (saved)
		this.data = {};

		// handler to determine power state of circuit
		// -> passed this.simple_inputs
		// <- should return a boolean representing power state
		this.determinePowerState;

		// add connectors
		var angle_space;
		var angle_start;
		// input
		if (type=="light") {
		  var connector = new Connector('input', this);
			this.inputs.push(connector);
			connector.index = 0;
			connector.gfx.x = -2;
			connector.gfx.y = 50;
			this.gfx.addChild(connector.gfx);
			this.simple_inputs.push(false);
		} else {
			angle_space = Math.PI / 5;
			angle_start = -angle_space * (inputs - 1) / 2 - Math.PI / 2;
			if (this.type=="display" || this.type=="and3" || this.type=="or3" || this.type=="and4" || this.type=="or4") {
				for (var i = 0; i < inputs; i++) {
					var current_angle = angle_space * i + angle_start;
					var connector = new Connector('input', this);
					this.inputs.push(connector);
					connector.index = i;
					connector.gfx.x = -this.chip_radius;
					connector.gfx.y = -Math.cos(current_angle) * this.chip_radius/2;
					this.gfx.addChild(connector.gfx);

					// build simple_inputs array as well
					this.simple_inputs.push(false);
				}

			} else {
				for (var i = 0; i < inputs; i++) {
					var current_angle = angle_space * i + angle_start;
					var connector = new Connector('input', this);
					this.inputs.push(connector);
					connector.index = i;
					connector.gfx.x = Math.sin(current_angle) * this.chip_radius;
					connector.gfx.y = -Math.cos(current_angle) * this.chip_radius;
					this.gfx.addChild(connector.gfx);

					// build simple_inputs array as well
					this.simple_inputs.push(false);			
				}
			}
		}
		
		// output
		angle_space = Math.PI / 5;
		angle_start = -angle_space * (outputs - 1) / 2 + Math.PI / 2;
		for (var i = 0; i < outputs; i++) {
			var current_angle = angle_space * i + angle_start;
			var connector = new Connector('output', this);
			this.outputs.push(connector);
			connector.index = i;
			connector.gfx.x = Math.sin(current_angle) * this.chip_radius;
			connector.gfx.y = -Math.cos(current_angle) * this.chip_radius;
			this.gfx.addChild(connector.gfx);
		}
		



		// wire up events
		this.draggable.on('mousedown', mouseDownHandler, this);
		this.draggable.on('pressmove', pressMoveHandler, this);
		this.draggable.on('pressup', pressUpHandler, this);
   
		// cache circuit
		var cache_radius = this.chip_radius + connector_radius + 1;
		this.gfx.cache(-cache_radius, -cache_radius, cache_radius * 2, cache_radius * 2);
	};


	// static methods
	// -----------------------
	Circuit.findById = function findById(id) {
		for (var i = this.active.length - 1; i >= 0; i--) {
			var c = this.active[i];
			if (c.id === id)
				return c;
		}

		return null;
	};

	Circuit.setNextId = function setNextId(id) {
		next_circuit_id = id;
	};


	// instance methods
	// -----------------------

	// updates position of circuit and redraws connected wires
	Circuit.prototype.setPosition = function setPosition(x, y) {
		var app = window.app;
		app.needs_update = true;
		// set position
		this.gfx.x = x;
		this.gfx.y = y;

		// update global coordinates of all connectors and redraw wires
		var temp_pt = new createjs.Point();
		for (var i = 0, len = this.inputs.length; i < len; i++) {
			var connector = this.inputs[i];
			this.gfx.localToLocal(connector.gfx.x, connector.gfx.y, app.wires, temp_pt);
			connector.globalX = temp_pt.x;
			connector.globalY = temp_pt.y;
			for (var n = connector.wires.length - 1; n >= 0; n--) {
				connector.wires[n].draw();
			}
		}
		for (var i = 0, len = this.outputs.length; i < len; i++) {
			var connector = this.outputs[i];
			this.gfx.localToLocal(connector.gfx.x, connector.gfx.y, app.wires, temp_pt);
			connector.globalX = temp_pt.x;
			connector.globalY = temp_pt.y;
			for (var n = connector.wires.length - 1; n >= 0; n--) {
				connector.wires[n].draw();
			}
		}
	};

	// input power state change
	Circuit.prototype.inputChange = function inputChange() {
		// update simple inputs array
		for (var i = this.inputs.length - 1; i >= 0; i--) {
			var c = this.inputs[i];
			this.simple_inputs[i] = c.wires.length && c.wires[0].has_power;
		}

		// determine new power state
		var new_power_state = this.determinePowerState(this.simple_inputs);

		// broadcast power state if it changed
		if (this.has_power !== new_power_state) {
			this.has_power = new_power_state;
			this.broadcastPower();
		}
	};

	// broadcast current power state
	Circuit.prototype.broadcastPower = function broadcastPower() {
		app.needs_update = true;
		// callback
		if (this.powerChanged) this.powerChanged(this.has_power);
		
		// send signal through wires
		var delay = app.propagation_delay;
		//for (var i = this.outputs.length - 1; i >= 0; i--) {
		for (var i = 0; i<=this.outputs.length - 1; i++) {
		
    		var c = this.outputs[i];
			for (var n = c.wires.length - 1; n >= 0; n--) {
				var w = c.wires[n];
                if (i==1) {
					setTimeout(w.powerChange.bind(w, !this.has_power), this.delay * delay);
				} else {
					setTimeout(w.powerChange.bind(w, this.has_power), this.delay * delay);
				}			
			
			}
		}
	};



	// add circuit to stage (at specified position) and active array
	Circuit.prototype.add = function add(x, y) {
		app.needs_update = true;

		app.circuits.addChild(this.gfx);
		Circuit.active.push(this);
		this.setPosition(x, y);
	};

	// remove circuit from stage and active array, recycling connected wires
	Circuit.prototype.remove = function remove() {
		app.needs_update = true;

		// remove from display list
		app.circuits.removeChild(this.gfx);
		// remove from active circuits array
		for (var i = Circuit.active.length - 1; i >= 0; i--) {
			var c = Circuit.active[i];
			if (c.id === this.id) {
				Circuit.active.splice(i, 1);
				// recycle connected wires
				for (var n = this.inputs.length - 1; n >= 0; n--) {
					this.inputs[n].recycleWires();
				}
				for (var n = this.outputs.length - 1; n >= 0; n--) {
					this.outputs[n].recycleWires();
				}
				break;
			}
		}
	};


	// drag events
	var drag_offset = new createjs.Point();
	var remove_box_size = 50;
	function mouseDownHandler(evt) {
		app.delete_btn.show();
		drag_offset.x = evt.localX;
		drag_offset.y = evt.localY;
		this.did_drag = false;
	}

function pressMoveHandler(evt) {
		this.did_drag = true;
		var rect = app.delete_btn.element.getBoundingClientRect();
		if ((evt.stageX > rect.left-200) && (evt.stageY > rect.top-100)) {
			app.delete_btn.active();
		} else {
			app.delete_btn.inactive();
		}
		this.setPosition(this.gfx.x + evt.localX - drag_offset.x, this.gfx.y + evt.localY - drag_offset.y);
	}

	function pressUpHandler(evt) {
		app.delete_btn.inactive().hide();
		var rect = app.delete_btn.element.getBoundingClientRect();
		if ((evt.stageX > rect.left-200) && (evt.stageY > rect.top-100)) {
			this.remove();
		}
		if (this.type=="button" && !this.did_drag) {this.toggleSwitch();}
	}



	

	// reusable connector graphics instance
	var connector_radius = 7;
	var connector_input_gfx = new createjs.Graphics();
	connector_input_gfx.setStrokeStyle(2);
	connector_input_gfx.beginStroke('#AAA');
	connector_input_gfx.beginFill('#888');
	connector_input_gfx.drawCircle(0, 0, connector_radius);

	var connector_output_gfx = new createjs.Graphics();
	connector_output_gfx.setStrokeStyle(3);
	connector_output_gfx.beginStroke('#F0F');
	connector_output_gfx.beginFill('#888');
	connector_output_gfx.drawCircle(0, 0, connector_radius);

	// connector constructor
	function Connector(type, circuit) {
		this.type = type;
		this.circuit = circuit;
		this.index = 0; // index in input/output array of circuit
		this.wires = [];
		this.gfx = new createjs.Shape(type === 'input' ? connector_input_gfx : connector_output_gfx);
		// coordinates relative to global circuits container
		// updated automatically when circuit is repositioned
		this.globalX = 0;
		this.globalY = 0;

		this.recycleWires = function recycleWires() {
			for (var i = this.wires.length - 1; i >= 0; i--) {
				Wire.recycle(this.wires[i]);
			}
		};

		if (type === 'output') {
			this.gfx.on('mousedown', app.startNewWire, this);
			this.gfx.on('pressmove', app.dragNewWire, this);
			this.gfx.on('pressup', app.endNewWire, this);
		}
		
		// click connector to remove wires
		this.gfx.on('click', this.recycleWires, this);
	}

	// active circuits on stage
	Circuit.active = [];

	return Circuit;
})();


var Wire = (function WireFactory() {
	// track unique circuit ids
	var next_wire_id = 0;

	// constructor
	var Wire = function Wire() {
		this.id = next_wire_id++;

		this.gfx = new createjs.Shape();
		this.gfx.mouseEnabled = false;

		this.has_power = false;
		this.output = null;
		this.input = null;
	};

	Wire.on_color = '#F0F';
	Wire.off_color = '#888';

	Wire.prototype.draw = function draw(straight_wire) {
		app.needs_update = true;

		var fromX = this.output.globalX;
		var fromY = this.output.globalY;
		var toX = this.input.globalX;
		var toY = this.input.globalY;
		var diffX = toX - fromX;
		var diffY = toY - fromY;
		var diffAbsX = Math.abs(diffX);
		var diffAbsY = Math.abs(diffY);

		// decide how far to extend bezier handles
		// ugh magic numbers everywhere
		var extend_x = 0;
		var extend_y = 0;
		// maximum amount to extend wire
		var extend_x_max = 400;

		if (!straight_wire) {
			extend_x = diffX / 1.5;
			if (diffX >= 0) {
				extend_x *= 0.25;
			}
			else {
				extend_x *= -1;
				extend_y = diffY / 6;
				extend_y += (diffAbsX / 8) * (diffAbsY > 80 ? 1 : diffAbsY / 80);
				if (diffAbsX < 80) {
					extend_y *= diffAbsX / 80;
				}
				// var v_thresh = 160;
				// var max_y_offset = 500;
				// if (diffAbsY < v_thresh) {
				// 	extend_y = (1 - diffAbsY / v_thresh) * max_y_offset;
				// 	if (diffY < 0) extend_y *= -1;
				// }
			}
			extend_x += Math.min(50, diffAbsY);
			extend_x += diffAbsY / 6;

			if (extend_x > extend_x_max) {
				// extend_y *= extend_x_max / extend_x;
				extend_x = extend_x_max;
			}
		}

		// render line
		this.gfx.graphics.clear();
		this.gfx.graphics.setStrokeStyle(6);
		this.gfx.graphics.beginStroke(this.has_power ? Wire.on_color : Wire.off_color);
		this.gfx.graphics.moveTo(fromX, fromY);
		if (straight_wire) {
			this.gfx.graphics.lineTo(toX, toY);
		}
		else {
			this.gfx.graphics.bezierCurveTo(
				fromX + extend_x,
				fromY + extend_y,
				toX - extend_x,
				toY - extend_y,
				toX,
				toY
			);
		}
		this.gfx.graphics.endStroke();
	};

	Wire.prototype.powerChange = function powerChange(power) {
		this.has_power = power;
		this.draw();
		this.input && this.input.circuit.inputChange();
	};

	// inactive wires for reuse
	Wire.pool = [];

	Wire.new = function newWire(output_conn, input_conn) {
		var w = this.pool.pop() || new Wire();
		w.output = output_conn;
		w.input = input_conn;
		return w;
	};

	Wire.recycle = function recycleWire(w) {
		app.needs_update = true;

		w.has_power = false;
		if (w.output) {
			// remove wire from output connector's array of wires
			for (var i = w.output.wires.length - 1; i >= 0; i--) {
				if (w.output.wires[i].id === w.id) {
					w.output.wires.splice(i, 1);
					break;
				}
			}
		}
		if (w.input) {
			w.input.wires.splice(0, 1);
			w.input.circuit.inputChange();
		}
		w.output = null;
		w.input = null;
		app.wires.removeChild(w.gfx);
		this.pool.push(w);
	};


	return Wire;
})();






// Handy math/trig reference (implement complex math directly to reduce overhead of extra convenience function calls)
var MyMath = {
	// degree/radian conversion constants
	toDeg: 180/Math.PI,
	toRad: Math.PI/180,
	halfPI: Math.PI/2,

	// Pythagorean Theorem point distance calculation
	pointDist: function(x1, y1, x2, y2) {
		var x_dist = x2-x1;
		var y_dist = y2-y1;
		return Math.sqrt(x_dist*x_dist + y_dist*y_dist);
	},
	// Returns the angle (in radians) between two points
	pointAngle: function(x1, y1, x2, y2) {
		return MyMath.halfPI+Math.atan2(y2-y1, x2-x1);
	},
	// Splits a speed vector into x and y components (angle needs to be in radians)
	split_vector: function(speed, angle) {
		return {x: Math.sin(angle)*speed, y: -Math.cos(angle)*speed};
	},
	// Generates a random integer between and possibly including min and max values
	randomInt: function(min, max) {
		return ((Math.random()*(max-min+1)) | 0) + min;
	},
	// Returns a random element from an array, or simply the set of provided arguments when called
	randomChoice: function(choices) {
		if (arguments.length === 1 && Array.isArray(choices))
			return choices[(Math.random()*choices.length) | 0];
		return arguments[(Math.random()*arguments.length) | 0];
	}
};




function saveProject(pretty_print) {
	var json = {};

	json.canvas = {
		x: (app.circuits.x - app.stage.canvas.width / 2 / app.scale) | 0,
		y: (app.circuits.y - app.stage.canvas.height / 2 / app.scale) | 0
	};

	// variable shorthand:
	// - c = circuit
	// - o = output
	// - i = input
	// - w = wire
	json.circuits = Circuit.active.map(function(c) {
		var c_json = {};

		c_json.t = c.type;
		c_json.id = c.id;
		c_json.x = c.gfx.x | 0;
		c_json.y = c.gfx.y | 0;
		// c_json.inputCount = c.inputs.length;
		// c_json.outputCount = c.outputs.length;
		if (c.delay > 1) c_json.delay = c.delay;
		if (c.type=="lbl") {
			c_json.d = c.label.text;
		} else if (c.type=="memory") {
			c_json.d = c.edgeTriggered;			
		} else if (c.type=="button") {
			c_json.d = c.has_power;			
		} else {
		    if (Object.keys(c.data).length) c_json.d = c.data;
        }
		var has_wires = false;
		if (c.outputs.length) {
			for (var i = c.outputs.length - 1; i >= 0; i--) {
				if (c.outputs[i].wires.length) {
					has_wires = true;
					break;
				}
			}
		}

		if (has_wires) {
			c_json.oc = c.outputs.map(function(o) {  //c_json.output_connections = c.outputs.map(function(o) {
				return {
					z: o.wires.map(function(w) { //z for wires
						var i = w.input;
						return {
							id: i.circuit.id, //input_circuit_id: i.circuit.id,
							ix: i.index  //input_index: i.index
						};
					})
				};
			});
		}

		return c_json;
	});

	return pretty_print ? JSON.stringify(json, null, '\t') : JSON.stringify(json);
}

function loadProject(json) {
	try {
		json = JSON.parse(json);
	}
	catch(e) {
		// failed
		alert('Could not load project, data is corrupted.');
		return false;
	}

	// clear current working area
	for (var i = Circuit.active.length - 1; i >= 0; i--) {
		Circuit.active[i].remove();
	}

	// position canvas
	app.circuits.x = app.wires.x = (json.canvas.x + app.stage.canvas.width / 2 / app.scale);
	app.circuits.y = app.wires.y = (json.canvas.y + app.stage.canvas.height / 2 / app.scale);


	// create circuits...
	var highest_id = 0;

	for (var i = 0, len = json.circuits.length; i < len; i++) {
		var c = json.circuits[i];

		if (c.id > highest_id) highest_id = c.id;
        if ((c.t!="lbl") && (c.t!="memory") && (c.t!="button")) {
		   if (!c.d) c.d = {};
		   c.d.delay = c.delay || 1;
		}
		
		var new_circuit = makeType(c.t, c.x, c.y, c.d);
		new_circuit.id = c.id;
		
	}

	Circuit.setNextId(highest_id + 1);


	// ...and wire them up!
	for (var i = 0, len = json.circuits.length; i < len; i++) {
		var c = json.circuits[i];

		
		if (c.oc) { //if (c.output_connections) {
			var new_circuit = Circuit.findById(c.id);

			for (var n = 0, len2 = c.oc.length; n < len2; n++) {  //for (var n = 0, len2 = c.output_connections.length; n < len2; n++) {
				var o = c.oc[n];  //var o = c.output_connections[n];
				if (!o.z.length) continue; //z=wires

				for (var j = 0, len3 = o.z.length; j < len3; j++) {
					var w = o.z[j];
					var output_connection = new_circuit.outputs[n];
					var input_connection = Circuit.findById(w.id).inputs[w.ix];  //var input_connection = Circuit.findById(w.input_circuit_id).inputs[w.input_index];

					var wire = Wire.new(output_connection, input_connection);
					output_connection.wires.push(wire);
					input_connection.wires.push(wire);
					window.app.wires.addChild(wire.gfx);
					if(n==1) {
						wire.powerChange(!new_circuit.has_power); 
					} else {
						wire.powerChange(new_circuit.has_power); 
					}
				}
			}
		}
	}

	window.app.needs_update = true;
	
	// successful
	return true;
}


// slightly modified version of answer here: http://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
function copyTextToClipboard(text) {
	var textArea = document.createElement("textarea");

	//
	// *** This styling is an extra step which is likely not required. ***
	//
	// Why is it here? To ensure:
	// 1. the element is able to have focus and selection.
	// 2. if element was to flash render it has minimal visual impact.
	// 3. less flakyness with selection and copying which **might** occur if
	//    the textarea element is not visible.
	//
	// The likelihood is the element won't even render, not even a flash,
	// so some of these are just precautions. However in IE the element
	// is visible whilst the popup box asking the user for permission for
	// the web page to copy to the clipboard.
	//

	// Place in top-left corner of screen regardless of scroll position.
	textArea.style.position = 'fixed';
	textArea.style.top = 0;
	textArea.style.left = 0;

	// Ensure it has a small width and height. Setting to 1px / 1em
	// doesn't work as this gives a negative w/h on some browsers.
	textArea.style.width = '2em';
	textArea.style.height = '2em';

	// We don't need padding, reducing the size if it does flash render.
	textArea.style.padding = 0;

	// Clean up any borders.
	textArea.style.border = 'none';
	textArea.style.outline = 'none';
	textArea.style.boxShadow = 'none';

	// Avoid flash of white box if rendered for any reason.
	textArea.style.background = 'transparent';


	textArea.value = text;

	document.body.appendChild(textArea);

	textArea.select();
	
	var copy_successful;
	try {
		var copy_successful = document.execCommand('copy');
	} catch (err) {
		copy_successful = false;
	}

	document.body.removeChild(textArea);
	
	if (!copy_successful) {
		console.log('Could not copy to clipboard, data is displayed below:');
		console.log(text);
		
		// fallback
		var ctrl_key = (navigator.platform.indexOf('Mac') === -1) ? 'Ctrl' : 'Cmd';
		window.prompt('Copy to clipboard: ' + ctrl_key + '+C, Enter. Some browsers may truncate long strings!', text);
	}
	
	return copy_successful;
}

preloader();

window.onload = (event) => {
 const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});
let q = params.q; 
if (q !== null) {
	if (q=="load") {
	loadProject(document.getElementById("json").innerText);		
	} else {	
	loadProject(q);		
	}
}
document.getElementById("addBtn").click();
};
