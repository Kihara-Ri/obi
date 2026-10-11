/** Isolated GLB preview. Does not import the app or read/write ledger state. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {filterSpineRibs} from '../../web/src/core/album-rib-material';

const stage = document.getElementById('stage');
const status = document.getElementById('status');
const canvas = document.getElementById('model');
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .9;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36,1,.001,5);
const environment = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const environmentMap = pmrem.fromScene(environment,.025);
scene.environment = environmentMap.texture;
scene.environmentIntensity = .5;
environment.dispose(); pmrem.dispose();
const spin = new THREE.Group(); scene.add(spin);
const conversion = new THREE.Group(); conversion.rotation.x = Math.PI/2; spin.add(conversion);
const light = new THREE.DirectionalLight(0xffffff,.35); light.position.set(-.3,.5,.5); scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff,.12));
const media = matchMedia('(prefers-reduced-motion:reduce)');
const state = {target:0,open:0,frame:0,previous:0,x:-.17,y:-.28,zoom:1,moved:false,drag:null};
let asset, mixer, action;
const box = new THREE.Box3();
const center = new THREE.Vector3();
const size = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function render() {
  if (!asset) return;
  action.time = action.getClip().duration*state.open;
  mixer.update(0);
  spin.position.set(0,0,0);
  spin.rotation.set(state.x,state.y,0);
  spin.updateMatrixWorld(true);
  box.setFromObject(spin); box.getCenter(center); box.getSize(size);
  spin.position.copy(center).multiplyScalar(-1);
  const slope = Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  const distance=(Math.max(size.x/(slope*camera.aspect),size.y/slope)*.56+size.z*.5)/state.zoom;
  camera.position.set(0,0,distance);
  camera.near=Math.max(.002,distance*.2); camera.far=distance+size.length()*2;
  camera.updateProjectionMatrix();
  camera.lookAt(0,0,0); camera.updateMatrixWorld(true);
  renderer.render(scene,camera);
  stage.dataset.progress = state.open.toFixed(5);
  stage.dataset.yaw = state.y.toFixed(5);
}
function request() {
  if (state.frame) return;
  state.previous = performance.now();
  const tick = now => {
    const dt = Math.min(.05,(now-state.previous)/1000); state.previous=now;
    state.open += (state.target-state.open)*(media.matches ? 1 : 1-Math.exp(-10*dt));
    if (Math.abs(state.target-state.open)<.001) state.open=state.target;
    render();
    state.frame = state.open!==state.target ? requestAnimationFrame(tick) : 0;
  };
  state.frame=requestAnimationFrame(tick);
}
function toggle() {state.target=1-state.target; stage.setAttribute('aria-expanded',String(!!state.target)); request();}
function hits(event) {
  if (!asset) return false;
  const rect=canvas.getBoundingClientRect();
  mouse.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  raycaster.setFromCamera(mouse,camera);
  return raycaster.intersectObject(spin,true).length>0;
}
stage.addEventListener('pointerdown',event=>{
  state.moved=false;
  if (!event.isPrimary || event.button!==0 || !hits(event)) return;
  state.drag={id:event.pointerId,x:event.clientX,y:event.clientY,rx:state.x,ry:state.y};
  stage.setPointerCapture(event.pointerId); stage.focus({preventScroll:true});
});
stage.addEventListener('pointermove',event=>{
  const drag=state.drag; if (!drag || drag.id!==event.pointerId) return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if (Math.hypot(dx,dy)>5) state.moved=true;
  state.y=drag.ry+dx/stage.clientWidth*4;
  state.x=THREE.MathUtils.clamp(drag.rx+dy/stage.clientWidth*3,-1.2,1.2);
  render();
});
stage.addEventListener('pointerup',event=>{
  const drag=state.drag; state.drag=null;
  if (!drag || drag.id!==event.pointerId) return;
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  if (!state.moved) toggle();
});
stage.addEventListener('pointercancel',()=>{state.drag=null;state.moved=true;});
stage.addEventListener('wheel',event=>{event.preventDefault();state.zoom=THREE.MathUtils.clamp(state.zoom*Math.exp(-event.deltaY*.001),.7,2);render();},{passive:false});
stage.addEventListener('keydown',event=>{
  if (event.key==='Enter'||event.key===' ') {event.preventDefault(); toggle();}
  else if (event.key==='Home') {event.preventDefault(); state.x=0;state.y=0;state.zoom=1;render();}
  else if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    if(event.key==='ArrowLeft')state.y-=.3;
    if(event.key==='ArrowRight')state.y+=.3;
    if(event.key==='ArrowUp')state.x-=.2;
    if(event.key==='ArrowDown')state.x+=.2;
    state.x=THREE.MathUtils.clamp(state.x,-1.2,1.2);render();
  }
});
const resize=()=>{renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();render();};
new ResizeObserver(resize).observe(stage);
media.addEventListener('change',()=>{if(media.matches){state.open=state.target;render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(state.frame);state.frame=0;}else request();});
new GLTFLoader().load('jewel-case.glb',gltf=>{
  asset=gltf.scene; conversion.add(asset);
  asset.traverse(object=>{
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material.name.startsWith('Tray_Graphite_Ribbed')) continue;
      let surface=object;
      while (surface && !surface.userData.ribbedSpine) surface=surface.parent;
      if (surface) filterSpineRibs(material,surface.userData,renderer.getPixelRatio());
    }
  });
  const clip=gltf.animations[0];
  if (!clip) throw new Error('Exported opening animation is missing');
  mixer=new THREE.AnimationMixer(asset);
  action=mixer.clipAction(clip); action.setLoop(THREE.LoopOnce,1); action.clampWhenFinished=true; action.play();action.paused=true;
  stage.dataset.ready='true';stage.dataset.animation=clip.name;status.textContent='';resize();
},undefined,error=>{status.textContent='模型载入失败';console.error(error);});
