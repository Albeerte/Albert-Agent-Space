import test from 'node:test';
import assert from 'node:assert/strict';
import { mountOfficeMap } from '../public/office-map.js';

test('Pixel Agents loop renders backend status and opens clicked agent',()=>{
  const original={window:globalThis.window,matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  let next,click,selected;
  const text=[];
  const ctx=new Proxy({fillText:value=>text.push(value)},{get:(obj,key)=>key in obj?obj[key]:()=>{}});
  const canvas={style:{},isConnected:true,getContext:()=>ctx,
    getBoundingClientRect:()=>({left:0,top:0,width:1000,height:218}),
    addEventListener:(type,handler)=>{if(type==='click')click=handler;}};
  globalThis.window={devicePixelRatio:1};
  globalThis.matchMedia=()=>({matches:false});
  globalThis.requestAnimationFrame=callback=>{next=callback;return 1;};
  globalThis.cancelAnimationFrame=()=>{};
  try {
    const loop=mountOfficeMap(canvas,{rooms:[{id:'room',name:'Development',space:'it'}],agents:[{id:'dev',name:'Backend Developer',room_id:'room'}],
      tasks:[{id:'task',title:'Change',agent_id:'dev',status:'approval'}]},agent=>{selected=agent;});
    assert.ok(text.includes('Tasdiq kutyapti'));
    assert.ok(text.includes('Backend Developer'));
    next(1000);
    click({clientX:500,clientY:90});
    assert.equal(selected,'dev');
    loop.stop();
  } finally {
    for(const [key,value] of Object.entries(original)) {
      if(value===undefined)delete globalThis[key];
      else globalThis[key]=value;
    }
  }
});
