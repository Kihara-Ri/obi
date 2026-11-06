import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={setTimeout,clearTimeout,TextDecoder,TextEncoder};
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../../static/local/rate-sync.js',import.meta.url),'utf8'),context);
const create=context.ObiRateSync.create;
const reply={status:200,body:new TextEncoder().encode(JSON.stringify({quotes:[{checkedAt:1000,rate:'4.7'}]}))};

test('本机公开报价进入主引擎后才回复；旧启动回执不能完成新请求',async()=>{
  let net, main, adopted=0;
  net=create({role:'net',session:'new',timeout:1000,channel:{postMessage:m=>{
    assert.equal(net.handle({t:'rate-cache-ack',session:'old',id:m.id}),false);
    main.handle(m);
  }}});
  main=create({role:'main',session:'new',adopt:q=>{adopted+=q.length;},channel:{postMessage:m=>net.handle(m)}});
  await net.transfer(reply);
  assert.equal(adopted,1);
});
test('主引擎丢失时同步有界超时，接收失败可以重试',async()=>{
  const net=create({role:'net',session:'new',timeout:5,channel:{postMessage(){}}});
  await assert.rejects(net.transfer(reply),/超时/);
});

test('主缓存已有较新报价时，预览回复采用主缓存确认值',async()=>{
  let net;
  const main=create({role:'main',session:'s',adopt:q=>q.map(x=>({...x,rate:'4.9'})),
    channel:{postMessage:m=>net.handle(m)}});
  net=create({role:'net',session:'s',channel:{postMessage:m=>main.handle(m)}});
  const copied={...reply};
  await net.transfer(copied);
  assert.equal(JSON.parse(new TextDecoder().decode(copied.body)).quotes[0].rate,'4.9');
});
