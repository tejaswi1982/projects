import * as T from '../vendor/three.module.js';

// V2.1 polish. Each item is independent: set it to false (or review with ?polish=-item)
// to restore the approved v2 street for that item alone. See V2.1-POLISH-CHANGES.md.
const POLISH={tree:true,grounding:true,cloth:true,sky:true,wires:true,windows:true,paving:true};

// An authored architectural street, measured in metres. No geographic claims.
export function createWorld(container,options={}) {
  const polish={...POLISH,...options.polish};
  const renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<800?1.25:1.5));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  container.append(renderer.domElement);
  // SKY: the fog takes the horizon tone so distant fade stays continuous with the sky.
  const horizon=polish.sky?'#d2d4c4':'#cbd2c3';
  const scene=new T.Scene();scene.background=new T.Color(horizon);scene.fog=new T.Fog(horizon,29,70);
  const camera=new T.PerspectiveCamera(58,1,.1,85);
  scene.add(new T.HemisphereLight('#f6efd9','#696950',2.3));
  const sun=new T.DirectionalLight('#fff1cf',3.1);sun.position.set(-10,17,3);sun.target.position.set(0,0,-16);scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-17,right:17,top:23,bottom:-23,near:1,far:65});sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;
  let seed=1234;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  // Polish detail draws from its own sequence, so every approved seeded position stays where it was.
  let seed2=4321;const rand2=()=>{seed2=(seed2*16807)%2147483647;return(seed2-1)/2147483646;};
  const burn=n=>{for(let i=0;i<n;i++)rand();};
  // Seeded paper/concrete grain is authored texture, never documentary evidence.
  function grain(base){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,256,256);for(let i=0;i<9000;i++){x.fillStyle=`rgba(${rand()>.5?'255,248,224':'45,42,31'},${rand()*.13})`;x.fillRect(rand()*256,rand()*256,1+rand()*3,1+rand()*2);}for(let i=0;i<22;i++){x.strokeStyle='rgba(54,49,36,.09)';x.beginPath();let a=rand()*256,b=rand()*256;x.moveTo(a,b);x.lineTo(a+rand()*70,b+rand()*4);x.stroke();}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
  const materials={},extras=[];
  function mat(name,color,texture=false){return materials[name]??=(new T.MeshLambertMaterial({color:texture?'#ffffff':color,map:texture?grain(color):null}));}
  const concrete=mat('concrete','#c4baa2',true),road=mat('road','#787867',true),wall=mat('wall','#c1baa5',true),dark=mat('dark','#3e4943'),rust=mat('rust','#916b4f',true),white=mat('white','#ddd4b9'),leaf=mat('leaf','#64724e',true),leaf2=mat('leaf2','#899270',true),bark=mat('bark','#645b44',true),ochre=mat('ochre','#a89b70',true);
  const cube=new T.BoxGeometry(1,1,1), cylinder=new T.CylinderGeometry(1,1,1,12), square=new T.PlaneGeometry(1,1);
  function box(w,h,d,x,y,z,m=concrete,parent=scene){const a=new T.Mesh(cube,m);a.scale.set(w,h,d);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
  function quad(w,h,x,y,z,rx,ry,m){const a=new T.Mesh(square,m);a.scale.set(w,h,1);a.position.set(x,y,z);a.rotation.set(rx,ry,0);a.castShadow=true;a.receiveShadow=true;scene.add(a);return a;}
  function branch(a,b,r){let av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);let mesh=new T.Mesh(cylinder,bark);mesh.scale.set(r,v.length(),r*.78);mesh.position.copy(av.add(bv).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());mesh.castShadow=true;scene.add(mesh);}
  // GROUNDING: surface heights (road, pavement, rust work mat). Standing objects now start below them.
  const ROAD=-.045,PAVE=.11,MAT=.065,SINK=polish.grounding?.12:0;
  const groundAt=(x,z)=>x>-2.4&&x<.3&&z<7&&z>-51?PAVE:x>.5&&x<3.5&&z<-23.2&&z>-26?MAT:ROAD;
  const spots=[];
  function spot(x,z,w,d,turn=0,strength=1,y=groundAt(x,z)){if(polish.grounding)spots.push([x,y,z,w,d,turn,strength]);}
  box(polish.grounding?22.5:12,.15,70,polish.grounding?1.75:2,-.12,-23,road);box(2.7,.2,58,-1.05,.01,-22,concrete);box(.22,.27,58,.38,.045,-22,white);box(.65,.16,2,-1.2,.15,2,concrete);
  // Paving joints and repaired patches read as material, not a UI grid.
  if(polish.paving){
    // PAVING: joints painted into one tile texture as a darker, warmer paving tone at ~60% of the old
    // rust contrast, over the same seeded concrete grain, with a very small tone shift per tile.
    const c=document.createElement('canvas');c.width=512;c.height=1024;const x=c.getContext('2d');
    const pattern=x.createPattern(concrete.map.image,'repeat');pattern.setTransform?.(new DOMMatrix([.893,0,0,.84,0,0]));
    x.fillStyle=pattern;x.fillRect(0,0,512,1024);
    for(let col=0;col<4;col++)for(let row=0;row<8;row++){const v=rand2()*2-1;x.fillStyle=v<0?`rgba(74,62,42,${-v*.045})`:`rgba(255,249,232,${v*.05})`;x.fillRect(col*128,row*128,128,128);}
    x.globalCompositeOperation='multiply';
    x.fillStyle='rgb(210,201,185)';const joint=(a,b,w,h)=>x.fillRect(a,b,w,h);
    for(const px of [0,128,256,384,512])joint(px-1,0,2,1024);
    for(let row=0;row<=8;row++)joint(0,row*128-1.3,512,2.6);
    const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    const g=new T.PlaneGeometry(2.67,58);g.rotateX(-Math.PI/2);g.translate(-1.065,.113,-22);
    const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+2)/3.2,(5-p.getZ(i))/6.8);
    const paving=new T.Mesh(g,new T.MeshLambertMaterial({map:texture,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));paving.receiveShadow=true;paving.userData.solo=true;scene.add(paving);extras.push(paving.material,texture);
  }else for(let z=5;z>-50;z-=.85){box(2.55,.006,.018,-1.04,.118,z,rust);for(let x=-2;x<.1;x+=.8)box(.012,.006,.82,x,.119,z-.42,rust);}
  box(.22,1.6,59,-2.6,.8,-23,wall);box(.4,.15,59,-2.6,1.65,-23,white);
  for(let z=4;z>-51;z-=4){box(.4,2,.4,-2.6,1,z,white);for(let q=0;q<6;q++)box(.04,.75,.04,-2.6,2.05,z-q*.64,dark);box(.06,.04,4,-2.6,2.42,z-1.8,dark);}
  // WINDOWS: the pane sits on the wall plane behind a 10 cm reveal (head soffit, jambs and their faces)
  // in the facade's own material, so it reads as depth rather than a sticker. The existing ledge is the sill.
  function recess(face,out,y,wz,m){
    const W=1.45,d=.1,f=.07,ry=out*Math.PI/2;
    box(.012,W,W,face+out*.006,y,wz,dark);
    quad(W+2*f,f,face+out*d,y+W/2+f/2,wz,0,ry,m);quad(f,W,face+out*d,y,wz-W/2-f/2,0,ry,m);quad(f,W,face+out*d,y,wz+W/2+f/2,0,ry,m);
    quad(d,W,face+out*d/2,y+W/2,wz,Math.PI/2,0,m);quad(d,W,face+out*d/2,y,wz-W/2,0,0,m);quad(d,W,face+out*d/2,y,wz+W/2,0,Math.PI,m);
  }
  // Residential facades, balconies, grilles, utility boxes and rooftop tanks.
  for(const side of [-1,1])for(let i=0;i<5;i++){
    const x=side<0?-6.8:10.2,z=2-i*12,h=9+(i%3)*2,facade=i%2?concrete:wall;
    box(5,h+SINK,10,x,(h-SINK)/2,z,facade);box(5.15,.16,10.2,x,h,z,white);
    for(let y=2;y<h-1;y+=2.4)for(let j=0;j<3;j++){
      const wx=x+(side<0?2.52:-2.52),wz=z-3+j*3;
      if(polish.windows)recess(x+(side<0?2.5:-2.5),side<0?1:-1,y,wz,facade);else box(.045,1.45,1.45,wx,y,wz,dark);
      box(.8,.12,2,wx,y-.78,wz,concrete);
      for(let k=0;k<5;k++)box(.055,1.5,.025,wx+side*-.08,y,wz-.64+k*.32,rust);
      box(.5,.55,.6,wx+side*-.2,y-.1,wz+1,white);
    }
    const tank=new T.Mesh(new T.CylinderGeometry(.8,.8,1.4,16),dark);tank.position.set(x,h+.7,z);scene.add(tank);
  }
  for(let i=0;i<4;i++){box(.12,7+SINK,.12,1.1,(7-SINK)/2,-i*14,dark);box(1.6,.08,.08,1.6,6.4,-i*14,dark);spot(1.1,-i*14,.5,.5,0,.9);}
  const wireMat=new T.LineBasicMaterial({color:'#535747'});
  if(polish.wires){
    // WIRES: every span leaves a crossarm insulator, sags once and lands on the next crossarm.
    const arms=[.88,1.72,2.32],points=[];
    for(let i=0;i<4;i++)for(const a of arms)box(.035,.07,.035,a,6.475,-i*14,dark);
    arms.forEach((a,w)=>{for(let s=0;s<4;s++){const z0=14-s*14,sag=.3+w*.03;for(let k=0;k<16;k++)for(const u of [k/16,(k+1)/16])points.push(new T.Vector3(a,6.51-sag*4*u*(1-u),z0-u*14));}});
    scene.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(points),wireMat));
  }else for(let x=0;x<3;x++){let pts=[];for(let i=0;i<=64;i++)pts.push(new T.Vector3(1+x*.18,6.3-Math.sin((i%16)/16*Math.PI)*.3,6-i));scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),wireMat));}
  const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=128;const leafContext=leafCanvas.getContext('2d');
  for(let i=0;i<35;i++){leafContext.fillStyle=i%2?'#8a966f':'#566547';leafContext.beginPath();leafContext.ellipse(12+rand()*104,12+rand()*104,4+rand()*8,2+rand()*3,rand()*6,0,Math.PI*2);leafContext.fill();}
  const leafTexture=new T.CanvasTexture(leafCanvas);leafTexture.colorSpace=T.SRGBColorSpace;
  const foliage=new T.MeshLambertMaterial({map:leafTexture,alphaTest:.5,side:T.DoubleSide});extras.push(foliage,leafTexture);
  // TREE: canopy sway runs in the vertex shader from the shared clock, so it freezes with Pause motion.
  const sway={value:new T.Vector2()};
  if(polish.tree)foliage.onBeforeCompile=shader=>{
    shader.uniforms.uSway=sway;
    shader.vertexShader='attribute vec2 aSway;\nuniform vec2 uSway;\n'+shader.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.0);
