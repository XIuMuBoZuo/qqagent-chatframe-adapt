import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {adaptReply,canRedirect} from '../automatic-adapter.mjs';

// Signature + IHDR header; mock verifies logic only, not visual PNG validity.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2p8AAAAASUVORK5CYII=','base64');
const normalize=x=>typeof x==='string'?[x]:x;
const fixture=()=>{
 const sends=[];
 const ctx={kind:'group',chatId:'550353385',chatKey:'group:550353385',session:{id:'s',sent:[]},emit(){},sender:{
  async sendImage(chat,img,opts){sends.push({kind:'image',chat,img,opts});assert(fs.existsSync(img.file));assert.deepEqual(Object.keys(img),['file']);},
  async sendTextBatch(chat,messages,opts){sends.push({kind:'text',chat,messages,opts});return {sent:messages.map(text=>({text,at:'now'})),failed:[]};}
 }};
 const render=async(text,dir)=>{if(text==='render-fail')throw Error('FONT_UNAVAILABLE');const image_path=path.join(dir,'one.png');fs.writeFileSync(image_path,png);return {ok:true,image_path,width:1,height:1};};
 return {ctx,sends,render};
};
assert(!canRedirect({enabled:true}));
assert(!canRedirect({enabled:true,availableToolIds:new Set(['send_message'])}));
assert(canRedirect({enabled:true,availableToolIds:new Set(['send_message','chatframe-auto__send'])}));
{
 const f=fixture(),r=await adaptReply({...f,enabled:false,args:{messages:'hello'},normalizeMessages:normalize});
 assert.equal(r.status,'passthrough');assert.equal(f.sends.length,0);
}
{
 const f=fixture(),r=await adaptReply({...f,enabled:true,args:{messages:['hello','render-fail','x'.repeat(241),'world'],replyToMessageId:22,atUserId:33},normalizeMessages:normalize});
 assert.equal(r.status,'completed');assert.deepEqual(f.sends.map(x=>x.kind),['image','text','text','image']);
 assert(f.sends.every(x=>x.chat==='group:550353385'));assert.equal(f.sends[0].opts.replyToMessageId,22);assert.equal(f.sends[0].opts.atUserId,33);
 assert.equal(f.sends[1].opts.replyToMessageId,null);assert.equal(f.sends[1].opts.atUserId,null);assert.equal(f.sends[2].messages[0].length,241);
 assert.equal(f.ctx.session.sent.length,4);assert(!fs.existsSync(f.sends[0].img.file));
}
{
 const f=fixture();f.ctx.chatKey='group:1014421207';
 const r=await adaptReply({...f,enabled:true,args:{messages:'hello'},normalizeMessages:normalize});assert.equal(r.status,'rejected');assert.equal(f.sends.length,0);
}
{
 const f=fixture(),r=await adaptReply({...f,enabled:true,args:{messages:'hello',targetChatKey:'group:1014421207'},normalizeMessages:normalize});
 assert.equal(r.status,'rejected');assert.equal(f.sends.length,0);
}
{
 const f=fixture();f.ctx.sender.sendImage=async()=>{f.sends.push({kind:'image-unknown'});throw Error('timeout');};
 const r=await adaptReply({...f,enabled:true,args:{messages:['hello','later']},normalizeMessages:normalize});
 assert.equal(r.status,'uncertain');assert.equal(r.reason,'image_send_unknown');assert.deepEqual(f.sends,[{kind:'image-unknown'}]);assert.equal(f.ctx.session.sent.length,0);
}
{
 const f=fixture();f.ctx.sender.sendTextBatch=async()=>{f.sends.push({kind:'text-unknown'});throw Error('timeout');};
 const r=await adaptReply({...f,enabled:true,args:{messages:['render-fail','later']},normalizeMessages:normalize});
 assert.equal(r.status,'uncertain');assert.deepEqual(f.sends,[{kind:'text-unknown'}]);
}
{
 const f=fixture();f.ctx.sender.sendTextBatch=async()=>{f.sends.push({kind:'text-partial'});return {sent:[{text:'第一段',at:'now'}],failed:[{index:1}]};};
 const r=await adaptReply({...f,enabled:true,args:{messages:['render-fail','later']},normalizeMessages:normalize});
 assert.equal(r.status,'uncertain');assert.equal(r.reason,'text_send_incomplete');assert.deepEqual(f.sends,[{kind:'text-partial'}]);assert.equal(f.ctx.session.sent[0].text,'第一段');
}
console.log('automatic adapter offline tests passed; no QQ messages sent');
