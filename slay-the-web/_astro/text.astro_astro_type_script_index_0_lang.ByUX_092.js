import{c as i}from"./new-game.C17BW8dB.js";import{f as m}from"./utils-state.Di1yGzAA.js";import{m as n}from"./index.module.CW_MxsZs.js";import{R as u}from"./preact.module.D_O1FYKR.js";import"./hooks.module.CJw0Fc1Z.js";import{a as s}from"./cards.C3I976ll.js";import{Monster as p}from"./player.BGsD3DZA.js";import{S as l}from"./slay-map.D2_peIv8.js";class d extends HTMLElement{constructor(){super(),this.game=i(!0),window.stw=this.game}connectedCallback(){this.update()}move(e){this.game.enqueue({type:"move",move:e}),this.update()}submitCard(e){e.preventDefault();const t=new FormData(e.target);this.playCard(t.get("card"),t.get("target"))}playCard(e,t){const o=this.game.state.hand.find(a=>a.id===e);this.game.enqueue({type:"playCard",card:o,target:t}),this.render()}endTurn(){this.game.enqueue({type:"endTurn"}),this.update()}update(){console.log("update",this.game.state),this.game.dequeue(),this.render()}undo(){this.game.undo(),this.update()}render(){const{state:e}=this.game,t=m(e);console.log("render room",t);const o=n`
			<h1>slaytheweb</h1>
			<div>status: ${e.won?"won":"playing"}</div>
			<div>turn ${e.turn}</div>
			<p>${this.game.future.list.length} future actions</p>
			<p>${this.game.past.list.length} past actions</p>
			<menu>
				<button class="Button" onClick=${()=>this.update()}><u>U</u>pdate</button>
				<button class="Button EndTurn" onClick=${()=>this.endTurn()}><u>E</u>nd turn</button>
			</menu>
			<h2>Player</h2>
			<p>block: ${e.player.block}</p>
			<p>hp: ${e.player.currentHealth}/${e.player.maxHealth}</p>
			<p class="EnergyBadge">${e.player.currentEnergy}/${e.player.maxEnergy}</p>

			<h2>Map x${e.dungeon.x}/y${e.dungeon.y} → ${t.type} room</h2>
			<div class="Targets-group">
				${t.monsters?.map(a=>n`<${p} model=${a} gameState=${e} />`)}
			</div>

			<h2>Draw pile</h2>
			<${s} type="drawPile" gameState=${e} />
			<h2>Hand</h2>
			<${s} type="hand" gameState=${e} />

			<menu>
				<form onsubmit=${this.submitCard.bind(this)}>
					<select name="card" required>
						<option value="">Select a card</option>
						${e.hand.map(a=>n`<option value=${a.id}>${a.name}</option>`)}
					</select>
					<select name="target">
						<option value="">Select a target</option>
						<option value="player">Player</option>
						<option value="allEnemies">All enemies</option>
						${t?.monsters?.length&&t.monsters.map((a,r)=>n`<option value=${`enemy${r}`}>enemy${r}</option>`)}
					</select>
					<button class="Button" type="submit">Play</button>
				</form>
			</menu>

			<h2>Discard pile</h2>
			<${s} type="discardPile" gameState=${e} />

			<${l}
				dungeon=${e.dungeon}
				x=${e.dungeon.x}
				y=${e.dungeon.y}
				onSelect=${this.move.bind(this)}
			><//>
		`;u(o,this)}handleCampfireChoice(e,t){e==="rest"&&(t=Math.floor(this.game.state.player.maxHealth*.3),this.game.enqueue({type:"addHealth",target:"player",amount:t})),e==="upgradeCard"&&this.game.enqueue({type:"upgradeCard",card:t}),e==="removeCard"&&this.game.enqueue({type:"removeCard",card:t}),this.game.enqueue({type:"makeCampfireChoice",choice:e,reward:t}),this.update(),this.update()}}customElements.get("slay-the-web-text")||customElements.define("slay-the-web-text",d);
//# sourceMappingURL=text.astro_astro_type_script_index_0_lang.ByUX_092.js.map
