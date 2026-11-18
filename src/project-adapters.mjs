// One HTTP contract per native runtime; model IDs name the deployed flow or agent.
export const sdkEngines=['autogen','crewai','metagpt','ag2','swarms','google-adk'];
export const flowEngines=['sim','langflow','chatdev','mastra',...sdkEngines];

export async function runProjectProfile(profile,prompt,key,base,request) {
  const {provider,model}=profile;
  const id=encodeURIComponent(model);
  const headers={'Content-Type':'application/json'};
  if(key)headers[['sim','langflow'].includes(provider)?'x-api-key':'Authorization']=
    ['sim','langflow'].includes(provider)?key:'Bearer '+key;
  let path,body;
  if(provider==='langflow'){
    path='/api/v1/run/'+id;
    body={input_value:prompt,input_type:'chat',output_type:'chat'};
  }else if(provider==='sim'){
    path='/api/workflows/'+id+'/execute';body={input:prompt};
  }else if(provider==='chatdev'){
    path='/api/workflow/run';body={yaml_file:model,task_prompt:prompt};
  }else if(provider==='mastra'){
    path='/api/agents/'+id+'/generate';body={messages:[{role:'user',content:prompt}]};
  }else{
    path='/run';body={engine:provider,model,input:prompt};
  }
  const reply=await request(base+path,{method:'POST',headers,body:JSON.stringify(body)});
  if(reply.success===false || reply.status==='failed')throw new Error('Tashqi ish jarayoni xato bilan tugadi.');
  let result=reply.text;
  if(provider==='langflow')result=reply.outputs?.[0]?.outputs?.[0]?.results?.message?.text;
  if(provider==='sim')result=reply.output;
  if(provider==='chatdev')result=reply.final_message;
  if(result && typeof result==='object')result=JSON.stringify(result);
  if(typeof result!=='string'||!result.trim())throw new Error('Ish jarayoni matnli natija qaytarmadi.');
  return {text:result,model,provider};
}
