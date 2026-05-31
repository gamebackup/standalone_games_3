import{a as f,g as y}from"./dungeon-stats.D1Y-aD2w.js";import{d as S}from"./utils-state.Di1yGzAA.js";import{m as o}from"./index.module.CW_MxsZs.js";import"./preact.module.D_O1FYKR.js";import{d as l,y as c}from"./hooks.module.CJw0Fc1Z.js";import{C as w}from"./cards.C3I976ll.js";import{S as x}from"./slay-map.D2_peIv8.js";function I(){const[t,d]=l(),[n,u]=l();if(c(()=>{const a=new URLSearchParams(window.location.search);u(a.get("id"))},[]),c(()=>{if(!n){d(null);return}f(n).then(a=>{d(a),console.log(a)})},[n]),!n)return o`<p>Add ?id=1234 (and use a real ID) to the URL to see a specific run.</p>`;if(!t)return o`<h1>Loading statistics for run no. ${n}...</h1>`;const e=t.gameState,p=new Intl.DateTimeFormat("en",{dateStyle:"long",hour12:!1}).format(new Date(e.createdAt)),s=e.endedAt-e.createdAt,i=Math.floor(s/(1e3*60*60)),m=Math.floor(s%(1e3*60*60)/(1e3*60)),h=Math.floor(s/1e3%60),$=`${i>0?`${i}h `:""}${m}m ${h}s`,r=e.dungeon.graph?y(e.dungeon):null;return console.log("extraStats",r),o`
		<header class="Header">
			<h1>Slay the Web run no. ${t.id}</h1>
		</header>

		<div class="Box Box--text">
			<p>
				<em>${t.player}</em> made it to floor ${e.dungeon.y} and
				<strong> ${e.won?"won":"lost"}</strong>.
			</p>
			<p>The run took ${$} on ${p}.</p>
			<p>
				Player made ${t.gamePast.length} moves over ${t.gameState.turn} turns,<br />
				and ended with ${e.player.currentHealth}/${e.player.maxHealth} health.
			</p>

			${r&&o`<p>You encountered ${r.encountered} monsters. And killed ${r.killed} of them.</p>`}
		</div>

		<div class="Box">
			<p>
				Inspect the raw JSON data for the run
				<a href=${`https://api.slaytheweb.cards/api/runs/${t.id}`}
					>api.slaytheweb.cards/api/runs/${t.id}</a
				>.
			</p>
		</div>

		<div class="Box">
			<p>Final deck had ${e.deck.length} cards:</p>
			<div class="Cards Cards--grid Cards--mini">
				${e.deck.map(a=>{try{return w({card:S(a)})}catch(g){return console.warn(`Skipping card "${a}": ${g.message}`),null}}).filter(Boolean)}
			</div>
		</div>

		<${x}
			dungeon=${t.gameState.dungeon}
			x=${e.dungeon.x}
			y=${e.dungeon.y}
			scatter=${20}
			debug=${!0}
		><//>
	`}export{I as default};
//# sourceMappingURL=run-stats.DwDJN92F.js.map
