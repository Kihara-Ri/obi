/** Real fixed-image booklet fold + independent roll + stow regression. Read-only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const expectations=JSON.parse(readFileSync(process.argv[2] || '/tmp/album-preview-expectations-20261016.json','utf8'));
const base=process.env.OBI_PREVIEW_URL || 'http://127.0.0.1:63282';
const angle=process.platform==='darwin' ? 'metal' : 'swiftshader';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle='+angle,'--enable-webgl']});
const results=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
 await page.goto(base+'/#gallery',{waitUntil:'networkidle'});
 await page.reload({waitUntil:'networkidle'});
 for (const [name,panels] of [['Illinois',6],['Lift Your Skinny Fists',4]]) {
  const model=expectations.models.find(item=>item.title.includes(name));
  assert.ok(model,'Missing real reference model '+name);
  const cover=page.locator(`[data-gallery-record-id="${model.recordId}"]`).first();
  await cover.scrollIntoViewIfNeeded();await cover.click();
  await page.locator('#gallery-focus[open]').waitFor();
  await page.locator('#gallery-focus .gallery-renderer-switch').getByRole('button',{name:'3D',exact:true}).click();
  const scene=page.locator('#gallery-focus .album-model-scene[data-renderer="webgl"][aria-busy="false"]');
  await scene.waitFor({timeout:45000});await scene.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>Number(document.querySelector('.album-model-scene')?.dataset.renderedOpen)>.98,null,{timeout:30000});
  const foldAmount=async()=>Number((await scene.getAttribute('data-paper-folds')||'').split(';').find(s=>s.startsWith('reference-booklet='))?.split('=')[1]);
  assert.equal(await foldAmount(),0,'Sheet must start folded: '+name);
  const grips=JSON.parse(await scene.getAttribute('data-accessory-grips') || '[]');
  const grip=grips.find(g=>g.id==='reference-booklet');assert.ok(grip,'Foldout needs grip: '+name);
  const box=await scene.boundingBox();const x=box.x+grip.x,y=box.y+grip.y;
  await page.mouse.move(x,y);
  const hover=await scene.getAttribute('data-accessory-hover');
  assert.equal(hover,'reference-booklet','Foldout grip hover must hit 3D mesh: '+name);
  await page.mouse.click(x,y);
  await page.waitForTimeout(1100);
  await page.waitForFunction(()=>Number((document.querySelector('.album-model-scene')?.dataset.accessoryProgress||'').split(';').find(s=>s.startsWith('reference-booklet='))?.split('=')[1])>.98,null,{timeout:12000});
  const tools=page.locator('#gallery-focus .album-paper-tools');
  await tools.waitFor({state:'visible'});
  assert.ok((await tools.textContent()).includes(String(panels)+' 联折页'));
  await tools.getByRole('button',{name:'展开纸张'}).click();
  await page.waitForFunction(()=>Number((document.querySelector('.album-model-scene')?.dataset.paperFolds||'').split(';').find(s=>s.startsWith('reference-booklet='))?.split('=')[1])>.98,null,{timeout:30000});
  await page.screenshot({path:'/tmp/obi-'+(panels===6?'illinois':'lift')+'-foldout-open.png'});
  assert.ok(await foldAmount()>.98,'Fully unfolded with all authored panels: '+name);
  // A direct single click on the physical unfolded paper must refold it;
  // returning the sheet is deliberately a separate visible control.
  await page.mouse.click(640,450);
  await page.waitForFunction(()=>Number((document.querySelector('.album-model-scene')?.dataset.paperFolds||'').split(';').find(s=>s.startsWith('reference-booklet='))?.split('=')[1])<.02,null,{timeout:30000});
  assert.ok(await foldAmount()<.02,'Single click on printed sheet must refold: '+name);
  await tools.getByRole('button',{name:'展开纸张'}).click();
  await page.waitForFunction(()=>Number((document.querySelector('.album-model-scene')?.dataset.paperFolds||'').split(';').find(s=>s.startsWith('reference-booklet='))?.split('=')[1])>.98,null,{timeout:30000});
  const poseBefore=await scene.getAttribute('data-accessory-rotations');
  await scene.focus();await page.keyboard.press('e');
  const poseAfter=await scene.getAttribute('data-accessory-rotations');
  assert.notEqual(poseAfter,poseBefore,'Withdrawn sheet roll must be independent: '+name);
  const rotations=(poseAfter||'').split(';').find(s=>s.startsWith('reference-booklet='))?.split('=')[1];
  assert.ok(rotations?.endsWith('90.000'),'Q/E must roll sheet 90 degrees: '+name);
  await tools.getByRole('button',{name:'折起纸张'}).click();
  await page.waitForFunction(()=>Number((document.querySelector('.album-model-scene')?.dataset.paperFolds||'').split(';').find(s=>s.startsWith('reference-booklet='))?.split('=')[1])<.02,null,{timeout:30000});
  await tools.getByRole('button',{name:'收回纸张'}).click();
  await page.waitForFunction(()=>Number((document.querySelector('.album-model-scene')?.dataset.accessoryProgress||'').split(';').find(s=>s.startsWith('reference-booklet='))?.split('=')[1])<.02,null,{timeout:30000});
  results.push({model:name,panels,hover,unfolded:true,rolled:true,refolded:true,returned:true});
  await page.keyboard.press('Escape');await page.locator('#gallery-focus').waitFor({state:'detached'});
 }
 assert.deepEqual(errors,[],'No browser or HTTP failures');
 console.log(JSON.stringify({ok:true,results,errors},null,2));
} finally {await browser.close();}
