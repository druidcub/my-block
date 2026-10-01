(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('world');
  const outlineCanvas = $('selection-outline');
  const outlineContext = outlineCanvas.getContext('2d');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) { $('welcome').classList.add('hidden'); $('error').classList.remove('hidden'); return; }
  const SIZE = 40, MAX_Y = 24, SAVE_KEY = 'little-block-world-v1';
  const BODY_RADIUS = .23, EYE_HEIGHT = .72, HEAD_HEIGHT = .10, EPSILON = .002;
  const MIN_EYE = 1 + EYE_HEIGHT + EPSILON;
  const blocks = [
    { id: 1, name: '草地', color: '#89b867', rgb: [.48,.67,.32] },
    { id: 3, name: '木頭', color: '#bc9266', rgb: [.66,.46,.28] },
    { id: 5, name: '石頭', color: '#aab9b8', rgb: [.60,.65,.64] },
    { id: 6, name: '奶油', color: '#f1ddb0', rgb: [.93,.82,.59] },
    { id: 7, name: '粉紅', color: '#eda6ac', rgb: [.91,.53,.58] },
    { id: 8, name: '天空', color: '#94c6de', rgb: [.49,.72,.83] },
    { id: 9, name: '陽光', color: '#f5ce6d', rgb: [.96,.76,.35] },
    { id: 4, name: '樹葉', color: '#6d9f71', rgb: [.35,.58,.36] }
  ];
  const colors = { 1:[.48,.67,.32], 2:[.55,.40,.26], 3:[.66,.46,.28], 4:[.35,.58,.36], 5:[.60,.65,.64], 6:[.93,.82,.59], 7:[.91,.53,.58], 8:[.49,.72,.83], 9:[.96,.76,.35], 10:[.31,.65,.77], 11:[.89,.57,.57], 12:[.96,.90,.74] };
  const voxels = new Uint8Array(SIZE * SIZE * MAX_Y);
  const index = (x,y,z) => x + SIZE * (z + SIZE * y);
  const inside = (x,y,z) => x>=0 && z>=0 && y>=0 && x<SIZE && z<SIZE && y<MAX_Y;
  const get = (x,y,z) => inside(x,y,z) ? voxels[index(x,y,z)] : 0;
  const set = (x,y,z,t) => { if (inside(x,y,z)) voxels[index(x,y,z)] = t; };
  let changes = {}, history = [], selected = 6, started = false, hit = null;
  let built = 0, usedColors = new Set(), achievements = 0, soundOn = false;
  let dirty = true, saveTimer, toastTimer, audioCtx, meshCount = 0;
  const keys = new Set(), held = new Set();
  const player = { x:20.5, y:8, z:32.5, yaw:0, pitch:-.29 };
  const aimOffset = { x:0, y:0 };
  let falling = false, fallVelocity = 0, lastShiftPress = null, godView = null;
  let lastTime = 0;

  const noise = (x,z) => (Math.sin(x*127.1+z*311.7)*43758.5453)%1;
  function terrain(x,z) {
    const d = Math.hypot(x-20,z-20);
    if (d > 21 || (d>18 && noise(x,z)>.35)) return 0;
    return 2 + ((x<10 || x>30 || z<8) && Math.sin(x*.23)+Math.cos(z*.26)>.55 ? 1 : 0);
  }
  function makeWorld() {
    voxels.fill(0);
    for(let x=0;x<SIZE;x++) for(let z=0;z<SIZE;z++) {
      const h = terrain(x,z);
      for(let y=0;y<=h;y++) set(x,y,z,y===h?1:2);
      if(!h) set(x,0,z,10);
    }
    // A little shallow pond, surrounded by a broad grass path.
    for(let x=8;x<=13;x++) for(let z=19;z<=24;z++) {
      if(Math.hypot(x-10.5,z-21.5)<3) { set(x,2,z,0); set(x,1,z,10); }
    }
    // Open doorway, colourful windows, stepped roof.
    for(let x=18;x<=23;x++) for(let z=16;z<=21;z++) {
      set(x,3,z,3);
      for(let y=4;y<=6;y++) {
        const wall=x===18||x===23||z===16||z===21;
        if(wall && !(z===21 && (x===20||x===21) && y<6)) set(x,y,z,6);
      }
    }
    for(const x of [18,23]) for(const z of [18,19]) set(x,5,z,8);
    for(const x of [19,22]) set(x,5,21,8);
    for(let tier=0;tier<3;tier++) for(let x=17+tier;x<=24-tier;x++) for(let z=15;z<=22;z++) set(x,7+tier,z,11);
    for(let z=22;z<=27;z++) for(let x=20;x<=21;x++) set(x,2,z,6);
    function tree(x,z,h) {
      const base=terrain(x,z)+1;
      for(let y=base;y<base+h;y++) set(x,y,z,3);
      for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++) for(let dy=0;dy<3;dy++) {
        if(Math.abs(dx)+Math.abs(dz)<4 && !(dy===2 && (Math.abs(dx)>1||Math.abs(dz)>1))) set(x+dx,base+h-1+dy,z+dz,4);
      }
    }
    [[7,10,4],[13,9,4],[28,12,4],[31,23,4],[8,29,3],[27,31,4],[17,32,3],[32,6,4]].forEach(v=>tree(...v));
    // Friendly block sculptures: a duck and a small pink bunny.
    [[14,3,26,9],[15,3,26,9],[14,4,26,9],[13,4,26,11],[15,4,26,12],
     [27,3,20,7],[27,4,20,7],[27,5,20,7],[28,5,20,7],[27,6,20,7],[28,6,20,7],
     [27,4,21,12],[28,3,20,7]].forEach(v=>set(...v));
    for(const [x,z] of [[16,25],[24,24],[6,17],[29,27],[12,14],[25,9]]) {
      set(x,terrain(x,z)+1,z,4); set(x,terrain(x,z)+2,z,(x%2)?7:9);
    }
    // White block clouds high above the island.
    for(const [cx,cz] of [[7,5],[29,4],[7,34],[33,32]]) for(let dx=0;dx<5;dx++) for(let dz=0;dz<2;dz++) set(cx+dx,20+(dx===2?1:0),cz+dz,12);
  }

  function loadSave() {
    try {
      const raw=localStorage.getItem(SAVE_KEY);
      if(!raw) return;
      const saved=JSON.parse(raw);
      if(saved.version!==1 || !saved.changes || typeof saved.changes!=='object') return;
      for(const [key,type] of Object.entries(saved.changes)) {
        const xyz=key.split(',').map(Number);
        if(xyz.length===3 && xyz.every(Number.isInteger) && inside(...xyz) && xyz[1]>0 && Number.isInteger(type) && type>=0 && type<=12) { set(...xyz,type); changes[key]=type; }
      }
      built=Number.isFinite(saved.built)?Math.min(100000,Math.max(0,saved.built)):0;
      usedColors=new Set(Array.isArray(saved.colors)?saved.colors.filter(t=>blocks.some(b=>b.id===t)):[]);
      achievements=Number.isInteger(saved.achievements)?Math.max(0,Math.min(3,saved.achievements)):0;
      $('save-status').textContent='● 已載入你的作品';
    } catch { $('save-status').textContent='● 這次的作品暫不存檔'; }
  }
  function saveNow() {
    try {
      localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,changes,built,colors:[...usedColors],achievements}));
      $('save-status').textContent='● 作品已存好';
    } catch { $('save-status').textContent='● 無法存檔'; showToast('這個瀏覽器無法存檔，請大人幫忙開啟儲存功能'); }
  }
  function scheduleSave() { $('save-status').textContent='● 正在收好積木…'; clearTimeout(saveTimer); saveTimer=setTimeout(saveNow,450); }
  window.addEventListener('pagehide',()=>{ if(started) saveNow(); });

  function compile(type,source) {
    const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  let program;
  try {
    program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,`
      attribute vec3 aPosition; attribute vec3 aColor; attribute vec2 aUV;
      uniform mat4 uVP; uniform vec3 uEye;
      varying vec3 vColor; varying vec2 vUV; varying float vDistance;
      void main(){ gl_Position=uVP*vec4(aPosition,1.0); vColor=aColor; vUV=aUV; vDistance=distance(aPosition,uEye); }
    `));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`
      precision mediump float;
      varying vec3 vColor; varying vec2 vUV; varying float vDistance;
      uniform float uOutline;
      uniform vec2 uFogRange;
      void main(){
        vec2 pixel=floor(vUV*8.0);
        float n=fract(sin(dot(pixel,vec2(12.9898,78.233)))*43758.5453);
        float edge=step(.025,vUV.x)*step(.025,vUV.y)*step(vUV.x,.975)*step(vUV.y,.975);
        vec3 c=vColor*(.93+n*.12)*mix(.91,1.0,edge);
        if(uOutline>.5)c=vec3(1.0,.93,.68);
        float fog=smoothstep(uFogRange.x,uFogRange.y,vDistance);
        gl_FragColor=vec4(mix(c,vec3(.74,.88,.92),fog),1.0);
      }
    `));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch(error) { console.error(error); $('welcome').classList.add('hidden'); $('error').classList.remove('hidden'); return; }
  gl.useProgram(program);
  const loc={ position:gl.getAttribLocation(program,'aPosition'), color:gl.getAttribLocation(program,'aColor'), uv:gl.getAttribLocation(program,'aUV'), vp:gl.getUniformLocation(program,'uVP'), eye:gl.getUniformLocation(program,'uEye'), outline:gl.getUniformLocation(program,'uOutline'), fog:gl.getUniformLocation(program,'uFogRange') };
  const mesh=gl.createBuffer();
  const faces=[
    {n:[1,0,0],s:.83,v:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]},
    {n:[-1,0,0],s:.72,v:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]},
    {n:[0,1,0],s:1.10,v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]},
    {n:[0,-1,0],s:.58,v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},
    {n:[0,0,1],s:.92,v:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]]},
    {n:[0,0,-1],s:.78,v:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]}
  ];
  function rebuild() {
    const data=[], uv=[[0,0],[0,1],[1,1],[1,0]];
    for(let y=0;y<MAX_Y;y++) for(let z=0;z<SIZE;z++) for(let x=0;x<SIZE;x++) {
      const type=get(x,y,z); if(!type) continue;
      for(const face of faces) {
        if(get(x+face.n[0],y+face.n[1],z+face.n[2])) continue;
        let color=colors[type]; if(type===1 && face.n[1]!==1) color=colors[2];
        for(const j of [0,1,2,0,2,3]) {
          const v=face.v[j]; data.push(x+v[0],y+v[1],z+v[2],color[0]*face.s,color[1]*face.s,color[2]*face.s,...uv[j]);
        }
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW); meshCount=data.length/8; dirty=false;
  }
  function bind(buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [attribute,size,offset] of [[loc.position,3,0],[loc.color,3,12],[loc.uv,2,24]]) { gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute,size,gl.FLOAT,false,32,offset); }
  }
  function multiply(a,b) {
    const out=new Float32Array(16);
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) out[c*4+r]+=a[k*4+r]*b[c*4+k];
    return out;
  }
  function viewProjection() {
    const cy=Math.cos(player.yaw),sy=Math.sin(player.yaw),cp=Math.cos(player.pitch),sp=Math.sin(player.pitch);
    const right=[cy,0,sy], up=[-sy*sp,cp,cy*sp], back=[-sy*cp,-sp,cy*cp], eye=[player.x,player.y,player.z];
    const dot=v=>v.reduce((sum,n,i)=>sum+n*eye[i],0);
    const view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,-dot(right),-dot(up),-dot(back),1]);
    const f=1/Math.tan(Math.PI/6), aspect=canvas.width/canvas.height, near=.08, far=godView?300:110;
    const projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    return multiply(projection,view);
  }
  function aimDirection() {
    const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw),sp=Math.sin(player.pitch),cp=Math.cos(player.pitch);
    const sx=2*aimOffset.x/innerHeight*Math.tan(Math.PI/6),syScreen=-2*aimOffset.y/innerHeight*Math.tan(Math.PI/6);
    const dir=[sy*cp+cy*sx-sy*sp*syScreen,sp+cp*syScreen,-cy*cp+sy*sx+cy*sp*syScreen];
    const length=Math.hypot(...dir);return dir.map(value=>value/length);
  }
  function positionAim(x=0,y=0) {
    const limit=Math.min(130,Math.min(innerWidth,innerHeight)*.16),length=Math.hypot(x,y);
    const scale=length>limit?limit/length:1;
    aimOffset.x=x*scale;aimOffset.y=y*scale;
    $('crosshair').style.left=`calc(50% + ${aimOffset.x}px)`;$('crosshair').style.top=`calc(50% + ${aimOffset.y}px)`;
    $('aim-label').style.left=`calc(50% + ${aimOffset.x}px)`;$('aim-label').style.top=`calc(50% + ${aimOffset.y+26}px)`;
  }
  function raycast() {
    const dir=aimDirection();
    let xyz=[Math.floor(player.x),Math.floor(player.y),Math.floor(player.z)], prev=[...xyz];
    const origin=[player.x,player.y,player.z], step=dir.map(d=>d>=0?1:-1);
    const delta=dir.map(d=>Math.abs(d)>1e-8?Math.abs(1/d):Infinity);
    const max=dir.map((d,i)=>Math.abs(d)>1e-8?((xyz[i]+(step[i]>0?1:0)-origin[i])/d):Infinity);
    let distance=0;
    for(let i=0;i<70 && distance<16;i++) {
      const type=get(...xyz);
      if(type) return {xyz:[...xyz],previous:prev,type,distance};
      prev=[...xyz];
      const axis=max[0]<max[1]?(max[0]<max[2]?0:2):(max[1]<max[2]?1:2);
      distance=max[axis]; xyz[axis]+=step[axis]; max[axis]+=delta[axis];
    }
    return null;
  }
  function drawOutline(vp) {
    outlineContext.clearRect(0,0,innerWidth,innerHeight);
    if(!hit || !canAct() || godView) return;
    const [x,y,z]=hit.xyz,paths=[];
    function project(v) {
      const point=[x+v[0],y+v[1],z+v[2],1];
      const clip=[0,0,0,0];
      for(let row=0;row<4;row++) for(let k=0;k<4;k++) clip[row]+=vp[k*4+row]*point[k];
      if(clip[3]<.08)return null;
      return [(clip[0]/clip[3]*.5+.5)*innerWidth,(.5-clip[1]/clip[3]*.5)*innerHeight];
    }
    for(const face of faces) {
      const facing=face.n[0]*(player.x-x-.5-face.n[0]*.5)+face.n[1]*(player.y-y-.5-face.n[1]*.5)+face.n[2]*(player.z-z-.5-face.n[2]*.5);
      if(facing<=0)continue;
      const points=face.v.map(project);if(points.some(p=>!p))continue;paths.push(points);
    }
    // Screen-space strokes stay legible on WebGL drivers limited to 1px lines.
    outlineContext.lineJoin='round';outlineContext.lineCap='round';
    for(const [width,color] of [[7,'rgba(30,62,49,.88)'],[3.5,'#ffe16b']]) {
      outlineContext.beginPath();
      for(const points of paths){outlineContext.moveTo(...points[0]);for(let i=1;i<4;i++)outlineContext.lineTo(...points[i]);outlineContext.closePath();}
      outlineContext.lineWidth=width;outlineContext.strokeStyle=color;outlineContext.stroke();
    }
  }
  function resize() {
    const ratio=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.floor(innerWidth*ratio); canvas.height=Math.floor(innerHeight*ratio); gl.viewport(0,0,canvas.width,canvas.height);
    outlineCanvas.width=canvas.width;outlineCanvas.height=canvas.height;outlineContext.setTransform(canvas.width/innerWidth,0,0,canvas.height/innerHeight,0,0);
    positionAim(aimOffset.x,aimOffset.y);
  }
  window.addEventListener('resize',resize);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(.74,.88,.92,1); resize();

  function showToast(text) { $('toast').textContent=text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600); }
  function playTone(kind) {
    if(!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
      audioCtx.resume();
      const now=audioCtx.currentTime, notes=kind==='win'?[523.25,659.25,783.99]:[kind==='remove'?330:523.25];
      notes.forEach((hz,i)=>{ const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(); osc.type='sine'; osc.frequency.value=hz; gain.gain.setValueAtTime(0,now+i*.10); gain.gain.linearRampToValueAtTime(.09,now+i*.10+.01); gain.gain.exponentialRampToValueAtTime(.001,now+i*.10+.22); osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now+i*.10); osc.stop(now+i*.10+.23); });
    } catch { /* Audio is optional. */ }
  }
  function updateQuests(celebrate=false) {
    const completed=built>=1?(built>=8?(usedColors.size>=3?3:2):1):0;
    if(completed>achievements) { achievements=completed; if(celebrate){showToast(['','✦ 太棒了！第一塊積木！','✦ 你是小小建築師了！','✦ 三顆星！繼續蓋你的夢想吧！'][completed]);playTone('win');} }
    const q=Math.min(achievements,3);
    const titles=['放下第一塊積木','蓋一個小小作品','讓世界變得繽紛','你是超棒的建築師！'];
    const details=['選一個喜歡的顏色，按「放積木」！',`再放一些積木吧！已經放了 ${Math.min(built,8)} / 8 塊`, `試試 3 種積木！已經用了 ${Math.min(usedColors.size,3)} 種`,'三顆星都收集到了。自由創作吧！'];
    $('quest-title').textContent=titles[q]; $('quest-detail').textContent=details[q]; $('quest-progress').textContent=q===3?'完成！':`${q+1} / 3`;
    $('stars').textContent=Array.from({length:3},(_,i)=>i<q?'★':'☆').join(' ');
    $('progress-fill').style.width=`${q===0?0:q===1?Math.min(built/8,1)*100:q===2?Math.min(usedColors.size/3,1)*100:100}%`;
  }
  function canAct() { return started && !document.querySelector('.modal-backdrop:not(.hidden)'); }
  function occupied(x,y,z) {
    return player.x+BODY_RADIUS>x && player.x-BODY_RADIUS<x+1 && player.z+BODY_RADIUS>z && player.z-BODY_RADIUS<z+1 && player.y+HEAD_HEIGHT>y && player.y-EYE_HEIGHT<y+1;
  }
  function edit(action) {
    if(!canAct()) return;
    if(godView){showToast('先按「回到原位」，就可以繼續蓋積木囉');return;}
    hit=raycast();
    if(!hit) { showToast('再靠近一點，往積木或地面看一看'); return; }
    const xyz=action==='place'?hit.previous:hit.xyz, [x,y,z]=xyz;
    if(!inside(...xyz) || y===0) { showToast('這是小島的底座，換個地方試試吧'); return; }
    if(action==='place' && occupied(x,y,z)) { showToast('往旁邊走一步，就能放下積木囉'); return; }
    const before=get(...xyz), after=action==='place'?selected:0;
    if(before===after) return;
    history.push({xyz:[...xyz],before,after}); if(history.length>150)history.shift();
    set(...xyz,after); changes[xyz.join(',')]=after; dirty=true;
    if(action==='place') {built++;usedColors.add(selected);}
    playTone(action); updateQuests(true); scheduleSave();
  }
  function undo() {
    if(!canAct()) return;
    const item=history.pop(); if(!item){showToast('還沒有要復原的動作，先蓋一蓋吧！');return;}
    set(...item.xyz,item.before); changes[item.xyz.join(',')]=item.before; dirty=true; scheduleSave();playTone('remove');showToast('上一個動作復原了！');
  }
  function clearMovement() { keys.clear();held.clear();lastShiftPress=null;document.querySelectorAll('.held').forEach(b=>b.classList.remove('held')); }
  function updateGodView() {
    const active=Boolean(godView),button=$('god-view');
    button.innerHTML=active?'◎<span>回到原位</span>':'◎<span>上帝視角</span>';
    button.setAttribute('aria-pressed',String(active));button.title=active?'回到剛才的位置與方向':'從高空看作品，再按一次回到原位';
    document.querySelectorAll('[data-move], #place, #remove').forEach(b=>b.disabled=active);
  }
  function toggleGodView() {
    if(!canAct())return;
    clearMovement();falling=false;fallVelocity=0;
    if(godView){Object.assign(player,godView.player);positionAim(godView.aim.x,godView.aim.y);godView=null;showToast('回到剛才的位置了！');}
    else {const height=42*Math.max(1,innerHeight/innerWidth);godView={player:{...player},aim:{...aimOffset}};Object.assign(player,{x:20.5,y:height,z:38.5,yaw:0,pitch:-Math.atan2(height-4,18)});positionAim();showToast('從高空看看你的作品，再按一次就回到原位');}
    updateGodView();
  }
  function home() { godView=null;updateGodView();falling=false;fallVelocity=0;Object.assign(player,{x:20.5,y:8,z:32.5,yaw:0,pitch:-.29});positionAim();clearMovement(); }
  function choose(type) {
    selected=type;
    document.querySelectorAll('.block-choice').forEach(b=>{ const active=Number(b.dataset.type)===type; b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active)); });
  }
  blocks.forEach((block,i)=>{
    const b=document.createElement('button');b.className='block-choice';b.dataset.type=block.id;b.title=`${block.name}（${i+1}）`;b.setAttribute('aria-label',`選擇${block.name}積木`);
    b.innerHTML=`<span class="key">${i+1}</span><span class="swatch" style="--block:${block.color}"></span><span class="block-name">${block.name}</span>`;
    b.addEventListener('click',()=>choose(block.id));$('palette').appendChild(b);
  });choose(selected);
  $('start').onclick=()=>{started=true;$('welcome').classList.add('hidden');showToast('歡迎！拖曳畫面，找一個喜歡的地方開始蓋吧');};
  $('help').onclick=()=>{$('help-modal').classList.remove('hidden');keys.clear();held.clear();};
  $('close-help').onclick=()=>$('help-modal').classList.add('hidden');
  $('sound').onclick=()=>{soundOn=!soundOn;$('sound').textContent=soundOn?'♫':'♪';$('sound').setAttribute('aria-label',soundOn?'關閉音效':'開啟音效');$('sound').style.background=soundOn?'#f9d58c':'';showToast(soundOn?'音效開啟了 ♪':'音效已關閉');playTone('place');};
  $('place').onclick=()=>edit('place');$('remove').onclick=()=>edit('remove');$('undo').onclick=undo;
  $('home').onclick=()=>{home();showToast('回到小屋了！');};
  $('god-view').onclick=toggleGodView;
  $('reset').onclick=()=>{$('reset-modal').classList.remove('hidden');keys.clear();held.clear();};
  $('cancel-reset').onclick=()=>$('reset-modal').classList.add('hidden');
  $('confirm-reset').onclick=()=>{clearTimeout(saveTimer);changes={};history=[];built=0;usedColors.clear();achievements=0;makeWorld();dirty=true;home();updateQuests();saveNow();$('reset-modal').classList.add('hidden');showToast('新的冒險開始了！');};
  document.addEventListener('contextmenu',e=>e.preventDefault());
  function handleKeyDown(e) {
    if(e.code==='Escape') { $('help-modal').classList.add('hidden');$('reset-modal').classList.add('hidden');keys.clear();held.clear();return; }
    if(!canAct()) return;
    if((e.code==='ShiftLeft'||e.code==='ShiftRight') && !e.repeat && !keys.has('ShiftLeft') && !keys.has('ShiftRight') && !godView) {
      const now=Number.isFinite(e.timeStamp)?e.timeStamp:performance.now();
      if(lastShiftPress!==null && now-lastShiftPress>=0 && now-lastShiftPress<=330){falling=true;fallVelocity=0;lastShiftPress=null;showToast('輕輕落地囉！按空白鍵可以停住');}
      else lastShiftPress=now;
    }
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyE','KeyQ'].includes(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.repeat)return;
    if(e.code==='KeyE')edit('place');if(e.code==='KeyQ')edit('remove');if(e.code==='KeyZ')undo();
    const digit=Number(e.key);if(digit>=1 && digit<=blocks.length)choose(blocks[digit-1].id);
  }
  document.addEventListener('keydown',handleKeyDown);
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{clearMovement();drag=null;});
  document.querySelectorAll('[data-move]').forEach(b=>{
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(canAct()){held.add(b.dataset.move);b.classList.add('held');}});
    const release=()=>{held.delete(b.dataset.move);b.classList.remove('held');};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
  });
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{if(!canAct())return;e.preventDefault();positionAim(e.clientX-innerWidth/2,e.clientY-innerHeight/2);canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0,button:e.button};});
  canvas.addEventListener('pointermove',e=>{
    if(!canAct())return;
    if(!drag){if(e.pointerType!=='touch')positionAim(e.clientX-innerWidth/2,e.clientY-innerHeight/2);return;}
    if(drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.distance+=Math.abs(dx)+Math.abs(dy);
    player.yaw+=dx*.005;player.pitch=Math.max(-1.35,Math.min(1.25,player.pitch-dy*.005));
  });
  canvas.addEventListener('pointerup',e=>{if(drag&&drag.id===e.pointerId){if(drag.distance<6)edit(drag.button===2?'remove':'place');drag=null;}});
  canvas.addEventListener('pointercancel',()=>drag=null);
  function collides(x,y,z) {
    for(let bx=Math.floor(x-BODY_RADIUS+EPSILON);bx<=Math.floor(x+BODY_RADIUS-EPSILON);bx++) for(let bz=Math.floor(z-BODY_RADIUS+EPSILON);bz<=Math.floor(z+BODY_RADIUS-EPSILON);bz++) for(let by=Math.floor(y-EYE_HEIGHT+EPSILON);by<=Math.floor(y+HEAD_HEIGHT-EPSILON);by++) if(get(bx,by,bz))return true;
    return false;
  }
  function lowerTo(nextY) {
    const oldFeet=player.y-EYE_HEIGHT,newFeet=nextY-EYE_HEIGHT;
    let support=-Infinity;
    for(let bx=Math.floor(player.x-BODY_RADIUS+EPSILON);bx<=Math.floor(player.x+BODY_RADIUS-EPSILON);bx++) for(let bz=Math.floor(player.z-BODY_RADIUS+EPSILON);bz<=Math.floor(player.z+BODY_RADIUS-EPSILON);bz++) {
      for(let by=0;by<MAX_Y;by++) if(by+1<=oldFeet+EPSILON && by+1>=newFeet-EPSILON && get(bx,by,bz))support=Math.max(support,by+1);
    }
    if(Number.isFinite(support)){player.y=support+EYE_HEIGHT+EPSILON;return true;}
    player.y=Math.max(MIN_EYE,nextY);return nextY<=MIN_EYE;
  }
  function move(dt) {
    if(godView)return;
    const pressed=(name,codes)=>held.has(name)||codes.some(c=>keys.has(c));
    let forward=Number(pressed('forward',['KeyW','ArrowUp']))-Number(pressed('back',['KeyS','ArrowDown']));
    let side=Number(pressed('right',['KeyD','ArrowRight']))-Number(pressed('left',['KeyA','ArrowLeft']));
    const length=Math.hypot(forward,side);if(length){forward/=length;side/=length;}
    const step=dt*4.2, dx=(Math.sin(player.yaw)*forward+Math.cos(player.yaw)*side)*step, dz=(-Math.cos(player.yaw)*forward+Math.sin(player.yaw)*side)*step;
    // A short body fits below a ceiling one block above the floor.
    for(const [axis,delta] of [['x',dx],['z',dz]]) {
      if(!delta)continue;
      const nx=axis==='x'?Math.max(.4,Math.min(SIZE-.4,player.x+delta)):player.x;
      const nz=axis==='z'?Math.max(.4,Math.min(SIZE-.4,player.z+delta)):player.z;
      if(!collides(nx,player.y,nz)){player.x=nx;player.z=nz;}
      else if(!falling && player.y+1.002<=18 && !collides(nx,player.y+1.002,nz)){player.x=nx;player.z=nz;player.y+=1.002;}
    }
    const rise=Number(pressed('rise',['Space'])),sink=Number(pressed('sink',['ShiftLeft','ShiftRight']));
    if(rise){falling=false;fallVelocity=0;const ny=Math.min(18,player.y+step);if(!collides(player.x,ny,player.z))player.y=ny;}
    else if(falling){fallVelocity=Math.min(28,fallVelocity+18*dt);if(lowerTo(player.y-fallVelocity*dt)){falling=false;fallVelocity=0;showToast('到地面了！繼續蓋積木吧');}}
    else if(sink)lowerTo(player.y-step);
  }
  let lastAim='';
  function frame(time) {
    const dt=Math.min((time-lastTime)/1000,.04);lastTime=time;
    if(canAct())move(dt);
    if(dirty)rebuild();
    const vp=viewProjection();
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(loc.vp,false,vp);gl.uniform3f(loc.eye,player.x,player.y,player.z);gl.uniform1f(loc.outline,0);gl.uniform2f(loc.fog,godView?200:20,godView?300:58);bind(mesh);gl.drawArrays(gl.TRIANGLES,0,meshCount);
    hit=raycast();drawOutline(vp);
    const aim=godView?'上帝視角 · 按「回到原位」繼續玩':hit?'亮框：E 放積木 / Q 拿掉':'靠近積木，再往下看一看';
    if(aim!==lastAim){$('aim-label').textContent=aim;lastAim=aim;}
    requestAnimationFrame(frame);
  }
  makeWorld();loadSave();updateQuests();requestAnimationFrame(frame);
})();
