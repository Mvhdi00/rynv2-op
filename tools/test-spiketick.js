/* Pulls the three new methods out of the client and runs them against stub
 * objects, so the sweep is exercised rather than just eyeballed. */
const fs=require("fs"), vm=require("vm");
const src=fs.readFileSync("/home/user/rynv2-op/src/RYN_Client_v4.js","utf8");
const lines=src.split("\n");
const s=lines.findIndex(x=>x.includes("class SpikeTick"));
let d=0,e=-1;for(let i=s;i<lines.length;i++){for(const ch of lines[i]){if(ch==="{")d++;else if(ch==="}")d--;}if(d===0){e=i;break}}
const classSrc=lines.slice(s,e+1).join("\n").replace(/^\s*class SpikeTick \{/,"class SpikeTick {");

// stubs
class PlayerObject{}
const reverseAngle=a=>Math.atan2(-Math.sin(a),-Math.cos(a));
const DataHandler_default={getWeapon:()=>({range:110})};
const Settings_default={_spikeTick:true};
const sandbox={PlayerObject,reverseAngle,DataHandler_default,Settings_default,Math,console};
vm.runInNewContext(classSrc+"\n;__C=SpikeTick;",sandbox);
const SpikeTick=sandbox.__C;

const P=(x,y)=>({x,y,distance(o){return Math.hypot(x-o.x,y-o.y)},angle(o){return Math.atan2(o.y-y,o.x-x)}});
function makeClient(objects,enemy){
  return {
    PlayerManager:{isEnemyByID:()=>true},
    ObjectManager:{
      objects:{get:id=>objects[id]},
      grid2D:{query:(x,y,r,cb)=>objects.forEach((_,i)=>cb(i))}
    }
  };
}
function spike(x,y,scale=49,dmg=20){
  const o=Object.create(PlayerObject.prototype);
  return Object.assign(o,{itemGroup:2,ownerID:99,collisionScale:scale,pos:{current:P(x,y)},getDamage:()=>dmg});
}
const enemy={collisionScale:35,hitScale:35,pos:{current:P(0,0),future:P(0,0)}};

let pass=0,fail=0;
function t(name,got,want){ const ok=got===want; ok?pass++:fail++; console.log(`  ${ok?"PASS":"FAIL"}  ${name}  (got ${got}, want ${want})`); }

// 1. spike straight ahead within reach -> lands on it
{
  const objs=[spike(120,0)];
  const st=new SpikeTick(makeClient(objs)); st.client=makeClient(objs);
  const r=st._landsOn(enemy,0,170);
  t("hazard dead ahead is found", r!==null, true);
}
// 2. same spike, but reach too short -> no landing
{
  const objs=[spike(300,0)];
  const st=new SpikeTick(makeClient(objs)); st.client=makeClient(objs);
  t("hazard beyond the travel budget is ignored", st._landsOn(enemy,0,170)===null, true);
}
// 3. spike off to the side -> swept path misses it
{
  const objs=[spike(0,160)];
  const st=new SpikeTick(makeClient(objs)); st.client=makeClient(objs);
  t("hazard off the knockback line is ignored", st._landsOn(enemy,0,170)===null, true);
}
// 4. spikes both ahead and behind -> pinned
{
  const objs=[spike(120,0),spike(-120,0)];
  const st=new SpikeTick(makeClient(objs)); st.client=makeClient(objs);
  t("hazard behind as well is a bounce", st._pinnedBehind(enemy,0,170), true);
}
// 5. only ahead -> not pinned
{
  const objs=[spike(120,0)];
  const st=new SpikeTick(makeClient(objs)); st.client=makeClient(objs);
  t("hazard only ahead is not a bounce", st._pinnedBehind(enemy,0,170), false);
}
// 6. the victim's own spike must not count
{
  const objs=[spike(120,0)];
  const cl=makeClient(objs); cl.PlayerManager.isEnemyByID=()=>false;
  const st=new SpikeTick(cl); st.client=cl;
  t("the victim's own spike is not a hazard", st._landsOn(enemy,0,170)===null, true);
}
// 7. nearest of two hazards on the line wins
{
  const objs=[spike(160,0),spike(90,0)];
  const st=new SpikeTick(makeClient(objs)); st.client=makeClient(objs);
  t("nearest hazard on the line is chosen", Math.round(st._landsOn(enemy,0,170).distance), 90);
}

/* ---- damage scoring ---------------------------------------------------- */
function touchingStub(objs){
  const cl=makeClient(objs);
  const st=new SpikeTick(cl); st.client=cl; return st;
}
// 8. a hazard in contact is reported with its damage
{
  const objs=[spike(80,0,49,45)];               // spinning spikes, touching (35+49=84 > 80)
  const st=touchingStub(objs);
  const victim={collisionScale:35,hitScale:35,
    pos:{previous:P(0,0),current:P(0,0),future:P(0,0)},
    collidingObject(o){const r=this.collisionScale+o.collisionScale;return this.pos.current.distance(o.pos.current)<=r}};
  t("contact damage is reported", st._touchingDamage(victim), 45);
}
// 9. a hazard out of contact contributes nothing
{
  const objs=[spike(300,0,49,45)];
  const st=touchingStub(objs);
  const victim={collisionScale:35,hitScale:35,
    pos:{previous:P(0,0),current:P(0,0),future:P(0,0)},
    collidingObject(o){const r=this.collisionScale+o.collisionScale;return this.pos.current.distance(o.pos.current)<=r}};
  t("a distant hazard adds no contact damage", st._touchingDamage(victim), 0);
}
// 10. the victim's own spike never counts as contact
{
  const objs=[spike(80,0,49,45)];
  const cl=makeClient(objs); cl.PlayerManager.isEnemyByID=()=>false;
  const st=new SpikeTick(cl); st.client=cl;
  const victim={collisionScale:35,hitScale:35,
    pos:{previous:P(0,0),current:P(0,0),future:P(0,0)},
    collidingObject(){return true}};
  t("the victim's own spike adds no contact damage", st._touchingDamage(victim), 0);
}
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