#ifdef USE_INSTANCING
mvPosition=instanceMatrix*mvPosition;
#endif
mvPosition.xyz+=vec3(.93,.1,.35)*aSway.x*uSway.y*(sin(uSway.x*.95+aSway.y)*.7+sin(uSway.x*1.63+aSway.y*1.7)*.3);
mvPosition=modelViewMatrix*mvPosition;
gl_Position=projectionMatrix*mvPosition;`);
  };
  // A tapered, curved limb: rings along a Catmull-Rom curve, radius easing from r0 to a fine tip.
  const onCurve=new T.Vector3(),around=new T.Vector3();
  function limb(points,r0,r1,radial,segments,flare=0,profile=null){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),frames=curve.computeFrenetFrames(segments,false),pos=[],nor=[],uv=[],index=[];
    for(let i=0;i<=segments;i++){const t=i/segments,r=(profile?profile(t):r0+(r1-r0)*t**.85)+flare*Math.max(0,1-t*5)**2;curve.getPointAt(t,onCurve);const n=frames.normals[i],b=frames.binormals[i];
      for(let j=0;j<=radial;j++){const a=j/radial*Math.PI*2,c=Math.cos(a),s=Math.sin(a);around.set(c*n.x+s*b.x,c*n.y+s*b.y,c*n.z+s*b.z);pos.push(onCurve.x+around.x*r,onCurve.y+around.y*r,onCurve.z+around.z*r);nor.push(around.x,around.y,around.z);uv.push(j/radial,t);}}
    for(let i=0;i<segments;i++)for(let j=0;j<radial;j++){const a=i*(radial+1)+j,b=a+radial+1;index.push(a,a+1,b,b,a+1,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);
    const mesh=new T.Mesh(g,bark);mesh.castShadow=true;scene.add(mesh);return curve;
  }
  function fork(parent,t,r,heading,length,rise,tips,radial=5){
    const start=parent.getPointAt(t),along=parent.getTangentAt(t),dx=Math.cos(heading),dz=Math.sin(heading);
    const end=[start.x+dx*length,start.y+rise,start.z+dz*length];
    limb([[start.x-along.x*.06,start.y-along.y*.06,start.z-along.z*.06],[start.x+dx*length*.5,start.y+rise*.75,start.z+dz*length*.5],end],r,.018,radial,5);tips.push(end);
  }
  // Hero rain tree: a kerbed pit, a trunk that splits near 2.4 m into four tapering limbs which fork
  // once or twice and disappear into a broader, higher canopy of paper-cut leaf cards.
  function heroTree(tx,tz){
    const P=.45,K=.07;
    box(2*P,.06,K,tx,.135,tz-P+K/2,concrete);box(2*P,.06,K,tx,.135,tz+P-K/2,concrete);box(K,.06,2*P-2*K,tx-P+K/2,.135,tz,concrete);box(K,.06,2*P-2*K,tx+P-K/2,.135,tz,concrete);
    box(2*P-2*K,.012,2*P-2*K,tx,.113,tz,bark);
    // The trunk runs on as the leading limb (no trunk top or stub); three more limbs leave it at ~2.4 m.
    const S=[tx-.1,2.4,tz-.08],tips=[];
    for(let k=0;k<4;k++){
      const heading=.5+k*Math.PI/2+(rand2()-.5)*.7,R=(k?2.6:2.1)+rand2()*.8,H=(k?5.25:5.8)+rand2()*.7,dx=Math.cos(heading),dz=Math.sin(heading);
      const at=(f,h)=>[S[0]+dx*R*f,h,S[2]+dz*R*f];
      const main=k?limb([[S[0]-dx*.02,S[1]-.38,S[2]-dz*.02],at(.1,S[1]+.25),at(.35,3.7),at(.68,4.7+(H-5.25)*.5),at(1,H)],.155,.025,7,9,.035)
        :limb([[tx+.01,-.2,tz+.01],[tx,.8,tz],[tx-.04,1.6,tz-.03],S,at(.28,3.65),at(.64,4.85),at(1,H)],0,0,9,15,.1,t=>t<.38?.25-.06*t/.38:.19-.165*((t-.38)/.62)**.85);
      tips.push(at(1,H));
      const forks=rand2()<.55?2:1;
      for(let f=0;f<forks;f++){const t=f?.74:.5;fork(main,t,(.15+(.025-.15)*t**.85)*.72,heading+(rand2()<.5?-1:1)*(.55+rand2()*.35),1.3+rand2()*.7,.45+rand2()*.5,tips);}
    }
    const clusters=tips.map(([x,y,z])=>[x,y+.4,z,1.25+rand2()*.4,.55+rand2()*.2]);
    for(let k=0;k<5;k++){const a=rand2()*Math.PI*2,r=1+rand2()*2.2;clusters.push([S[0]+Math.cos(a)*r,6.2+rand2()*.5,S[2]+Math.sin(a)*r,1.3+rand2()*.4,.5+rand2()*.2]);}
    clusters.push([S[0],6.6,S[2],1.6,.55]);
    const count=1100,inst=new T.InstancedMesh(new T.PlaneGeometry(1,1),foliage,count),dummy=new T.Object3D(),tint=new T.Color(),motion=new Float32Array(count*2);
    const weights=clusters.map(c=>c[3]*c[3]*c[4]),total=weights.reduce((a,b)=>a+b);
    let i=0;
    clusters.forEach((c,ci)=>{
      const n=ci===clusters.length-1?count-i:Math.round(count*weights[ci]/total),phase=rand2()*6.28,shade=1+(rand2()-.5)*.1;
      for(let k=0;k<n&&i<count;k++,i++){
        let ux,uy,uz,l;do{ux=rand2()*2-1;uy=rand2()*2-1;uz=rand2()*2-1;l=ux*ux+uy*uy+uz*uz;}while(l>1);
        const pull=.65+.35*rand2();dummy.position.set(c[0]+ux*c[3]*pull,c[1]+uy*c[4]*pull,c[2]+uz*c[3]*pull);
        dummy.scale.set(.6+rand2()*.65,.6+rand2()*.65,1);dummy.rotation.set(-Math.PI/2+rand2()*1.5,rand2()*6,rand2()*6);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
        // Darker olive underside, slightly lighter upper groups, small per-cluster variation.
        const up=T.MathUtils.smoothstep(uy*pull,-.7,.75);tint.setRGB((.7+.38*up)*shade,(.76+.32*up)*shade,(.6+.4*up)*shade);inst.setColorAt(i,tint);
        motion[i*2]=.011+.009*Math.min(1,Math.hypot(dummy.position.x-tx,dummy.position.z-tz)/4.5);motion[i*2+1]=phase+(rand2()-.5)*.5;
      }
    });
    inst.geometry.setAttribute('aSway',new T.InstancedBufferAttribute(motion,2));inst.castShadow=true;inst.receiveShadow=true;scene.add(inst);
  }
  // Background trees: the same grown structure, simpler (three limbs, one fork each), inside their approved canopies.
  function smallTree(tx,tz,scale,index){
    const S=[tx-.08*scale,2.4*scale,tz-.06*scale],tips=[];
    limb([[tx,-.2,tz],[tx-.03,1.2*scale,tz-.02],S],.2*scale,.16*scale,6,4,.06*scale);
    for(let k=0;k<3;k++){
      const heading=index*1.3+k*2.1+(rand2()-.5)*.5,R=(1.5+rand2()*.6)*scale,H=5.1*scale-.16*R+.35+rand2()*.3,dx=Math.cos(heading),dz=Math.sin(heading);
      const at=(f,h)=>[S[0]+dx*R*f,h,S[2]+dz*R*f];
      const main=limb([[S[0],S[1]-.25,S[2]],at(.1,S[1]+.3),at(.55,S[1]+(H-S[1])*.7),at(1,H)],.12*scale,.02,5,6);
      fork(main,.55,.07*scale,heading+(rand2()<.5?-.7:.7),(.9+rand2()*.5)*scale,.35,tips,4);
    }
  }
  function canopy(tx,tz,scale){
    const geo=new T.PlaneGeometry(1,1), inst=new T.InstancedMesh(geo,foliage,650);const dummy=new T.Object3D();
    for(let i=0;i<650;i++){const angle=rand()*Math.PI*2,r=Math.sqrt(rand())*3.4*scale;dummy.position.set(tx+Math.cos(angle)*r,5.1*scale+rand()*1.15-r*.16,tz+Math.sin(angle)*r);dummy.scale.set(.6+rand()*.65,.6+rand()*.65,1);dummy.rotation.set(-Math.PI/2+rand()*1.5,rand()*6,rand()*6);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}inst.castShadow=true;inst.receiveShadow=true;scene.add(inst);return inst;
  }
  // Rain-tree silhouette: irregular branches and cut-paper leaf clusters.
  for(const [index,[tx,tz,scale]] of [[-.15,-7,1],[-3.2,-29,.85],[8,-20,.8]].entries()){
    if(!polish.tree){
      const s=SINK/(4.5*scale);branch([tx+.3*s,-SINK,tz+.3*s],[tx-.3,4.5*scale,tz-.3],.24*scale);
      for(let i=0;i<11;i++){const angle=i*2.4,r=1.2+rand()*2.4,ex=tx+Math.cos(angle)*r,ez=tz+Math.sin(angle)*r,ey=(4.1+rand()*1.4)*scale;branch([tx-.2,2.6*scale,tz],[ex,ey,ez],.055*scale);}
      canopy(tx,tz,scale);
    }else if(index===0){burn(22+650*8);heroTree(tx,tz);}
    else{
      burn(22);smallTree(tx,tz,scale,index);
      const inst=canopy(tx,tz,scale),m=new T.Matrix4(),v=new T.Vector3(),motion=new Float32Array(650*2);
      for(let i=0;i<650;i++){inst.getMatrixAt(i,m);v.setFromMatrixPosition(m);motion[i*2]=.008+.006*Math.min(1,Math.hypot(v.x-tx,v.z-tz)/(3.4*scale));motion[i*2+1]=Math.atan2(v.z-tz,v.x-tx)*1.5+rand2()*.4;}
      inst.geometry.setAttribute('aSway',new T.InstancedBufferAttribute(motion,2));
    }
    if(index===0)spot(tx,tz,1.05,1.05,0,1.1,polish.tree?.119:PAVE+.003);else if(index===1)spot(tx,tz,.7,.7,0,.8);
  }
  // Parked scooters, quiet silhouettes with wheels, saddle and mirrors.
  for(let i=0;i<4;i++){const g=new T.Group();g.position.set(1.2+(i%2)*.35,polish.grounding?ROAD-.006:0,-11-i*3.2);g.rotation.y=-.28+i*.07;scene.add(g);for(const z of [-.6,.65]){const w=new T.Mesh(new T.CylinderGeometry(.26,.26,.14,18),dark);w.rotation.z=Math.PI/2;w.position.set(0,.26,z);g.add(w);}box(.42,.5,1.25,0,.65,.08,i%2?ochre:rust,g);box(.49,.13,.76,0,.96,-.15,dark,g);box(.4,.8,.18,0,.82,.62,white,g);box(.65,.06,.07,0,1.23,.6,dark,g);for(const x of [-.26,.26]){box(.025,.3,.025,x,1.38,.58,dark,g);box(.14,.09,.045,x,1.53,.58,dark,g);}spot(g.position.x,g.position.z,.62,1.9,g.rotation.y,1,ROAD);}
  // Civic material: no official sign, agency, emblem or invented notice.
  for(let i=0;i<3;i++){const x=1.35+i*1.65;box(.09,1.7+SINK,.09,x,(1.7-SINK)/2,-23,rust);box(.09,1.7+SINK,.09,x,(1.7-SINK)/2,-26,rust);box(1.7,.18,.08,x+.8,1.4,-23,ochre);box(1.7,.18,.08,x+.8,.55,-23,white);spot(x,-23,.3,.3,0,.9);spot(x,-26,.3,.3,0,.9);}
  const stack=polish.grounding?MAT+.057:.18;
  for(let i=0;i<20;i++)box(.48,.12,.32,1.25+(i%4)*.51,stack+Math.floor(i/4)*.13,-25.6,concrete);
  spot(2.015,-25.6,2.45,.72,0,1.15);
  if(polish.grounding)box(3,.16,2.8,2,-.015,-24.6,rust);else box(3,.05,2.8,2,.04,-24.6,rust);
  let cloth,clothGeo,clothMat,base,clothMotion=null,clothBounds={x0:.55,x1:5.55,z:-25};
  const motion={cloth:0,gust:0};
  if(polish.cloth){
    // CLOTH: a shade net lashed along its top edge to the back of the three rear rust posts. It sags between
    // the ties, hangs in shallow vertical folds with an uneven hem, lets a little light through, and moves
    // mostly at the lower edge and the loose right-hand corner, at about half the old amplitude and speed.
    const x0=1.25,x1=5.05,top=1.6,bottom=.17,zc=-26.12,posts=[1.35,3,4.65],cols=32,rows=10,W=x1-x0,H=top-bottom,cx=(x0+x1)/2;
    clothBounds={x0,x1,z:zc};
    for(const px of posts)box(.11,.045,.2,px,top+.012,-26.06,dark);
    const texture=grain('#b48c67'),w=texture.image.getContext('2d');
    w.fillStyle='rgba(58,30,14,.075)';for(let i=0;i<256;i+=3){w.fillRect(0,i,256,1);w.fillRect(i,0,1,256);}
    w.globalCompositeOperation='destination-out';w.fillStyle='rgba(0,0,0,.13)';for(let i=1;i<256;i+=3)for(let j=1;j<256;j+=3)w.fillRect(i,j,2,2);
    w.globalCompositeOperation='source-over';w.fillStyle='rgba(70,36,16,.45)';w.fillRect(0,0,256,7);
    texture.repeat.set(3,1);
    clothMat=new T.MeshLambertMaterial({color:'#a76d43',side:T.DoubleSide,map:texture,transparent:true,opacity:.93,emissive:'#4a2210',emissiveIntensity:.35,forceSinglePass:true});
    clothGeo=new T.PlaneGeometry(W,H,cols,rows);cloth=new T.Mesh(clothGeo,clothMat);cloth.position.set(cx,(top+bottom)/2,zc);cloth.castShadow=true;cloth.frustumCulled=false;cloth.renderOrder=2;scene.add(cloth);
    const p=clothGeo.attributes.position,n=p.count,rest=new Float32Array(n*3),hang=new Float32Array(n),loose=new Float32Array(n),hem=[];
    for(let c=0;c<=cols;c++)hem.push((rand2()-.5)*.07);
    for(let i=0;i<n;i++){
      const lx=p.getX(i),ly=p.getY(i),wx=lx+cx,v=(H/2-ly)/H,col=Math.round((lx+W/2)/W*cols);
      let sag=wx<posts[0]?.03*(posts[0]-wx)/(posts[0]-x0):wx>posts[2]?.05*(wx-posts[2])/(x1-posts[2]):0;
      for(let k=0;k<2;k++)if(wx>=posts[k]&&wx<=posts[k+1])sag=.055*Math.sin(Math.PI*(wx-posts[k])/(posts[k+1]-posts[k]));
      const tie=Math.min(1,Math.min(...posts.map(q=>Math.abs(wx-q)))/.45);
      rest[i*3]=lx;rest[i*3+1]=ly-sag-v*v*(hem[col]+.02*Math.sin(wx*2.3));rest[i*3+2]=(Math.sin(wx*15.1+.7)*.6+Math.sin(wx*23.7+2.1)*.4)*(.01+.03*v)*(.5+.5*tie)-.03*v;
      hang[i]=v**1.5*(.35+.65*tie);loose[i]=v*v*T.MathUtils.smoothstep(wx,posts[2]+.02,x1);
    }
    const a=p.array,normal=clothGeo.attributes.normal.array,C=cols+1,edge=rows*C;let last=0;
    clothMotion=time=>{
      const g=motion.gust,flap=Math.sin(time*1.35+.6);let moved=0;
      for(let i=0;i<n;i++){
        const wx=rest[i*3]+cx,z=rest[i*3+2]+hang[i]*g*(.1*Math.sin(wx*1.6-time*1.05)+.045*Math.sin(wx*3.3+time*.8))+loose[i]*g*.1*flap;
        if(i>=edge)moved+=Math.abs(z-a[i*3+2]);
        a[i*3]=rest[i*3];a[i*3+1]=rest[i*3+1]+loose[i]*g*.035*Math.max(0,flap);a[i*3+2]=z;
      }
      for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
        const i=r*C+c,l=(r*C+Math.max(0,c-1))*3,rr=(r*C+Math.min(cols,c+1))*3,u=(Math.max(0,r-1)*C+c)*3,d=(Math.min(rows,r+1)*C+c)*3;
        const nx=-(a[rr+2]-a[l+2])/(a[rr]-a[l]),ny=-(a[u+2]-a[d+2])/(a[u+1]-a[d+1]),len=Math.hypot(nx,ny,1);
        normal[i*3]=nx/len;normal[i*3+1]=ny/len;normal[i*3+2]=1/len;
      }
      p.needsUpdate=true;clothGeo.attributes.normal.needsUpdate=true;
      const dt=time-last;last=time;if(dt>0&&dt<.2)motion.cloth+=(Math.min(1,moved/(C*dt)/.12)-motion.cloth)*.2;
    };
  }else{clothGeo=new T.PlaneGeometry(5,1.65,20,6);clothMat=new T.MeshLambertMaterial({color:'#a76d43',side:T.DoubleSide,map:grain('#b48c67')});cloth=new T.Mesh(clothGeo,clothMat);cloth.position.set(3.05,1,-25);cloth.castShadow=true;scene.add(cloth);base=clothGeo.attributes.position.array.slice();}
  // Road paint and ordinary loose material are subordinate to the route.
  for(let z=-3;z>-50;z-=9)box(.1,.007,2,6,polish.grounding?ROAD+.0045:.01,z,white);
  for(let i=0;i<12;i++){const w=.12+rand()*.14,x=1+rand()*3,z=-22-rand()*5;box(w,.08,.1,x,polish.grounding?groundAt(x,z)+.037:.13,z,concrete);spot(x,z,w+.16,.26,0,.55);}
  box(.15,1.1+SINK,.15,1.2,(1.1-SINK)/2,-35,dark);box(.15,1.1+SINK,.15,1.2,(1.1-SINK)/2,-37,dark);spot(1.2,-35,.4,.4,0,.9);spot(1.2,-37,.4,.4,0,.9);
  // Batch stationary material surfaces into one draw per material.
  scene.updateMatrixWorld(true);
  const batches=new Map(),remove=[];
  scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o===cloth||o.userData.solo)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const flat=g.index?g.toNonIndexed():g;if(o.material.map){const p=flat.attributes.position,n=flat.attributes.normal,uv=flat.attributes.uv;for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));uv.setXY(i,(nx>.5?p.getZ(i):p.getX(i))*.7,(ny>.5?p.getZ(i):p.getY(i))*.7);}}const batch=batches.get(o.material)||[];batch.push(flat);batches.set(o.material,batch);remove.push(o);});
  remove.forEach(o=>o.removeFromParent());
  for(const [material,geometries] of batches){const combined=new T.BufferGeometry();for(const name of ['position','normal','uv']){const size=geometries.reduce((n,g)=>n+g.attributes[name].array.length,0),values=new Float32Array(size);let offset=0;for(const g of geometries){values.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}combined.setAttribute(name,new T.BufferAttribute(values,name==='uv'?2:3));}const mesh=new T.Mesh(combined,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);geometries.forEach(g=>g.dispose());}
  // GROUNDING: soft painted contact shadows, one mesh and one draw, visible even when live shadows are off.
  if(spots.length){
    const pos=[],col=[],index=[],rings=[[.45,.62],[.78,.22],[1,0]],seg=14;
    for(const [x,y,z,w,d,turn,strength] of spots){
      const first=pos.length/3,c=Math.cos(turn),s=Math.sin(turn);pos.push(x,y+.004,z);col.push(1,1,1,.95*strength);
      for(const [r,alpha] of rings)for(let k=0;k<seg;k++){const a=k/seg*Math.PI*2,lx=Math.cos(a)*w/2*r,lz=Math.sin(a)*d/2*r;pos.push(x+lx*c+lz*s,y+.004,z-lx*s+lz*c);col.push(1,1,1,alpha*strength);}
      for(let k=0;k<seg;k++)index.push(first,first+1+(k+1)%seg,first+1+k);
      for(let q=0;q<rings.length-1;q++)for(let k=0;k<seg;k++){const inner=first+1+q*seg,outer=inner+seg,next=(k+1)%seg;index.push(inner+k,inner+next,outer+k,outer+k,inner+next,outer+next);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,4));g.setIndex(index);
    const shadows=new T.Mesh(g,new T.MeshBasicMaterial({color:'#2d2a1f',vertexColors:true,transparent:true,opacity:.42,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
    shadows.renderOrder=1;scene.add(shadows);extras.push(shadows.material);
  }
  // SKY: one vertical gradient, warmer and paler at the horizon, deeper and cooler overhead. No clouds.
  let sky=null;
  if(polish.sky){
    const g=new T.SphereGeometry(60,24,12),p=g.attributes.position,colors=[],low=new T.Color(horizon),high=new T.Color('#b5c3c1'),c=new T.Color();
    for(let i=0;i<p.count;i++){c.copy(low).lerp(high,Math.max(0,p.getY(i)/60)**.8);colors.push(c.r,c.g,c.b);}
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    sky=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false,depthWrite:false}));sky.renderOrder=-1;sky.frustumCulled=false;scene.add(sky);extras.push(sky.material);
  }
  let width=0,height=0;
  function resize(){width=innerWidth;height=innerHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.fov=width<650?66:58;camera.updateProjectionMatrix();}
  resize();
  function view(distance,yaw,pitch,lift=0){camera.position.set(-1.02+Math.sin(distance/32)*.12,1.65+lift,2-distance);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);if(sky)sky.position.copy(camera.position);}
  // Pay Attention on portrait screens: the smallest turn that brings the whole cloth into view.
  function frameCloth(distance,yaw){
    if(camera.aspect>=1)return yaw;
    const half=Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect)-.03,cx=-1.02+Math.sin(distance/32)*.12,cz=2-distance;
    const toward=x=>Math.atan2(cx-x,cz-clothBounds.z),left=toward(clothBounds.x0),right=toward(clothBounds.x1),min=left-half,max=right+half;
    return min<=max?Math.min(max,Math.max(min,yaw)):(left+right)/2;
  }
  function draw(time){
    motion.gust=.55+.45*(.6*Math.sin(time*.21)+.4*Math.sin(time*.34+1.3));
    if(polish.tree)sway.value.set(time,.72+.28*motion.gust);
    if(clothMotion)clothMotion(time);else{const p=clothGeo.attributes.position;for(let i=0;i<p.count;i++){const x=base[i*3],y=base[i*3+1];p.array[i*3+2]=Math.sin(x*2.3+time*1.9)*.24*(.9-y/2)+Math.sin(time*.9+x)*.12;}p.needsUpdate=true;clothGeo.computeVertexNormals();}
    renderer.render(scene,camera);renderer.shadowMap.autoUpdate=false;
  }
  function dispose(){renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});Object.values(materials).forEach(m=>{m.map?.dispose();m.dispose();});clothMat.map.dispose();clothMat.dispose();extras.forEach(e=>e.dispose());container.replaceChildren();}
  return {renderer,camera,view,draw,resize,dispose,frameCloth,motion,canvas:renderer.domElement,stats:()=>({...renderer.info.render,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures})};
}
