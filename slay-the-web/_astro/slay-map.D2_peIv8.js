import{n as v,e as N}from"./dungeon.BzStoRqK.js";import{e as D,r as P,s as S,m as E}from"./utils-state.Di1yGzAA.js";import{m as y}from"./index.module.CW_MxsZs.js";import{C}from"./preact.module.D_O1FYKR.js";import"./hooks.module.CJw0Fc1Z.js";class T extends C{constructor(){super(),this.didDrawPaths=!1}componentDidMount(){this.drawPathsDebounced=D(this.drawPaths.bind(this),300,{trailing:!0}),this.setState({universe:42}),this.drawPaths()}componentDidUpdate(e){const t=this.props.dungeon.id!==e?.dungeon.id,s=this.props.scatter!==e?.scatter;(t||!this.didDrawPaths)&&(this.drawPathsDebounced(),this.scatterNodes()),s&&this.didDrawPaths&&(this.scatterNodes(),this.drawPathsDebounced()),this.resizeObserver||(this.resizeObserver=new ResizeObserver(()=>{this.drawPathsDebounced()}),this.resizeObserver.observe(this.base))}componentWillUnmount(){this.resizeObserver&&(this.resizeObserver.disconnect(),this.resizeObserver=null),this.drawPathsDebounced&&this.drawPathsDebounced.cancel()}scatterNodes(){const e=Number(this.props.scatter);if(!e)return;this.props.debug&&console.log("scattering map nodes with a type"),this.base.querySelectorAll("slay-map-node[type]").forEach(s=>{s.style.transform=`translate3d(
				${P(-e,e)}%,
				${P(-e,e)}%,
				0)
			`})}drawPaths(){if(!this.props.dungeon.paths)return;if(!this.base){this.props.debug&&console.warn("drawPaths: this.base missing (called too early)");return}if(!this.base.childNodes[0]){this.props.debug&&console.warn("drawPaths: DOM not ready (no childNodes)");return}this.props.debug&&console.time("drawPaths"),this.props.debug&&console.groupCollapsed(`drawing ${this.props.dungeon.paths.length} paths`);const t=this.base.querySelectorAll("svg.paths");for(const s of t)s.remove();this.props.dungeon.paths.forEach((s,r)=>{this.drawPath(s,r)}),this.didDrawPaths=!0,this.props.debug&&console.groupEnd(),this.props.debug&&console.timeEnd("drawPaths")}drawPath(e,t){const s=this.props.dungeon.graph,r=this.base,n=this.props.debug;if(!r){n&&console.warn("drawPath: containerElement missing");return}const a=([i,h])=>s[i][h],u=([i,h])=>{const c=r.childNodes[i];return c?c.childNodes[h]:(n&&console.warn(`drawPath: childNodes[${i}] missing, DOM not ready`),null)},d=`path${t}`;let o=r.querySelector(`svg#${d}`);o&&o.remove(),o=document.createElementNS("http://www.w3.org/2000/svg","svg"),o.id=d,o.classList.add("paths"),r.appendChild(o),n&&console.groupCollapsed(`drawing path on x${t}`,e),e.forEach((i,h)=>{const c=a(i[0]),m=a(i[1]),l=u(i[0]),b=u(i[1]);if(!l||!b){n&&console.warn("drawPath: DOM nodes not ready, skipping path");return}const g=$(l,r),f=$(b,r);if(!g.top){n&&console.warn("drawPath: element positions not ready");return}const p=document.createElementNS("http://www.w3.org/2000/svg","line");p.setAttribute("x1",String(g.left+g.width/2)),p.setAttribute("y1",String(g.top+g.height/2)),p.setAttribute("x2",String(f.left+f.width/2)),p.setAttribute("y2",String(f.top+f.height/2)),o.appendChild(p),p.setAttribute("length",String(p.getTotalLength())),l.setAttribute("linked",!0),b.setAttribute("linked",!0),n&&console.log(`Move ${h}`,{from:c,to:m})}),n&&console.groupEnd()}nodeSelect({x:e,y:t}){this.props.debug&&console.log("nodeSelect",{x:e,y:t}),this.props.onSelect({x:e,y:t})}render(e){const{dungeon:t,x:s,y:r,freeNavigation:n}=e;if(!t.graph)throw new Error("No graph to render. This should not happen?",t);const a=t.graph[r][s];return Array.isArray(a.edges)||(a.edges=S(a.edges)),y`
			<slay-map class=${this.props.debug?"debug":""} style=${{"--rows":t.graph.length,"--columns":t.graph[1].length}}>
				${t.graph.map((u,d)=>y`
						<slay-map-row current=${d===r}>
							${u.map((o,i)=>{const h=d===r&&i===s,c=a.edges.includes(o.id),m=E(t.graph[r][s].room),l=n?!!o.type:c&&m;return y`<slay-map-node
									key=${`${d}${i}`}
									type=${!!o.type}
									node-type=${o.type}
									current=${h}
									can-visit=${!!l}
									did-visit=${o.didVisit}
									onClick=${()=>this.nodeSelect({x:i,y:d})}
									title=${v(o.type)}
								>
									<span>${N(o.type)}</span>
								</slay-map-node>`})}
						</slay-map-row>
					`)}
			</slay-map>
		`}}function $(w,e){if(!w)throw new Error("Could not find DOM node for graph row node");if(!e)throw new Error("missing container");const t=e.getBoundingClientRect(),s=w.getBoundingClientRect();return{top:s.top-t.top,left:s.left-t.left,width:s.width,height:s.height}}export{T as S};
//# sourceMappingURL=slay-map.D2_peIv8.js.map
