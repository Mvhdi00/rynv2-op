const N_ANGLES=72,R=1000,PLACE_R=70,SCALE=35,CELL=150;
function mkObjects(n){const o=[];for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,d=Math.sqrt(Math.random())*R;
 o.push({x:7200+Math.cos(a)*d,y:7200+Math.sin(a)*d,scale:20+Math.random()*60,active:true,isItem:true,blocker:0,
 getScale(sM,ii){return this.scale*(sM||1);}});}return o;}
const getDistance=(x1,y1,x2,y2)=>Math.sqrt((x2-=x1)*x2+(y2-=y1)*y2);
function checkItemLocation(x,y,s,sM,objects){for(let i=0;i<objects.length;++i){const b=objects[i].blocker?objects[i].blocker:objects[i].getScale(sM,objects[i].isItem);
 if(objects[i].active&&getDistance(x,y,objects[i].x,objects[i].y)<(s+b))return false;}return true;}
function sweepBaseline(px,py,objects){let ok=0;for(let i=0;i<N_ANGLES;i++){const a=i*(Math.PI*2/N_ANGLES);
 if(checkItemLocation(px+PLACE_R*Math.cos(a),py+PLACE_R*Math.sin(a),SCALE,0.6,objects))ok++;}return ok;}
function prepFlat(o,sM){const n=o.length,X=new Float64Array(n),Y=new Float64Array(n),Rr=new Float64Array(n);
 for(let i=0;i<n;i++){X[i]=o[i].x;Y[i]=o[i].y;Rr[i]=o[i].blocker?o[i].blocker:o[i].getScale(sM,o[i].isItem);}return{X,Y,Rr,n};}
function buildGrid(F){const g=new Map();let maxR=0;for(let j=0;j<F.n;j++){if(F.Rr[j]>maxR)maxR=F.Rr[j];
 const k=((F.X[j]/CELL)|0)+','+((F.Y[j]/CELL)|0);let b=g.get(k);if(!b){b=[];g.set(k,b);}b.push(j);}return{g,maxR};}
function sweepGrid(px,py,F,G){let ok=0;const span=Math.ceil((SCALE+G.maxR)/CELL);
 for(let i=0;i<N_ANGLES;i++){const a=i*(Math.PI*2/N_ANGLES),cx=px+PLACE_R*Math.cos(a),cy=py+PLACE_R*Math.sin(a);
  const gx=(cx/CELL)|0,gy=(cy/CELL)|0;let bl=false;
  outer:for(let ax=gx-span;ax<=gx+span;ax++)for(let ay=gy-span;ay<=gy+span;ay++){const b=G.g.get(ax+','+ay);if(!b)continue;
   for(let t=0;t<b.length;t++){const j=b[t],dx=cx-F.X[j],dy=cy-F.Y[j],rr=SCALE+F.Rr[j];
    if(dx*dx+dy*dy<rr*rr){bl=true;break outer;}}}
  if(!bl)ok++;}return ok;}
function time(fn,it){fn();const t0=process.hrtime.bigint();for(let i=0;i<it;i++)fn();return Number(process.hrtime.bigint()-t0)/1e6/it;}
const IT=3000;
console.log('n    | 1 sweep base | 1 sweep grid | grid build | correctness');
for(const n of [80,200,400]){
  const o=mkObjects(n),px=7200,py=7200,F=prepFlat(o,0.6),G=buildGrid(F);
  const a=sweepBaseline(px,py,o),c=sweepGrid(px,py,F,G);
  const tb=time(()=>sweepBaseline(px,py,o),IT), tg=time(()=>sweepGrid(px,py,F,G),IT);
  const tbuild=time(()=>{const FF=prepFlat(o,0.6);buildGrid(FF);},IT);
  console.log(`${String(n).padStart(4)} | ${tb.toFixed(4)}ms     | ${tg.toFixed(4)}ms     | ${tbuild.toFixed(4)}ms   | ${a}==${c} ${a===c?'OK':'MISMATCH'}`);
}
console.log('\n--- realistic per-tick totals (400 objects) ---');
const o=mkObjects(400),px=7200,py=7200,F=prepFlat(o,0.6),G=buildGrid(F);
const one=time(()=>sweepBaseline(px,py,o),IT);
const oneG=time(()=>sweepGrid(px,py,F,G),IT);
const build=time(()=>{const FF=prepFlat(o,0.6);buildGrid(FF);},IT);
for(const [label,sweeps] of [['today, quiet (AutoPlace 2 + Preplace 2 + dead 2)',6],
                            ['today, enemy trapped (+canTrapTick x5 nested, +canShamePlace x2)',13],
                            ['today, worst (canSmartTick 3 candidates too)',16],
                            ['designed (Preplace 1 + Replace 1)',2]]){
  console.log(`${label.padEnd(62)} base ${(one*sweeps).toFixed(3)}ms  | grid ${(build+oneG*sweeps).toFixed(3)}ms`);
}
console.log('\ntick budget = 111ms');
