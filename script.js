const bodies={
earth:{name:"Earth",mu:398600.4418,radius:6378.137,colors:["#b9f4ff","#49a9ff","#0d2b5a"]},
mars:{name:"Mars",mu:42828.375214,radius:3389.5,colors:["#ffd0ae","#db754d","#4b1b18"]},
moon:{name:"Moon",mu:4902.800066,radius:1737.4,colors:["#ffffff","#aeb8c5","#353b45"]}
};

const $=id=>document.getElementById(id);
const canvas=$("orbitCanvas");
const ctx=canvas.getContext("2d");
let animationFrame=null;
let currentMission=null;

function getMission(){
  const body=bodies[$("planet").value];
  const altitude1=Number($("r1").value);
  const altitude2=Number($("r2").value);

  if(!Number.isFinite(altitude1)||!Number.isFinite(altitude2)||altitude1<=0||altitude2<=0){
    throw new Error("Enter valid positive orbital altitudes.");
  }
  if(altitude1===altitude2){
    throw new Error("Choose two different orbital altitudes.");
  }

  const r1=body.radius+altitude1;
  const r2=body.radius+altitude2;
  const mu=body.mu;
  const v1=Math.sqrt(mu/r1);
  const v2=Math.sqrt(mu/r2);
  const aTransfer=(r1+r2)/2;
  const vTransferAtR1=Math.sqrt(mu*(2/r1-1/aTransfer));
  const vTransferAtR2=Math.sqrt(mu*(2/r2-1/aTransfer));
  const dv1=Math.abs(vTransferAtR1-v1);
  const dv2=Math.abs(v2-vTransferAtR2);
  const totalDv=dv1+dv2;
  const transferHours=Math.PI*Math.sqrt(aTransfer**3/mu)/3600;

  return {body,altitude1,altitude2,r1,r2,dv1,dv2,totalDv,transferHours};
}

function calculateTransfer(animate=true){
  try{
    currentMission=getMission();
  }catch(error){
    alert(error.message);
    return;
  }

  $("dv1").textContent=currentMission.dv1.toFixed(3);
  $("dv2").textContent=currentMission.dv2.toFixed(3);
  $("dvt").textContent=currentMission.totalDv.toFixed(3);
  $("time").textContent=currentMission.transferHours.toFixed(2);
  $("missionTitle").textContent=`${currentMission.body.name} Hohmann Transfer`;

  if(animate) animateTransfer(currentMission);
  else drawScene(currentMission,1);
}

function drawScene(mission,progress){
  const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2;
  ctx.clearRect(0,0,w,h);

  const bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,"#020811");
  bg.addColorStop(1,"#06101c");
  ctx.fillStyle=bg;
  ctx.fillRect(0,0,w,h);

  drawStars(w,h);

  const maxR=Math.max(mission.r1,mission.r2);
  const scale=Math.min(w,h)*0.37/maxR;
  const orbit1=mission.r1*scale;
  const orbit2=mission.r2*scale;
  const planetRadius=Math.max(28,mission.body.radius*scale);

  drawOrbit(cx,cy,orbit1,"rgba(99,215,255,.85)",2);
  drawOrbit(cx,cy,orbit2,"rgba(255,255,255,.48)",2);

  const inner=Math.min(orbit1,orbit2);
  const outer=Math.max(orbit1,orbit2);
  const transfer=drawTransferEllipse(cx,cy,inner,outer);

  drawPlanet(cx,cy,planetRadius,mission.body.colors);

  const theta=Math.PI*progress;
  const x=transfer.centerX+transfer.a*Math.cos(theta);
  const y=cy+transfer.b*Math.sin(theta);
  drawSpacecraft(x,y,theta+Math.PI/2);

  drawBurnMarker(cx+orbit1,cy,"BURN 1");
  drawBurnMarker(cx-orbit2,cy,"BURN 2");

  ctx.fillStyle="#d8eaff";
  ctx.font="600 17px system-ui";
  ctx.fillText(`${mission.body.name} Transfer Simulation`,24,34);

  ctx.fillStyle="#7f95b2";
  ctx.font="14px system-ui";
  ctx.fillText(`Start: ${mission.altitude1.toLocaleString()} km`,24,58);
  ctx.fillText(`Target: ${mission.altitude2.toLocaleString()} km`,24,80);
}

