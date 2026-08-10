
const state={files:[],groups:{},jobs:[],styleRefs:new Map(),running:false};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const categoryHelp={
WOMENS_DRESS:"Full-body dress photography. Exact dress length is locked; hem and feet remain visible.",
WOMENS_TOP:"Head-to-upper-thigh framing. Complete neckline, sleeves and hem remain visible.",
WOMENS_SKIRT:"Skirt length is protected. Mini stays mini; midi/maxi stay their true length.",
WOMENS_JEANS:"Full-body jeans photography. Waistband, pockets, fit and both hems remain visible.",
WOMENS_PANTS:"Full-body pants photography. Leg cut, cargo/pleat details and length are protected.",
MENS_TSHIRT:"Designed specifically for men's T-shirts: collar, sleeves, graphic placement, fit and hem.",
MENS_POLO_SHIRT:"Optimized for polos and shirts: collar, placket, buttons, sleeves and print placement.",
MENS_JEANS:"Full-body men's jeans: waistband, wash, pockets, leg cut and both hems.",
MENS_PANTS_SHORTS:"Men's pants/shorts: exact garment length and cargo/pocket details preserved.",
HANDBAG_LIFESTYLE:"Adult female lifestyle model carrying the bag naturally; entire bag stays visible.",
HANDBAG_PRODUCT:"Product-only handbag photography with accurate handles, straps and hardware.",
BRA_PRODUCT:"Always product only. No model/mannequin/body form.",
PANTY_PRODUCT:"Always product only. No model/mannequin/body form.",
SHOES_SLIPPERS:"Footwear-focused lifestyle framing with both products visible.",
ACCESSORY_PRODUCT:"Product-focused neutral ecommerce photography.",
HOUSEHOLD_PRODUCT:"Product-only clean retail photography."
};
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function toast(m){let t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2000)}
function showView(v){$$(".view").forEach(x=>x.classList.remove("active"));$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$("#"+v).classList.add("active")}
window.showView=showView;$$(".nav").forEach(b=>b.onclick=()=>showView(b.dataset.view));
function updateCategory(){$("#categoryHelp").textContent=categoryHelp[$("#category").value]||""}
$("#category").onchange=updateCategory;updateCategory();

function colorName(n){return n.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim()}
function readDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
$("#folderInput").onchange=e=>{
  state.files=[...e.target.files].filter(f=>(f.type||"").startsWith("image/")||/\.(png|jpe?g|webp)$/i.test(f.name));
  state.groups={};
  for(const f of state.files){
    const parts=(f.webkitRelativePath||f.name).split("/").filter(Boolean);
    const style=parts.length>=2?parts[parts.length-2]:"Unsorted";
    (state.groups[style]??=[]).push({file:f,color:colorName(f.name)});
  }
  renderBatch();
};
function renderBatch(){
  const entries=Object.entries(state.groups),p=$("#preview");
  if(!state.files.length){p.className="empty";p.textContent="No folder selected.";$("#batchSummary").classList.add("hidden");$("#addQueue").disabled=true;return}
  p.className="";
  p.innerHTML=entries.map(([s,a])=>`<div class="style"><div class="styleHead"><b>${esc(s)}</b><span>${a.length} color${a.length===1?"":"s"}</span></div><div class="chips">${a.map(x=>`<span class="chip">${esc(x.color)}</span>`).join("")}</div></div>`).join("");
  $("#batchSummary").classList.remove("hidden");$("#batchSummary").innerHTML=`Detected <b>${entries.length}</b> style(s) and <b>${state.files.length}</b> color image(s).`;
  $("#addQueue").disabled=false;
}
$("#clearBatch").onclick=()=>{state.files=[];state.groups={};$("#folderInput").value="";renderBatch()};
$("#addQueue").onclick=()=>{
  const category=$("#category").value,fb=$("#femaleBody").value,mb=$("#maleBuild").value;
  for(const [style,items] of Object.entries(state.groups)){
    const seed=style+"-"+crypto.getRandomValues(new Uint32Array(1))[0];
    items.forEach((x,i)=>state.jobs.push({id:crypto.randomUUID(),style,color:x.color,file:x.file,sourceURL:URL.createObjectURL(x.file),category,femaleBody:fb,maleBuild:mb,styleSeed:seed,status:"queued",result:null,error:null,approved:false,index:i}));
  }
  $("#clearBatch").click();renderAll();showView("queue");toast("Batch added to generation queue");
};

