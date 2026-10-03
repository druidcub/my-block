(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('world');
  const outlineCanvas = $('selection-outline');
  const outlineContext = outlineCanvas.getContext('2d');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) { $('welcome').classList.add('hidden'); $('error').classList.remove('hidden'); return; }
  const SIZE = 40, MAX_Y = 40, FLY_LIMIT = 38, LEGACY_SAVE_KEY = 'little-block-world-v1';
  const SAVE_PREFIX = 'little-block-world-v2:', AREA_META_KEY = 'little-block-world-area-v2';
  const SETTINGS_KEY='little-block-world-settings-v1';
  const preferences={thirdPerson:true,distance:3.6,sfx:false,music:false,volume:.55};
  try {
    const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');
    if(saved){for(const key of ['thirdPerson','sfx','music'])if(typeof saved[key]==='boolean')preferences[key]=saved[key];
      if(Number.isFinite(saved.distance))preferences.distance=Math.max(1.4,Math.min(7.5,saved.distance));
      if(Number.isFinite(saved.volume))preferences.volume=Math.max(0,Math.min(.85,saved.volume));}
  } catch { /* Default controls work without saved preferences. */ }
  const audio=window.BlockAudio.create(preferences);
  let cameraDistance=preferences.distance;
  const areas = {
    cottage:{name:'小屋世界',icon:'⌂',hint:'小屋、樹木與池塘，替家添一點顏色。',idea:'替小屋蓋個花園或小陽台',sky:[.74,.88,.92],spawn:{x:20.5,y:8,z:32.5,yaw:0,pitch:-.29},material:6},
    street:{name:'道路街景',icon:'▤',hint:'逛街、看車子，蓋出你喜歡的城市。',idea:'替街道蓋一間商店或公車站',sky:[.76,.87,.94],spawn:{x:20.5,y:6,z:35.5,yaw:0,pitch:-.45},material:16},
    volcano:{name:'火山口',icon:'▲',hint:'安全的岩漿與火山，出發去探險！',idea:'蓋一座觀景台或跨過岩漿的橋',sky:[.94,.80,.68],spawn:{x:20.5,y:17.5,z:28.5,yaw:0,pitch:-.83},material:18},
    meadow:{name:'平坦草地',icon:'▱',hint:'一大片空白草地，全部交給你的想像。',idea:'從草地開始，蓋出自己的夢想小屋',sky:[.75,.90,.87],spawn:{x:20.5,y:3.722,z:29.5,yaw:0,pitch:-.4},material:6},
    titanic:{name:'鐵達尼號',icon:'⚓',hint:'四座煙囪的大船！上甲板、蓋船艙。',idea:'替大船加一間船艙或漂亮的甲板',sky:[.73,.87,.94],spawn:{x:37.5,y:20,z:37.5,yaw:-.72,pitch:-.38},material:12},
    cars:{name:'汽車世界',icon:'▰',hint:'賽道、停車場與彩色車子，打造車車樂園。',idea:'蓋一輛夢想車或自己的車庫',sky:[.77,.90,.91],spawn:{x:20.5,y:9,z:37.5,yaw:0,pitch:-.4},material:9},
    taipei101:{name:'台北 101',icon:'▥',hint:'飛到高高的塔頂，看看城市與廣場！',idea:'替 101 蓋一座空中花園或新廣場',sky:[.76,.87,.94],spawn:{x:35.5,y:20,z:38.5,yaw:-.69,pitch:.12},material:20}
  };
  let currentArea = 'cottage';
  try { const last=localStorage.getItem(AREA_META_KEY);if(Object.hasOwn(areas,last))currentArea=last; } catch { /* Offline play works without storage. */ }
  const regionSessions = new Map();
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
    { id: 4, name: '樹葉', color: '#6d9f71', rgb: [.35,.58,.36] },
    { id: 2, name: '泥土', color:'#98704a' }, { id:10,name:'池水',color:'#58a9c5' },
    { id:11,name:'屋瓦',color:'#df8f91' }, { id:12,name:'白磚',color:'#f5e8c9' },
    { id:13,name:'沙地',color:'#dcc39b' }, { id:14,name:'柏油',color:'#54646b' },
    { id:15,name:'岩漿',color:'#ff7b2c' }, { id:16,name:'紅磚',color:'#c66b54' },
    { id:17,name:'窗框',color:'#a4d4dd' }, { id:18,name:'火山岩',color:'#64616c' },
    { id:19,name:'定時炸彈',color:'#e85e55' }, { id:20,name:'青綠',color:'#438f88' }
  ];
  const paletteGroups = {color:[1,3,5,6,7,8,9,4],building:[3,5,6,12,14,16,17,11],nature:[1,4,2,10,13,15,18,20],fun:[19]};
  let paletteGroup='color';
  const colors = { 1:[.48,.67,.32], 2:[.55,.40,.26], 3:[.66,.46,.28], 4:[.35,.58,.36], 5:[.60,.65,.64], 6:[.93,.82,.59], 7:[.91,.53,.58], 8:[.49,.72,.83], 9:[.96,.76,.35], 10:[.31,.65,.77], 11:[.89,.57,.57], 12:[.96,.90,.74],13:[.83,.73,.54],14:[.25,.31,.34],15:[1,.37,.07],16:[.75,.37,.27],17:[.60,.80,.84],18:[.32,.30,.36],19:[.91,.30,.26],20:[.22,.53,.49] };
  const voxels = new Uint8Array(SIZE * SIZE * MAX_Y);
  const index = (x,y,z) => x + SIZE * (z + SIZE * y);
  const inside = (x,y,z) => x>=0 && z>=0 && y>=0 && x<SIZE && z<SIZE && y<MAX_Y;
  const get = (x,y,z) => inside(x,y,z) ? voxels[index(x,y,z)] : 0;
  const set = (x,y,z,t) => { if (inside(x,y,z)) voxels[index(x,y,z)] = t; };
  let changes = {}, history = [], selected = 6, started = false, hit = null;
  let built = 0, usedColors = new Set(), achievements = 0;
  let dirty = true, saveTimer, toastTimer, meshCount = 0, focused=true;
  const keys = new Set(), held = new Set();
  const player = { x:20.5, y:8, z:32.5, yaw:0, pitch:-.29 };
  const aimOffset = { x:0, y:0 };
  let falling = false, fallVelocity = 0, lastShiftPress = null, godView = null;
  let lastTime = 0;
  const bombs = new Map(), bursts = [];
  const BOMB_SECONDS = 10, BLAST_RADIUS = 2;
  const avatar={mode:'idle',phase:0,heading:0,walk:0,rise:0,sink:0,fall:0,hover:0,landing:0,action:0,last:{...player},grounded:false,step:0};

  const noise = (x,z) => (Math.sin(x*127.1+z*311.7)*43758.5453)%1;
  function terrain(x,z) {
    const d = Math.hypot(x-20,z-20);
    if (d > 21 || (d>18 && noise(x,z)>.35)) return 0;
    return 2 + ((x<10 || x>30 || z<8) && Math.sin(x*.23)+Math.cos(z*.26)>.55 ? 1 : 0);
  }
  function makeCottage() {
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

  function fillFlat(top=1) {
    for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++)for(let y=0;y<=2;y++)set(x,y,z,y===2?top:2);
  }
  function makeStreet() {
    fillFlat();
    for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++) {
      if((x>=17&&x<=22)||(z>=17&&z<=22))set(x,2,z,14);
      if((x===19||x===20)&&z%6<3&&(z<16||z>23))set(x,2,z,12);
      if((z===19||z===20)&&x%6<3&&(x<16||x>23))set(x,2,z,9);
      if((x===15||x===16||x===23||x===24)&&!(z>=17&&z<=22))set(x,3,z,12);
      if((z===15||z===16||z===23||z===24)&&!(x>=17&&x<=22))set(x,3,z,12);
      if(x>=17&&x<=22&&(z===28||z===30))set(x,2,z,12);
    }
    function shop(x0,z0,width,depth,height,wall,roof) {
      for(let x=x0;x<x0+width;x++)for(let z=z0;z<z0+depth;z++) {
        set(x,3,z,12);
        for(let y=4;y<4+height;y++)if(x===x0||x===x0+width-1||z===z0||z===z0+depth-1) {
          const door=z===z0+depth-1&&(x===x0+3||x===x0+4)&&y<6;
          if(!door)set(x,y,z,(y===5||y===8)&&(x-x0)%3!==0&&(z-z0)%3!==0?17:wall);
        }
        set(x,4+height,z,roof);
      }
      for(let x=x0+1;x<x0+width-1;x++)set(x,6,z0+depth,roof);
    }
    shop(5,5,8,9,7,6,16);shop(27,5,8,9,9,8,12);
    shop(5,27,8,7,4,7,9);shop(27,27,8,7,5,16,6);
    for(const x of [15,24])for(const z of [9,26,34]) {
      for(let y=4;y<8;y++)set(x,y,z,18);set(x,8,z,9);set(x,8,z+1,9);
    }
    function car(x,z,color) {
      for(let dx=0;dx<2;dx++)for(let dz=0;dz<4;dz++){set(x+dx,3,z+dz,color);if(dz===1||dz===2)set(x+dx,4,z+dz,17);}
      set(x,3,z,18);set(x+1,3,z,18);set(x,3,z+3,18);set(x+1,3,z+3,18);
    }
    car(17,24,9);car(21,9,7);car(29,17,8);
    for(const [x,z] of [[3,18],[36,18],[3,24],[36,24]]){for(let y=3;y<6;y++)set(x,y,z,3);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)set(x+dx,6,z+dz,4);}
  }
  function makeVolcano() {
    for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++) {
      const radius=Math.hypot(x-20,z-19);
      const h=radius<4?5:2+Math.max(0,Math.floor((14-radius)*.8));
      for(let y=0;y<=h;y++)set(x,y,z,y===h?(radius<4?15:radius<14?18:13):18);
    }
    // A bright, harmless lava stream and a wooden lookout for little explorers.
    for(let x=24;x<=34;x++)for(let z=17;z<=18;z++) {
      let top=MAX_Y-1;while(top>0&&!get(x,top,z))top--;set(x,top,z,15);
    }
    for(let x=17;x<=23;x++)for(let z=29;z<=31;z++){for(let y=3;y<=5;y++)set(x,y,z,3);set(x,6,z,3);}
    for(const x of [17,23])for(let z=29;z<=31;z++)set(x,7,z,6);
    for(let z=25;z<=28;z++)for(let x=19;x<=21;x++)set(x,6+Math.floor((28-z)/2),z,3);
    for(const [x,z] of [[7,10],[31,7],[6,27],[32,30]])for(let y=3;y<6;y++)set(x,y,z,18);
  }
  function box(x0,y0,z0,x1,y1,z1,type) {
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)set(x,y,z,type);
  }
  function makeTitanic() {
    fillFlat(10);
    // A toy ocean liner: tapered hull, open decks and four golden funnels.
    for(let z=6;z<=33;z++) {
      const half=z<10?2+Math.floor((z-6)/2):z>29?2+Math.floor((33-z)/2):5;
      for(let x=20-half;x<=20+half;x++) {
        for(let y=2;y<=6;y++)set(x,y,z,y<4?11:14);
        set(x,7,z,3);
        if(x===20-half||x===20+half)set(x,8,z,12);
      }
    }
    for(let x=17;x<=23;x++)for(let z=11;z<=29;z++) {
      for(let y=8;y<=10;y++)if(x===17||x===23||z===11||z===29) {
        if(!(z===29&&(x===20||x===21)&&y<10))set(x,y,z,y===9&&z%3!==0?17:12);
      }
      set(x,11,z,3);
    }
    box(18,12,28,22,13,29,17);box(18,14,28,22,14,29,12);
    for(const z of [12,17,22,26]){box(19,12,z,21,16,z+1,9);box(19,17,z,21,17,z+1,18);}
    for(const z of [8,31]){box(20,8,z,20,19,z,3);box(18,15,z,22,15,z,3);}
    for(const x of [15,25])for(const z of [13,19,25]){box(x,9,z,x,9,z+2,9);set(x,10,z+1,12);}
    box(29,3,28,38,3,38,3);box(29,4,28,38,4,28,12);
    for(let x=26;x<=30;x++)box(x,7-Math.floor((x-26)/2),29,x,7-Math.floor((x-26)/2),31,3);
    for(const [x,z] of [[4,8],[7,28],[34,8]]){box(x,3,z,x+3,3,z+3,12);box(x+1,4,z+1,x+2,5,z+2,12);}
  }
  function makeCars() {
    fillFlat();
    for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++) {
      const radius=Math.hypot((x-20)/16,(z-20)/12);
      if(radius>.72&&radius<1.13)set(x,2,z,14);
      if(radius>.87&&radius<.94&&(x+z)%6<3)set(x,2,z,12);
      if(radius>1.13&&radius<1.22)set(x,2,z,(x+z)%2?12:11);
    }
    box(5,2,5,14,2,13,14);box(27,2,26,34,2,36,14);
    for(const x of [5,9,13])box(x,2,5,x,2,13,12);
    function car(x,z,color,length=5,tall=false) {
      box(x,4,z,x+2,4,z+length-1,color);
      for(const dx of [0,2])for(const dz of [1,length-2])set(x+dx,3,z+dz,18);
      box(x,5,z+1,x+2,tall?6:5,z+length-2,17);
      box(x, tall?7:6,z+1,x+2,tall?7:6,z+length-2,color);
      for(const dx of [0,2]){set(x+dx,4,z,9);set(x+dx,4,z+length-1,7);}
    }
    car(19,24,9);car(7,6,7);car(11,6,8);car(29,28,16,7,true);car(4,19,12,6,true);car(32,16,20);
    for(let x=16;x<=24;x++)for(let z=30;z<=31;z++)set(x,2,z,(x+z)%2?12:14);
    box(16,3,30,16,8,30,16);box(24,3,30,24,8,30,16);
    for(let x=16;x<=24;x++)set(x,9,30,x%2?12:14);
    box(27,3,7,35,3,12,5);box(27,4,7,27,7,12,16);box(35,4,7,35,7,12,16);
    box(27,4,7,35,7,7,16);box(27,8,7,35,8,12,9);
    box(11,3,17,13,3,23,6);box(12,4,19,12,6,21,9);
  }
  function makeTaipei101() {
    fillFlat(5);
    for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++) {
      if(x<6||x>32||z<5||z>33)set(x,2,z,14);
      if((x===3||x===36)&&z%6<3)set(x,2,z,12);
      if((z===2||z===36)&&x%6<3)set(x,2,z,12);
    }
    box(12,3,12,28,3,28,12);
    box(15,4,15,25,6,25,20);box(14,7,14,26,7,26,12);
    // Eight tiered sections echo the landmark's bamboo-shaped silhouette.
    for(let tier=0;tier<8;tier++)for(let dy=0;dy<3;dy++) {
      const half=dy===0?3:4,y=8+tier*3+dy;
      box(20-half,y,20-half,20+half,y,20+half,dy===1?17:20);
      for(const x of [20-half,20+half])for(const z of [20-half,20+half])set(x,y,z,20);
    }
    box(18,32,18,22,33,22,20);box(19,34,19,21,35,21,17);box(20,36,20,20,38,20,12);
    box(19,4,23,21,5,25,0); // Walk into the mall entrance.
    for(const [x,z,w,h,color] of [[7,7,4,8,6],[28,7,3,11,8],[7,26,4,6,16]]) {
      box(x,3,z,x+w,3+h,z+w,color);
      for(let y=5;y<3+h;y+=3)box(x,y,z,x+w,y,z+w,17);
      box(x,4+h,z,x+w,4+h,z+w,12);
    }
    box(27,3,29,30,3,31,10);
    for(const [x,z] of [[9,18],[30,18],[13,30],[25,30]]){box(x,3,z,x,5,z,3);box(x-1,6,z-1,x+1,7,z+1,4);}
    for(let x=15;x<=25;x++)set(x,3,30,x%2?6:12);
  }
  function makeWorld() {
    voxels.fill(0);
    if(currentArea==='cottage')makeCottage();
    else if(currentArea==='street')makeStreet();
    else if(currentArea==='volcano')makeVolcano();
    else if(currentArea==='titanic')makeTitanic();
    else if(currentArea==='cars')makeCars();
    else if(currentArea==='taipei101')makeTaipei101();
    else fillFlat();
  }

  function saveKey(area=currentArea){return SAVE_PREFIX+area;}
  function snapshot() {
    return {version:2,area:currentArea,changes:{...changes},bombs:[...bombs.values()].map(b=>({xyz:[...b.xyz],remaining:b.remaining})),built,colors:[...usedColors],achievements,selected,player:{...(godView?godView.player:player)},aim:{...(godView?godView.aim:aimOffset)}};
  }
  function validCamera(p) {
    return p&&['x','y','z','yaw','pitch'].every(k=>Number.isFinite(p[k]))&&p.x>=.4&&p.x<=SIZE-.4&&p.z>=.4&&p.z<=SIZE-.4&&p.y>=MIN_EYE&&p.y<=FLY_LIMIT&&Math.abs(p.pitch)<=1.35&&!collides(p.x,p.y,p.z);
  }

  function loadSave() {
    try {
      const session=regionSessions.get(currentArea);
      let raw=session?session.raw:localStorage.getItem(saveKey()),legacy=false;
      if(!raw&&currentArea==='cottage'){raw=localStorage.getItem(LEGACY_SAVE_KEY);legacy=Boolean(raw);}
      if(!raw) return;
      const saved=JSON.parse(raw);
      if((legacy?saved.version!==1:saved.version!==2||saved.area!==currentArea)||!saved.changes||typeof saved.changes!=='object')return;
      for(const [key,type] of Object.entries(saved.changes)) {
        const xyz=key.split(',').map(Number);
        if(xyz.length===3 && xyz.every(Number.isInteger) && inside(...xyz) && xyz[1]>0 && Number.isInteger(type) && type>=0 && type<=20) { set(...xyz,type); changes[key]=type; }
      }
      if(Array.isArray(saved.bombs))for(const b of saved.bombs) {
        if(b&&Array.isArray(b.xyz)&&b.xyz.length===3&&b.xyz.every(Number.isInteger)&&inside(...b.xyz)&&b.xyz[1]>0&&get(...b.xyz)===19&&Number.isFinite(b.remaining)&&b.remaining>0&&b.remaining<=BOMB_SECONDS)bombs.set(b.xyz.join(','),{xyz:[...b.xyz],remaining:b.remaining});
      }
      built=Number.isFinite(saved.built)?Math.min(100000,Math.max(0,saved.built)):0;
      usedColors=new Set(Array.isArray(saved.colors)?saved.colors.filter(t=>blocks.some(b=>b.id===t)):[]);
      achievements=Number.isInteger(saved.achievements)?Math.max(0,Math.min(3,saved.achievements)):0;
      if(blocks.some(b=>b.id===saved.selected))choose(saved.selected);
      if(validCamera(saved.player))Object.assign(player,saved.player);
      if(saved.aim&&Number.isFinite(saved.aim.x)&&Number.isFinite(saved.aim.y))positionAim(saved.aim.x,saved.aim.y);
      if(session)history=session.history.map(cloneHistoryItem);
      $('save-status').textContent='● 已載入你的作品';
      if(legacy)saveNow();
    } catch { $('save-status').textContent='● 這次的作品暫不存檔'; }
  }
  function saveNow() {
    const raw=JSON.stringify(snapshot());
    regionSessions.set(currentArea,{raw,history:history.map(cloneHistoryItem)});
    try {
      localStorage.setItem(saveKey(),raw);
      $('save-status').textContent='● 作品已存好';
      return true;
    } catch { $('save-status').textContent='● 暫存於這次遊戲'; showToast('作品暫存在這次遊戲，重開前請大人幫忙開啟儲存功能');return false; }
  }
  function scheduleSave() { $('save-status').textContent='● 正在收好積木…'; clearTimeout(saveTimer); saveTimer=setTimeout(saveNow,450); }
  window.addEventListener('pagehide',()=>{ audio.suspend();if(started) saveNow(); });
  function updateAreaUI() {
    const area=areas[currentArea];$('area-select').value=currentArea;$('area-hint').textContent=area.hint;
    $('area-icon').textContent=area.icon;$('area-save-note').textContent='各區域獨立存檔';
    $('home').innerHTML='⌂<span>'+(currentArea==='cottage'?'回小屋':'回起點')+'</span>';
    $('home').title=currentArea==='cottage'?'回到小屋':'回到目前區域的起點';
    const sky=area.sky;gl.clearColor(...sky,1);
  }
  function switchArea(area) {
    if(!Object.hasOwn(areas,area)||area===currentArea)return;
    clearTimeout(saveTimer);saveNow();
    currentArea=area;changes={};history=[];bombs.clear();bursts.length=0;built=0;usedColors=new Set();achievements=0;
    makeWorld();home();choose(areas[area].material);$('save-status').textContent='● 新區域，開始創作吧';loadSave();resetAvatar();dirty=true;hit=null;updateAreaUI();updateQuests();
    try{localStorage.setItem(AREA_META_KEY,area);}catch{/* In-memory area switching remains available. */}
    showToast('來到'+areas[area].name+'！作品會分開保存');
  }

  function compile(type,source) {
    const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  let program;
  try {
    program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,`
      attribute vec3 aPosition; attribute vec3 aColor; attribute vec2 aUV; attribute float aKind; attribute float aCountdown;
      uniform mat4 uVP; uniform vec3 uEye;
      varying vec3 vColor; varying vec2 vUV; varying float vDistance; varying float vKind; varying float vCountdown;
      void main(){ gl_Position=uVP*vec4(aPosition,1.0); vColor=aColor; vUV=aUV; vKind=aKind; vCountdown=aCountdown; vDistance=distance(aPosition,uEye); }
    `));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`
      precision mediump float;
      varying vec3 vColor; varying vec2 vUV; varying float vDistance; varying float vKind; varying float vCountdown;
      uniform sampler2D uBombAtlas;
      uniform float uOutline;
      uniform vec2 uFogRange;
      uniform vec3 uSky; uniform float uTime;
      void main(){
        vec2 pixel=floor(vUV*8.0);
        float n=fract(sin(dot(pixel,vec2(12.9898,78.233)))*43758.5453);
        float edge=step(.025,vUV.x)*step(.025,vUV.y)*step(vUV.x,.975)*step(vUV.y,.975);
        vec3 c=vColor*(.93+n*.12)*mix(.91,1.0,edge);
        if(vKind>14.5&&vKind<15.5){float glow=.5+.5*sin(uTime*1.7+vUV.x*6.0+vUV.y*4.0);c=mix(vec3(1.0,.27,.04),vec3(1.0,.72,.14),glow*.65+n*.18);}
        if(vKind>15.5&&vKind<16.5){float seam=step(.09,fract(vUV.y*3.0))*step(.045,fract(vUV.x*2.0+floor(vUV.y*3.0)*.5));c=mix(vec3(.77,.69,.56),c,seam);}
        if(vKind>16.5&&vKind<17.5){float pane=step(.1,vUV.x)*step(.1,vUV.y)*step(vUV.x,.9)*step(vUV.y,.9);c=mix(vec3(.93,.91,.81),c,pane);}
        if(vKind>18.5&&vKind<19.5)c=texture2D(uBombAtlas,vec2((floor(vCountdown+.5)+clamp(1.0-vUV.x,.01,.99))/12.0,clamp(vUV.y,.01,.99))).rgb;
        if(uOutline>.5)c=vec3(1.0,.93,.68);
        float fog=smoothstep(uFogRange.x,uFogRange.y,vDistance);
        gl_FragColor=vec4(mix(c,uSky,fog),1.0);
      }
    `));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch(error) { console.error(error); $('welcome').classList.add('hidden'); $('error').classList.remove('hidden'); return; }
  gl.useProgram(program);
  const loc={ position:gl.getAttribLocation(program,'aPosition'), color:gl.getAttribLocation(program,'aColor'), uv:gl.getAttribLocation(program,'aUV'), kind:gl.getAttribLocation(program,'aKind'), countdown:gl.getAttribLocation(program,'aCountdown'),atlas:gl.getUniformLocation(program,'uBombAtlas'),vp:gl.getUniformLocation(program,'uVP'), eye:gl.getUniformLocation(program,'uEye'), outline:gl.getUniformLocation(program,'uOutline'), fog:gl.getUniformLocation(program,'uFogRange'),sky:gl.getUniformLocation(program,'uSky'),time:gl.getUniformLocation(program,'uTime') };
  // One offline canvas atlas puts readable countdown digits on every cube face.
  const atlasCanvas=document.createElement('canvas');atlasCanvas.width=128*12;atlasCanvas.height=128;
  const atlasContext=atlasCanvas.getContext('2d');
  for(let n=0;n<12;n++) {
    const left=n*128;atlasContext.fillStyle='#e85e55';atlasContext.fillRect(left,0,128,128);
    atlasContext.fillStyle='#a73736';atlasContext.fillRect(left+7,7,114,114);
    atlasContext.fillStyle='#fff1cb';atlasContext.fillRect(left+10,23,108,82);
    atlasContext.textAlign='center';atlasContext.textBaseline='middle';atlasContext.fillStyle='#952e30';
    atlasContext.font=n===11?'bold 58px sans-serif':'bold 76px monospace';atlasContext.fillText(n===11?'停':String(n),left+64,67);
  }
  const atlasTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlasCanvas);
  for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);
  for(const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,param,gl.LINEAR);
  gl.uniform1i(loc.atlas,0);
  const mesh=gl.createBuffer();
  const penguinMesh=gl.createBuffer();
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
      const countdown=type===19?(bombs.has([x,y,z].join(','))?Math.ceil(bombs.get([x,y,z].join(',')).remaining):11):0;
      for(const face of faces) {
        if(get(x+face.n[0],y+face.n[1],z+face.n[2])) continue;
        let color=colors[type]; if(type===1 && face.n[1]!==1) color=colors[2];
        for(const j of [0,1,2,0,2,3]) {
          const v=face.v[j]; data.push(x+v[0],y+v[1],z+v[2],color[0]*face.s,color[1]*face.s,color[2]*face.s,...uv[j],type,countdown);
        }
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW); meshCount=data.length/10; dirty=false;
  }
  function bind(buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [attribute,size,offset] of [[loc.position,3,0],[loc.color,3,12],[loc.uv,2,24],[loc.kind,1,32],[loc.countdown,1,36]]) { gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute,size,gl.FLOAT,false,40,offset); }
  }
  function multiply(a,b) {
    const out=new Float32Array(16);
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) out[c*4+r]+=a[k*4+r]*b[c*4+k];
    return out;
  }
  function cameraEye() {
    if(godView||!preferences.thirdPerson)return {x:player.x,y:player.y,z:player.z,clearance:0};
    const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw),sp=Math.sin(player.pitch),cp=Math.cos(player.pitch);
    const distance=cameraDistance,side=Math.min(.85,.48*innerWidth/innerHeight)*Math.min(1,distance/3.6);
    const offset=[-sy*cp*distance-sy*sp*.22+cy*side,-sp*distance+cp*.22,cy*cp*distance+cy*sp*.22+sy*side];
    const length=Math.hypot(...offset);let fraction=1;
    // Sweep the entire camera path so walls cannot hide the penguin or crosshair.
    for(let travel=.08;travel<=length+.08;travel+=.08) {
      const f=Math.min(1,travel/length),point=[player.x+offset[0]*f,player.y+offset[1]*f,player.z+offset[2]*f];
      let blocked=false;
      for(const dx of [-.08,.08])for(const dy of [-.08,.08])for(const dz of [-.08,.08])if(get(Math.floor(point[0]+dx),Math.floor(point[1]+dy),Math.floor(point[2]+dz)))blocked=true;
      if(blocked){fraction=Math.max(0,(travel-.16)/length);break;}
    }
    return {x:player.x+offset[0]*fraction,y:player.y+offset[1]*fraction,z:player.z+offset[2]*fraction,clearance:length*fraction};
  }
  function fieldOfView(){const base=['titanic','taipei101'].includes(currentArea)?Math.PI/2.5:Math.PI/3;return !godView&&!preferences.thirdPerson?Math.max(.55,Math.min(1.55,base*cameraDistance/3.6)):base;}
  function viewProjection() {
    const cy=Math.cos(player.yaw),sy=Math.sin(player.yaw),cp=Math.cos(player.pitch),sp=Math.sin(player.pitch);
    const camera=cameraEye(),right=[cy,0,sy], up=[-sy*sp,cp,cy*sp], back=[-sy*cp,-sp,cy*cp], eye=[camera.x,camera.y,camera.z];
    const dot=v=>v.reduce((sum,n,i)=>sum+n*eye[i],0);
    const view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,-dot(right),-dot(up),-dot(back),1]);
    const f=1/Math.tan(fieldOfView()/2), aspect=canvas.width/canvas.height, near=.08, far=godView?300:110;
    const projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    return multiply(projection,view);
  }
  function aimDirection() {
    const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw),sp=Math.sin(player.pitch),cp=Math.cos(player.pitch);
    const sx=2*aimOffset.x/innerHeight*Math.tan(fieldOfView()/2),syScreen=-2*aimOffset.y/innerHeight*Math.tan(fieldOfView()/2);
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
    const dir=aimDirection(),eye=cameraEye();
    let xyz=[Math.floor(eye.x),Math.floor(eye.y),Math.floor(eye.z)], prev=[...xyz];
    const origin=[eye.x,eye.y,eye.z], step=dir.map(d=>d>=0?1:-1);
    const delta=dir.map(d=>Math.abs(d)>1e-8?Math.abs(1/d):Infinity);
    const max=dir.map((d,i)=>Math.abs(d)>1e-8?((xyz[i]+(step[i]>0?1:0)-origin[i])/d):Infinity);
    let distance=0;
    const reach=24+(preferences.thirdPerson&&!godView?eye.clearance:0);
    for(let i=0;i<110 && distance<reach;i++) {
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
    const [x,y,z]=hit.xyz,paths=[],eye=cameraEye();
    function project(v) {
      const point=[x+v[0],y+v[1],z+v[2],1];
      const clip=[0,0,0,0];
      for(let row=0;row<4;row++) for(let k=0;k<4;k++) clip[row]+=vp[k*4+row]*point[k];
      if(clip[3]<.08)return null;
      return [(clip[0]/clip[3]*.5+.5)*innerWidth,(.5-clip[1]/clip[3]*.5)*innerHeight];
    }
    for(const face of faces) {
      if(get(x+face.n[0],y+face.n[1],z+face.n[2]))continue;
      const facing=face.n[0]*(eye.x-x-.5-face.n[0]*.5)+face.n[1]*(eye.y-y-.5-face.n[1]*.5)+face.n[2]*(eye.z-z-.5-face.n[2]*.5);
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
    audio.play(kind,selected);
  }
  function onGround(p=player) {
    const feet=p.y-EYE_HEIGHT;
    if(feet<=1+EPSILON)return true;
    for(const dx of [-.16,.16])for(const dz of [-.16,.16])if(get(Math.floor(p.x+dx),Math.floor(feet-.035),Math.floor(p.z+dz)))return true;
    return false;
  }
  function resetAvatar() {
    Object.assign(avatar,{mode:onGround()?'idle':'hover',heading:player.yaw,walk:0,rise:0,sink:0,fall:0,hover:0,landing:0,action:0,grounded:onGround(),last:{...player},step:0});
  }
  function updateAvatar(dt) {
    if(godView||dt<=0)return;
    const dx=player.x-avatar.last.x,dz=player.z-avatar.last.z,vy=(player.y-avatar.last.y)/dt,speed=Math.hypot(dx,dz)/dt,grounded=onGround();
    const mode=grounded?(speed>.02?'walk':'idle'):vy>.02?'rise':vy<-.02?(falling?'fall':'sink'):'hover';
    if(grounded&&!avatar.grounded){avatar.landing=1;playTone('land');}
    if(mode==='fall'&&avatar.mode!=='fall')playTone('fall');
    avatar.mode=mode;avatar.grounded=grounded;avatar.phase+=dt*(mode==='walk'?13:mode==='rise'?13.5:mode==='sink'||mode==='fall'?5:mode==='hover'?3.4:3);
    const smoothing=1-Math.exp(-dt*10);
    for(const state of ['walk','rise','sink','fall','hover'])avatar[state]+=(Number(mode===state)-avatar[state])*smoothing;
    avatar.landing*=Math.exp(-dt*8);avatar.action*=Math.exp(-dt*9);
    const heading=speed>.02?Math.atan2(dx,-dz):avatar.heading,angle=Math.atan2(Math.sin(heading-avatar.heading),Math.cos(heading-avatar.heading));
    avatar.heading+=angle*(1-Math.exp(-dt*12));
    const step=Math.floor(avatar.phase/Math.PI);if(mode==='walk'&&step!==avatar.step)playTone('step');avatar.step=step;
    if(mode==='rise')playTone('fly');if(mode==='sink')playTone('sink');
    avatar.last={...player};$('character-state').textContent={idle:'小企鵝建築師',walk:'搖搖走路',rise:'拍翅飛高',sink:'張翅飛低',fall:'輕輕落下',hover:'空中停一停'}[mode];
  }
  let lastPortrait=0;
  function drawPenguin(time) {
    const physical=godView?godView.player:player,eye=cameraEye();
    if(started&&(godView||preferences.thirdPerson&&eye.clearance>.75)) {
      const data=window.BlockPenguin.geometry(avatar,{x:physical.x,y:physical.y-EYE_HEIGHT,z:physical.z},avatar.heading,faces);
      gl.bindBuffer(gl.ARRAY_BUFFER,penguinMesh);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);bind(penguinMesh);gl.drawArrays(gl.TRIANGLES,0,data.length/10);
    }
    if(time-lastPortrait>65){window.BlockPenguin.portrait($('penguin-portrait'),avatar,faces);lastPortrait=time;}
  }
  function savePreferences(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(preferences));}catch{/* World saving has its own feedback. */}}
  function updateSettingsUI() {
    for(const [id,key,label] of [['sound','sfx','音效'],['music','music','背景音樂']]) {
      const active=preferences[key],button=$(id);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',(active?'關閉':'開啟')+label);button.title=label+(active?'：開啟':'：關閉');button.classList.toggle('audio-on',active);
    }
    $('volume').value=Math.round(preferences.volume*100);$('help-volume').value=Math.round(preferences.volume*100);
    $('camera-view').innerHTML=preferences.thirdPerson?'◉<span>第一人稱</span>':'◉<span>看企鵝</span>';
    $('camera-view').setAttribute('aria-pressed',String(preferences.thirdPerson));$('camera-view').title='切換企鵝視角與第一人稱（F）';
  }
  function toggleCamera() {
    if(!canAct())return;preferences.thirdPerson=!preferences.thirdPerson;updateSettingsUI();savePreferences();
    showToast(preferences.thirdPerson?'跟著小企鵝探索！滾輪可以拉近、拉遠':'第一人稱：用準心蓋積木，滾輪可以縮放');
  }
  function adjustZoom(amount) {
    if(!canAct())return;preferences.distance=Math.max(1.4,Math.min(7.5,preferences.distance+amount));
    if(godView)positionGodCamera();savePreferences();
  }
  async function toggleAudio(key) {
    preferences[key]=!preferences[key];audio.configure(preferences);audio.setActive(canAct()&&focused&&document.visibilityState!=='hidden');
    if(preferences[key]&&!await audio.unlock()){preferences[key]=false;audio.configure(preferences);showToast('這個瀏覽器暫時無法播放聲音，遊戲可以繼續玩');}
    else {showToast((key==='sfx'?'音效':'背景音樂')+(preferences[key]?'開啟了 ♪':'已關閉'));if(key==='sfx'&&preferences[key])playTone('pick');}
    updateSettingsUI();savePreferences();
  }
  function updateQuests(celebrate=false) {
    const completed=built>=1?(built>=8?(usedColors.size>=3?3:2):1):0;
    if(completed>achievements) { achievements=completed; if(celebrate){showToast(['','✦ 太棒了！第一塊積木！','✦ 你是小小建築師了！','✦ 三顆星！繼續蓋你的夢想吧！'][completed]);playTone('win');} }
    const q=Math.min(achievements,3);
    const titles=['放下第一塊積木',currentArea==='street'?'打造你的街道':currentArea==='volcano'?'小小火山探險家':currentArea==='meadow'?'從零蓋出夢想':'蓋一個小小作品','讓世界變得繽紛','你是超棒的建築師！'];
    const details=['選一個喜歡的素材，按「放積木」！',`已放 ${Math.min(built,8)} / 8 塊！${areas[currentArea].idea}`, `試試 3 種積木！已經用了 ${Math.min(usedColors.size,3)} 種`,areas[currentArea].idea+'，自由創作吧！'];
    $('quest-title').textContent=titles[q]; $('quest-detail').textContent=details[q]; $('quest-progress').textContent=q===3?'完成！':`${q+1} / 3`;
    $('stars').textContent=Array.from({length:3},(_,i)=>i<q?'★':'☆').join(' ');
    $('progress-fill').style.width=`${q===0?0:q===1?Math.min(built/8,1)*100:q===2?Math.min(usedColors.size/3,1)*100:100}%`;
  }
  function canAct() { return started && !document.querySelector('.modal-backdrop:not(.hidden)'); }
  function occupied(x,y,z) {
    return player.x+BODY_RADIUS>x && player.x-BODY_RADIUS<x+1 && player.z+BODY_RADIUS>z && player.z-BODY_RADIUS<z+1 && player.y+HEAD_HEIGHT>y && player.y-EYE_HEIGHT<y+1;
  }
  function cloneHistoryItem(item) {return {kind:item.kind,edits:item.edits.map(e=>({...e,xyz:[...e.xyz]}))};}
  function remember(edits,kind) {history.push({edits,kind});if(history.length>150)history.shift();}
  function updateBombs(seconds) {
    if(!canAct()||document.visibilityState==='hidden'||!Number.isFinite(seconds)||seconds<=0)return;
    const expired=[];let changed=false;
    for(const [key,b] of bombs) {
      if(get(...b.xyz)!==19){bombs.delete(key);changed=true;continue;}
      const before=Math.ceil(b.remaining);b.remaining=Math.max(0,b.remaining-seconds);
      if(Math.ceil(b.remaining)!==before){changed=true;if(Math.ceil(b.remaining)>0&&Math.ceil(b.remaining)<=3)playTone('tick');}
      if(b.remaining===0)expired.push(key);
    }
    // A nearby bomb is removed by the blast, with no chain reaction.
    for(const key of expired)if(bombs.has(key))explode(bombs.get(key));
    for(const burst of bursts)burst.age+=seconds;
    while(bursts.length&&bursts[0].age>1.1)bursts.shift();
    if(changed){dirty=true;scheduleSave();}
  }
  function explode(bomb) {
    const [cx,cy,cz]=bomb.xyz,edits=[];
    for(let dx=-BLAST_RADIUS;dx<=BLAST_RADIUS;dx++)for(let dy=-BLAST_RADIUS;dy<=BLAST_RADIUS;dy++)for(let dz=-BLAST_RADIUS;dz<=BLAST_RADIUS;dz++) {
      const xyz=[cx+dx,cy+dy,cz+dz];
      if(dx*dx+dy*dy+dz*dz>BLAST_RADIUS*BLAST_RADIUS||!inside(...xyz)||xyz[1]===0)continue;
      const before=get(...xyz);if(!before)continue;
      edits.push({xyz,before,after:0});set(...xyz,0);changes[xyz.join(',')]=0;bombs.delete(xyz.join(','));
    }
    if(edits.length)remember(edits,'explosion');
    bursts.push({xyz:[cx+.5,cy+.5,cz+.5],age:0});dirty=true;scheduleSave();playTone('explode');
    showToast('積木炸開了！按「復原」就能還原');
  }
  function drawBursts(vp) {
    if(!canAct())return;
    for(const burst of bursts)for(let i=0;i<16;i++) {
      const angle=i*Math.PI*2/16,spread=burst.age*3.5;
      const point=[burst.xyz[0]+Math.cos(angle)*spread,burst.xyz[1]+Math.sin(i*2.1)*spread+burst.age,burst.xyz[2]+Math.sin(angle)*spread,1],clip=[0,0,0,0];
      for(let r=0;r<4;r++)for(let k=0;k<4;k++)clip[r]+=vp[k*4+r]*point[k];
      if(clip[3]<.08)continue;
      const x=(clip[0]/clip[3]*.5+.5)*innerWidth,y=(.5-clip[1]/clip[3]*.5)*innerHeight,size=Math.max(2,32/clip[3]);
      outlineContext.globalAlpha=Math.max(0,1-burst.age/1.1);outlineContext.fillStyle=['#ffdd75','#ef8b8b','#8bc6ce','#9dc887'][i%4];outlineContext.fillRect(x-size,y-size,size*2,size*2);
    }
    outlineContext.globalAlpha=1;
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
    remember([{xyz:[...xyz],before,after}],action);
    const key=xyz.join(',');bombs.delete(key);
    if(after===19)bombs.set(key,{xyz:[...xyz],remaining:BOMB_SECONDS});
    set(...xyz,after); changes[xyz.join(',')]=after; dirty=true;
    if(action==='place') {built++;usedColors.add(selected);}
    avatar.action=1;playTone(action); updateQuests(true); scheduleSave();
    if(after===19)showToast('10 秒後炸開！拿掉可取消，復原可還原');
  }
  function undo() {
    if(!canAct()) return;
    const item=history.pop(); if(!item){showToast('還沒有要復原的動作，先蓋一蓋吧！');return;}
    for(const edit of item.edits){set(...edit.xyz,edit.before);changes[edit.xyz.join(',')]=edit.before;bombs.delete(edit.xyz.join(','));}
    bursts.length=0;dirty=true;scheduleSave();playTone('undo');showToast(item.kind==='explosion'?'爆炸已復原！炸彈已停止，再放一次才會倒數':'上一個動作復原了！');
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
    else {godView={player:{...player},aim:{...aimOffset}};positionGodCamera();positionAim();showToast('從高空看看作品，滾輪可以拉近、拉遠');}
    updateGodView();if(!godView)resetAvatar();
  }
  function positionGodCamera() {const height=Math.max(currentArea==='taipei101'?44:24,(currentArea==='taipei101'?70:42)*Math.max(1,innerHeight/innerWidth)*(cameraDistance/3.6));Object.assign(player,{x:20.5,y:height,z:38.5,yaw:0,pitch:-Math.atan2(height-(currentArea==='taipei101'?16:4),18)});}
  function home() { godView=null;updateGodView();falling=false;fallVelocity=0;Object.assign(player,areas[currentArea].spawn);positionAim();clearMovement();resetAvatar(); }
  function choose(type) {
    if(!blocks.some(b=>b.id===type))return;
    selected=type;
    if(!paletteGroups[paletteGroup].includes(type))renderPalette(Object.keys(paletteGroups).find(group=>paletteGroups[group].includes(type)));
    document.querySelectorAll('.block-choice').forEach(b=>{ const active=Number(b.dataset.type)===type; b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active)); });
  }
  function renderPalette(group) {
    if(!Object.hasOwn(paletteGroups,group))return;
    paletteGroup=group;$('palette').innerHTML='';
    $('palette-note').textContent=group==='fun'?'10 秒倒數 · 炸開附近 2 格 · 拿掉取消 · 復原還原':'';
    for(const name of Object.keys(paletteGroups)){$('palette-'+name).setAttribute('aria-pressed',String(name===group));}
    paletteGroups[group].forEach((type,i)=>{
      const block=blocks.find(b=>b.id===type),b=document.createElement('button');b.className='block-choice';b.dataset.type=block.id;b.title=`${block.name}（${i+1}）`;b.setAttribute('aria-label',`選擇${block.name}積木`);b.setAttribute('aria-pressed',String(selected===type));
      b.classList.toggle('active',selected===type);b.innerHTML=`<span class="key">${i+1}</span><span class="swatch" style="--block:${block.color}"></span><span class="block-name">${block.name}</span>`;
      b.addEventListener('click',()=>choose(block.id));$('palette').appendChild(b);
    });
  }
  function pickBlock() {
    if(!canAct()||godView)return;
    const target=raycast();if(!target){showToast('先用準心對準想要的積木');return;}
    choose(target.type);playTone('pick');showToast('選好了：'+blocks.find(b=>b.id===target.type).name+'積木！');
  }
  for(const group of Object.keys(paletteGroups))$('palette-'+group).onclick=()=>renderPalette(group);
  renderPalette(paletteGroup);choose(selected);
  $('area-select').addEventListener('change',e=>{switchArea(e.target.value);e.target.blur();});
  $('start').onclick=()=>{started=true;$('welcome').classList.add('hidden');audio.setActive(true);if(preferences.sfx||preferences.music)audio.unlock();showToast('小企鵝出發！拖曳轉頭，滾輪拉近、拉遠');};
  $('help').onclick=()=>{$('help-modal').classList.remove('hidden');keys.clear();held.clear();};
  $('close-help').onclick=()=>$('help-modal').classList.add('hidden');
  $('sound').onclick=()=>toggleAudio('sfx');$('music').onclick=()=>toggleAudio('music');
  $('camera-view').onclick=toggleCamera;$('zoom-in').onclick=()=>adjustZoom(-.5);$('zoom-out').onclick=()=>adjustZoom(.5);
  for(const id of ['volume','help-volume'])$(id).addEventListener('input',e=>{preferences.volume=Math.max(0,Math.min(.85,Number(e.target.value)/100));audio.configure(preferences);updateSettingsUI();savePreferences();});
  updateSettingsUI();
  $('place').onclick=()=>edit('place');$('remove').onclick=()=>edit('remove');$('undo').onclick=undo;
  $('home').onclick=()=>{home();showToast('回到'+areas[currentArea].name+'的起點了！');};
  $('god-view').onclick=toggleGodView;
  $('reset').onclick=()=>{$('reset-area-name').textContent='要重新開始「'+areas[currentArea].name+'」嗎？';$('reset-modal').classList.remove('hidden');clearMovement();};
  $('cancel-reset').onclick=()=>$('reset-modal').classList.add('hidden');
  $('confirm-reset').onclick=()=>{clearTimeout(saveTimer);changes={};history=[];bombs.clear();bursts.length=0;built=0;usedColors.clear();achievements=0;makeWorld();dirty=true;home();choose(areas[currentArea].material);updateQuests();saveNow();$('reset-modal').classList.add('hidden');showToast(areas[currentArea].name+'重新開始了，其他區域都保留！');};
  document.addEventListener('contextmenu',e=>e.preventDefault());
  function handleKeyDown(e) {
    if(e.code==='Escape') { $('help-modal').classList.add('hidden');$('reset-modal').classList.add('hidden');keys.clear();held.clear();return; }
    if(!canAct()) return;
    if(e.target&&['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName))return;
    if((e.code==='ShiftLeft'||e.code==='ShiftRight') && !e.repeat && !keys.has('ShiftLeft') && !keys.has('ShiftRight') && !godView) {
      const now=Number.isFinite(e.timeStamp)?e.timeStamp:performance.now();
      if(lastShiftPress!==null && now-lastShiftPress>=0 && now-lastShiftPress<=330){falling=true;fallVelocity=0;lastShiftPress=null;showToast('輕輕落地囉！按空白鍵可以停住');}
      else lastShiftPress=now;
    }
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyE','KeyQ','KeyR'].includes(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.repeat)return;
    if(e.code==='KeyE')edit('place');if(e.code==='KeyQ')edit('remove');if(e.code==='KeyZ')undo();if(e.code==='KeyR')pickBlock();
    if(e.code==='KeyF'){e.preventDefault();toggleCamera();}
    const digit=Number(e.key);if(digit>=1 && digit<=paletteGroups[paletteGroup].length)choose(paletteGroups[paletteGroup][digit-1]);
  }
  document.addEventListener('keydown',handleKeyDown);
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{focused=false;clearMovement();drag=null;audio.setActive(false);});
  window.addEventListener('focus',()=>{focused=true;if(audio.status().ready&&(preferences.sfx||preferences.music))audio.unlock();});
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
  canvas.addEventListener('wheel',e=>{if(!canAct())return;e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);adjustZoom(Math.max(-.6,Math.min(.6,delta*.005)));},{passive:false});
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
      else if(!falling && player.y+1.002<=FLY_LIMIT && !collides(nx,player.y+1.002,nz)){player.x=nx;player.z=nz;player.y+=1.002;}
    }
    const rise=Number(pressed('rise',['Space'])),sink=Number(pressed('sink',['ShiftLeft','ShiftRight']));
    if(rise){falling=false;fallVelocity=0;const ny=Math.min(FLY_LIMIT,player.y+step);if(!collides(player.x,ny,player.z))player.y=ny;}
    else if(falling){fallVelocity=Math.min(28,fallVelocity+18*dt);if(lowerTo(player.y-fallVelocity*dt)){falling=false;fallVelocity=0;showToast('到地面了！繼續蓋積木吧');}}
    else if(sink)lowerTo(player.y-step);
  }
  let lastAim='';
  function frame(time) {
    const elapsed=lastTime?Math.max(0,(time-lastTime)/1000):0;lastTime=time;
    if(Math.abs(cameraDistance-preferences.distance)>.0001){cameraDistance+=(preferences.distance-cameraDistance)*(1-Math.exp(-Math.min(elapsed,.04)*10));if(godView)positionGodCamera();}
    const active=canAct()&&document.visibilityState!=='hidden';audio.setActive(active&&focused);audio.tick();
    if(active){const dt=Math.min(elapsed,.04);move(dt);updateAvatar(dt);updateBombs(elapsed);}
    if(dirty)rebuild();
    const vp=viewProjection(),eye=cameraEye();
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(loc.vp,false,vp);gl.uniform3f(loc.eye,eye.x,eye.y,eye.z);gl.uniform1f(loc.outline,0);gl.uniform2f(loc.fog,godView?200:20,godView?300:58);gl.uniform3f(loc.sky,...areas[currentArea].sky);gl.uniform1f(loc.time,time/1000);bind(mesh);gl.drawArrays(gl.TRIANGLES,0,meshCount);drawPenguin(time);
    hit=raycast();drawOutline(vp);drawBursts(vp);
    const aim=godView?'上帝視角 · 按「回到原位」繼續玩':hit?'亮框：E 放積木 / Q 拿掉':'靠近積木，再往下看一看';
    if(aim!==lastAim){$('aim-label').textContent=aim;lastAim=aim;}
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.visibilityState==='hidden')audio.suspend();else if(audio.status().ready&&(preferences.sfx||preferences.music))audio.unlock();if(started)saveNow();});
  makeWorld();home();choose(areas[currentArea].material);loadSave();resetAvatar();updateAreaUI();updateQuests();window.BlockPenguin.portrait($('penguin-portrait'),avatar,faces);requestAnimationFrame(frame);
})();
