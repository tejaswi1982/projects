import * as T from '../vendor/three.module.js';

// An authored architectural street, measured in metres. No geographic claims.
export function createWorld(container) {
  const renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<800?1.25:1.5));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#cbd2c3');scene.fog=new T.Fog('#cbd2c3',29,70);
  const camera=new T.PerspectiveCamera(58,1,.1,85);
  scene.add(new T.HemisphereLight('#f6efd9','#696950',2.3));
  const sun=new T.DirectionalLight('#fff1cf',3.1);sun.position.set(-10,17,3);sun.target.position.set(0,0,-16);scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-17,right:17,top:23,bottom:-23,near:1,far:65});sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;
  let seed=1234;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  // Seeded paper/concrete grain is authored texture, never documentary evidence.
  function grain(base){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,256,256);for(let i=0;i<9000;i++){x.fillStyle=`rgba(${rand()>.5?'255,248,224':'45,42,31'},${rand()*.13})`;x.fillRect(rand()*256,rand()*256,1+rand()*3,1+rand()*2);}for(let i=0;i<22;i++){x.strokeStyle='rgba(54,49,36,.09)';x.beginPath();let a=rand()*256,b=rand()*256;x.moveTo(a,b);x.lineTo(a+rand()*70,b+rand()*4);x.stroke();}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
  const materials={};
  function mat(name,color,texture=false){return materials[name]??=(new T.MeshLambertMaterial({color:texture?'#ffffff':color,map:texture?grain(color):null}));}
  const concrete=mat('concrete','#c4baa2',true),road=mat('road','#787867',true),wall=mat('wall','#c1baa5',true),dark=mat('dark','#3e4943'),rust=mat('rust','#916b4f',true),white=mat('white','#ddd4b9'),leaf=mat('leaf','#64724e',true),leaf2=mat('leaf2','#899270',true),bark=mat('bark','#645b44',true),ochre=mat('ochre','#a89b70',true);
  const cube=new T.BoxGeometry(1,1,1), cylinder=new T.CylinderGeometry(1,1,1,12);
  function box(w,h,d,x,y,z,m=concrete,parent=scene){const a=new T.Mesh(cube,m);a.scale.set(w,h,d);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
  function branch(a,b,r){let av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);let mesh=new T.Mesh(cylinder,bark);mesh.scale.set(r,v.length(),r*.78);mesh.position.copy(av.add(bv).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());mesh.castShadow=true;scene.add(mesh);}
  box(12,.15,70,2,-.12,-23,road);box(2.7,.2,58,-1.05,.01,-22,concrete);box(.22,.27,58,.38,.045,-22,white);box(.65,.16,2,-1.2,.15,2,concrete);
  // Paving joints and repaired patches read as material, not a UI grid.
  for(let z=5;z>-50;z-=.85){box(2.55,.006,.018,-1.04,.118,z,rust);for(let x=-2;x<.1;x+=.8)box(.012,.006,.82,x,.119,z-.42,rust);}
  box(.22,1.6,59,-2.6,.8,-23,wall);box(.4,.15,59,-2.6,1.65,-23,white);
  for(let z=4;z>-51;z-=4){box(.4,2,.4,-2.6,1,z,white);for(let q=0;q<6;q++)box(.04,.75,.04,-2.6,2.05,z-q*.64,dark);box(.06,.04,4,-2.6,2.42,z-1.8,dark);}
  // Residential facades, balconies, grilles, utility boxes and rooftop tanks.
  for(const side of [-1,1])for(let i=0;i<5;i++){
    const x=side<0?-6.8:10.2,z=2-i*12,h=9+(i%3)*2;
    box(5,h,10,x,h/2,z,i%2?concrete:wall);box(5.15,.16,10.2,x,h,z,white);
    for(let y=2;y<h-1;y+=2.4)for(let j=0;j<3;j++){
      const wx=x+(side<0?2.52:-2.52),wz=z-3+j*3;
      box(.045,1.45,1.45,wx,y,wz,dark);box(.8,.12,2,wx,y-.78,wz,concrete);
      for(let k=0;k<5;k++)box(.055,1.5,.025,wx+side*-.08,y,wz-.64+k*.32,rust);
      box(.5,.55,.6,wx+side*-.2,y-.1,wz+1,white);
    }
    const tank=new T.Mesh(new T.CylinderGeometry(.8,.8,1.4,16),dark);tank.position.set(x,h+.7,z);scene.add(tank);
  }
  for(let i=0;i<4;i++){box(.12,7,.12,1.1,3.5,-i*14,dark);box(1.6,.08,.08,1.6,6.4,-i*14,dark);}
  const wireMat=new T.LineBasicMaterial({color:'#535747'});
  for(let x=0;x<3;x++){let pts=[];for(let i=0;i<=64;i++)pts.push(new T.Vector3(1+x*.18,6.3-Math.sin((i%16)/16*Math.PI)*.3,6-i));scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),wireMat));}
  const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=128;const leafContext=leafCanvas.getContext('2d');
  for(let i=0;i<35;i++){leafContext.fillStyle=i%2?'#8a966f':'#566547';leafContext.beginPath();leafContext.ellipse(12+rand()*104,12+rand()*104,4+rand()*8,2+rand()*3,rand()*6,0,Math.PI*2);leafContext.fill();}
  const leafTexture=new T.CanvasTexture(leafCanvas);leafTexture.colorSpace=T.SRGBColorSpace;
  const foliage=new T.MeshLambertMaterial({map:leafTexture,alphaTest:.5,side:T.DoubleSide});
  // Rain-tree silhouette: irregular branches and cut-paper leaf clusters.
  for(const [tx,tz,scale] of [[-.15,-7,1],[-3.2,-29,.85],[8,-20,.8]]){
    branch([tx,0,tz],[tx-.3,4.5*scale,tz-.3],.24*scale);
    for(let i=0;i<11;i++){const angle=i*2.4,r=1.2+rand()*2.4,ex=tx+Math.cos(angle)*r,ez=tz+Math.sin(angle)*r,ey=(4.1+rand()*1.4)*scale;branch([tx-.2,2.6*scale,tz],[ex,ey,ez],.055*scale);}
    const geo=new T.PlaneGeometry(1,1), inst=new T.InstancedMesh(geo,foliage,650);const dummy=new T.Object3D();
    for(let i=0;i<650;i++){const angle=rand()*Math.PI*2,r=Math.sqrt(rand())*3.4*scale;dummy.position.set(tx+Math.cos(angle)*r,5.1*scale+rand()*1.15-r*.16,tz+Math.sin(angle)*r);dummy.scale.set(.6+rand()*.65,.6+rand()*.65,1);dummy.rotation.set(-Math.PI/2+rand()*1.5,rand()*6,rand()*6);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}inst.castShadow=true;inst.receiveShadow=true;scene.add(inst);
  }
  // Parked scooters, quiet silhouettes with wheels, saddle and mirrors.
  for(let i=0;i<4;i++){const g=new T.Group();g.position.set(1.2+(i%2)*.35,0,-11-i*3.2);g.rotation.y=-.28+i*.07;scene.add(g);for(const z of [-.6,.65]){const w=new T.Mesh(new T.CylinderGeometry(.26,.26,.14,18),dark);w.rotation.z=Math.PI/2;w.position.set(0,.26,z);g.add(w);}box(.42,.5,1.25,0,.65,.08,i%2?ochre:rust,g);box(.49,.13,.76,0,.96,-.15,dark,g);box(.4,.8,.18,0,.82,.62,white,g);box(.65,.06,.07,0,1.23,.6,dark,g);for(const x of [-.26,.26]){box(.025,.3,.025,x,1.38,.58,dark,g);box(.14,.09,.045,x,1.53,.58,dark,g);}}
  // Civic material: no official sign, agency, emblem or invented notice.
  for(let i=0;i<3;i++){const x=1.35+i*1.65;box(.09,1.7,.09,x,.85,-23,rust);box(.09,1.7,.09,x,.85,-26,rust);box(1.7,.18,.08,x+.8,1.4,-23,ochre);box(1.7,.18,.08,x+.8,.55,-23,white);}
  for(let i=0;i<20;i++)box(.48,.12,.32,1.25+(i%4)*.51,.18+Math.floor(i/4)*.13,-25.6,concrete);
  box(3,.05,2.8,2,.04,-24.6,rust);
  const clothGeo=new T.PlaneGeometry(5,1.65,20,6),clothMat=new T.MeshLambertMaterial({color:'#a76d43',side:T.DoubleSide,map:grain('#b48c67')});const cloth=new T.Mesh(clothGeo,clothMat);cloth.position.set(3.05,1,-25);cloth.castShadow=true;scene.add(cloth);const base=clothGeo.attributes.position.array.slice();
  // Road paint and ordinary loose material are subordinate to the route.
  for(let z=-3;z>-50;z-=9)box(.1,.007,2,6,.01,z,white);
  for(let i=0;i<12;i++)box(.12+rand()*.14,.08,.1,1+rand()*3,.13,-22-rand()*5,concrete);
  box(.15,1.1,.15,1.2,.55,-35,dark);box(.15,1.1,.15,1.2,.55,-37,dark);
  // Batch stationary material surfaces into one draw per material.
  scene.updateMatrixWorld(true);
  const batches=new Map(),remove=[];
  scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o===cloth)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const flat=g.index?g.toNonIndexed():g;if(o.material.map){const p=flat.attributes.position,n=flat.attributes.normal,uv=flat.attributes.uv;for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));uv.setXY(i,(nx>.5?p.getZ(i):p.getX(i))*.7,(ny>.5?p.getZ(i):p.getY(i))*.7);}}const batch=batches.get(o.material)||[];batch.push(flat);batches.set(o.material,batch);remove.push(o);});
  remove.forEach(o=>o.removeFromParent());
  for(const [material,geometries] of batches){const combined=new T.BufferGeometry();for(const name of ['position','normal','uv']){const size=geometries.reduce((n,g)=>n+g.attributes[name].array.length,0),values=new Float32Array(size);let offset=0;for(const g of geometries){values.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}combined.setAttribute(name,new T.BufferAttribute(values,name==='uv'?2:3));}const mesh=new T.Mesh(combined,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);geometries.forEach(g=>g.dispose());}
  let width=0,height=0;
  function resize(){width=innerWidth;height=innerHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.fov=width<650?66:58;camera.updateProjectionMatrix();}
  resize();
  function view(distance,yaw,pitch){camera.position.set(-1.02+Math.sin(distance/32)*.12,1.65,2-distance);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);}
  function draw(time){const p=clothGeo.attributes.position;for(let i=0;i<p.count;i++){const x=base[i*3],y=base[i*3+1];p.array[i*3+2]=Math.sin(x*2.3+time*1.9)*.24*(.9-y/2)+Math.sin(time*.9+x)*.12;}p.needsUpdate=true;clothGeo.computeVertexNormals();renderer.render(scene,camera);renderer.shadowMap.autoUpdate=false;}
  function dispose(){renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});Object.values(materials).forEach(m=>{m.map?.dispose();m.dispose();});clothMat.map.dispose();clothMat.dispose();container.replaceChildren();}
  return {renderer,camera,view,draw,resize,dispose,canvas:renderer.domElement,stats:()=>({...renderer.info.render,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures})};
}
