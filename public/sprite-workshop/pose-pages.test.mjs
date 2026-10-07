import test from 'node:test';
import assert from 'node:assert/strict';
import {posePage} from './pose-pages.mjs';
test('large equipment libraries keep canvas count bounded and every pose reachable',()=>{
  const poses=Object.fromEntries(Array.from({length:841},(_,i)=>['p'+i,{id:'p'+i,name:'Loadout '+i,weapon:i<29?'sword':'axe',offhandType:'shield'}]));
  const all=[];for(let page=0;page<36;page++){const current=posePage(poses,'',page);assert.ok(current.rows.length<=24);all.push(...current.rows.map(p=>p.id));}
  assert.equal(new Set(all).size,841);
  assert.equal(posePage(poses,'sword',35).page,1);assert.equal(posePage(poses,'missing').total,0);
});
