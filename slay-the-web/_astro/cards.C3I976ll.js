import{c as i}from"./conditions.duw01iPE.js";import{m as s}from"./index.module.CW_MxsZs.js";import{C as c}from"./preact.module.D_O1FYKR.js";import"./hooks.module.CJw0Fc1Z.js";class $ extends c{render(a){const e=a.gameState[a.type];return s` <div class="Cards">${e.map(r=>n({card:r,gameState:a.gameState}))}</div> `}}function n(d){const{card:a,gameState:e}=d,r=!i(e,a),t=a.image?`/images/cards/${a.image}`:"/images/cards/fallback.jpg";return s`
		<stw-card
			class="Card"
			data-card-type=${a.type}
			data-card-target=${a.target}
			key=${a.id}
			data-id=${a.id}
			upgraded=${a.upgraded?"":null}
			disabled=${r}
		>
			<div class="Card-inner">
				<p class="Card-energy EnergyBadge">
					<span>${a.energy}</span>
				</p>
				<figure class="Card-media">
					<img src=${t} alt=${a.name} />
				</figure>
				<p class="Card-type">${a.type}</p>
				<h3 class="Card-name">${a.name}</h3>
				<p class="Card-description">${a.description}</p>
			</div>
		</stw-card>
	`}export{n as C,$ as a};
//# sourceMappingURL=cards.C3I976ll.js.map