async function generateJob(j){
  const source=await readDataURL(j.file);
  const reference=state.styleRefs.get(j.styleSeed)||null;
  const payload={
    category:j.category,color:j.color,female_body:j.femaleBody,male_build:j.maleBuild,style_seed:j.styleSeed,
    filename:j.file.name,source_base64:source,reference_base64:reference,
    model:localStorage.getItem("zradaModel")||"gpt-image-2",
    quality:localStorage.getItem("zradaQuality")||"high",
    size:localStorage.getItem("zradaSize")||"1024x1536"
  };
  const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const d=await r.json();
  if(!r.ok||!d.ok)throw new Error(d.error||"Generation failed");
  j.result=d.image_base64;j.meta=d;j.status="complete";
  if(!reference)state.styleRefs.set(j.styleSeed,d.image_base64);
}
$("#generateBtn").onclick=async()=>{
  if(state.running)return;
  const jobs=state.jobs.filter(j=>j.status==="queued"||j.status==="failed");
  if(!jobs.length)return toast("No queued or failed jobs to generate");
  state.running=true;$("#generateBtn").textContent="Generating...";
  for(const j of jobs){
    j.status="running";j.error=null;renderAll();
    let attempts=0;
    while(attempts<2){
      try{await generateJob(j);break}catch(e){attempts++;j.error=e.message;if(attempts>=2)j.status="failed";}
    }
    renderAll();
  }
  state.running=false;$("#generateBtn").textContent="Generate Images";toast("Generation queue finished");
};
function renderQueue(){
  const q=$("#queueList");
  if(!state.jobs.length){q.className="empty";q.textContent="No images queued.";progress();return}
  q.className="";
  q.innerHTML=state.jobs.map(j=>`<div class="job"><div><b>${esc(j.style)}</b><br><span class="meta">${esc(j.category)}</span></div><span>${esc(j.color)}</span><span>${esc(j.meta?.framing||"—")}</span><span class="status ${j.status}">${esc(j.status.toUpperCase())}</span>${j.error?`<div class="jobError"><b>Error:</b> ${esc(j.error)}</div>`:""}</div>`).join("");
  progress();
}
function progress(){let t=state.jobs.length,d=state.jobs.filter(j=>j.status==="complete").length,p=t?Math.round(d/t*100):0;$("#progressText").textContent=`${d} of ${t} generated`;$("#progressPct").textContent=p+"%";$("#progressBar").style.width=p+"%"}
function renderReview(){
  const jobs=state.jobs.filter(j=>j.result),box=$("#reviewGrid");
  if(!jobs.length){box.innerHTML='<div class="empty">Generated images will appear here.</div>';return}
  box.innerHTML=jobs.map(j=>`<div class="reviewCard"><div class="reviewTop"><div><b>${esc(j.style)} — ${esc(j.color)}</b><br><span class="meta">${esc(j.meta?.model_profile||"Product only")} • ${esc(j.meta?.scene||"")} • ${esc(j.meta?.framing||"")}</span></div><span class="meta">${j.approved?"APPROVED":"PENDING"}</span></div><div class="compare"><div class="imgBox"><small>ORIGINAL MANNEQUIN PHOTO</small><img src="${j.sourceURL}"></div><div class="imgBox"><small>AI PRODUCT IMAGE</small><img src="${j.result}"></div></div><div class="reviewActions"><button class="mini approve" onclick="approve('${j.id}')">Approve</button><button class="mini regen" onclick="regenerate('${j.id}')">Regenerate</button><button class="mini reject" onclick="removeJob('${j.id}')">Reject</button></div></div>`).join("");
}
window.approve=id=>{const j=state.jobs.find(x=>x.id===id);if(j){j.approved=true;renderAll();toast("Approved")}}
window.regenerate=id=>{const j=state.jobs.find(x=>x.id===id);if(j){j.status="queued";j.result=null;j.error=null;j.approved=false;renderAll();showView("queue")}}
window.removeJob=id=>{state.jobs=state.jobs.filter(x=>x.id!==id);renderAll()}
$("#downloadApproved").onclick=async()=>{
  const approved=state.jobs.filter(j=>j.approved&&j.result);
  if(!approved.length)return toast("No approved images");
  // Browser-native individual downloads: avoids external ZIP dependency.
  for(const j of approved){
    const a=document.createElement("a");a.href=j.result;a.download=`${j.style}_${j.color.replace(/\s+/g,"_")}.png`;document.body.appendChild(a);a.click();a.remove();
    await new Promise(r=>setTimeout(r,250));
  }
  toast(`${approved.length} approved image(s) downloaded`);
};
function renderStats(){$("#statStyles").textContent=new Set(state.jobs.map(j=>j.styleSeed)).size;$("#statQueued").textContent=state.jobs.filter(j=>j.status==="queued"||j.status==="running").length;$("#statDone").textContent=state.jobs.filter(j=>j.status==="complete").length;$("#statApproved").textContent=state.jobs.filter(j=>j.approved).length}
function renderAll(){renderQueue();renderReview();renderStats()}

$("#model").value=localStorage.getItem("zradaModel")||"gpt-image-2";
$("#quality").value=localStorage.getItem("zradaQuality")||"high";
$("#size").value=localStorage.getItem("zradaSize")||"1024x1536";

async function testServerConnection(){
  $("#apiStatus").textContent="Testing server connection...";
  try{
    const r=await fetch("/api/test",{method:"POST"});
    const d=await r.json();
    $("#apiStatus").textContent=d.ok
      ?"Server connection successful. OpenAI is ready."
      :"Connection failed: "+(d.error||"Unknown error");
  }catch(e){
    $("#apiStatus").textContent="Connection failed: "+e.message;
  }
}
$("#testKey").onclick=testServerConnection;

["model","quality","size"].forEach(id=>{
  $("#"+id).onchange=()=>{
    localStorage.setItem("zradaModel",$("#model").value);
    localStorage.setItem("zradaQuality",$("#quality").value);
    localStorage.setItem("zradaSize",$("#size").value);
    toast("Image setting saved");
  };
});

testServerConnection();renderBatch();renderAll();
