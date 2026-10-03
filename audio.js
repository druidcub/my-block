(() => {
  'use strict';
  // Original notes and synthesized effects keep the game entirely offline.
  const melody=[67,72,76,74,72,0,69,72,74,76,79,0,76,74,72,0,69,72,76,74,72,0,67,69,72,74,76,0,74,69,72,0,
    64,67,72,74,76,0,74,72,69,72,74,0,72,69,67,0,65,69,72,74,72,0,69,65,67,72,76,0,74,69,72,0];
  const bass=[48,53,57,55,53,48,53,55];
  const frequency=midi=>440*Math.pow(2,(midi-69)/12);
  function create(settings={}) {
    let ctx,master,sfxBus,musicBus,noiseBuffer,nextBeat=0,beat=0,active=false;
    let config={sfx:false,music:false,volume:.55,...settings};
    const live=new Map(),cooldowns=new Map();
    function stop(channel) {
      for(const [source,group] of live)if(!channel||group===channel){try{source.stop();}catch{/* Already finished. */}live.delete(source);}
    }
    function track(source,channel,nodes) {
      live.set(source,channel);source.onended=()=>{live.delete(source);for(const n of [source,...nodes])n.disconnect();};
    }
    function envelope(gain,when,duration,level) {
      gain.gain.setValueAtTime(.0001,when);gain.gain.linearRampToValueAtTime(level,when+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
    }
    function tone(hz,end,duration,level,when=ctx.currentTime,channel='sfx',type='sine') {
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;
      osc.frequency.setValueAtTime(hz,when);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),when+duration);
      envelope(gain,when,duration,level);osc.connect(gain);gain.connect(channel==='music'?musicBus:sfxBus);
      track(osc,channel,[gain]);osc.start(when);osc.stop(when+duration+.02);
    }
    function noise(duration,level,hz,filter='lowpass') {
      const source=ctx.createBufferSource(),gain=ctx.createGain(),eq=ctx.createBiquadFilter();source.buffer=noiseBuffer;
      eq.type=filter;eq.frequency.value=hz;eq.Q.value=.65;envelope(gain,ctx.currentTime,duration,level);
      source.connect(eq);eq.connect(gain);gain.connect(sfxBus);track(source,'sfx',[eq,gain]);source.start();source.stop(ctx.currentTime+duration+.02);
    }
    async function unlock() {
      try {
        if(!ctx) {
          const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
          ctx=new Audio();master=ctx.createGain();sfxBus=ctx.createGain();musicBus=ctx.createGain();
          const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-18;limiter.knee.value=24;limiter.ratio.value=4;limiter.attack.value=.006;limiter.release.value=.18;
          sfxBus.connect(master);musicBus.connect(master);master.connect(limiter);limiter.connect(ctx.destination);
          noiseBuffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const samples=noiseBuffer.getChannelData(0);
          for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
          configure(config);
        }
        if(ctx.state==='suspended')await ctx.resume();nextBeat=Math.max(nextBeat,ctx.currentTime+.06);return ctx.state==='running';
      } catch { return false; }
    }
    function configure(next) {
      const previous=config;config={...config,...next};config.volume=Math.min(.85,Math.max(0,Number(config.volume)||0));
      if(!ctx)return;
      master.gain.setTargetAtTime(config.volume,ctx.currentTime,.035);
      sfxBus.gain.setTargetAtTime(config.sfx ? .55 : 0,ctx.currentTime,.025);
      musicBus.gain.setTargetAtTime(config.music&&active ? .36 : 0,ctx.currentTime,.08);
      if(!config.sfx)stop('sfx');if(!config.music)stop('music');
      if(config.music&&!previous.music){beat=0;nextBeat=ctx.currentTime+.08;}
    }
    function setActive(value) {
      if(active===value)return;active=value;if(!ctx)return;
      musicBus.gain.setTargetAtTime(config.music&&active ? .36 : 0,ctx.currentTime,.08);
      if(!active)stop();else nextBeat=ctx.currentTime+.08;
    }
    function play(kind,material=0) {
      if(!config.sfx||!active||!ctx||ctx.state!=='running'||live.size>48)return;
      const cooldown={step:.28,fly:.45,sink:.55,fall:.5,explode:.08,tick:.15}[kind]||.04;
      if(ctx.currentTime-(cooldowns.get(kind)??-Infinity)<cooldown)return;cooldowns.set(kind,ctx.currentTime);
      if(kind==='place'){noise(.075,.13,material===3?850:1500,'bandpass');tone(material===3?260:360,180,.11,.065);tone(880,760,.07,.014);}
      else if(kind==='remove'){noise(.14,.10,1100,'highpass');tone(460,220,.14,.035,ctx.currentTime,'sfx','triangle');}
      else if(kind==='explode'){noise(.5,.20,560);tone(120,42,.38,.15);tone(330,440,.16,.025,ctx.currentTime+.08);}
      else if(kind==='step'){noise(.07,.025,550);tone(110,65,.08,.034);}
      else if(kind==='fly'||kind==='sink'){noise(.15,.033,kind==='fly'?950:650);}
      else if(kind==='fall'){tone(660,300,.38,.027);noise(.18,.025,700);}
      else if(kind==='land'){noise(.12,.055,430);tone(200,85,.16,.07);}
      else if(kind==='tick'){tone(660,600,.055,.022);}
      else if(kind==='win'){[523.25,659.25,783.99].forEach((hz,i)=>tone(hz,hz,.22,.07,ctx.currentTime+i*.12));}
      else if(kind==='undo'){tone(580,300,.18,.05,ctx.currentTime,'sfx','triangle');}
      else tone(780,660,.10,.045);
    }
    function tick() {
      if(!active||!config.music||!ctx||ctx.state!=='running')return;
      if(nextBeat<ctx.currentTime-.1)nextBeat=ctx.currentTime+.06;
      while(nextBeat<ctx.currentTime+.3) {
        const note=melody[beat%melody.length];
        if(note){const hz=frequency(note);tone(hz,hz,.66,.16,nextBeat,'music');tone(hz*2,hz*2,.35,.021,nextBeat,'music');}
        if(beat%8===0){const hz=frequency(bass[Math.floor(beat/8)%bass.length]);tone(hz,hz,2.5,.12,nextBeat,'music');tone(hz*1.5,hz*1.5,2.2,.038,nextBeat,'music');}
        beat++;nextBeat+=60/88;
      }
    }
    function suspend(){setActive(false);if(ctx&&ctx.state==='running')ctx.suspend().catch(()=>{});}
    return {unlock,configure,setActive,play,tick,suspend,status:()=>({ready:Boolean(ctx),running:ctx?.state==='running',active,voices:live.size,...config})};
  }
  window.BlockAudio={create};
})();
