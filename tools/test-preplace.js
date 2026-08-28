#!/usr/bin/env node
// Unit tests for the Preplace primitives added to NovaStorm.user.js.
// Extracts the pure functions from the userscript and exercises them.
//
//   node tools/test-preplace.js

const fs=require('fs');
const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','NovaStorm.user.js'),'utf8');
function fnbody(name){
  const m=new RegExp("\\n\\s*function\\s+"+name+"\\s*\\(").exec(src);
  const start=src.indexOf("function",m.index);
  let i=src.indexOf("{",start),d=0;
  for(let j=i;j<src.length;j++){const c=src[j];if(c==="{")d++;else if(c==="}"){d--;if(!d)return src.slice(start,j+1);}}
}
const consts=/const NS_PP = \{[\s\S]*?\};/.exec(src)[0];
// minimal stand-ins for the globals the extracted functions touch
const harness = `
const UTILS={getDistance:(a,b,c,d)=>Math.hypot(c-a,d-b),
  getAngleDist:(a,b)=>{const p=Math.abs(b-a)%(Math.PI*2);return p>Math.PI?Math.PI*2-p:p;}};
const config={playerDecel:0.993,playerSpeed:0.0016};
${consts}
${fnbody('NS_segDist2')}
${fnbody('NS_escapeExits')}
${fnbody('NS_probeAngles')}
${fnbody('NS_updateMoveModel')}
module.exports={NS_segDist2,NS_escapeExits,NS_probeAngles,NS_updateMoveModel,NS_PP,UTILS};
`;
const tmp=path.join(__dirname,'.ns_extract.tmp.js');
fs.writeFileSync(tmp,harness);
const M=require(tmp);
process.on('exit',()=>{try{fs.unlinkSync(tmp);}catch(e){}});
let ok=0,bad=0;
const t=(n,c,extra='')=>{if(c){ok++;console.log('  ok   '+n);}else{bad++;console.log('  FAIL '+n+(extra?' — '+extra:''));}};

console.log('\nNS_segDist2 — exact segment/point distance');
t('point on segment = 0', Math.abs(M.NS_segDist2(5,0, 0,0, 10,0))<1e-9);
t('perpendicular offset', Math.abs(M.NS_segDist2(5,3, 0,0, 10,0)-9)<1e-9);
t('clamps past the end', Math.abs(M.NS_segDist2(14,0, 0,0, 10,0)-16)<1e-9);
t('degenerate segment', Math.abs(M.NS_segDist2(3,4, 0,0, 0,0)-25)<1e-9);
{ // the diagonal case an AABB gets wrong
  const cfg={x:100,y:100,scale:35};
  const r=35+35, d2=M.NS_segDist2(cfg.x,cfg.y, 0,0, 0,200);
  t('diagonal miss is a miss (AABB would say hit)', d2 > r*r, 'd='+Math.sqrt(d2).toFixed(1)+' r='+r);
}

console.log('\nNS_probeAngles — budget and coverage');
{
  const p=M.NS_probeAngles(0);
  t('probe count equals the stock budget', p.length===M.NS_PP.PROBE_ANGLES, 'got '+p.length);
  const norm=a=>{let x=a%(Math.PI*2);return x<0?x+Math.PI*2:x;};
  const near=p.filter(a=>M.UTILS.getAngleDist(a,0)<=M.NS_PP.ANCHOR_SPAN).length;
  t('fine band packed at the anchor', near>=M.NS_PP.ANCHOR_FINE, 'near='+near);
  // full-circle coverage: no gap wider than ~25 deg
  const s=p.map(norm).sort((a,b)=>a-b);
  let maxGap=s[0]+(Math.PI*2-s[s.length-1]);
  for(let i=1;i<s.length;i++)maxGap=Math.max(maxGap,s[i]-s[i-1]);
  t('no coverage gap > 25 deg', maxGap<0.44, 'maxGap='+(maxGap*180/Math.PI).toFixed(1)+' deg');
}

console.log('\nNS_escapeExits — containment');
{
  // radius 110: a realistic spike ring around a trapped player. At R=70 the
  // scale-35 objects touch, so no gap can admit a 70-wide player and the
  // formula correctly reports sealed regardless of holes.
  const ring=[],R=110;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;ring.push({x:Math.cos(a)*R,y:Math.sin(a)*R,r:35});}
  t('closed ring has no exit', M.NS_escapeExits(0,0,35,ring)===null);
  const gapped=ring.filter((_,i)=>i!==2&&i!==3);   // 135 deg hole
  const ex=M.NS_escapeExits(0,0,35,gapped);
  t('ring with a hole reports an exit', ex && ex.length>=1, ex?('exits='+ex.length):'null');
  t('too few members skips analysis', M.NS_escapeExits(0,0,35,ring.slice(0,2))===null);
  t('tight ring stays sealed even with a hole',
    M.NS_escapeExits(0,0,35,(()=>{const a=[];for(let i=0;i<8;i++){if(i===2||i===3)continue;
      const t=i*Math.PI/4;a.push({x:Math.cos(t)*70,y:Math.sin(t)*70,r:35});}return a;})())===null);
}

console.log('\nNS_updateMoveModel — confidence behaviour');
{
  const mk=()=>({x2:0,y2:0,t1:0,t2:111,buildIndex:-1});
  // steady straight-line movement
  let p=mk(),lx=0,ly=0;
  for(let i=0;i<8;i++){lx=p.x2;ly=p.y2;p.x2+=12;p.t1=0;p.t2=111;M.NS_updateMoveModel(p,lx,ly);}
  const steady=p._mv.conf;
  t('steady movement clears CONF_MIN', steady>=M.NS_PP.CONF_MIN, 'conf='+steady.toFixed(3));
  t('stability accumulated', p._mv.stable>=M.NS_PP.STABLE_N, 'stable='+p._mv.stable);
  // now a hard reversal
  lx=p.x2;ly=p.y2;p.x2-=12;M.NS_updateMoveModel(p,lx,ly);
  t('direction change floors confidence below CONF_MIN',
    p._mv.conf<M.NS_PP.CONF_MIN && p._mv.conf<=M.NS_PP.TURN_FLOOR, 'conf='+p._mv.conf.toFixed(3));
  t('stability reset by the turn', p._mv.stable===0, 'stable='+p._mv.stable);
  // a stop also counts as a direction change
  let q=mk(),qx,qy;
  for(let i=0;i<8;i++){qx=q.x2;qy=q.y2;q.x2+=12;M.NS_updateMoveModel(q,qx,qy);}
  qx=q.x2;qy=q.y2;M.NS_updateMoveModel(q,qx,qy); // no displacement
  t('a stop is treated as a direction change', q._mv.conf<=M.NS_PP.TURN_FLOOR, 'conf='+q._mv.conf.toFixed(3));
  t('diagonal movement is not read as stationary (signed-sum bug)',
    (()=>{let r=mk(),rx=r.x2,ry=r.y2;r.x2-=10;r.y2+=10;M.NS_updateMoveModel(r,rx,ry);return r._mv.dir!==null;})());
}
console.log(`\n${ok} passed, ${bad} failed\n`);
process.exit(bad?1:0);
