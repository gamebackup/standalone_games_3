import{w as d,v as h,r as v,s as w,p as g}from"./powers.DAVjme3M.js";import{m as l}from"./index.module.CW_MxsZs.js";import{C as f}from"./preact.module.D_O1FYKR.js";import"./hooks.module.CJw0Fc1Z.js";const x=a=>l`<${b} ...${a} type="player" />`,y=a=>{const e=a.model,s=a.gameState,$=e.intents[e.nextIntent];function c([t,r]){const o=e.powers.weak,u=s.player.powers.vulnerable;t==="damage"&&o&&(r=d.use(r)),t==="damage"&&u&&(r=h.use(r));let n="";return t==="damage"&&(n=`Will deal ${r} damage`),t==="block"&&(n=`Will block for ${r}`),t==="weak"&&(n=`Will apply ${r} Weak`),t==="vulnerable"&&(n=`Will apply ${r} Vulnerable`),t==="poison"&&(n=`Will apply ${r} Poison`),(t==="vulnerable"||t==="weak")&&(r=void 0),l`
			<div class="Target-intent ${n&&"tooltipped tooltipped-n"}" aria-label=${n}>
				<img alt=${t} src=${`/images/${t}.png`} /> ${r}
			</div>
		`}return l`
		<${b} ...${a} type="enemy" name=${e.name}>
			${$&&Object.entries($).map(t=>c(t))}
		<//>
	`};class b extends f{componentDidUpdate(e){const s=e.model.currentHealth-this.props.model.currentHealth;s>0&&this.setState({lostHealth:s})}render({model:e,type:s,name:$,children:c},t){const r=e.currentHealth<1,o=r?0:e.currentHealth;return l`
			<div class=${`Target${r?" Target--isDead":""}`} data-type=${s}>
				<header class="Target-header">
					${e.sprite&&l`<img-sprite class="Target-sprite" sprite=${e.sprite} scale="2"></img-sprite>`}
					<h3 class="Target-intents">
						<span class="Target-name">${$}</span>
						${c}
					</h3>
				</header>
				<${k} max=${e.maxHealth} value=${o} block=${e.block} />
				<${m} powers=${e.powers} />
				<div class="Target-combatText Split">
					<${p} key=${e.block} value=${e.block} class="FCT FCT--block" />
					<${p} key=${o} value=${t.lostHealth} />
				</div>
			</div>
		`}}function k({value:a,max:e,block:s}){return l`
		<div class="Healthbar ${s?"Healthbar--hasBlock":""}">
			<p class="Healthbar-label">
				<span>${a}/${e}</span>
			</p>
			<div class="Healthbar-bar" style=${`width: ${a/e*100}%`}></div>
			<div class="Healthbar-bar Healthbar-blockBar" style=${`width: ${s/e*100}%`}>
				${s>0?s:""}
			</div>
		</div>
	`}const m=a=>l`
		<div class="Target-powers">
			<${i} amount=${a.powers.vulnerable} power=${h} />
			<${i} amount=${a.powers.regen} power=${v} />
			<${i} amount=${a.powers.weak} power=${d} />
			<${i} amount=${a.powers.strength} power=${w} />
			<${i} amount=${a.powers.poison} power=${g} />
		</div>
	`,i=({power:a,amount:e})=>e?l`<span class="tooltipped tooltipped-s" aria-label=${a.description}>
		${a.name} ${e}
	</span>`:null;function p(a){return a.value?l`<p class="FCT" ...${a}>${a.value}</p>`:l`<p></p>`}export{y as Monster,x as Player};
//# sourceMappingURL=player.BGsD3DZA.js.map
