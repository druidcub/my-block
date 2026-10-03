const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','audio.js'),'utf8');
class Param {
  constructor(){this.value=0;this.events=[];}
  setValueAtTime(value,time){this.value=value;this.events.push({value,time});}
  linearRampToValueAtTime(value,time){this.events.push({value,time});}
  exponentialRampToValueAtTime(value,time){assert.ok(value>0);this.events.push({value,time});}
  setTargetAtTime(value,time){this.value=value;this.events.push({value,time});}
}
class Node {
  constructor(type,context){this.context=context;this.kind=type;for(const name of ['gain','frequency','Q','threshold','knee','ratio','attack','release'])this[name]=new Param();}
  connect(node){this.output=node;}
  disconnect(){this.disconnected=true;}
  start(time=this.context.currentTime){this.started=time;}
  stop(time){this.stopped=time??true;}
}
class FakeAudio {
  constructor(){FakeAudio.last=this;this.state='suspended';this.currentTime=0;this.sampleRate=48000;this.destination={};this.nodes=[];}
  node(type){const n=new Node(type,this);this.nodes.push(n);return n;}
  createGain(){return this.node('gain');}
  createDynamicsCompressor(){return this.node('limiter');}
  createOscillator(){return this.node('tone');}
  createBufferSource(){return this.node('noise');}
  createBiquadFilter(){return this.node('filter');}
  createBuffer(channels,length,rate){assert.equal(rate,48000);return {getChannelData:()=>new Float32Array(length)};}
  async resume(){this.state='running';}
  async suspend(){this.state='suspended';}
}
function boot(config={},AudioContext=FakeAudio){const context={window:{AudioContext}};vm.createContext(context);vm.runInContext(source,context);return context.window.BlockAudio.create(config);}
let checks=0;
async function check(label,fn){await fn();checks++;console.log('PASS '+label);}
async function main(){
  await check('Audio remains uninitialized and silent until explicitly unlocked',()=>{const a=boot();assert.equal(a.status().ready,false);a.play('place');a.tick();assert.equal(a.status().voices,0);});
  await check('Effects have distinct synthesis, bounded envelopes and finite scheduled stop times',async()=>{const a=boot({sfx:true});await a.unlock();a.setActive(true);const ctx=FakeAudio.last;for(const kind of ['place','remove','explode','step','fly','sink','fall','land','tick','win','undo','pick']){const from=ctx.nodes.length;a.play(kind,3);const nodes=ctx.nodes.slice(from),sources=nodes.filter(n=>n.kind==='tone'||n.kind==='noise');assert.ok(sources.length>0,kind);for(const n of sources){assert.ok(n.stopped>n.started);assert.ok(n.stopped-n.started<=.6);const gains=nodes.filter(n=>n.kind==='gain').flatMap(n=>n.gain.events.map(e=>e.value));assert.ok(gains.every(v=>v>=0&&v<=.2));}ctx.currentTime++;}assert.ok(ctx.nodes.some(n=>n.kind==='filter'&&n.frequency.value===560));assert.ok(ctx.nodes.some(n=>n.kind==='limiter'));});
  await check('Step and wing sounds are throttled across rapid render frames',async()=>{const a=boot({sfx:true});await a.unlock();a.setActive(true);const ctx=FakeAudio.last;a.play('fly');const count=ctx.nodes.length;for(let i=0;i<20;i++){ctx.currentTime+=.01;a.play('fly');}assert.equal(ctx.nodes.length,count);ctx.currentTime=1;a.play('fly');assert.ok(ctx.nodes.length>count);});
  await check('Music and effects can each run while the other is disabled',async()=>{const a=boot({music:true,sfx:false});await a.unlock();a.setActive(true);const ctx=FakeAudio.last;a.play('explode');assert.equal(a.status().voices,0);a.tick();assert.ok(a.status().voices>=2);a.configure({music:false,sfx:true});assert.equal(a.status().voices,0);a.play('place');assert.ok(a.status().voices>0);const count=ctx.nodes.length;a.tick();assert.equal(ctx.nodes.length,count);});
  await check('Muting, pausing and hiding stop every scheduled sound; resume avoids a burst of missed notes',async()=>{const a=boot({music:true,sfx:true});await a.unlock();a.setActive(true);a.tick();a.play('place');assert.ok(a.status().voices>0);a.setActive(false);assert.equal(a.status().voices,0);const ctx=FakeAudio.last;ctx.currentTime=1000;a.setActive(true);const from=ctx.nodes.length;a.tick();const tones=ctx.nodes.slice(from).filter(n=>n.kind==='tone');assert.ok(tones.length>0&&tones.length<=4);assert.ok(tones.every(n=>n.started>=1000&&n.started<=1000.3));a.suspend();assert.equal(a.status().voices,0);assert.equal(ctx.state,'suspended');await a.unlock();assert.equal(ctx.state,'running');a.configure({music:false,sfx:false});assert.equal(a.status().voices,0);});
  await check('Master volume is clamped and changing it does not replace the audio context',async()=>{const a=boot();await a.unlock();const ctx=FakeAudio.last;a.configure({volume:2});assert.equal(a.status().volume,.85);a.configure({volume:-1});assert.equal(a.status().volume,0);assert.equal(FakeAudio.last,ctx);});
  await check('Browsers without Web Audio keep the rest of the game usable',async()=>{const a=boot({music:true,sfx:true},null);assert.equal(await a.unlock(),false);a.setActive(true);a.play('explode');a.tick();a.suspend();assert.equal(a.status().voices,0);});
  console.log(`${checks} audio checks passed.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
