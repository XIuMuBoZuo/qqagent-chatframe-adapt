import assert from 'node:assert/strict';
import {rewriteNativeCalls} from '../automatic-prototype.mjs';
const make=()=>({message:{tool_calls:[{id:'call-1',type:'function',function:{name:'send_message',arguments:JSON.stringify({messages:['你好','世界'],atUserId:'123456',replyToMessageId:'22'})}},{id:'call-2',type:'function',function:{name:'send_image',arguments:'{}'}}]}});
for(const options of [{},{enabled:true},{enabled:false,availableToolIds:new Set(['send_message','chatframe-auto__send'])},{enabled:true,availableToolIds:new Set(['send_message'])},{enabled:true,availableToolIds:['send_message','chatframe-auto__send']}] ){
 const r=make(),before=JSON.stringify(r);assert.equal(rewriteNativeCalls(r,options),0);assert.equal(JSON.stringify(r),before);
}
const r=make(),beforeArgs=r.message.tool_calls[0].function.arguments;
assert.equal(rewriteNativeCalls(r,{enabled:true,availableToolIds:new Set(['send_message','chatframe-auto__send'])}),1);
assert.equal(r.message.tool_calls[0].function.name,'chatframe-auto__send');
assert.equal(r.message.tool_calls[0].function.arguments,beforeArgs);
assert.equal(r.message.tool_calls[0].id,'call-1');
assert.equal(r.message.tool_calls[1].function.name,'send_image');
assert.equal(rewriteNativeCalls({message:{content:'inline send_message'}},{enabled:true,availableToolIds:new Set(['send_message','chatframe-auto__send'])}),0);
console.log('Offline proof-gated rewriting tests passed; no host or QQ access.');
