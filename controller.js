(() => {
  'use strict';
  const BUTTON = Object.freeze({jump:0,gravity:1,undo:2,camera:3,previous:4,next:5,remove:6,place:7,god:8,menu:9,pick:10,sink:11,up:12,down:13,left:14,right:15});
  const finite = n => Number.isFinite(n) ? Math.max(-1,Math.min(1,n)) : 0;
  function stick(axes,x,y,deadzone) {
    const dx=finite(axes[x]),dy=finite(axes[y]),length=Math.hypot(dx,dy);
    if(length<=deadzone)return {x:0,y:0};
    const scale=(Math.min(1,length)-deadzone)/(1-deadzone)/length;
    return {x:dx*scale,y:dy*scale};
  }
  function create() {
    let device='',context='',previous=new Set(),blocked=new Set(),nextRepeat=new Map();
    function reset(){device='';context='';previous.clear();blocked.clear();nextRepeat.clear();}
    function poll(pads,time,mode='play',options={}) {
      const candidates=Array.from(pads||[]).filter(p=>p&&p.connected!==false);
      const pad=candidates.find(p=>`${p.index}:${p.id}`===device)||candidates.find(p=>p.mapping==='standard')||candidates[0];
      const empty={connected:false,usable:false,id:'',index:-1,mapping:'',move:{x:0,y:0},look:{x:0,y:0},down:new Set(),pressed:new Set(),repeat:new Set(),active:false};
      if(!pad){reset();return empty;}
      const usable=pad.mapping==='standard'||options.allowRaw===true;
      const result={...empty,connected:true,usable,id:String(pad.id||'手把'),index:pad.index,mapping:pad.mapping||''};
      if(!usable){reset();return result;}
      const now=Number.isFinite(time)?time:0,newDevice=`${pad.index}:${pad.id}`,down=new Set();
      Array.from(pad.buttons||[]).forEach((b,i)=>{if(typeof b==='number'?b>.55:b&&(b.pressed||b.value>.55))down.add(i);});
      if(newDevice!==device||mode!==context){blocked=new Set(down);previous=new Set(down);nextRepeat.clear();device=newDevice;context=mode;}
      for(const i of blocked)if(!down.has(i))blocked.delete(i);
      for(const i of down) {
        if(blocked.has(i))continue;
        result.down.add(i);
        if(!previous.has(i)){result.pressed.add(i);result.repeat.add(i);nextRepeat.set(i,now+.35);}
        else if(now>=(nextRepeat.get(i)??Infinity)){result.repeat.add(i);nextRepeat.set(i,now+.35);}
      }
      for(const i of previous)if(!down.has(i))nextRepeat.delete(i);
      previous=down;
      const deadzone=Number.isFinite(options.deadzone)?Math.max(.05,Math.min(.4,options.deadzone)):.16;
      const axes=pad.axes||[],lookStart=Number.isInteger(options.lookAxis)?options.lookAxis:2;
      result.move=stick(axes,0,1,deadzone);result.look=stick(axes,lookStart,lookStart+1,deadzone);
      result.active=result.down.size>0||Math.hypot(result.move.x,result.move.y,result.look.x,result.look.y)>.04;
      return result;
    }
    return {poll,reset};
  }
  window.BlockController={create,BUTTON};
})();
