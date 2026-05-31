import{p as l}from"./immer.CY-zHz7m.js";import{c as p,a as m}from"./new-game.C17BW8dB.js";import{d as h,f as d}from"./utils-state.Di1yGzAA.js";import{M as c,a as v}from"./dungeon.BzStoRqK.js";import{m as r}from"./index.module.CW_MxsZs.js";import{C as g}from"./preact.module.D_O1FYKR.js";import"./hooks.module.CJw0Fc1Z.js";class x extends g{componentDidMount(){this.reset()}reset(){const e=p(!0);this.setState({game:e,selectedAction:"",actionParams:{},history:[]}),window.game=window.game||e,console.log("New game created",e)}getParamSchema(e){return{playCard:[{name:"card",type:"card",required:!0},{name:"target",type:"target",required:!1}],drawCards:[{name:"amount",type:"number",required:!1,default:5}],addHealth:[{name:"target",type:"target",required:!0},{name:"amount",type:"number",required:!0}],removeHealth:[{name:"target",type:"target",required:!0},{name:"amount",type:"number",required:!0}],setPower:[{name:"target",type:"target",required:!0},{name:"power",type:"string",required:!0},{name:"amount",type:"number",required:!0}],addCardToHand:[{name:"card",type:"card",required:!0}],addCardToDeck:[{name:"card",type:"card",required:!0}],upgradeCard:[{name:"card",type:"card",required:!0}],discardCard:[{name:"card",type:"card",required:!0}]}[e]||[]}handleActionSelect(e){this.setState({selectedAction:e,actionParams:{}})}handleParamChange(e,o){this.setState(a=>({actionParams:{...a.actionParams,[e]:o}}))}handleCardSelect(e,o){const a=h(o);this.handleParamChange(e,a)}executeAction(){const{game:e,selectedAction:o,actionParams:a}=this.state;if(o)try{e.enqueue({type:o,...a}),e.dequeue();const n={action:o,params:{...a},timestamp:new Date().toLocaleTimeString()};this.setState(t=>({history:[...t.history,n]}))}catch(n){console.error("Error executing action:",n),alert(`Error: ${n.message}`)}}undoAction(){const{game:e,history:o}=this.state;if(o.length!==0)try{e.undo(),this.setState(a=>({history:a.history.slice(0,-1)}))}catch(a){console.error("Error undoing action:",a),alert(`Error undoing: ${a.message}`)}}addMonsterToRoom(){const{game:e}=this.state,o=Number(document.getElementById("new-monster-hp").value||40),a=c({currentHealth:o,maxHealth:o,intents:[{damage:6},{block:5}]});e.state=l(e.state,n=>{const t=d(n);t.monsters||(t.monsters=[]),t.monsters.push(a)}),this.setState({})}createTestRoom(){const{game:e}=this.state,o=v(c({currentHealth:40,maxHealth:40,intents:[{damage:6},{block:5}]}));e.state=l(e.state,a=>{const{x:n,y:t}=a.dungeon;a.dungeon.graph[t][n].room=o}),e.enqueue({type:"endEncounter"}),e.dequeue(),this.setState({})}renderRoomEditor(){const{game:e}=this.state;if(!e?.state)return null;const o=d(e.state);return r`
			<div class="Box">
				<h2>Room Editor</h2>

				<details>
					<summary>Current Room Data</summary>
					<pre>${JSON.stringify(o,null,2)}</pre>
				</details>

				<div class="monster-controls">
					<h3>Add Monster</h3>
					<div class="form-group">
						<label>HP</label>
						<input type="number" value="40" id="new-monster-hp" />
						<button class="Button" onClick=${()=>this.addMonsterToRoom()}>Add Monster</button>
					</div>
				</div>

				<h3>Current Monsters</h3>
				${o.monsters?.map((a,n)=>r`
						<div class="monster-editor">
							<h4>Enemy ${n}</h4>
							<div>HP: ${a.currentHealth}/${a.maxHealth}</div>
							<div class="form-group">
								<label>Set HP:</label>
								<input type="number" id="set-hp-${n}" value="10" />
								<button
									class="Button"
									onClick=${()=>{const t=document.getElementById(`set-hp-${n}`),s=Number(t instanceof HTMLInputElement?t.value:10);e.state=l(e.state,i=>{const u=d(i);u.monsters[n].currentHealth=s}),this.setState({})}}
								>
									Set
								</button>
							</div>
							<div class="form-group">
								<label>Add HP:</label>
								<input type="number" id="add-hp-${n}" value="5" />
								<button
									class="Button"
									onClick=${()=>{const t=document.getElementById(`add-hp-${n}`),s=Number(t instanceof HTMLInputElement?t.value:5);e.enqueue({type:"addHealth",target:`enemy${n}`,amount:s}),e.dequeue(),this.setState({})}}
								>
									Add
								</button>
							</div>
							<div class="form-group">
								<label>Apply Power:</label>
								<select id="power-type-${n}">
									<option value="weak">Weak</option>
									<option value="vulnerable">Vulnerable</option>
									<option value="strength">Strength</option>
								</select>
								<input type="number" id="power-amount-${n}" value="1" />
								<button
									class="Button"
									onClick=${()=>{const t=document.getElementById(`power-type-${n}`),s=document.getElementById(`power-amount-${n}`),i=t instanceof HTMLSelectElement?t.value:"weak",u=Number(s instanceof HTMLInputElement?s.value:1);e.enqueue({type:"setPower",target:`enemy${n}`,power:i,amount:u}),e.dequeue(),this.setState({})}}
								>
									Apply
								</button>
							</div>
							<button
								class="Button danger"
								onClick=${()=>{e.state=l(e.state,t=>{d(t).monsters.splice(n,1)}),this.setState({})}}
							>
								Remove
							</button>
						</div>
					`)}

				<button class="Button" onClick=${()=>this.createTestRoom()}>Create Test Room</button>
			</div>
		`}renderParamsForm(){const{selectedAction:e,actionParams:o,game:a}=this.state;if(!e)return null;const n=this.getParamSchema(e);return r`
			<div class="params-form">
				${n.map(t=>t.type==="card"?r`
							<div class="form-group">
								<label>${t.name} (card)</label>
								<select
									onChange=${s=>this.handleCardSelect(t.name,s.target.value)}
									value=${o[t.name]?.name||""}
								>
									<option value="">Select a card...</option>
									<option value="Strike">Strike</option>
									<option value="Defend">Defend</option>
									<option value="Bash">Bash</option>
									<option value="Body Slam">Body Slam</option>
									<option value="Clash">Clash</option>
									<option value="Cleave">Cleave</option>
									<option value="Flourish">Flourish</option>
									<option value="Succube">Succube</option>
									<option value="Thunderclap">Thunderclap</option>
									<option value="Summer of Sam">Summer of Sam</option>
								</select>

								<p class="help-text">
									Or select from hand:
									${a.state.hand.map((s,i)=>r`
											<button
												class="Button card-btn ${o[t.name]?.id===s.id?"selected":""}"
												onClick=${()=>this.handleParamChange(t.name,s)}
											>
												${s.name} (${i})
											</button>
										`)}
								</p>
							</div>
						`:t.type==="target"?r`
							<div class="form-group">
								<label>${t.name} (target)</label>
								<select
									onChange=${s=>this.handleParamChange(t.name,s.target.value)}
									value=${o[t.name]||""}
								>
									<option value="">Select target...</option>
									<option value="player">Player</option>
									<option value="enemy0">Enemy 0</option>
									<option value="enemy1">Enemy 1</option>
									<option value="enemy2">Enemy 2</option>
									<option value="allEnemies">All Enemies</option>
								</select>
							</div>
						`:r`
							<div class="form-group">
								<label>${t.name} (${t.type})</label>
								<input
									type=${t.type==="number"?"number":"text"}
									value=${o[t.name]!==void 0?o[t.name]:t.default||""}
									onInput=${s=>this.handleParamChange(t.name,t.type==="number"?Number(s.target.value):s.target.value)}
									placeholder=${t.required?"Required":"Optional"}
								/>
							</div>
						`)}

				<button class="Button execute-btn" onClick=${()=>this.executeAction()} disabled=${!e}>
					Execute
				</button>
			</div>
		`}renderGameState(){const{game:e}=this.state;if(!e)return null;const o=[];try{const a=e.state.dungeon?.graph[e.state.dungeon.y][e.state.dungeon.x]?.room;a?.monsters&&o.push(...a.monsters)}catch{}return r`
			<div class="Box">
				<h2>Game State</h2>

				<details open>
					<summary>
						<h3>Player</h3>
					</summary>
					<section>
						<div>Health: ${e.state.player.currentHealth}/${e.state.player.maxHealth}</div>
						<div>Energy: ${e.state.player.currentEnergy}/${e.state.player.maxEnergy}</div>
						<div>Block: ${e.state.player.block}</div>
						${Object.keys(e.state.player.powers||{}).length>0&&r` <div>Powers: ${JSON.stringify(e.state.player.powers)}</div> `}
					</section>
				</details>

				<details open>
					<summary>
						<h3>Cards</h3>
					</summary>
					<section>
						<div>
							Hand (${e.state.hand.length}):
							${e.state.hand.map(a=>r` <span class="card-pill" title=${JSON.stringify(a)}>${a.name}</span> `)}
						</div>
						<div>Draw pile: ${e.state.drawPile.length} cards</div>
						<div>Discard pile: ${e.state.discardPile.length} cards</div>
					</section>
				</details>

				<details open>
					<summary>
						<h3>Monsters</h3>
					</summary>
					<section>
						${o.length>0?o.map((a,n)=>r`
											<div class="monster">
												<strong>Enemy ${n}</strong>: HP ${a.currentHealth}/${a.maxHealth}
												${a.block>0?r`<span>Block: ${a.block}</span>`:""}
												${Object.keys(a.powers||{}).length>0?r` <div>Powers: ${JSON.stringify(a.powers)}</div> `:""}
											</div>
										`):r`<div>No monsters in current room</div>`}
					</div>
				</details>

				<details>
					<summary>
						<h3>Action Queue</h3>
					</summary>
					<section>
						<div>Future actions: ${e.future.list.length}</div>
						<div>Past actions: ${e.past.list.length}</div>
					</section>
				</details>

				<details>
					<summary>
						<h3>Full Game State</h3>
					</summary>
					<section>
						<pre class="full-state-pre">${JSON.stringify(e.state,null,2)}</pre>
					</section>
				</details>
			</div>
		`}renderHistory(){const{history:e}=this.state;return r`
			<div class="Box history-panel">
				<h3>Action History</h3>
				${e.length===0?r`<div class="empty-history">No actions executed yet</div>`:r`
							<div class="history-list">
								${e.map((o,a)=>r`
										<div class="history-item">
											<div class="action-name">${o.action}</div>
											<div class="action-params">${JSON.stringify(o.params)}</div>
											<div class="action-time">${o.timestamp}</div>
										</div>
									`)}
							</div>
							<button class="Button undo-btn" onClick=${()=>this.undoAction()}>Undo Last Action</button>
						`}
			</div>
		`}render(e,o){const{game:a}=o;if(!a)return r`<div>Loading game...</div>`;const n=Object.keys(m).filter(t=>typeof m[t]=="function").sort();return r`
			<div class="debug-console">
				<style>
					:root {
						--bg: var(--purple);
					}
					.debug-console {
						display: grid;
						grid-template-columns: 1fr 1fr;
						gap: 1rem;
						max-width: 1200px;
						margin: 0 auto;
						padding: 1rem;
					}
					.form-group {
						margin-bottom: 0.5rem;
					}
					label {
						display: block;
					}
					h2,
					h3,
					p {
						font-size: 1rem;
						margin: 0;
					}
					h2 {
						margin-bottom: 0rem;
					}
						details {
						margin-top: 0.5rem;}
					summary h3 {
						display: inline-block;
						margin: 0;
					}
					.card-pill {
						border-bottom: 1px dotted;
					}
					.card-btn.selected {
						font-weight: bold;
					}
					.full-state-pre {
						max-height: 300px;
						overflow: auto;
					}
					.monster-editor {
						border: 1px solid #ccc;
						padding: 0.5rem;
						margin-bottom: 0.5rem;
					}
					.Box {
						margin-bottom: 1rem;
					}
					.Button {
						margin-right: 0.25rem;
					}
				</style>

				<div class="left-panel">
					<div class="Box">
						<h2>Debug system</h2>
						<select onChange=${t=>this.handleActionSelect(t.target.value)} value=${o.selectedAction}>
							<option value="">-- Select an action --</option>
							${n.map(t=>r` <option value=${t}>${t}</option> `)}
						</select>

						${this.renderParamsForm()}
					</div>

					${this.renderRoomEditor()}

					${this.renderHistory()}

					<menu>
						<button class="Button" onClick=${()=>this.reset()}>New Game</button>
					</<menu>
				</div>

				<div class="right-panel">${this.renderGameState()}</div>
			</div>
		`}}export{x as default};
//# sourceMappingURL=debug-ui.DBUoKG9o.js.map
