import{m as a}from"./index.module.CW_MxsZs.js";import"./preact.module.D_O1FYKR.js";import{d as l}from"./hooks.module.CJw0Fc1Z.js";const c="slaytheweb_custom_decks";function i(){try{return JSON.parse(localStorage.getItem(c))||[]}catch(e){return console.error("Error loading custom decks:",e),[]}}function D(e){if(!e.cards?.length)throw new Error("Cannot save deck without cards");const s={...e,id:e.id,name:e.name.trim(),custom:!0},t=i(),n=t.findIndex(r=>r.id===s.id);return n>=0?t[n]=s:t.push(s),localStorage.setItem(c,JSON.stringify(t)),t}function h(e){const t=i().filter(n=>n.id!==e);return localStorage.setItem(c,JSON.stringify(t)),t}const u={id:"classic",name:"Classic",cards:["Defend","Defend","Defend","Defend","Strike","Strike","Strike","Strike","Strike","Bash"]},d={id:"one-of-each",name:"One of each",cards:["Adrenaline","Bash","Bludgeon","Body Slam","Clash","Cleave","Defend","Flourish","Intimidate","Iron Wave","Mask of the Faceless","Pommel Strike","Ritual Rain","Soul Drain","Strike","Succube","Sucker Punch","Summer of Sam","Terror","Thunderclap","Voodoo Gift"]},m=Object.freeze(Object.defineProperty({__proto__:null,deck1:u,deck2:d},Symbol.toStringTag,{value:"Module"}));function g({onSelectDeck:e}){const[s,t]=l(null),n=[...Object.values(m),...i()];function r(o){t(o),e&&e(o)}return a`
		<ul class="Options">
			${n.map(o=>a`
					<li>
						<button class="Button ${s?.id===o.id?"selected":""}" onClick=${()=>r(o)}>
							${o.name}
							<small>
								${o.cards.length} cards, ${o.custom?"custom":"built-in"}
							</small>
						</button>
					</li>
				`)}
		</ul>
	`}export{g as D,h as d,D as s};
//# sourceMappingURL=deck-selector.9UGf__VA.js.map
