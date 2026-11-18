import { startGameLoop } from './vendor/game-loop.js';
import {buildObstacleMap} from './vendor/pathfinder.js';
import {astar2D} from './vendor/office-pathfinding.js';
import {isLeadRole} from './vendor/lead-role.js';
import './vendor/life-sprites.js';

const statuses = {
  idle: ['Bo‘sh', '#cbd5df'], todo: ['Navbatda', '#d2b48b'],
  working: ['Ishlayapti', '#75d8ff'], review: ['Tekshiruvda', '#f9ca73'],
  approval: ['Tasdiq kutyapti', '#d7aeff'], done: ['Bajarildi', '#89e8b5'], error: ['Xatolik', '#ff9794']
};
const interiors = [
  ['#9f795b','#b38d68','#856348','#294d50'], ['#7c9992','#91aaa0','#66857f','#2e5053'],
  ['#6a8c8f','#7fa0a0','#55787c','#284750'], ['#607f91','#7293a1','#4b6b7c','#2a434f'],
  ['#ad8a66','#bf9c77','#90714e','#3b4d50'], ['#829483','#9bab92','#697f6c','#314d49']
];
const skins = ['#f0c49c','#ad7354','#dfaa7c','#bd876b','#f1c6ab'];
const shirts = ['#ce765d','#679bc4','#63aa93','#998cc0','#dbad61','#c07d9b'];
const hair = ['#4a342e','#28343c','#72513d','#967350','#444753'];
const ink = '#293138';
// Original indexed pixel art. Each letter is an opaque two-pixel tile.
const figure = [
  '    hhhhh    ','   hHHHHhh   ','  hHHHHHHhh  ','  hHHsssHsh  ',
  '  hssIssIsh  ','   ssstsss   ','    sssss    ','   cCssCcc   ',
  '  cCCCCCCCc  ','  sCCCCCCCs  ','  ssCCCCCss  ','    ppppp    ',
  '    pp pp    ','   bb   bb   '
];

