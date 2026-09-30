const $=s=>document.querySelector(s);
const panels=[...document.querySelectorAll('.panel')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
// V2.1 polish switches. Each is independent; review without one using ?polish=-ease (or -rhythm, -framing,
// -sound, -tree, -grounding, -cloth, -sky, -wires, -windows, -paving), or ?polish=off for the approved v2.
const review=(()=>{try{return new URLSearchParams(location.search).get('polish')||'';}catch(error){return '';}})();
const off=name=>review==='off'||review.split(',').includes('-'+name);
const WALK_EASE=!off('ease'),STEP_RHYTHM=!off('rhythm'),ATTENTION_FRAMING=!off('framing'),SOUND=!off('sound');
const worldPolish=Object.fromEntries(['tree','grounding','cloth','sky','wires','windows','paving'].map(name=>[name,!off(name)]));
// Top speed is the approved 1.65 m/s. One footfall per 0.825 m: 2.0 steps/s at full speed.
const TOP_SPEED=1.65,EASE_IN=.35,EASE_OUT=.25,STEP_LENGTH=.825,BOB=.01,REVEALS=new Set(['TREE_SCORE','KNOW_YOUR_MP','PAY_ATTENTION','END']);
let world,state='ARRIVAL',distance=0,yaw=0,pitch=-.32,targetPitch=pitch,targetYaw=0,time=0,previous=0,paused=false,moving=0,pointer=null,raf=0,active=true;
let slowFrames=0,frames=0,qualityLowered=false,alive=true,holdTimer,pressedAt=0;
let drive=0,velocity=0,pending=0,odometer=0,rest=1,bob=0,footfalls=0;
let audio=null,audioContext=null,engine=null,soundOn=false,soundRequest=0,soundAttempts=0;
const transition={ARRIVAL:['WALK_TREE'],WALK_TREE:['LOOK_UP_AVAILABLE'],LOOK_UP_AVAILABLE:['TREE_NOTICED'],TREE_NOTICED:['TREE_SCORE'],TREE_SCORE:['WALK_CIVIC'],WALK_CIVIC:['CIVIC'],CIVIC:['KNOW_YOUR_MP'],KNOW_YOUR_MP:['WALK_ATTENTION'],WALK_ATTENTION:['ATTENTION_NOTICED'],ATTENTION_NOTICED:['PAY_ATTENTION'],PAY_ATTENTION:['WALK_END'],WALK_END:['END'],END:[]};
function readVersion(reason){if(!alive)return;alive=false;cancelAnimationFrame(raf);audio?.disable();window.v2Startup.fallback();}
function announce(message){$('#status').textContent=message;}
function panel(id){panels.forEach(p=>p.hidden=p.id!==id);if(id){const p=$('#'+id);p.scrollTop=0;p.focus({preventScroll:true});}$('#walk-controls').hidden=Boolean(id);}
// With eased steps an encounter can arrive between presses; a press within 400 ms of the action appearing is
// treated as the tail of walking, not a choice, so rhythmic Walk presses cannot open a project by accident.
function controls(thought,label,walking=false){$('#thought').textContent=thought;const old=$('#action'),button=old.cloneNode(false),shown=performance.now();button.hidden=!label;button.textContent=label||'';let pressed=false;button.addEventListener('pointerdown',()=>pressed=true);button.onclick=e=>{if(WALK_EASE&&performance.now()-shown<400){pressed=false;return;}if(e.detail===0||pressed)action();pressed=false;};old.replaceWith(button);$('#advance').hidden=!walking;$('#back').hidden=!walking;$('#hint').textContent=walking?'Hold Walk ↑ · Drag to look':state==='LOOK_UP_AVAILABLE'?'Drag upward to look into the canopy':'';}
function enter(next){if(!transition[state]?.includes(next))return;state=next;document.body.dataset.state=state;moving=0;drive=velocity=pending=0;panel(null);
  switch(state){
    case 'WALK_TREE':controls('','',true);announce('Walk forward. Hold W or Arrow Up, or hold the Walk button. Drag to look.');break;
    case 'LOOK_UP_AVAILABLE':controls('','LOOK UP');announce('Look up into the tree. Drag upward or choose Look up.');break;
    case 'TREE_NOTICED':controls('How green is this place?','TREE SCORE ↗');announce('How green is this place?');break;
    case 'TREE_SCORE':panel('tree');announce('TreeScore.');break;
    case 'WALK_CIVIC':targetPitch=0;targetYaw=0;controls('','',true);break;
    case 'CIVIC':targetYaw=-.45;controls('Who represents this place?','KNOW YOUR MP ↗');announce('Who represents this place?');break;
    case 'KNOW_YOUR_MP':panel('record');break;
    case 'WALK_ATTENTION':controls('','',true);break;
    case 'ATTENTION_NOTICED':if(ATTENTION_FRAMING)targetYaw=world.frameCloth(distance,targetYaw);controls('What caught your attention?','PAY ATTENTION. ↗');announce('What caught your attention?');break;
    case 'WALK_END':controls('','',true);break;
    case 'PAY_ATTENTION':panel('attention');break;
    case 'END':panel('ending');break;
  }
  if(!$('#walk-controls').hidden){($('#action').hidden?$('#advance'):$('#action')).focus({preventScroll:true});}
}
function action(){if(state==='LOOK_UP_AVAILABLE'){targetPitch=.55;return;}const next={TREE_NOTICED:'TREE_SCORE',CIVIC:'KNOW_YOUR_MP',ATTENTION_NOTICED:'PAY_ATTENTION'}[state];if(next)enter(next);}
function canWalk(){return ['WALK_TREE','WALK_CIVIC','WALK_ATTENTION','WALK_END'].includes(state)&&!$('#projects').open;}
function passage(){return state==='WALK_TREE'?[0,7]:state==='WALK_CIVIC'?[7,22]:state==='WALK_ATTENTION'?[22,25]:[25,28];}
function advance(amount){if(!canWalk())return;const limits=passage();distance=Math.min(limits[1],Math.max(limits[0],distance+amount));if(distance>=limits[1])enter(state==='WALK_TREE'?'LOOK_UP_AVAILABLE':state==='WALK_CIVIC'?'CIVIC':state==='WALK_ATTENTION'?'ATTENTION_NOTICED':'END');}
// A tap or keyboard step queues distance; move() glides it with the same easing instead of jumping.
function step(amount){if(!WALK_EASE)return advance(amount);if(!canWalk())return;const [lo,hi]=passage();pending=Math.max(lo-distance,Math.min(hi-distance,pending+amount));}
// WALKING: same top speed, eased start (~0.35 s) and stop (~0.25 s). Near a queued step's end or an encounter
// the walker brakes in time to settle on it rather than halting at full speed.
function move(dt){
  const from=distance;
  if(!WALK_EASE){velocity=canWalk()?moving*TOP_SPEED:0;advance(velocity*dt);}
  else if(!canWalk())drive=velocity=pending=0;
  else{
    const [lo,hi]=passage();if(moving)pending=0;
    let want=moving||(pending>0?1:pending<0?-.5:0);
    const travel=Math.sign(drive)||Math.sign(want),toward=pending&&Math.sign(pending)===travel,goal=toward?distance+pending:travel>0?hi:lo,s0=Math.abs(drive);
    if(travel&&TOP_SPEED*EASE_OUT*(s0*s0*s0-s0**4/2)>=Math.abs(goal-distance))want=0;
    if(want&&Math.sign(want)!==travel)want=0;
    const rate=dt/(Math.abs(want)>s0?EASE_IN:EASE_OUT);drive+=Math.max(-rate,Math.min(rate,want-drive));
    const s=Math.abs(drive);velocity=Math.sign(drive)*TOP_SPEED*s*s*(3-2*s);
    let next=distance+velocity*dt;
    if(travel&&(travel>0?next>=goal-.003:next<=goal+.003)){next=goal;if(toward){pending=0;drive=0;}}else if(pending)pending-=next-distance;
    next=Math.max(lo,Math.min(hi,next));
    advance(next>=hi?hi-distance+1e-6:next-distance);
  }
  stride(Math.abs(distance-from),dt);
}
// STEP RHYTHM: a ~1 cm dip at each footfall, locked to distance walked and scaled by speed; zero when still.
// Footsteps fire on the same footfall, so sound and camera share one cadence.
function stride(travelled,dt){
  const speed=Math.min(1,Math.abs(velocity)/TOP_SPEED);
  if(speed<.02)rest+=dt;else{if(rest>.3)odometer=(Math.floor(odometer/STEP_LENGTH)+1)*STEP_LENGTH-.22;rest=0;}
  const before=Math.floor(odometer/STEP_LENGTH);odometer+=travelled;
  if(Math.floor(odometer/STEP_LENGTH)>before&&Math.abs(velocity)>.25){footfalls++;if(soundOn)audio?.step(speed);}
  bob=STEP_RHYTHM?-BOB/2*Math.cos(odometer/STEP_LENGTH*Math.PI*2)*speed:0;
}
function clearMovement(){moving=0;clearTimeout(holdTimer);pointer=null;}
function halt(){clearMovement();drive=velocity=pending=bob=0;}
// SOUND: off by default. Nothing audio-related loads until the visitor turns it on; the context is created
// inside that click so no autoplay rule is broken. The choice lasts for this tab's session only.
function soundLabel(){const b=$('#sound');b.textContent=soundOn?'Sound on':'Sound off';b.setAttribute('aria-pressed',String(soundOn));}
function setSound(on){
  const request=++soundRequest;soundOn=on;soundLabel();announce(on?'Sound on.':'Sound off.');
  try{if(on)sessionStorage.setItem('projects-sound','on');else sessionStorage.removeItem('projects-sound');}catch(error){}
  if(!on){audio?.disable();return;}
  try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume?.()?.catch?.(()=>{});}catch(error){return soundFailed(request);}
  // A failed module load is cached by the browser, so a retry asks for a fresh URL.
  engine??=import(soundAttempts?`./sound.js?retry=${soundAttempts}`:'./sound.js').then(module=>module.createSound(audioContext));
  engine.then(a=>{audio=a;if(request===soundRequest&&soundOn)a.enable();},()=>{engine=null;soundAttempts++;soundFailed(request);});
}
function soundFailed(request){if(request!==soundRequest)return;soundOn=false;soundLabel();announce('Sound is unavailable.');try{sessionStorage.removeItem('projects-sound');}catch(error){}}
const hearing={dt:0,distance:0,paused:false,panel:false,gust:0,cloth:0};
async function init(){
  if(!window.v2Startup.pending)return;
  try{const [module]=await Promise.all([import('./3d/world.js'),window.v2Startup.styles]);if(!alive||!window.v2Startup.pending)return;world=module.createWorld($('#world'),{polish:worldPolish});world.view(distance,yaw,pitch);world.draw(time);
    document.body.classList.add('spatial');document.body.dataset.state=state;panels.forEach(p=>p.hidden=p.id!=='arrival');$('#start').hidden=false;$('#pause').hidden=false;$('#sound').hidden=!SOUND;
  }catch(error){return readVersion('renderer-failure');}
  $('#start').onclick=()=>enter('WALK_TREE');$('#action').onclick=action;
  // The tap that ends the route must not activate the newly revealed restart link.
  const restart=$('#restart-walk');let restartPressed=false;
  restart.addEventListener('pointerdown',()=>restartPressed=state==='END');
  restart.addEventListener('pointercancel',()=>restartPressed=false);
  restart.addEventListener('click',e=>{if(e.detail>0&&!restartPressed)e.preventDefault();restartPressed=false;});
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const next={'tree-done':'WALK_CIVIC','record-done':'WALK_ATTENTION','attention-done':'WALK_END'}[b.dataset.action];enter(next);});
  $('#pause').onclick=()=>{paused=!paused;halt();$('#pause').textContent=paused?'Resume motion':'Pause motion';$('#pause').setAttribute('aria-pressed',String(paused));announce(paused?'Street motion paused.':'Street motion resumed.');};
  if(SOUND){
    $('#sound').onclick=()=>setSound(!soundOn);
    // Within the same tab session, a visitor who chose sound gets it back on their next deliberate input.
    let remembered=false;try{remembered=sessionStorage.getItem('projects-sound')==='on';}catch(error){}
    if(remembered){const events=['pointerup','keydown'],arm=e=>{if(e.type==='keydown'&&['Escape','Tab','Shift','Control','Alt','Meta'].includes(e.key))return;events.forEach(t=>removeEventListener(t,arm,true));if(!soundOn&&!e.target.closest?.('#sound'))setSound(true);};events.forEach(t=>addEventListener(t,arm,true));}
  }
  $('#projects').addEventListener('toggle',halt);
  $('#advance').addEventListener('pointerdown',e=>{if(!canWalk()||paused)return;e.preventDefault();pressedAt=performance.now();$('#advance').setPointerCapture(e.pointerId);moving=1;});
  $('#advance').addEventListener('pointerup',()=>{if(!paused&&performance.now()-pressedAt<250)step(1);clearMovement();});$('#advance').addEventListener('pointercancel',clearMovement);$('#advance').addEventListener('lostpointercapture',clearMovement);$('#advance').addEventListener('contextmenu',e=>e.preventDefault());
  $('#advance').addEventListener('click',e=>{if(e.detail===0&&!paused)step(1);});$('#back').onclick=()=>{if(!paused)step(-.65);};
  window.addEventListener('keydown',e=>{if($('#projects').open||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='Escape'){halt();return;}if(canWalk()&&!paused&&['w','W','ArrowUp','s','S','ArrowDown'].includes(e.key)){e.preventDefault();moving=['w','W','ArrowUp'].includes(e.key)?1:-.5;}if(state==='LOOK_UP_AVAILABLE'&&e.key==='ArrowUp'){e.preventDefault();targetPitch=Math.min(.75,targetPitch+.12);}});
  window.addEventListener('keyup',e=>{if(['w','W','ArrowUp','s','S','ArrowDown'].includes(e.key))moving=0;});window.addEventListener('blur',halt);
  window.addEventListener('keydown',e=>{if(paused||$('#projects').open||!['WALK_TREE','LOOK_UP_AVAILABLE','TREE_NOTICED','WALK_CIVIC','CIVIC','WALK_ATTENTION','ATTENTION_NOTICED','WALK_END'].includes(state))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();targetYaw=Math.max(-.9,Math.min(.9,targetYaw+(e.key==='ArrowLeft'?.08:-.08)));}if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();targetPitch=Math.max(-.6,Math.min(.85,targetPitch+(e.key==='PageUp'?.1:-.1)));}});
  const canvas=world.canvas;
  canvas.addEventListener('pointerdown',e=>{if(paused||$('#projects').open||!['WALK_TREE','LOOK_UP_AVAILABLE','WALK_CIVIC','CIVIC','WALK_ATTENTION','ATTENTION_NOTICED','WALK_END'].includes(state))return;pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!pointer)return;targetYaw=Math.max(-.9,Math.min(.9,targetYaw-(e.clientX-pointer.x)*.003));targetPitch=Math.max(-.6,Math.min(.85,targetPitch-(e.clientY-pointer.y)*.003));pointer={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',()=>pointer=null);canvas.addEventListener('pointercancel',()=>pointer=null);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();readVersion('context-lost');});
  window.addEventListener('resize',()=>{world.resize();world.draw(time);});
  document.addEventListener('visibilitychange',()=>{halt();active=!document.hidden;previous=0;if(active&&!raf)raf=requestAnimationFrame(frame);});
  reduced.addEventListener('change',e=>{if(e.matches)readVersion('reduced-motion');});
  function frame(now){raf=0;if(!active||!alive)return;const elapsed=previous?(now-previous)/1000:0;previous=now;const dt=Math.min(elapsed,.15);
    const menuOpen=$('#projects').open;
    if(!paused&&!menuOpen){time+=dt;move(dt);const damping=1-Math.exp(-dt*9);yaw+=(targetYaw-yaw)*damping;pitch+=(targetPitch-pitch)*damping;if(state==='LOOK_UP_AVAILABLE'&&pitch>.43)enter('TREE_NOTICED');}
    world.view(distance,yaw,pitch,bob);if(!paused&&!menuOpen)world.draw(time);
    if(audio&&soundOn){const still=paused||menuOpen;hearing.dt=dt;hearing.distance=distance;hearing.paused=still;hearing.panel=REVEALS.has(state);hearing.gust=world.motion.gust;hearing.cloth=still?0:world.motion.cloth;audio.update(hearing);}
    if(!paused&&!menuOpen&&elapsed>0){frames++;if(elapsed>.085)slowFrames++;if(frames>=180){if(slowFrames>100){if(qualityLowered)return readVersion('slow-renderer');world.renderer.setPixelRatio(1);world.renderer.shadowMap.enabled=false;qualityLowered=true;}frames=slowFrames=0;}}
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  // Read-only diagnostics used by local QA. No telemetry, storage or fingerprinting.
  window.walkDiagnostics=()=>({state,distance,yaw,pitch,time,paused,velocity,bob,pending,footfalls,sound:soundOn,audio:audio?.diagnostics(),stats:world.stats()});
  window.v2Startup.finish();
}
init().catch(()=>readVersion('unexpected-failure'));
