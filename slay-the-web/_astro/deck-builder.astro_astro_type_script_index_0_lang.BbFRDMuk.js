import{a as k,d as $,u as m}from"./utils-state.Di1yGzAA.js";import{C as l}from"./cards.C3I976ll.js";import{s as p,d as C,D as b}from"./deck-selector.9UGf__VA.js";import{m as n}from"./index.module.CW_MxsZs.js";import{R as D}from"./preact.module.D_O1FYKR.js";import{d as u,y as h}from"./hooks.module.CJw0Fc1Z.js";function y({deckName:e,onNameChange:t,onSave:a,onDelete:s}){return n`
		<form onSubmit=${a}>
			<label>
				Name <input type="text" value=${e} onInput=${d=>t(d.target.value)} />
			</label>
			<button type="submit" class="Button">Save deck</button>
			<button type="button" onClick=${s} class="Button" danger>Delete deck</button>
		</form>
	`}function B({selectedCards:e,onRemove:t}){return e.length?n`
		<div class="Cards Cards--grid Cards--mini">
			${e.map((a,s)=>n`
					<div class="Cards-item">
						<${l} key=${a} card=${$(a)} />
						<button class="Button" danger onClick=${()=>t(s)}>✕</button>
					</div>
				`)}
		</div>
	`:n`<p center>Empty deck, add some cards!</p>`}function g({onAdd:e}){return n`
		<h3>Available Cards</h3>
		<div class="Cards Cards--grid Cards--mini">
			${k.map(t=>n`
					<div class="Cards-item">
						<${l} key=${t.name} card=${t} />
						<button class="Button" onClick=${()=>e(t.name)}>+</button>
					</div>
				`)}
		</div>
	`}function w({deck:e,onSaveDeck:t,onDeleteDeck:a}){const[s,d]=u(e?.name),[o,c]=u(e?.cards||[]);h(()=>{d(e?.name),c(e?.cards||[])},[e]);function f(r){if(r.preventDefault(),!o.length)return;const i={...e,name:s.trim(),cards:o,custom:!0};p(i),t&&t(i)}function v(){e?.id&&confirm(`Are you sure you want to delete the deck "${e.name}"?`)&&(C(e.id),a&&a(e.id))}return n`
		<div class="Split">
			<div class="Box">
				<${g} onAdd=${r=>c([...o,r])} />
			</div>
			<div class="Box">
				<${y}
					deckName=${s}
					onNameChange=${d}
					onSave=${f}
					onDelete=${v}
				/>
				<br />
				<${B}
					selectedCards=${o}
					onRemove=${r=>{const i=[...o];i.splice(r,1),c(i)}}
				/>
			</div>
		</div>
	`}function S(){const[e,t]=u(null);function a(){t({id:m(),name:`My deck ${m()}`,custom:!0})}return n`
		<div class="Box">
			<h2>Deck Builder</h2>
			<p>
				Slay the Web comes with a standard, classic deck. Now you can also create your own decks from the
				existing cards. Custom decks are, for now, only stored in your own browser. If you think others might
				find your deck fun, <a href="/manual">please contribute</a>!
			</p>
			<ul class="Options">
				<li><button class="Button" onClick=${a}>New custom deck</button></li>
			</ul>
		</div>

		<div class="Box">
			<${b} onSelectDeck=${t} />
		</div>

		${e?.custom?n`<${w}
					deck=${e}
					onSaveDeck=${t}
					onDeleteDeck=${s=>{e?.id===s&&t(null)}}
				/>`:n`<${x} deck=${e} />`}
	`}function x({deck:e}){return e?n`
		<div class="Box">
			<h3>${e.name} <small>(Built-in deck)</small></h3>
			<div class="Cards Cards--grid Cards--mini">
				${e.cards.map(t=>n` <${l} key=${t} card=${$(t)} /> `)}
			</div>
		</div>
	`:n``}D(n`<${S} />`,document.getElementById("deck-editor-app"));
//# sourceMappingURL=deck-builder.astro_astro_type_script_index_0_lang.BbFRDMuk.js.map
