(() => {
  'use strict';
  const ink=[.13,.18,.25],cream=[1,.96,.85],orange=[1,.65,.18],black=[.05,.08,.11];
  const clamp=n=>Math.max(0,Math.min(1,n||0));
  function geometry(pose={},origin={x:0,y:0,z:0},yaw=0,faces) {
    const data=[],uv=[[0,0],[0,1],[1,1],[1,0]],phase=pose.phase||0;
    const walk=clamp(pose.walk),rise=clamp(pose.rise),sink=clamp(pose.sink),fall=clamp(pose.fall),hover=clamp(pose.hover),land=clamp(pose.landing);
    const roll=Math.sin(phase)*walk*.045,lean=-.10*rise+.07*fall;
    const bob=Math.abs(Math.sin(phase))*walk*.014+Math.sin(phase*.5)*hover*.008-land*.045;
    const flap=.16+rise*(1.4+Math.sin(phase*1.8)*.6)+sink*1.3+fall*1.35+hover*(1.25+Math.sin(phase)*.4);
    function transform(v,joint,fixed) {
      let [x,y,z]=v;
      if(joint){const [px,py,pz,angle]=joint,c=Math.cos(angle),s=Math.sin(angle),dx=x-px,dy=y-py;x=px+c*dx-s*dy;y=py+s*dx+c*dy;z+=pz;}
      const c=Math.cos(roll),s=Math.sin(roll),dy=y-.25;
      if(!fixed){[x,y]=[c*x-s*dy,s*x+c*dy+.25];const cy=Math.cos(lean),sy=Math.sin(lean),h=y-.25;[y,z]=[cy*h-sy*z+.25,sy*h+cy*z];y+=bob;}
      return [origin.x+Math.cos(yaw)*x-Math.sin(yaw)*z,origin.y+y,origin.z+Math.sin(yaw)*x+Math.cos(yaw)*z];
    }
    function part(min,max,color,joint,fixed=false) {
      for(const face of faces)for(const j of [0,1,2,0,2,3]) {
        const v=face.v[j].map((n,i)=>min[i]+n*(max[i]-min[i]));
        data.push(...transform(v,joint,fixed),...color.map(n=>n*face.s),...uv[j],0,0);
      }
    }
    part([-.175,.13,-.13],[.175,.48,.13],ink);
    part([-.135,.17,-.145],[.135,.47,-.128],cream);
    part([-.165,.45,-.13],[.165,.755,.13],ink);
    for(const side of [-1,1]) {
      const x=side*.087;
      part([x-.071,.49,-.146],[x+.071,.705,-.128],cream);
      part([x-.026,.625,-.162],[x+.026,.674,-.146],black);
      part([x-.019,.653,-.165],[x-.005,.667,-.163],cream);
      const step=Math.sin(phase+(side<0?0:Math.PI))*walk;
      part([x-.071,.02+Math.max(0,step)*.035,-.19+step*.055],[x+.071,.081+Math.max(0,step)*.035,.058+step*.055],orange,null,true);
      const wing=side<0?[[-.215,.205,-.055],[-.17,.465,.055]]:[[.17,.205,-.055],[.215,.465,.055]];
      part(...wing,ink,[side*.175,.46,0,side*(flap+clamp(pose.action)*.24)]);
    }
    part([-.066,.545,-.22],[.066,.597,-.143],orange);
    part([-.056,.545,-.221],[.056,.558,-.218],[.78,.39,.10]);
    part([-.09,.17,.13],[.09,.25,.19],ink);
    return new Float32Array(data);
  }
  function portrait(canvas,pose,faces) {
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const size=canvas.width,mesh=geometry(pose,{x:0,y:0,z:0},-.34,faces),triangles=[];
    ctx.clearRect(0,0,size,size);
    for(let i=0;i<mesh.length;i+=30) {
      const vertices=[];let depth=0;
      for(let j=0;j<3;j++){const k=i+j*10,x=mesh[k],y=mesh[k+1],z=mesh[k+2];vertices.push([size*.5+x*size*.94,size*.87-y*size*.94-z*size*.13]);depth+=z;}
      triangles.push({vertices,depth,color:`rgb(${[mesh[i+3],mesh[i+4],mesh[i+5]].map(n=>Math.round(Math.min(1,n)*255)).join(',')})`});
    }
    triangles.sort((a,b)=>b.depth-a.depth);
    for(const t of triangles){ctx.fillStyle=t.color;ctx.beginPath();ctx.moveTo(...t.vertices[0]);ctx.lineTo(...t.vertices[1]);ctx.lineTo(...t.vertices[2]);ctx.closePath();ctx.fill();}
  }
  window.BlockPenguin={geometry,portrait};
})();