export function mountOfficeMap(canvas, data, onAgent) {
  const rooms = data.rooms.map((room,index) => ({...room,index,
    staff:data.agents.filter(agent=>agent.room_id===room.id)}));
  const widthOfRoom = 320;
  const columns = rooms.length>6?Math.min(5,Math.ceil(rooms.length/2)):Math.min(Math.max(1,rooms.length),3);
  const rowSizes=[];
  for(const room of rooms){
    const row=Math.floor(room.index/columns);
    rowSizes[row]=Math.max(rowSizes[row]||0, 142+Math.max(1,Math.ceil(room.staff.length/3))*102);
  }
  const rowStarts=[];
  let height=9;
  for(const size of rowSizes){rowStarts.push(height);height+=size+46;}
  const width=columns*(widthOfRoom+7)+9;
  const ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=width*ratio;
  canvas.height=height*ratio;
  canvas.style.aspectRatio=width+' / '+height;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roster = new Map(data.agents.map((a,i)=>[a.id,i]));
  const seats=new Map();
  const obstacles=[];
  const cellSize=8;
  const block=(x,y,w,h)=>obstacles.push({x:Math.floor(x/cellSize),y:Math.floor(y/cellSize),
    w:Math.max(1,Math.ceil(w/cellSize)),h:Math.max(1,Math.ceil(h/cellSize))});
  for(const room of rooms){
    const row=Math.floor(room.index/columns),x=7+(room.index%columns)*(widthOfRoom+7),y=rowStarts[row];
    const bottom=y+rowSizes[row]-4;
    block(x,y,widthOfRoom,34);
    block(x,y,4,rowSizes[row]);block(x+widthOfRoom-4,y,4,rowSizes[row]);
    block(x,bottom,widthOfRoom/2-20,4);block(x+widthOfRoom/2+20,bottom,widthOfRoom/2-20,4);
    block(x+15,bottom-35,40,20);block(x+widthOfRoom-94,bottom-43,46,23);
    room.staff.forEach((agent,slot)=>{
      const perRow=room.staff.length===4?2:3;
      const count=Math.min(perRow,room.staff.length-Math.floor(slot/perRow)*perRow);
      seats.set(agent.id,{x:x+(slot%perRow+.5)*(widthOfRoom/count),y:y+77+Math.floor(slot/perRow)*102,
        doorX:x+widthOfRoom/2,doorY:y+rowSizes[row]+18});
      const seat=seats.get(agent.id);
      block(seat.x-25,seat.y-33,50,29);
    });
  }
  const cols=Math.ceil(width/cellSize),rows=Math.ceil(height/cellSize);
  const obstacleMap=buildObstacleMap(cols,rows,obstacles);
  const navGrid={cols,rows,cellSize,cells:Uint8Array.from(obstacleMap.flat().map(Boolean))};
  const meetingRoutes=new Map();
  const active=new Set(['working','review','approval','todo']);
  const assignments=new Map();
  for(const task of data.tasks){
    const previous=assignments.get(task.agent_id);
    if(!previous || (!active.has(previous.status) && active.has(task.status)))assignments.set(task.agent_id,task);
  }
  const messages=data.officeMeetings===false?[]:(data.agentMessages||[]).filter(message=>seats.has(message.from_agent)&&seats.has(message.to_agent));
  const targets=[];
  let elapsed=0,hovered,loop,lastDraw='';
  const characters=typeof Image==='undefined'?[]:Array.from({length:6},(_,index)=>{
    const img=new Image();
    img.onload=()=>{lastDraw='';if(canvas.isConnected)loop?.redraw();};
    img.src='/vendor/characters/char_'+index+'.png';
    return img;
  });
  function render(ctx){
    if(!canvas.isConnected){loop?.stop();return;}
    const meetings=messages.filter(message=>Date.now()-Date.parse(message.created_at)<8500);
    const animating=!reduced&&(data.officeMotion!==false||meetings.length>0);
    const tick=animating?Math.floor(elapsed*12):0;
    const key=tick+'|'+hovered;
    if(lastDraw===key)return;
    lastDraw=key;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
    const label=(value,x,y,font,color,max)=>{ctx.fillStyle=color;ctx.font=font;ctx.fillText(value,x,y,max);};
    function plant(x,y){
      rect(x-7,y-3,14,3,'#0003');rect(x-5,y-8,10,7,'#925f45');rect(x-6,y-9,12,3,'#ce9469');
      for(const [dx,dy] of [[-8,-17],[-4,-21],[0,-24],[4,-19],[6,-15]]){
        rect(x+dx,y+dy,4,9,'#2d6652');rect(x+dx,y+dy,2,5,'#8bba78');
      }
    }
    function decor(x,y,variant){
      if(variant%3===0){
        rect(x,y,43,17,'#403a38');rect(x+2,y+2,39,12,'#664d3c');
        ['#b48064','#839d98','#c8ae70','#a76d67','#788bab','#cea87c','#98aa83','#c08771'].forEach((c,i)=>{
          const h=7+(i%3)*2;rect(x+3+i*5,y+14-h,3,h,c);rect(x+3+i*5,y+12,3,1,'#ded9bc');
        });rect(x-1,y+15,45,3,'#bd926c');
      }else if(variant%3===1){
        rect(x,y,44,17,ink);rect(x+2,y+2,40,13,'#a5c3c1');rect(x+3,y+4,38,4,'#d7dfcf');
        rect(x+21,y+1,3,15,'#738a8b');rect(x-2,y+16,48,3,'#c2af94');
      }else{
        rect(x+3,y,36,18,'#74583f');rect(x+5,y+2,32,14,'#dab88b');rect(x+7,y+4,28,10,'#8eaead');
        rect(x+10,y+8,6,6,'#5f8d78');rect(x+16,y+10,14,4,'#70977c');rect(x+27,y+5,3,3,'#f8dea0');
      }
    }
    function desk(cx,cy,phase){
      rect(cx-24,cy-2,50,6,'#0003');rect(cx-22,cy-9,4,9,'#503e38');rect(cx+18,cy-9,4,9,'#503e38');
      rect(cx-25,cy-26,50,18,'#6a493a');rect(cx-23,cy-25,46,13,'#cb9f74');
      rect(cx-23,cy-25,46,2,'#e3bc8c');rect(cx-23,cy-12,46,3,'#ae7c58');
      rect(cx-8,cy-37,19,16,ink);rect(cx-7,cy-36,17,13,'#d4d0b7');rect(cx-5,cy-34,13,8,'#354e57');
      rect(cx-3,cy-32,phase?9:6,1,'#8edbaa');rect(cx-3,cy-30,4,1,'#8edbaa');rect(cx,cy-21,4,2,ink);
      rect(cx-7,cy-18,17,4,'#817d72');rect(cx-6,cy-18,15,2,'#eee3cc');
      rect(cx+15,cy-19,4,5,'#f0d4aa');rect(cx+15,cy-20,4,2,'#684f42');
    }
    function person(cx,cy,index,working,walking){
      const sprite=characters[index%6];
      if(sprite?.complete&&sprite.naturalWidth){
        rect(cx-10,cy+24,20,3,'#0003');
        const frame=working?3+(tick%2):walking?tick%3:0;
        ctx.drawImage(sprite,frame*16,0,16,32,Math.round(cx-12),Math.round(cy-22),24,48);
        return;
      }
      const skin=skins[index%skins.length],color=shirts[index%shirts.length],h=hair[index%hair.length];
      const pal={h:ink,H:h,s:skin,I:'#332c30',t:'#b57760',c:ink,C:color,p:'#394753',b:ink};
      const bounce=working&&!reduced&&tick%2?1:0;
      rect(cx-11,cy+24,22,4,'#0003');
      if(!walking){rect(cx-9,cy+13,18,9,'#36484c');rect(cx-7,cy+12,14,6,'#7b9592');}
      figure.forEach((line,row)=>{for(let col=0;col<line.length;col++){const c=pal[line[col]];
        const step=walking&&row>=11?Math.round(Math.sin(elapsed*8+index)*2)*(col<6?1:-1):0;
        if(c)rect(cx-13+col*2,cy+bounce+row*2+step,2,2,c);
      }});
      if(index%4===1){rect(cx-9,cy+11+bounce,4,9,h);rect(cx+6,cy+10+bounce,3,8,h);}
      if(index%4===2){rect(cx-7,cy+8+bounce,12,2,ink);rect(cx-5,cy+9+bounce,3,2,'#bbd6cd');rect(cx+1,cy+9+bounce,3,2,'#bbd6cd');}
    }
    
    rect(0,0,width,height,'#26313a');targets.length=0;
    // Shared tiled circulation connects every office door.
    for(let y=0;y<height;y+=18)for(let x=0;x<width;x+=18)
      rect(x,y,17,17,(Math.floor(x/18)+Math.floor(y/18))%2?'#455e61':'#50696b');
    rowStarts.forEach((top,row)=>{
      const y=top+rowSizes[row]+13;
      for(let x=22;x<width-25;x+=124){
        rect(x,y,43,11,'#38484c');rect(x+2,y,39,7,'#93a49d');
        rect(x+3,y+10,3,4,'#29383c');rect(x+36,y+10,3,4,'#29383c');
      }
      label(row===0?'ALBERT  /  HAMKORLIK YO‘LAGI':'ALBERT  /  JAMOA QAVATI',24,y+29,'8px monospace','#d1d9ce',width-30);
    });
    
    for(const room of rooms){
      const row=Math.floor(room.index/columns),x=7+(room.index%columns)*(widthOfRoom+7),y=rowStarts[row];
      const styleIndex=Math.max(0,data.roomOrder?.indexOf(room.id)??room.index);
      const w=widthOfRoom,h=rowSizes[row],palette=interiors[styleIndex%interiors.length];
      rect(x,y,w,h,ink);rect(x+3,y+3,w-6,29,palette[3]);rect(x+3,y+30,w-6,4,'#304146');
      const floorY=y+34,bottom=y+h-4;
      ctx.save();ctx.beginPath();ctx.rect(x+3,floorY,w-6,bottom-floorY);ctx.clip();
      rect(x+3,floorY,w-6,bottom-floorY,palette[0]);
      const wood=styleIndex%4===0||styleIndex%4===3;
      const tw=wood?51:19,th=wood?9:19;
      for(let ty=0;ty*th<bottom-floorY;ty++){
        for(let tx=-1;tx*tw<w;tx++){
          const px=x+3+tx*tw+(wood&&ty%2?24:0),py=floorY+ty*th;
          rect(px,py,tw-1,th-1,(tx+ty)%2===0?palette[1]:palette[0]);
          rect(px,py+th-1,tw,1,palette[2]);if(wood)rect(px+6,py+4,14,1,'#65482c19');
        }
      }
      ctx.restore();
      // Woven rugs mark work areas without changing walkable geometry.
      room.staff.forEach((agent,slot)=>{
        const seat=seats.get(agent.id);
        rect(seat.x-35,seat.y-3,70,46,'#365e5c55');
        rect(seat.x-32,seat.y,64,40,'#b9c9ad28');
        rect(seat.x-31,seat.y+38,62,1,'#d5d5b54d');
      });
      decor(x+w-61,y+8,styleIndex);plant(x+w-16,bottom-3);
      plant(x+15,bottom-4);
      // Wall clock and a shared notice board make rooms read as an office.
      rect(x+w-84,y+10,13,13,'#263e43');rect(x+w-82,y+12,9,9,'#e1dfc7');
      rect(x+w-78,y+13,1,5,'#52686c');rect(x+w-78,y+17,4,1,'#52686c');
      {
        rect(x+w/2-35,bottom-48,70,27,'#4b655f');
        rect(x+w/2-33,bottom-46,66,23,'#c0c9ad');
        rect(x+w/2-27,bottom-41,19,2,'#6d8880');rect(x+w/2-27,bottom-36,31,2,'#6d8880');
        rect(x+w/2+17,bottom-42,9,11,'#d5ae78');
      }
      rect(x+3,bottom,w-6,4,ink);
      rect(x+w/2-19,bottom,38,4,palette[0]);
      rect(x+w/2-17,bottom+4,34,2,'#c5ae86');
      // A meeting table and four chairs occupy the shared room aisle.
      {
        rect(x+w-94,bottom-43,46,23,'#6f5141');rect(x+w-92,bottom-42,42,19,'#c39a6e');
        rect(x+w-82,bottom-39,10,6,'#d7cbb2');rect(x+w-67,bottom-32,7,5,'#e6d4ae');
        for(const dx of [-90,-65]){
          rect(x+w+dx,bottom-50,13,6,'#92aaa4');rect(x+w+dx,bottom-18,13,6,'#92aaa4');
        }
      }
      label(room.name,x+11,y+21,'bold 13px system-ui','#f0e9cf',w-104);
      {
        const sx=x+15,sy=bottom-35;
        rect(sx,sy,40,17,'#61414c');rect(sx+2,sy+1,36,7,'#b86e77');rect(sx+3,sy+9,34,5,'#cc8790');
        rect(sx+1,sy+16,3,3,ink);rect(sx+36,sy+16,3,3,ink);
      }
      room.staff.forEach((agent,slot)=>{
        const perRow=room.staff.length===4?2:3;
        const count=Math.min(perRow,room.staff.length-Math.floor(slot/perRow)*perRow);
        const cx=Math.round(x+(slot%perRow+.5)*(w/count));
        const cy=y+81+Math.floor(slot/perRow)*102;
        const status=assignments.get(agent.id)?.status||'idle';
        const [name,color]=statuses[status]||statuses.idle;
        const index=roster.get(agent.id);
        const meeting=meetings.find(item=>item.from_agent===agent.id||item.to_agent===agent.id);
        const walking=animating&&data.officeMotion!==false&&status==='idle'&&room.staff.length<5;
        const lane=w/Math.max(1,room.staff.length);
        const distance=Math.max(8,lane-88);
        const walkPhase=(elapsed*12+index*37)%(distance*2);
        let px=walking?x+slot*lane+44+Math.abs(walkPhase-distance):cx;
        let py=walking?bottom-65+(index%2)*9:cy-4;
        if(meeting&&!reduced){
          const origin=seats.get(agent.id),host=seats.get(meeting.from_agent);
          const side=agent.id===meeting.from_agent?-14:14;
          const target={x:host.doorX+side,y:host.doorY};
          const routeKey=meeting.id+'|'+agent.id;
          if(!meetingRoutes.has(routeKey))meetingRoutes.set(routeKey,astar2D(origin.x,origin.y,target.x,target.y,navGrid));
          const route=meetingRoutes.get(routeKey);
          const path=route.length?[origin,...route]:[origin,origin];
          const age=Math.max(0,(Date.now()-Date.parse(meeting.created_at))/8500);
          const progress=age<.4?age/.4:age>.7?(1-age)/.3:1;
          const scaled=Math.max(0,Math.min(1,progress))*(path.length-1);
          const segment=Math.min(path.length-2,Math.floor(scaled)),mix=scaled-segment;
          px=path[segment].x+(path[segment+1].x-path[segment].x)*mix;
          py=path[segment].y+(path[segment+1].y-path[segment].y)*mix;
        }
        desk(cx,cy,status==='working'&&tick%2);
        person(px,py,agent.sprite_id??index,status==='working',walking||Boolean(meeting));
        if(meeting)globalThis.VOLifeSprites?.draw(ctx,meeting.kind==='report'?'folder':'envelope',px+13,py-15,{scale:1.5});
        const labelY=walking||meeting?py+5:cy;
        const labelX=walking||meeting?px:cx;
        ctx.font='bold 11px system-ui';
        const measured=ctx.measureText(agent.name)?.width||70;
        const plate=Math.min(walking?84:98,Math.max(56,Math.ceil(measured)+15));
        rect(labelX-plate/2,labelY+26,plate,28,hovered===agent.id?'#162627':'#253239');
        rect(labelX-plate/2,labelY+26,plate,2,hovered===agent.id?'#fff2c9':color);
        ctx.textAlign='center';
        label(agent.name,labelX,labelY+39,'bold 11px system-ui','#fff6db',plate-6);
        if(data.agents.some(child=>child.lead_id===agent.id)||isLeadRole(agent.role||'')){
          rect(labelX-plate/2,labelY+26,3,28,'#e4c786');
        }
        label(meeting?(meeting.kind==='report'?'Hisobot uchrashuvi':'Buyruq uchrashuvi'):name,labelX,labelY+50,'9px system-ui',color,plate-6);ctx.textAlign='left';
        const assignment=assignments.get(agent.id);
        const detail=assignment?agent.name+' · '+assignment.title:agent.name+' · '+name;
        if(meeting||((hovered===agent.id||status==='working')&&assignment)){
          const text=meeting?(meeting.kind==='report'?'Hisobotni topshiryapman':'Topshiriqni yetkazyapman'):assignment.title;
          const bw=Math.min(w-18, Math.max(110,Math.ceil(ctx.measureText(text)?.width||110)+22));
          const bx=Math.max(4,Math.min(px-bw/2,width-bw-4)),by=meeting?py-44:cy-57;
          rect(bx,by,bw,18,'#253b3c');rect(bx+2,by+2,bw-4,14,'#f2ecd4');
          rect(px-2,by+18,5,3,'#253b3c');
          label(text,bx+6,by+12,'bold 10px system-ui','#263537',bw-12);
        }
        targets.push({id:agent.id,name:detail,x:labelX-48,y:walking||meeting?py:cy-40,w:96,h:walking||meeting?60:95});
      });
    }
  }
  loop=startGameLoop(canvas,{update:dt=>{elapsed+=dt;},render});
  function hit(event){
    const box=canvas.getBoundingClientRect();
    const x=(event.clientX-box.left)*width/box.width,y=(event.clientY-box.top)*height/box.height;
    return targets.find(t=>x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h);
  }
  canvas.addEventListener('click',event=>{const t=hit(event);if(t)onAgent(t.id);});
  canvas.addEventListener('mousemove',event=>{const t=hit(event);hovered=t?.id;canvas.title=t?.name||'';canvas.style.cursor=t?'pointer':'default';});
  canvas.addEventListener('mouseleave',()=>{hovered=null;});
  loop.redraw();return loop;
}
