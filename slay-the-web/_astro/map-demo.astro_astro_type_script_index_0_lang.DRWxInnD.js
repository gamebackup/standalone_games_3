import{d as c,D as g,g as y}from"./dungeon.BzStoRqK.js";import{m as p}from"./index.module.CW_MxsZs.js";import{R as f}from"./preact.module.D_O1FYKR.js";import{d as r}from"./hooks.module.CJw0Fc1Z.js";import{S as $}from"./slay-map.D2_peIv8.js";const x=t=>{const[o,u]=r(c),[m]=r(c),n=(e,a)=>{const s={...o};s[a]=e.target.type==="number"?Number(e.target.value):e.target.value,u(s),t.onUpdate(s)},i=(e,a)=>{console.log("requested style update",a);const s=document.querySelector("slay-map"),{value:d}=e.target;a==="min-height"?s.style[a]=`${d}vh`:s.style[a]=d};return p`
		<form class="Form FForm--vertical">
			<fieldset>
				<legend>Dungeon size</legend>
				<label>
					Floors
					<input type="number" value=${o.height} min="0" onInput=${e=>n(e,"height")} />
				</label>
				<label>
					Columns
					<input type="number" value=${o.width} onInput=${e=>n(e,"width")} />
				</label>
			</fieldset>
			<fieldset>
				<legend>Map size</legend>
				<label>Debug styles <input type="checkbox" checked=${t.debug} onInput=${t.onDebugToggle} /></label>
				<label>
					Height in vh
					<input
						type="number"
						value="70"
						min="0"
						step="5"
						onInput=${e=>i(e,"min-height")}
					/>
				</label>
				<label hidden>
					Width
					<input type="number" value=${m.width} onInput=${e=>i(e,"width")} />
				</label>
			</fieldset>
			<fieldset>
				<legend>Amout of rooms per floor</legend>
				<label>
					Min
					<input type="number" value=${o.minRooms} onInput=${e=>n(e,"minRooms")} />
				</label>
				<label>
					Max
					<input type="number" value=${o.maxRooms} onInput=${e=>n(e,"maxRooms")} />
				</label>
			</fieldset>
			<fieldset>
				<legend>Custom rooms & paths</legend>
				<label>
					Room Types
					<input type="text" value=${o.roomTypes} onInput=${e=>n(e,"roomTypes")} />
				</label>
				<p>
					M for monster, E for elite, C for camp. Repeat character to increase chance of appearing. There is
					additional logic in the code as well, which for example increases chance of elites on higher floors.
				</p>
				<label>
					Paths to draw
					<input
						type="text"
						value=${o.customPaths}
						onInput=${e=>n(e,"customPaths")}
						placeholder="0235"
					/>
				</label>
				<p>
					Defaults to draw one path per column. To draw paths on specific columns enter a string of indexes
					like
					<code>034</code>. This would attempt to draw three paths at those indexes.
				</p>
			</fieldset>
		</form>
	`},v=()=>{const[t,o]=r(g()),[u,m]=r(0),[n,i]=r({x:0,y:0}),[e,a]=r(!0);window.slaymapdemo=t;const s=l=>{console.log("Selected move:",l);const h=t.graph[l.y][l.x],b=t.graph[n.y][n.x];n.y===0||b.edges.includes(h.id)?(i(l),console.log("Moved to:",l,"Paths still exist:",t.paths.length)):console.log("Cannot move to unconnected node")};return p`
		<div class="Box" style="max-width: 25rem">
			<details open>
				<summary><strong>Dungeon Configuration</strong></summary>
				<${x} onUpdate=${l=>{o(g(l)),i({x:0,y:0})}} debug=${e} onDebugToggle=${()=>a(!e)} />
				<fieldset class="Form">
					<label>
						Scatter: ${u}%
						<input
							type="range"
							min="0"
							max="20"
							value=${u}
							onInput=${l=>m(Number(l.target.value))}
						/>
					</label>
				</fieldset>
			</details>
			<pre>${y(t.graph)}</pre>
		</div>

		${t&&p`
			<${$}
				dungeon=${t}
				x=${n.x}
				y=${n.y}
				onSelect=${s}
				scatter=${u}
				debug=${e}
			><//>
		`}
	`};class w extends HTMLElement{connectedCallback(){f(p`<${v} />`,this)}}customElements.get("slay-map-demo")||customElements.define("slay-map-demo",w);
//# sourceMappingURL=map-demo.astro_astro_type_script_index_0_lang.DRWxInnD.js.map
