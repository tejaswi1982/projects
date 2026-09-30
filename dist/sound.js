// Optional street sound for the 3D walk, loaded only after the visitor chooses Sound on.
// Everything here is synthesised in the browser from seeded noise, simple filters and sine partials:
// no recordings, downloads or third-party audio (see AUDIO-SOURCES.md). No music.
// Loudness order: footsteps, then the quiet city bed, then local cues (leaves, a distant tap, cloth).
const LEVEL={step:.2,traffic:.042,tyres:.06,hum:.045,air:.006,horn:.022,rustle:.022,tap:.02,flutter:.13};

export function createSound(ctx){
  const rate=ctx.sampleRate,low=22050;
  let seed=917;const rnd=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const noise=n=>{const a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=rnd()*2-1;return a;};
  // RBJ biquad (low, high, or constant-peak band), applied in place.
  function filter(a,type,f,q,sr){const w=2*Math.PI*f/sr,c=Math.cos(w),s=Math.sin(w)/(2*q),a0=1+s,a1=-2*c,a2=1-s;let b0,b1,b2;
    if(type==='low'){b0=b2=(1-c)/2;b1=1-c;}else if(type==='high'){b0=b2=(1+c)/2;b1=-(1+c);}else{b0=s;b1=0;b2=-s;}
    let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<a.length;i++){const x=a[i],y=(b0*x+b1*x1+b2*x2-a1*y1-a2*y2)/a0;x2=x1;x1=x;y2=y1;y1=y;a[i]=y;}return a;}
  function normal(a,target,byRms){let m=0;for(const v of a)m=byRms?m+v*v:Math.max(m,Math.abs(v));m=byRms?Math.sqrt(m/a.length):m;const g=m?target/m:0;for(let i=0;i<a.length;i++)a[i]*=g;return a;}
  function fadeOut(a,sr,seconds){const n=Math.min(a.length,Math.floor(seconds*sr));for(let i=0;i<n;i++)a[a.length-1-i]*=i/n;return a;}
  // A burst of band-limited noise: linear attack, exponential decay, starting t0 seconds in.
  function burst(out,sr,t0,attack,decay,f,q,gain,type='band'){
    const start=Math.floor(t0*sr),n=Math.min(out.length-start,Math.floor((attack+decay*7)*sr));if(n<=0)return;const b=filter(noise(n),type,f,q,sr);
    for(let i=0;i<n;i++){const t=i/sr;out[start+i]+=b[i]*(t<attack?t/attack:Math.exp(-(t-attack)/decay))*gain;}
  }
  // Seamless loop: render a little extra and cross-fade the tail into the head (equal power, uncorrelated noise).
  function loop(seconds,sr,make){const n=Math.floor(seconds*sr),m=Math.floor(.06*sr),a=make(n+m);for(let i=0;i<m;i++){const t=i/m;a[i]=a[i]*Math.sqrt(t)+a[n+i]*Math.sqrt(1-t);}return a.subarray(0,n);}
  const brown=n=>{const a=noise(n);let y=0;for(let i=0;i<n;i++){y=y*.996+a[i]*.06;a[i]=y;}return normal(filter(a,'high',22,.7,low),.3,true);};
  const pink=n=>{const a=noise(n);let b0=0,b1=0,b2=0;for(let i=0;i<n;i++){const w=a[i];b0=.99765*b0+w*.099046;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;a[i]=b0+b1+b2+w*.1848;}return normal(a,.3,true);};
  const white=n=>normal(noise(n),.3,true);
  function buffer(data,sr){const b=ctx.createBuffer(1,data.length,sr);b.getChannelData(0).set(data);return b;}

  // FOOTSTEPS: ordinary city shoes on dry paving. A soft rubber heel (low thud, small dry click, no leather clack),
  // the sole rolling down 50 to 85 ms later, and a little grit. Eight variants; pitch and level vary per step.
  function footstep(){
    const sr=rate,out=new Float32Array(Math.floor(sr*.3)),sole=.05+rnd()*.035,f0=108+rnd()*35;
    for(let i=0;i<Math.floor(.14*sr);i++){const t=i/sr;out[i]+=Math.sin(2*Math.PI*f0*t*(1-t*1.5))*Math.min(1,t/.002)*Math.exp(-t/.024)*.5;}
    burst(out,sr,0,.0015,.016,150+rnd()*60,1.1,1);
    burst(out,sr,0,.001,.011,480+rnd()*180,1,.55);
    burst(out,sr,.0005,.0005,.0045,1800+rnd()*900,.9,.2+rnd()*.12);
    burst(out,sr,sole,.004,.022,850+rnd()*450,.8,.45+rnd()*.2);
    burst(out,sr,sole,.003,.012,230+rnd()*50,1.2,.35);
    const grit=.1+rnd()*.12;for(let t=.004;t<sole+.06;t+=.0015)if(rnd()<.28)burst(out,sr,t,.0002,.0006,3200+rnd()*2500,.7,grit*rnd()*Math.sin(Math.PI*t/(sole+.06)));
    filter(out,'high',70,.7,sr);filter(out,'low',6500,.7,sr);return normal(fadeOut(out,sr,.02),.95);
  }
  // LEAVES: soft hiss plus many tiny leaf ticks whose density follows a slow gust over the loop.
  function rustle(seconds){
    const sr=low,n=Math.floor(seconds*sr),gust=i=>{const t=i/n*Math.PI*2;return .55+.25*Math.sin(t*2+.4)+.2*Math.sin(t*3+1.7);};
    const out=loop(seconds,sr,m=>{const a=filter(noise(m),'band',4200,.6,sr);for(let i=0;i<m;i++)a[i]*=.22*gust(i%n);return a;});
    for(let g=0;g<seconds*260;g++){const i=Math.floor(rnd()*n);if(rnd()>gust(i))continue;const len=Math.floor(sr*(.003+rnd()*.014)),tick=filter(noise(len),'band',2400+rnd()*4200,1.2,sr),amp=.5*rnd()*rnd();for(let k=0;k<len;k++)out[(i+k)%n]+=tick[k]*Math.sin(Math.PI*k/len)*amp;}
    return normal(out,.3,true);
  }
  // DISTANT METAL TAP: free-bar partials, short strike, softened by distance with a faint street tail.
  function tap(f0){
    const sr=low,n=Math.floor(sr*1.1),out=new Float32Array(n);
    [[1,.38,1],[2.76,.19,.5],[5.4,.09,.26],[8.93,.05,.12]].forEach(([ratio,decay,amp],p)=>{const f=f0*ratio;if(f<sr/2.3)for(let i=0;i<n;i++){const t=i/sr;out[i]+=Math.sin(2*Math.PI*f*t+p)*Math.exp(-t/decay)*amp*Math.min(1,t/.0008);}});
    burst(out,sr,0,.0003,.0015,4500,.8,.4);filter(out,'low',3200,.7,sr);
    const tail=filter(noise(n),'band',f0,4,sr);for(let i=0;i<n;i++){const t=i/sr;out[i]+=tail[i]*Math.exp(-t/.3)*Math.min(1,t/.02)*.25;}
    return normal(fadeOut(out,sr,.1),.95);
  }
  // DISTANT HORN: one or two short blasts, heavily low-passed, with two soft reflections from the buildings.
  function horn(double){
    const sr=low,n=Math.floor(sr*1.4),dry=new Float32Array(n),f1=400+rnd()*40,f2=f1*1.19;
    for(const [t0,len] of double?[[0,.16],[.27,.2]]:[[0,.36]])for(let i=Math.floor(t0*sr);i<Math.min(n,Math.floor((t0+len+.12)*sr));i++){const t=i/sr-t0,e=Math.min(1,t/.02)*(t<len?1:Math.exp(-(t-len)/.03));let v=0;for(let h=1;h<=8;h++)v+=(Math.sin(2*Math.PI*f1*h*t)+Math.sin(2*Math.PI*f2*h*t+h))/h;dry[i]+=v*e;}
    filter(dry,'low',1100,.7,sr);filter(dry,'low',1400,.6,sr);filter(dry,'high',300,.7,sr);
    const out=dry.slice(),d1=Math.floor(.09*sr),d2=Math.floor(.21*sr);for(let i=n-1;i>=0;i--)out[i]+=(i>=d1?dry[i-d1]*.35:0)+(i>=d2?dry[i-d2]*.18:0);
    return normal(fadeOut(out,sr,.2),.95);
  }

  const master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  const bus=(to=master)=>{const g=ctx.createGain();g.connect(to);return g;};
  const steps=bus(),duck=bus(),bed=bus(duck),cues=bus();
  const panner=value=>{if(!ctx.createStereoPanner)return ctx.createGain();const p=ctx.createStereoPanner();p.pan.value=value;return p;};
  function chain(nodes){for(let i=0;i<nodes.length-1;i++)nodes[i].connect(nodes[i+1]);return nodes;}
  function biquad(type,f,q){const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;return b;}
  function gain(value){const g=ctx.createGain();g.gain.value=value;return g;}
  const sources=[];
  function play(buf,offset=0){const s=ctx.createBufferSource();s.buffer=buf;s.loop=true;s.start(0,offset%buf.duration);sources.push(s);return s;}

  // CITY BED: never a short loop. Stereo traffic wash from two brown-noise loops of different lengths, distant
  // tyre noise that swells and drifts as cars pass at random, a faint low hum and a little air.
  const traffic=[],tyreBand=biquad('bandpass',650,.6),tyreGain=gain(LEVEL.tyres*.5),tyrePan=panner(0),flutter=gain(0);
  function city(){
    const whiteLoop=buffer(loop(5.3,low,white),low),pinkLoop=buffer(loop(6.1,low,pink),low);
    for(const [seconds,side] of [[7.3,-.6],[9.7,.6]]){const g=gain(LEVEL.traffic);chain([play(buffer(loop(seconds,low,brown),low)),biquad('lowpass',360,.5),g,panner(side),bed]);traffic.push(g);}
    chain([play(pinkLoop),tyreBand,tyreGain,tyrePan,bed]);
    chain([play(pinkLoop,2.3),biquad('bandpass',105,1.6),gain(LEVEL.hum),bed]);
    chain([play(whiteLoop,1.7),biquad('highpass',3800,.7),biquad('lowpass',9500,.7),gain(LEVEL.air),bed]);
    // CLOTH: soft flutter whose level follows the cloth's actual movement (zero when it is still).
    chain([play(whiteLoop,3.1),biquad('bandpass',520,.7),biquad('highpass',160,.7),flutter,cues]);
  }

  // Footsteps are ready at once; the bed, leaf loops and one-shots are rendered over the next frames
  // (the bed fades in anyway), so turning sound on never stalls the walk.
  const stepBuffers=[],taps=[],horns=[];let leaves=null;
  for(let i=0;i<8;i++)stepBuffers.push(buffer(footstep(),rate));
  const later=[city,()=>{leaves=gain(0);const pair=[[7.3,-.35],[11.1,.35]].map(([seconds,side])=>chain([play(buffer(rustle(seconds),low)),panner(side),leaves]));leaves.connect(cues);return pair;},
    ()=>{for(const f of [820,960,1130])taps.push(buffer(tap(f),low));},()=>{horns.push(buffer(horn(false),low),buffer(horn(true),low));}];
  (function next(){const job=later.shift();if(job)setTimeout(()=>{job();next();},30);})();

  let on=false,token=0,lastStep=-1,count=0,lastParams=0;
  const now=()=>ctx.currentTime;
  let nextDrift=now()+4,nextCar=now()+3+rnd()*6,nextTap=now()+3,nextHorn=now()+45+rnd()*60;
  const targets=new Map();
  function toward(param,value,time){if(Math.abs((targets.get(param)??-1)-value)<.0004)return;targets.set(param,value);param.setTargetAtTime(value,now(),time);}
  function fade(to,seconds){const t=now(),g=master.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(to,t+seconds);}
  const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  function oneShot(buf,level,to,spread=.03){if(!buf)return;const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buf;s.playbackRate.value=1+(rnd()-.5)*2*spread;g.gain.value=level;s.connect(g);g.connect(to);s.onended=()=>g.disconnect();s.start();}
  // Hidden tab: quick fade, then suspend. Visible again: resume and fade back in, never at full volume at once.
  document.addEventListener('visibilitychange',()=>{if(!on)return;const t=++token;if(document.hidden){fade(0,.12);setTimeout(()=>{if(t===token&&document.hidden)ctx.suspend?.();},150);}else Promise.resolve(ctx.resume?.()).then(()=>{if(t===token&&on){master.gain.value=0;fade(1,1.2);}},()=>{});});

  return {
    enable(){on=true;token++;Promise.resolve(ctx.resume?.()).catch(()=>{});fade(1,1);},
    disable(){on=false;const t=++token;fade(0,.25);setTimeout(()=>{if(t===token&&!on)ctx.suspend?.();},320);},
    // One footstep per footfall from the walk: never repeats the previous variant, pitch ±4%, tiny level change.
    step(intensity){if(!on)return;let k=Math.floor(rnd()*stepBuffers.length);if(k===lastStep)k=(k+1)%stepBuffers.length;lastStep=k;count++;oneShot(stepBuffers[k],LEVEL.step*(.62+.38*intensity)*(1+(rnd()-.5)*.12),steps,.04);},
    update(info){
      if(!on)return;const t=now(),d=info.distance,still=info.paused;
      if(t-lastParams>.08){lastParams=t;
        toward(duck.gain,info.panel?.7:1,.5);
        if(leaves)toward(leaves.gain,still?0:LEVEL.rustle*smooth(2.5,6,d)*(1-smooth(11,15,d))*(.55+.45*info.gust),.25);
        toward(flutter.gain,still?0:LEVEL.flutter*smooth(17,22,d)*(1-smooth(29,32,d))*Math.min(1,info.cloth),.1);
      }
      if(t>=nextDrift){nextDrift=t+3+rnd()*6;for(const g of traffic)g.gain.setTargetAtTime(LEVEL.traffic*(.7+rnd()*.3),t,2.5);}
      if(t>=nextCar){const span=5+rnd()*4,from=rnd()<.5?-.7:.7;nextCar=t+span+2+rnd()*12;
        tyreGain.gain.setTargetAtTime(LEVEL.tyres*(.9+rnd()*.5),t,span*.25);tyreGain.gain.setTargetAtTime(LEVEL.tyres*.5,t+span*.55,span*.2);
        tyreBand.frequency.setTargetAtTime(760,t,span*.3);tyreBand.frequency.setTargetAtTime(600,t+span*.5,span*.25);
        if(tyrePan.pan){tyrePan.pan.setValueAtTime(from,t);tyrePan.pan.linearRampToValueAtTime(-from,t+span);}}
      if(!still&&d>14&&d<27.5&&t>=nextTap){nextTap=t+6+rnd()*8;oneShot(taps[Math.floor(rnd()*taps.length)],LEVEL.tap*(.7+rnd()*.3),cues);}
      if(t>=nextHorn){nextHorn=t+70+rnd()*100;oneShot(horns[rnd()<.6?0:1],LEVEL.horn*(.7+rnd()*.3),bed,.02);}
    },
    diagnostics:()=>({state:ctx.state,on,steps:count,master:+master.gain.value.toFixed(3),ready:{steps:stepBuffers.length,leaves:!!leaves,taps:taps.length,horns:horns.length}})
  };
}
