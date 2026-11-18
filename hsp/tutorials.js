/* =================================================================
   HERBAL SPACE PROGRAM – Interaktive Tutorials
   Every tutorial drops the player into a prepared scenario.
   scenario.stack  = pre-built rocket (top → bottom)
   scenario.orbit  = starts straight in orbit {body, alt}
   (without orbit: launch from the pad)
   steps: {text, check} – check(o, F) ticks the step off automatically
   (o = Flight.orbit(), F = Flight). Ohne check: "Weiter"-Button.
   ================================================================= */
const TUTORIALS = [
  {id:"first", icon:"🚀", title:"Your first launch", sub:"Pre-built rocket – ignite, climb, land.",
   scenario:{stack:["chute","pod","fin","tankS","engS"]},
   steps:[
    {text:`Your first rocket is on the pad, ready to go: parachute, pod, tank, engine.<br><br>
      Ignite the first stage with <b>[Space]</b>!`,
     check:(o,F)=>!F.landed && F.flew},
    {text:`Liftoff! 🔥 The rocket climbs straight up. On the left you see the altitude, on the
      <b>navball</b> below the speed (with reference body), to its left the throttle and to the
      right the g-force; bottom left are tank and power.<br><br>Climb to <b>5 km</b>!`,
     check:o=>o.alt>5000},
    {text:`5 km! 🏆 The tank is about to run dry and the rocket will fall back.<br><br>
      Wait until it is <b>falling</b> again (speed pointing downwards), then open
      the parachute with <b>[P]</b>.`,
     check:(o,F)=>F.chuteOpen},
    {text:`Chute out! 🪂 Now you float down at about 7 m/s.
      Below 8 m/s impact the landing is safe.<br><br>Wait for touchdown …`,
     check:(o,F)=>F.landed && F.flew}
   ],
   done:`Safely down! 🛬 You have mastered launch, ascent and parachute.
     Next step: the <b>Into orbit</b> tutorial!`},

  {id:"orbit", icon:"🛰️", title:"Into orbit", sub:"A two-stage rocket is ready – fly the gravity turn.",
   scenario:{stack:["chute","pod","shield","rcs","tankM","engVac","decoupler","inter","fin","tankL","tankL","engMain"]},
   steps:[
    {text:`This two-stage rocket has enough Δv for an orbit (~3400 m/s) – and a
      <b>heat shield</b> under the pod for the way back!<br><br>
      An orbit means: <b>flying sideways so fast</b> that you keep missing the
      ground as you fall!<br><br>Ignite with <b>[Space]</b> and climb vertically.`,
     check:(o,F)=>!F.landed && F.flew},
    {text:`From here on the <b>gravity turn</b>: tilt the rocket east with <b>[D]</b>, slowly
      (navball: heading 90°).<br><br>Rule of thumb: 10 km → 20° tilt, 30 km → 60°.<br>
      When stage 1 runs dry: <b>[Space]</b> separates it and lights stage 2.<br><br>
      For now, climb past <b>20 km</b>.`,
     check:o=>o.alt>20000},
    {text:`Open the map with <b>[M]</b>: the blue <b>Ap</b> marker is the highest point
      of your trajectory.<br><br>Keep burning east until <b>Ap is above 75 km</b> –
      then shut the engine down with <b>[X]</b>.`,
     check:o=>o.ap>75000},
    {text:`Perfect! Now the trick that makes it all work:<br><br>
      ⏩ Warp time with <b>[.]</b> until you are just short of Ap (altitude ≈ apoapsis).<br>
      Then <b>[T]</b> for SAS PROGRADE and full throttle <b>[⇧X]</b> –
      burn until the <b>periapsis rises above 70 km</b>!`,
     check:o=>o.pe>70000},
   ],
   done:`YOU ARE IN ORBIT! 🎉 You now circle forever without burning any fuel.
     Getting home: SAS retrograde, burn until Pe < 35 km – your <b>heat shield</b> survives
     the fire of reentry (without it: 💥!), then parachute [P].`},

  {id:"node", icon:"◆", title:"Maneuver nodes: journey to Basil", sub:"You start in orbit – plan the transfer.",
   scenario:{stack:["chute","pod","rcs","fin","tankM","tankM","engVac"], orbit:{body:"HERBIN", alt:80000}},
   steps:[
    {text:`You are already in an 80 km orbit – with full tanks (~2600 m/s Δv).
      Target: the moon <b>Basil</b>!<br><br>Open the map first with <b>[M]</b>.`,
     check:(o,F)=>F.map},
    {text:`Create a maneuver node on your orbit with <b>[K]</b>.`,
     check:(o,F)=>!!F.node},
    {text:`In the panel on the right: click +10 next to <b>Prograde</b> until roughly
      <b>+860 m/s</b> are dialled in. Watch the <b>green planned trajectory</b> grow – it has to
      reach all the way out to Basil's orbit!`,
     check:(o,F)=>F.node && F.node.pro>=800},
    {text:`The green path crosses Basil's orbit – but does it actually hit Basil? Shift the
      <b>time</b> (±60s buttons) until the green path passes close by Basil.<br><br>
      Then: <b>[T]</b> a few times until "SAS: maneuver node" – and ignite at
      <b>T minus half the burn time</b> (shown in the panel) with <b>[⇧X]</b>.
      Burn for roughly the stated duration, until your real trajectory (orange) matches the green one
      (Ap > 11.000 km).`,
     check:o=>o.ap<0 || o.ap>1.1e7},
    {text:`Transfer trajectory locked in! 🚀 Engine off with <b>[X]</b>.<br><br>
      Now some patience, fast-forwarded: time warp <b>[.]</b> up to 1000× and watch
      yourself coast to Basil (a few seconds in real time).`,
     check:o=>o.body && o.body.name==="Basil"},
    {text:`Welcome to Basil's sphere of influence! 🌗 But careful: without braking this is
      just a <b>flyby</b> – Basil will let you go again!<br><br>
      To get <b>CAPTURED</b> you brake at the lowest point (the Oberth trick – every m/s
      counts most down there): warp until just before <b>periapsis</b> (the orange
      Pe marker on the map), then <b>[T]</b> for SAS RETROGRADE and full throttle <b>[⇧X]</b>
      until the <b>apoapsis drops below 2000 km</b> – your path becomes an ellipse around Basil!`,
     check:o=>o.body && o.body.name==="Basil" && o.ap>0 && o.ap<2e6},
   ],
   done:`CAPTURED – you are in BASIL ORBIT! 🌗🎉 This is exactly how you reach any moon:
     transfer node → fine-tune the flyby → capture burn at periapsis.
     Next step: the <b>Moon landing on Basil</b> tutorial!`},

  {id:"sat", icon:"📡", title:"Deploy a satellite", sub:"You start in orbit – with a satellite under the fairing.",
   scenario:{stack:["antenna","solar","battery","probe","fairing","pod","rcs","solar","fin","tankM","engVac"], orbit:{body:"HERBIN", alt:90000}},
   steps:[
    {text:`You are in a 90 km orbit. On the nose of your rocket sits a complete satellite
      (antenna + solar + probe core) under a white <b>payload fairing</b>.<br><br>
      In vacuum the fairing is dead weight: jettison it with <b>[F]</b>!`,
     check:(o,F)=>!F.v.fairingIntact},
    {text:`There is the satellite! ✨<br><br>
      Now release it with <b>[N]</b>.`,
     check:(o,F)=>F.sats.length>0},
    {text:`📡 From now on the satellite flies on its own!<br><br>
      Important for your own missions: probes need <b>power</b> (the ⚡ bar at bottom left).
      Deploy the solar panels with <b>[G]</b> – but only in vacuum, in airflow they tear off!`,
     check:(o,F)=>F.panelsOut},
    {text:`☀️ The panels charge the battery (+3 ⚡/s). One more thing – open the map <b>[M]</b>:
      your satellite shows up as a green dot on its orbit.`,
     check:(o,F)=>F.map},
   ],
   done:`Mission accomplished! In career mode this earns you the "First satellite" mission (+30 🧪).
     Pro goal: a satellite in orbit around Basil or Minty!`},

  {id:"land", icon:"🛬", title:"Moon landing on Basil", sub:"You start in low Basil orbit – set the lander down.",
   scenario:{stack:["pod","rcs","fin","tankM","engVac","legs"], orbit:{body:"BASIL", alt:15000}},
   steps:[
    {text:`You are circling Basil at 15 km. Your lander has landing legs – but they are
      <b>retracted</b> for launch! Press <b>[Y]</b> to fold them out; they then forgive
      you up to 12 m/s instead of just 8.<br><br>
      Basil also has <b>no atmosphere</b>: no parachute, engine braking only.
      Switch SAS to <b>RETROGRADE</b> with <b>[T]</b> and burn with <b>[⇧X]</b>
      until the periapsis drops <b>below 0</b> (the path points into the ground).`,
     check:o=>o.pe<0},
    {text:`You are now falling towards Basil. Leave SAS on retrograde – that way you always
      brake exactly against the direction of fall.<br><br>Rule of thumb: let yourself drop to
      2000 m, then brake hard. Descend below <b>5000 m</b>.`,
     check:o=>o.alt<5000},
    {text:`Final phase! 🔥 Burn so that your speed stays small as you sink:<br>
      at 1000 m → below 100 m/s · at 200 m → below 20 m/s · touchdown → <b>below 12 m/s</b>.<br><br>
      Use <b>[↑/↓]</b> for fine control. You've got this!`,
     check:(o,F)=>F.landed},
   ],
   done:`THE EAGLE HAS LANDED! 🦅 Moon landing mastered – the supreme discipline.<br><br>
     Now the best part: get out with <b>[V]</b> and walk across Basil with <b>W/A/S/D</b>
     (jump with <b>[↑]</b> – at 1.6 m/s² you fly a long way!). With <b>[F]</b> you plant the
     <b>HSP flag</b>. In career mode it stays there forever.
     (Crashed? <b>↩ Restart</b> resets the scenario.)`},

  {id:"reentry", icon:"🔥", title:"Surviving reentry", sub:"Drop the stage, point the shield, pull the chute.",
   scenario:{stack:["chute","pod","shield","rcs","decoupler","fin","tankM","engVac"], orbit:{body:"HERBIN", alt:75000, pe:28000}},
   steps:[
    {text:`Coming home from orbit! Your trajectory already dips into the atmosphere
      (periapsis 28 km – check the map <b>[M]</b>).<br><br>
      You no longer need the spent propulsion stage – and it has no heat protection.
      <b>Separate it with [Space]!</b>`,
     check:(o,F)=>F.v.segs.length===1},
    {text:`Now you are just pod + heat shield + parachute. 👍<br><br>
      The <b>heat shield points down</b> – so the pod has to face <b>against the direction
      of travel</b>: press <b>[T]</b> until <b>SAS: RETROGRADE</b>.`,
     check:(o,F)=>F.sas==="retro"},
    {text:`Lined up perfectly! Now wait for the atmosphere (time warp <b>[.]</b>,
      [,] to step back down if needed).<br><br>
      It is about to get hot: the shield glows, the plasma lights up – but it holds.
      Ride out the fire until you are below <b>30 km</b> and slower than
      <b>1200 m/s</b> bist!`,
     check:o=>o.alt<30000 && o.speed<1200},
    {text:`Made it – the worst is over! 🔥➡️💨<br><br>
      The air keeps slowing you down. Below <b>5 km</b>: parachute with <b>[P]</b>!`,
     check:(o,F)=>F.chuteOpen},
    {text:`🪂 Floating gently… wait for touchdown.`,
     check:(o,F)=>F.landed},
   ],
   done:`Reentry mastered! 🏅 Remember: <b>drop the stage → retrograde with the
     heat shield leading → parachute below 5 km</b>. Without a shield = 💥, without
     retrograde attitude you gamble with your crew. Now you are ready for real orbital missions!`},
  {id:"burns", icon:"🧭", title:"Understanding burns & SAS", sub:"Prograde, retrograde & co. – the language of spaceflight.",
   scenario:{stack:["chute","pod","shield","rcs","fin","tankM","tankM","engVac"], orbit:{body:"HERBIN", alt:100000}},
   steps:[
    {text:`You are in a 100 km orbit. On the <b>navball</b> you can see the green symbol:
      that is <b>PROGRADE</b> – the direction you are currently flying.<br><br>
      Mnemonic: <b>burn prograde = go faster = orbit gets BIGGER</b>
      (on the opposite side!).<br><br>
      Press <b>[T]</b> until SAS: PROGRADE is active.`,
     check:(o,F)=>F.sas==="pro"},
    {text:`SAS now holds the nose on prograde automatically. 🎯<br><br>
      Go full throttle <b>[⇧X]</b> and watch the <b>apoapsis</b> on the left:
      it grows – but not here, on the OPPOSITE side of your orbit!
      (Map [M] shows it live.)<br><br>
      Burn until <b>Ap is above 200 km</b>, then engine off [X].`,
     check:o=>o.ap>200000},
    {text:`Now the opposite: <b>RETROGRADE</b> = burn against the direction of travel
      = slow down = <b>orbit gets SMALLER</b>.<br><br>
      Press <b>[T]</b> until SAS: RETROGRADE is active – the rocket turns 180°.`,
     check:(o,F)=>F.sas==="retro"},
    {text:`Full throttle <b>[⇧X]</b> – and watch the apoapsis shrink again!<br><br>
      Burn until <b>Ap is back below 130 km</b>, then [X].<br><br>
      💡 This is how EVERYTHING in spaceflight works: higher = prograde, lower = retrograde,
      always at the right point on the orbit.`,
     check:o=>o.ap>0 && o.ap<130000},
    {text:`The last two directions (for the pros):<br><br>
      <b>NORMAL</b> (perpendicular to the orbital plane) tilts your inclination –
      important for Minty's inclined orbit.<br>
      <b>RADIAL</b> (towards/away from the planet) rotates the orbit without changing its size much.<br><br>
      You dial in both at the <b>maneuver node [K]</b> – the sliders there have exactly these names!`},
   ],
   done:`You speak spaceflight now! 🧭 Prograde = bigger, retrograde = smaller,
     normal = inclination, radial = rotation. With [T] the SAS holds any direction automatically –
     and at a maneuver node the engine burns exactly the planned Δv.`},

  {id:"inclination", icon:"📐", title:"Changing inclination", sub:"Satellite in a tilted orbit – swing the plane over with a normal burn.",
   scenario:{stack:["probe","solar","antenna","rcs","tankM","engVac"],
     orbit:{body:"HERBIN", alt:150000, inc:20},
     goalOrbit:{body:"HERBIN", alt:150000, incMax:5, label:"Equatorial orbit (inclination < 5°)"}},
   steps:[
    {text:`Your satellite is in a 150 km orbit – but the plane is tilted by <b>20°</b>
      (HUD on the left: "Inclination"). The customer wants an <b>equatorial orbit</b>!
      Luckily the upper stage is still attached: full tanks for the maneuver.<br><br>
      Open the map with <b>[M]</b>: the <b>blue ring</b> is the target orbit –
      your orange path lies at an angle to it and crosses it at exactly <b>two points</b>.`,
     check:(o,F)=>F.map},
    {text:`An orbital plane can only be tilted <b>at those crossing points</b>
      (that is where the old and the new plane intersect).<br><br>
      Create a maneuver node with <b>[K]</b>.`,
     check:(o,F)=>!!F.node},
    {text:`Now shift the node's <b>time</b> (±10s/±60s buttons on the right)
      until the green <b>Δv marker</b> sits exactly on a <b>crossing point</b> of the orange
      path and the blue ring.<br><br>
      💡 Viewed from the side (drag the camera!) it is easiest to see where your orbit
      punches through the equatorial plane.`,
     check:(o,F)=>F.node && F.nodeRelY!==undefined && Math.abs(F.nodeRelY)<40000},
    {text:`Perfectly placed! Now the <b>NORMAL burn</b> (perpendicular to the orbital plane):<br><br>
      In the panel, click −10/+10 next to <b>Normal</b> until roughly <b>±780 m/s</b> are
      dialled in. Watch the <b>green planned trajectory</b>: it has to lie <b>flat on the
      blue ring</b>!<br><br>
      ⚠️ If it tilts even STEEPER instead, you picked the wrong direction –
      just use the other sign.`,
     check:(o,F)=>F.node && F.nodePlannedInc!==undefined && F.nodePlannedInc<5},
    {text:`The green path is in the equatorial plane – now let's fly it!<br><br>
      Press <b>[T]</b> until <b>SAS: maneuver node</b> is active – the nose turns
      automatically onto the <b style="color:#ff6ad5">pink ✛</b> on the navball (your
      burn-direction pointer).<br><br>
      Warp with <b>[.]</b> until <b>T minus half the burn time</b> (shown in the
      panel), then go full throttle <b>[⇧X]</b> – the engine stops automatically
      once the Δv is spent. Bring the <b>inclination below 5°</b>!`,
     check:(o,F)=>F.orbitInc()<5 && o.pe>70000 && o.ap>0},
   ],
   done:`📐 ORBITAL PLANE TILTED – the ring on the map glows GREEN! 🎉 Remember:
     you change inclination <b>at the crossing point of the planes</b> with a
     <b>normal burn</b> – and it is expensive (~780 m/s here!). That is why the pros
     launch from the right pad in the first place: the latitude of the launch site becomes
     the inclination. Career mode has orbital missions with exactly these target rings!`},

  {id:"evatut", icon:"🧑‍🚀", title:"Extravehicular activity (EVA)", sub:"Get out, float, come back safely.",
   scenario:{stack:["chute","pod","shield","rcs","fin","tankM","engVac"], orbit:{body:"HERBIN", alt:120000}},
   steps:[
    {text:`You are in a 120 km orbit – time for the most famous moment in spaceflight:
      the <b>spacewalk</b>!<br><br>
      Open the hatch with <b>[V]</b>.`,
     check:(o,F)=>!!F.eva},
    {text:`Da schwebt deine Pilotin / dein Pilot! 🧑‍🚀<br><br>
      The <b>jetpack</b> is camera-relative: <b>W/S</b> = forward/back,
      <b>A/D</b> = left/right, <b>↑/↓</b> = up/down. The mouse turns the camera.<br><br>
      Get at least <b>40 m</b> away from the ship (distance shown top right).`,
     check:(o,F)=>F.eva && F.eva.pos.distanceTo(F.pos)>40},
    {text:`Take a look at your ship from outside – and at Herbin below you! 🌍<br><br>
      But careful: drift too far and you will not make it back.
      Now fly <b>back to the ship</b> (under 60 m) and climb back in with <b>[V]</b>.`,
     check:(o,F)=>!F.eva},
   ],
   done:`Safely back on board! 🛰️ Remember: in orbit the astronaut moves at exactly the
     same orbital speed as the ship – small jetpack nudges are all you need.
     EVA only works with crew (command pod) and only in space.`},

  {id:"rendezvous", icon:"🔗", title:"Rendezvous & docking", sub:"Meet the »Tea Break« space station – and dock with it!",
   scenario:{stack:["dock","pod","rcs","fin","tankS","engT"], nearStation:3000},
   steps:[
    {text:`Ahead of you flies the space station <b>»Tea Break«</b> – only 3 km away, in the same
      100 km orbit! On the right of the HUD you see <b>distance</b> and <b>relative speed</b>.<br><br>
      First get the lay of the land: open the map with <b>[M]</b> –
      the station is the light-blue <b>»Tea Break«</b> marker right next to you.`,
     check:(o,F)=>F.map},
    {text:`Close the map again <b>[M]</b>. On the navball you see two markers:
      the <b>turquoise ◆</b> (that is where the station IS) and the <b style="color:#ff6ad5">pink ✛</b>
      – your <b>approach assistant</b>!<br><br>
      The ✛ always shows the <b>perfect burn direction</b>: it steers you towards the station
      AND brakes you automatically the closer you get.<br><br>
      So it is simple: turn the nose onto the <b style="color:#ff6ad5">pink ✛</b> with
      <b>W/A/S/D</b> and <b>apply thrust</b> (<b>[↑]</b>). If the ✛ moves, follow it!
      Close to <b>under 1 km</b>.`,
     check:(o,F)=>!F.map && F.pos.distanceTo(stationPos(F.t))<1000},
    {text:`Unter 1000 m! 🛰 Einfach weiter so:<br><br>
      Keep the nose on the <b style="color:#ff6ad5">pink ✛</b> and thrust in
      <b>short bursts</b> – the ✛ keeps slowing you down all by itself
      (watch the <b>relative speed</b> on the right: it drops along with the distance).<br><br>
      If the ✛ drifts aside, follow it with the nose and burn briefly again.
      Close to <b>under 200 m</b> – from there the autopilot takes over!`,
     check:(o,F)=>F.docked || F.pos.distanceTo(stationPos(F.t))<200},
    {text:`Under 200 m! ✨ Now press:<br><br>
      <b>[L] – the DOCKING AUTOPILOT takes over!</b><br><br>
      It handles the final approach with the RCS thrusters and docks gently –
      exactly like Crew Dragon in real life. Sit back and watch! 🤖`,
     check:(o,F)=>F.docked},
   ],
   done:`🔗 DOCKED AT »TEA BREAK«! 🎉 You have now mastered the hardest exercise in
     spaceflight: the rendezvous. This is exactly how the real ISS was built – module by module.
     Career mode has the "Rendezvous: »Tea Break«" mission for it (+55 🧪).
     By the way, you can undock again at any time with [L].`},

  {id:"launchwindow", icon:"⏰", title:"Space station: from pad to docking", sub:"Catch the launch window, match the phase, dock – the supreme discipline.",
   scenario:{stack:["dock","pod","rcs","tankS","tankS","engVac","decoupler","inter","fin","tankL","engMain"]},
   steps:[
    {text:`This time you do EVERYTHING yourself: from the pad to the station hatch!<br><br>
      The station races around Herbin at 2.2 km/s – launch "whenever" and you come out
      thousands of kilometres off. The pros wait for the <b>launch window</b>.<br><br>
      Pick your target first: press <b>[Z]</b> → 🎯 Space station »Tea Break«.`,
     check:(o,F)=>!!F.target},
    {text:`On the right of the HUD you now see the <b>launch window time</b> ⏰ – the moment
      when the station is about 30° <b>behind</b> the pad. While you climb,
      it makes up exactly those 30°: you meet up top!<br><br>
      Warp forward with <b>[.]</b> (step back down with <b>[,]</b>) until
      <b style="color:#5fc46a">LAUNCH WINDOW OPEN</b> lights up.`,
     check:(o,F)=>{ if(!F.target || !F.landed) return false;
       const tw = F.nextLaunchWindow(F.target)-F.t, per = 2*Math.PI/F.target.w;
       return tw<30 || tw>per-15; }},
    {text:`<b style="color:#5fc46a">WINDOW OPEN – LAUNCH NOW!</b> 🚀 [Space]!<br><br>
      Then the usual: at ~2 km tilt slowly <b>EAST</b> (the <b>E</b> on the
      navball), fly the gravity turn and bring the <b>apoapsis to ~100 km</b>
      (the map [M] helps). Once up there: burn prograde until the
      <b>periapsis rises above 70 km</b>.`,
     check:(o,F)=>F.flew && o.alt>69000 && o.pe>68000},
    {text:`In orbit! 🛰 Look at the <b>💡 phasing tips</b> on the right: they tell you whether the
      station is ahead of you or behind you.<br><br>
      Mnemonic: <b>LOWER = faster, HIGHER = slower.</b> If you are lagging behind,
      fly a little lower and you will catch up. Adjust your orbit and close in until the
      distance is <b>under 50 km</b>. (Use time warp [.]!)`,
     check:(o,F)=>F.pos.distanceTo(stationPos(F.t))<50000},
    {text:`Under 50 km – now the navball markers appear: turquoise <b>◆</b> = station,
      <b style="color:#ff6ad5">pink ✛</b> = your approach assistant!<br><br>
      Final approach as in the rendezvous tutorial: keep the nose on the
      <b style="color:#ff6ad5">pink ✛</b> and thrust in short bursts – it steers AND brakes you
      automatically. Close to <b>under 200 m</b>!`,
     check:(o,F)=>F.docked || F.pos.distanceTo(stationPos(F.t))<200},
    {text:`Made it – autopilot range! Press <b>[L]</b>: the
      <b>docking autopilot</b> takes over the last stretch. 🤖`,
     check:(o,F)=>F.docked},
   ],
   done:`🏆 FROM THE PAD TO THE HATCH – the complete supreme discipline! This is exactly how
     SpaceX plans every Crew Dragon flight: wait for the window, match the phase, dock.
     By the way: you can also pick parked tanker Starships as a target with [Z] on the pad –
     that is how orbital refuelling works on the first try.`},

  {id:"science", icon:"🔬", title:"Collecting science", sub:"You start in orbit with a lab on board.",
   scenario:{stack:["chute","pod","lab","rcs","fin","tankM","engVac"], orbit:{body:"HERBIN", alt:100000}},
   steps:[
    {text:`Your ship carries a <b>»Curie« materials lab</b> (the module with the
      glowing windows). You are in near space above Herbin.<br><br>
      Run an experiment: <b>[B]</b>!`,
     check:(o,F)=>F.expCount>0},
    {text:`🔬 In career mode every <b>new location</b> gives science once:
      atmosphere (6) · near space (12) · high orbit (15) · near Basil (20) ·
      on Basil (30) · near Minty (25) · on Minty (40).<br><br>
      Climb into a higher orbit: burn PROGRADE (SAS [T] helps) until the
      <b>apoapsis is above 250 km</b>, then warp up there – that would be the
      next new research location! Burn now until <b>Ap > 250 km</b>.`,
     check:o=>o.ap>250000},
    {text:`Warp with <b>[.]</b> until you are above <b>250 km</b>
      (= the new "high orbit" location), then press <b>[B]</b> again.`,
     check:(o,F)=>F.expCount>1},
   ],
   done:`That is how research works! 🧪 In career mode you spend those points under
     <b>Research</b> to unlock new parts. Tip: take the lab on EVERY mission.`},

  {id:"booster", icon:"🛬", title:"Booster landing (Falcon style)", sub:"First stage with grid fins – separate, watch, save money.",
   scenario:{stack:["chute","pod","rcs","tankM","engVac","decoupler","inter","gridfin","fin","tankL","tankL","engMain"]},
   steps:[
    {text:`This rocket has <b>grid fins</b> on the first stage (the folded grids at the top of
      the big tank – just like on Falcon 9!). With them the <b>landing autopilot</b>
      can bring the stage back safely after separation.<br><br>
      Important: watch the <b>TANK gauge</b> at bottom left – the <b>orange mark</b>
      shows the fuel the autopilot needs for the landing burn!<br><br>
      Ignite with <b>[Space]</b> and climb vertically.`,
     check:(o,F)=>!F.landed && F.flew},
    {text:`Tilt the rocket slightly east with <b>[D]</b> (gravity turn) and keep climbing.
      Keep an eye on the <b>tank gauge</b> – it is dropping towards the
      orange mark!<br><br>Climb past <b>10 km</b>.`,
     check:o=>o.alt>10000},
    {text:`Here comes the Falcon moment! 🚀<br><br>
      Separate the first stage with <b>[Space]</b>, <b>while the tank bar is
      still ABOVE the orange mark</b>. Too late = no fuel for the landing and
      the booster is scrap!`,
     check:(o,F)=>!!F.booster},
    {text:`The <b>autopilot</b> has taken over – an <b>observation window</b> opens on the
      right: flip manoeuvre, grid fins out, descent, landing burn. 🍿<br><br>
      Meanwhile you fly on with <b>stage 2</b> (prograde towards orbit, for instance –
      or just watch). Wait until the booster has <b>landed</b>!`,
     check:(o,F)=>F.booster && F.booster.state==="landed"},
   ],
   done:`🏆 BOOSTER LANDED – just like SpaceX! Remember: <b>grid fins fitted, separate above
     the orange mark, the autopilot does the rest.</b> In career mode you get the
     full value of the stage refunded – reuse
     really saves money! (The "It lands after all!" mission is waiting.)`},

  {id:"starship", icon:"🤸", title:"Starship: reentry & bellyflop", sub:"Belly down, flip, landing burn – like in Boca Chica.",
   scenario:{stack:["starship"], orbit:{body:"HERBIN", alt:75000, pe:22000}},
   steps:[
    {text:`You are sitting in the <b>Starship</b> on a reentry trajectory (periapsis 22 km).
      No parachutes, no heat shield part – the <b>heat tiles are ONLY on the
      belly</b>. ⚠️ Which means: dive in nose first and you <b>burn up</b> –
      exactly like in real life!<br><br>
      So activate the bellyflop autopilot IMMEDIATELY: <b>[C]</b> – the ship lies
      down flat on its belly, tiles into the airflow.`,
     check:(o,F)=>!!F.belly},
    {text:`🤸 Belly down! That huge belly brakes like a parachute – and it is the only way
      the <b>tiles face the wind</b> that keeps the fireball off you.<br><br>
      Now be patient (time warp <b>[.]</b> helps): ride out the glowing reentry
      and fall until you are <b>below 10 km</b> and <b>slower than 300 m/s</b>.
      (And do not get any ideas about switching [C] off halfway … 🔥)`,
     check:o=>o.alt<10000 && o.speed<300},
    {text:`Look at the speed: it settles at <b>terminal velocity (~70–90 m/s)</b> –
      a falling Starship gets no faster than that, however long it falls.
      Exactly like in real life!<br><br>
      Now do NOTHING: the autopilot fires the <b>flip + landing burn</b> automatically
      just above the ground. (Remember: [C] has to be pressed above <b>200 m</b> –
      below that there is not enough time for the flip!)<br><br>Wait for touchdown …`,
     check:(o,F)=>F.landed},
   ],
   done:`🏆 STARSHIP LANDED! Belly down → flip → landing burn: the most spectacular
     landing in spaceflight. Tip for your own flights: park the tanker Starship (no flaps)
     in orbit and refuel there – then you have enough to reach Basil and beyond!`},

  {id:"refuel", icon:"⛽", title:"Starship: orbital refuelling", sub:"Tanks nearly dry? A tanker is waiting in orbit – fly over and fill up!",
   scenario:{stack:["starship"], tanker:{alt:120000, behind:3000}, fuelFrac:0.15},
   steps:[
    {text:`Your Starship is in a 120 km orbit – but the tanks are <b>nearly empty</b>
      (check the gauge: only about 15 % left!). That will never get you to Basil or beyond.<br><br>
      SpaceX's answer: <b>orbital refuelling</b>. 3 km ahead a parked
      <b>tanker Starship ⛽</b> is waiting – it is already marked as your target.<br><br>
      Take a look at the map <b>[M]</b>: there it is!`,
     check:(o,F)=>F.map},
    {text:`Map closed again <b>[M]</b>. On the navball you see the approach assistant:
      the <b style="color:#ff6ad5">pink ✛</b>.<br><br>
      Same as the station rendezvous: <b>turn the nose onto the ✛ with W/A/S/D</b> and thrust in
      <b>short bursts</b> <b>[↑]</b> – the ✛ steers AND brakes you
      automatically.<br><br>
      ⚠️ Burn sparingly, your fuel is tight! Close to <b>under 500 m</b>.`,
     check:(o,F)=>F.refueled || (F.tutTanker && !F.map && F.pos.distanceTo(F.assetPos(F.tutTanker,F.t))<500)},
    {text:`Under 500 m! Now the final approach – nice and calm:<br><br>
      Nose on the <b style="color:#ff6ad5">pink ✛</b>, small bursts of thrust. Refuelling
      starts automatically as soon as you are <b>closer than 60 m</b> and <b>slower than
      4 m/s</b> relative to the tanker – like two ships lying alongside.<br><br>
      Watch the relative speed on the right and feel your way in!`,
     check:(o,F)=>F.refueled},
    {text:`⛽ <b>TANKS FULL!</b> Everything back to 100 % – the empty tanker
      burns up in the atmosphere under control.<br><br>
      Feel the difference: a moment ago you were stranded, now you have Δv to spare for a
      <b>trip to Basil</b>. Burn prograde briefly to celebrate and raise your
      <b>apoapsis above 300 km</b>!`,
     check:o=>o.ap>300000},
   ],
   done:`🏆 ORBITAL REFUELLING MASTERED! This is exactly how SpaceX plans Moon and Mars flights:
     the Starship launches into orbit almost empty and is filled up there by tankers –
     only then does the real journey start. In career mode: pick a tanker Starship with [Z]
     on the pad, fly over, refuel (the tanker is used up).`}
];
