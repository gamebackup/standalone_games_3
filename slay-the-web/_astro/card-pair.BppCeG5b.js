import{d as s}from"./utils-state.Di1yGzAA.js";import{m as p}from"./index.module.CW_MxsZs.js";import{C as l}from"./preact.module.D_O1FYKR.js";import"./hooks.module.CJw0Fc1Z.js";import{C as a}from"./cards.C3I976ll.js";class u extends l{constructor(r){super(r),this.state={flipped:!1}}handleClick(){this.setState({flipped:!this.state.flipped})}render(r,d){const{card:t,gameState:e}=r,i=s(t.name,!0);return p`
			<div
				class="CardBox"
				flipped=${d.flipped?"":null}
				onClick=${()=>this.handleClick()}
			>
				${a({card:t,gameState:e})}
				${a({card:i,gameState:e})}
			</div>
		`}}export{u as default};
//# sourceMappingURL=card-pair.BppCeG5b.js.map
