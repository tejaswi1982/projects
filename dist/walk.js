const $=s=>document.querySelector(s);
const panels=[...document.querySelectorAll('.panel')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let world,state='ARRIVAL',distance=0,yaw=0,pitch=-.32,targetPitch=pitch,targetYaw=0,time=0,previous=0,paused=false,moving=0,pointer=null,raf=0,active=true;
let slowFrames=0,frames=0,qualityLowered=false,alive=true,holdTimer,pressedAt=0;
const transition={ARRIVAL:['WALK_TREE'],WALK_TREE:['LOOK_UP_AVAILABLE'],LOOK_UP_AVAILABLE:['TREE_NOTICED'],TREE_NOTICED:['TREE_SCORE'],TREE_SCORE:['WALK_CIVIC'],WALK_CIVIC:['CIVIC'],CIVIC:['KNOW_YOUR_MP'],KNOW_YOUR_MP:['WALK_ATTENTION'],WALK_ATTENTION:['ATTENTION_NOTICED'],ATTENTION_NOTICED:['PAY_ATTENTION'],PAY_ATTENTION:['WALK_END'],WALK_END:['END'],END:[]};
function readVersion(reason){if(!alive)return;alive=false;cancelAnimationFrame(raf);location.replace(new URL($('.skip').getAttribute('href'),location.href));}
function announce(message){$('#status').textContent=message;}
function panel(id){panels.forEach(p=>p.hidden=p.id!==id);if(id){const p=$('#'+id);p.scrollTop=0;p.focus({preventScroll:true});}$('#walk-controls').hidden=Boolean(id);}
function controls(thought,label,walking=false){$('#thought').textContent=thought;const old=$('#action'),button=old.cloneNode(false);button.hidden=!label;button.textContent=label||'';let pressed=false;button.addEventListener('pointerdown',()=>pressed=true);button.onclick=e=>{if(e.detail===0||pressed)action();pressed=false;};old.replaceWith(button);$('#advance').hidden=!walking;$('#back').hidden=!walking;$('#hint').textContent=walking?'Hold Walk ↑ · Drag to look':state==='LOOK_UP_AVAILABLE'?'Drag upward to look into the canopy':'';}
function enter(next){if(!transition[state]?.includes(next))return;state=next;document.body.dataset.state=state;moving=0;panel(null);
  switch(state){
    case 'WALK_TREE':controls('','',true);announce('Walk forward. Hold W or Arrow Up, or hold the Walk button. Drag to look.');break;
    case 'LOOK_UP_AVAILABLE':controls('','LOOK UP');announce('Look up into the tree. Drag upward or choose Look up.');break;
    case 'TREE_NOTICED':controls('How green is this place?','TREE SCORE ↗');announce('How green is this place?');break;
    case 'TREE_SCORE':panel('tree');announce('TreeScore.');break;
    case 'WALK_CIVIC':targetPitch=0;targetYaw=0;controls('','',true);break;
    case 'CIVIC':targetYaw=-.45;controls('Who represents this place?','KNOW YOUR MP ↗');announce('Who represents this place?');break;
    case 'KNOW_YOUR_MP':panel('record');break;
    case 'WALK_ATTENTION':controls('','',true);break;
    case 'ATTENTION_NOTICED':controls('What caught your attention?','PAY ATTENTION. ↗');announce('What caught your attention?');break;
    case 'WALK_END':controls('','',true);break;
    case 'PAY_ATTENTION':panel('attention');break;
    case 'END':panel('ending');break;
  }
  if(!$('#walk-controls').hidden){($('#action').hidden?$('#advance'):$('#action')).focus({preventScroll:true});}
}
function action(){if(state==='LOOK_UP_AVAILABLE'){targetPitch=.55;return;}const next={TREE_NOTICED:'TREE_SCORE',CIVIC:'KNOW_YOUR_MP',ATTENTION_NOTICED:'PAY_ATTENTION'}[state];if(next)enter(next);}
function canWalk(){return ['WALK_TREE','WALK_CIVIC','WALK_ATTENTION','WALK_END'].includes(state)&&!$('#projects').open;}
function advance(amount){if(!canWalk())return;const limits=state==='WALK_TREE'?[0,7]:state==='WALK_CIVIC'?[7,22]:state==='WALK_ATTENTION'?[22,25]:[25,28];distance=Math.min(limits[1],Math.max(limits[0],distance+amount));if(distance>=limits[1])enter(state==='WALK_TREE'?'LOOK_UP_AVAILABLE':state==='WALK_CIVIC'?'CIVIC':state==='WALK_ATTENTION'?'ATTENTION_NOTICED':'END');}
function clearMovement(){moving=0;clearTimeout(holdTimer);pointer=null;}
async function init(){
  if(reduced.matches)return readVersion('reduced-motion');
  if(navigator.connection?.saveData||navigator.deviceMemory&&navigator.deviceMemory<=2)return readVersion('low-capability');
  const probe=document.createElement('canvas');const gl=probe.getContext('webgl2');if(!gl)return readVersion('webgl-unavailable');gl.getExtension('WEBGL_lose_context')?.loseContext();
  const timeout=setTimeout(()=>readVersion('loading-timeout'),9000);
  try{const module=await import('./3d/world.js');if(!alive)return;world=module.createWorld($('#world'));world.view(distance,yaw,pitch);world.draw(time);clearTimeout(timeout);
    document.body.classList.add('spatial');document.body.dataset.state=state;panels.forEach(p=>p.hidden=p.id!=='arrival');$('#start').hidden=false;$('#pause').hidden=false;
  }catch(error){clearTimeout(timeout);return readVersion('renderer-failure');}
  $('#start').onclick=()=>enter('WALK_TREE');$('#action').onclick=action;
  // The tap that ends the route must not activate the newly revealed restart link.
  const restart=$('#restart-walk');let restartPressed=false;
  restart.addEventListener('pointerdown',()=>restartPressed=state==='END');
  restart.addEventListener('pointercancel',()=>restartPressed=false);
  restart.addEventListener('click',e=>{if(e.detail>0&&!restartPressed)e.preventDefault();restartPressed=false;});
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const next={'tree-done':'WALK_CIVIC','record-done':'WALK_ATTENTION','attention-done':'WALK_END'}[b.dataset.action];enter(next);});
  $('#pause').onclick=()=>{paused=!paused;clearMovement();$('#pause').textContent=paused?'Resume motion':'Pause motion';$('#pause').setAttribute('aria-pressed',String(paused));announce(paused?'Street motion paused.':'Street motion resumed.');};
  $('#projects').addEventListener('toggle',clearMovement);
  $('#advance').addEventListener('pointerdown',e=>{if(!canWalk()||paused)return;e.preventDefault();pressedAt=performance.now();$('#advance').setPointerCapture(e.pointerId);moving=1;});
  $('#advance').addEventListener('pointerup',()=>{if(!paused&&performance.now()-pressedAt<250)advance(1);clearMovement();});$('#advance').addEventListener('pointercancel',clearMovement);$('#advance').addEventListener('lostpointercapture',clearMovement);$('#advance').addEventListener('contextmenu',e=>e.preventDefault());
  $('#advance').addEventListener('click',e=>{if(e.detail===0&&!paused)advance(1);});$('#back').onclick=()=>{if(!paused)advance(-.65);};
  window.addEventListener('keydown',e=>{if($('#projects').open||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='Escape'){clearMovement();return;}if(canWalk()&&!paused&&['w','W','ArrowUp','s','S','ArrowDown'].includes(e.key)){e.preventDefault();moving=['w','W','ArrowUp'].includes(e.key)?1:-.5;}if(state==='LOOK_UP_AVAILABLE'&&e.key==='ArrowUp'){e.preventDefault();targetPitch=Math.min(.75,targetPitch+.12);}});
  window.addEventListener('keyup',e=>{if(['w','W','ArrowUp','s','S','ArrowDown'].includes(e.key))moving=0;});window.addEventListener('blur',clearMovement);
  window.addEventListener('keydown',e=>{if(paused||$('#projects').open||!['WALK_TREE','LOOK_UP_AVAILABLE','TREE_NOTICED','WALK_CIVIC','CIVIC','WALK_ATTENTION','ATTENTION_NOTICED','WALK_END'].includes(state))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();targetYaw=Math.max(-.9,Math.min(.9,targetYaw+(e.key==='ArrowLeft'?.08:-.08)));}if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();targetPitch=Math.max(-.6,Math.min(.85,targetPitch+(e.key==='PageUp'?.1:-.1)));}});
  const canvas=world.canvas;
  canvas.addEventListener('pointerdown',e=>{if(paused||$('#projects').open||!['WALK_TREE','LOOK_UP_AVAILABLE','WALK_CIVIC','CIVIC','WALK_ATTENTION','ATTENTION_NOTICED','WALK_END'].includes(state))return;pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!pointer)return;targetYaw=Math.max(-.9,Math.min(.9,targetYaw-(e.clientX-pointer.x)*.003));targetPitch=Math.max(-.6,Math.min(.85,targetPitch-(e.clientY-pointer.y)*.003));pointer={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',()=>pointer=null);canvas.addEventListener('pointercancel',()=>pointer=null);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();readVersion('context-lost');});
  window.addEventListener('resize',()=>{world.resize();world.draw(time);});
  document.addEventListener('visibilitychange',()=>{clearMovement();active=!document.hidden;previous=0;if(active&&!raf)raf=requestAnimationFrame(frame);});
  reduced.addEventListener('change',e=>{if(e.matches)readVersion('reduced-motion');});
  function frame(now){raf=0;if(!active||!alive)return;const elapsed=previous?(now-previous)/1000:0;previous=now;const dt=Math.min(elapsed,.15);
    const menuOpen=$('#projects').open;
    if(!paused&&!menuOpen){time+=dt;advance(moving*dt*1.65);const damping=1-Math.exp(-dt*9);yaw+=(targetYaw-yaw)*damping;pitch+=(targetPitch-pitch)*damping;if(state==='LOOK_UP_AVAILABLE'&&pitch>.43)enter('TREE_NOTICED');}
    world.view(distance,yaw,pitch);if(!paused&&!menuOpen)world.draw(time);
    if(!paused&&!menuOpen&&elapsed>0){frames++;if(elapsed>.085)slowFrames++;if(frames>=180){if(slowFrames>100){if(qualityLowered)return readVersion('slow-renderer');world.renderer.setPixelRatio(1);world.renderer.shadowMap.enabled=false;qualityLowered=true;}frames=slowFrames=0;}}
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  // Read-only diagnostics used by local QA. No telemetry, storage or fingerprinting.
  window.walkDiagnostics=()=>({state,distance,yaw,pitch,time,paused,stats:world.stats()});
}
init().catch(()=>readVersion('unexpected-failure'));
