import{p as l}from"./immer.CY-zHz7m.js";import{s as c}from"./utils-state.Di1yGzAA.js";import{m as u}from"./index.module.CW_MxsZs.js";import"./preact.module.D_O1FYKR.js";import"./hooks.module.CJw0Fc1Z.js";const o="https://api.slaytheweb.cards/api/runs";function h(t){return l(t,e=>{e.endedAt||(e.endedAt=Date.now()),delete e.dungeon?.paths,delete e.drawPile,delete e.hand,delete e.discardPile,delete e.exhaustPile,e.deck=e.deck.map(n=>n.name)})}async function w(t,e){const n={player:e||"Unknown entity",gameState:h(t.state),gamePast:t.past.list.map(a=>({action:a.action,turn:a.state.turn,player:a.state.player}))};return fetch(o,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(n)})}function i(t){return t.gameState?.dungeon?.graph&&t.gameState.dungeon.graph.forEach(e=>{e.forEach(n=>{n.edges&&(n.edges=c(n.edges))})}),t}async function H(){const e=await(await fetch(o)).json();return e.runs=e.runs.map(i),e}async function k(t){const n=await(await fetch(`${o}/${t}`)).json();return i(n)}function E({dungeon:t}){const e=p(t);return u`
		<h2>Dungeon stats</h2>
		<ul>
			<li>Enemies encountered: ${e.encountered}</li>
			<li>Enemies killed: ${e.killed}</li>
			<li>Total enemies health: ${e.maxHealth}</li>
			<li>Final health count: ${e.finalHealth}</li>
		</ul>
	`}const p=t=>{const e={killed:0,encountered:0,maxHealth:0,finalHealth:0};if(!t.graph)throw new Error("Missing dungeon graph");return t.pathTaken.forEach(([n,a])=>{const s=t.graph[a][n];s.room?.monsters&&(e.encountered+=s.room.monsters.length,s.room.monsters.forEach(r=>{r.currentHealth<=0&&(e.killed+=1),e.finalHealth+=r.currentHealth,e.maxHealth+=r.maxHealth}))}),e};export{E as D,k as a,H as b,p as g,w as p};
//# sourceMappingURL=dungeon-stats.D1Y-aD2w.js.map
