(() => {
  'use strict';
  function create({active,aim,turn,zoom,tap}) {
    const fingers=new Map();let drag=null,multi=false,lastDistance=0;
    const distance=()=>{const points=[...fingers.values()];return points.length<2?0:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);};
    function reset(){fingers.clear();drag=null;multi=false;lastDistance=0;}
    function down(e){
      if(!active()){reset();return;}
      if(e.pointerType==='touch') {
        fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(fingers.size>1){multi=true;drag=null;lastDistance=distance();return;}
      }else if(fingers.size)return;
      aim(e.clientX,e.clientY);drag={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0,button:e.button};
    }
    function move(e){
      if(!active()){reset();return;}
      if(e.pointerType==='touch') {
        if(!fingers.has(e.pointerId))return;
        fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(multi){const current=distance();if(current>=12&&lastDistance>=12)zoom(lastDistance/current);lastDistance=current;return;}
      }
      if(!drag){if(e.pointerType!=='touch'&&!fingers.size)aim(e.clientX,e.clientY);return;}
      if(drag.id!==e.pointerId)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.distance+=Math.abs(dx)+Math.abs(dy);turn(dx,dy);
    }
    function finish(e,cancelled){
      if(drag?.id===e.pointerId){if(!cancelled&&active()&&!multi&&drag.distance<6)tap(drag.button===2?'remove':'place');drag=null;}
      fingers.delete(e.pointerId);lastDistance=distance();
      if(!fingers.size){multi=false;lastDistance=0;}
    }
    return {down,move,up:e=>finish(e,false),cancel:e=>finish(e,true),reset};
  }
  window.BlockTouch={create};
})();