function drawStars(w,h){
  for(let i=0;i<130;i++){
    const x=(i*91+537)%w;
    const y=(i*53+991)%h;
    const size=(i%4===0)?2:1;
    ctx.fillStyle=i%7===0?"rgba(99,215,255,.8)":"rgba(255,255,255,.64)";
    ctx.fillRect(x,y,size,size);
  }
}

function drawOrbit(cx,cy,r,color,width){
  ctx.beginPath();
  ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  ctx.stroke();
}

function drawTransferEllipse(cx,cy,inner,outer){
  const a=(inner+outer)/2;
  const c=(outer-inner)/2;
  const b=Math.sqrt(Math.max(1,a*a-c*c));
  const centerX=cx-c;

  ctx.save();
  ctx.translate(centerX,cy);
  ctx.beginPath();
  ctx.ellipse(0,0,a,b,0,0,Math.PI*2);
  ctx.setLineDash([12,9]);
  ctx.strokeStyle="#ffc66d";
  ctx.lineWidth=3;
  ctx.shadowColor="rgba(255,198,109,.35)";
  ctx.shadowBlur=12;
  ctx.stroke();
  ctx.restore();
  ctx.setLineDash([]);

  return {a,b,centerX};
}

function drawPlanet(cx,cy,r,colors){
  const glow=ctx.createRadialGradient(cx,cy,r*.4,cx,cy,r*1.8);
  glow.addColorStop(0,"rgba(76,168,255,.22)");
  glow.addColorStop(1,"rgba(76,168,255,0)");
  ctx.beginPath();
  ctx.arc(cx,cy,r*1.8,0,Math.PI*2);
  ctx.fillStyle=glow;
  ctx.fill();

  const g=ctx.createRadialGradient(cx-r*.35,cy-r*.35,r*.05,cx,cy,r);
  g.addColorStop(0,colors[0]);
  g.addColorStop(.35,colors[1]);
  g.addColorStop(1,colors[2]);

  ctx.beginPath();
  ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle=g;
  ctx.fill();

  ctx.strokeStyle="rgba(255,255,255,.18)";
  ctx.lineWidth=2;
  ctx.stroke();
}

function drawSpacecraft(x,y,rotation){
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(rotation);
  ctx.shadowColor="#ffffff";
  ctx.shadowBlur=13;

  ctx.fillStyle="#ffffff";
  ctx.beginPath();
  ctx.moveTo(15,0);
  ctx.lineTo(-10,-7);
  ctx.lineTo(-6,0);
  ctx.lineTo(-10,7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle="#63d7ff";
  ctx.fillRect(-25,-5,14,10);
  ctx.fillRect(11,-5,14,10);
  ctx.restore();
}

function drawBurnMarker(x,y,label){
  ctx.beginPath();
  ctx.arc(x,y,6,0,Math.PI*2);
  ctx.fillStyle="#ffc66d";
  ctx.fill();

  ctx.fillStyle="#ffc66d";
  ctx.font="700 11px system-ui";
  const offset=label==="BURN 1"?12:-60;
  ctx.fillText(label,x+offset,y-10);
}

function animateTransfer(mission){
  if(animationFrame) cancelAnimationFrame(animationFrame);
  const duration=3600;
  const start=performance.now();

  function frame(now){
    const t=Math.min(1,(now-start)/duration);
    const eased=.5-.5*Math.cos(Math.PI*t);
    drawScene(mission,eased);
    if(t<1) animationFrame=requestAnimationFrame(frame);
  }
  animationFrame=requestAnimationFrame(frame);
}

document.querySelectorAll(".preset").forEach(button=>{
  button.addEventListener("click",()=>{
    $("planet").value=button.dataset.body;
    $("r1").value=button.dataset.start;
    $("r2").value=button.dataset.target;
    calculateTransfer(true);
  });
});

$("calculate").addEventListener("click",()=>calculateTransfer(true));
$("playAnimation").addEventListener("click",()=>currentMission&&animateTransfer(currentMission));
$("planet").addEventListener("change",()=>calculateTransfer(false));

calculateTransfer(true);
