
// ===== v2.7 LOGIN CLIENT =====
async function zradaAuthStatus(){
  try{
    const r=await fetch("/api/auth-status",{credentials:"same-origin"});
    const d=await r.json();
    document.getElementById("loginGate").classList.toggle("hidden",!!d.authenticated);
  }catch(e){
    document.getElementById("loginGate").classList.remove("hidden");
  }
}
document.addEventListener("DOMContentLoaded",()=>{
  const form=document.getElementById("loginForm");
  if(form) form.addEventListener("submit",async e=>{
    e.preventDefault();
    const error=document.getElementById("loginError");
    error.textContent="Signing in...";
    try{
      const r=await fetch("/api/login",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        credentials:"same-origin",
        body:JSON.stringify({
          username:document.getElementById("loginUsername").value,
          password:document.getElementById("loginPassword").value
        })
      });
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Login failed.");
      error.textContent="";
      document.getElementById("loginPassword").value="";
      document.getElementById("loginGate").classList.add("hidden");
    }catch(err){ error.textContent=err.message; }
  });
  zradaAuthStatus();
});
async function zradaLogout(){
  await fetch("/api/logout",{method:"POST",credentials:"same-origin"});
  location.reload();
}
// ===== END LOGIN CLIENT =====


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
async function readFile(file) {
  // v2.7: normalize every uploaded product image to a fresh standard RGB JPEG.
  // This fixes CMYK/progressive/unusual JPEG modes and Windows files reported as image/dng.
  try {
    let bitmap;
    if ("createImageBitmap" in window) {
      bitmap = await createImageBitmap(file, {imageOrientation:"from-image"});
    } else {
      const objectUrl = URL.createObjectURL(file);
      bitmap = await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error("Browser could not decode this image."));
        img.src=objectUrl;
      });
    }

    const w = bitmap.width || bitmap.naturalWidth;
    const h = bitmap.height || bitmap.naturalHeight;
    if (!w || !h) throw new Error("Image has invalid dimensions.");

    // Keep originals sharp but avoid enormous payloads that can overload Render.
    const MAX = 3000;
    const scale = Math.min(1, MAX / Math.max(w,h));
    const cw = Math.max(1, Math.round(w*scale));
    const ch = Math.max(1, Math.round(h*scale));

    const canvas=document.createElement("canvas");
    canvas.width=cw; canvas.height=ch;
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.fillStyle="#ffffff";
    ctx.fillRect(0,0,cw,ch);
    ctx.drawImage(bitmap,0,0,cw,ch);

    if (bitmap.close) bitmap.close();

    // JPEG export from canvas is standard browser-decoded RGB/sRGB data.
    return canvas.toDataURL("image/jpeg",0.95);
  } catch (e) {
    throw new Error(
      `Could not normalize ${file?.name||"image"}. ` +
      `The file may not contain a browser-decodable JPEG/PNG/WebP image. ` +
      `Original error: ${e.message||e}`
    );
  }
})}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function isTransientStatus(status){return [408,425,429,500,502,503,504].includes(Number(status))}
function friendlyHttpError(status,text){
  const raw=String(text||"").trim();
  if(status===429)return "OpenAI/Render is temporarily rate-limited. The app will retry automatically.";
  if([500,502,503,504].includes(Number(status)))return "Temporary server interruption. The app will retry automatically.";
  if(raw.startsWith("<!DOCTYPE")||raw.startsWith("<html")||raw.includes("<!DOCTYPE html"))return "Temporary Render gateway page received instead of the image response.";
  try{
    const d=JSON.parse(raw);
    return d?.error || d?.message || `Request failed (HTTP ${status}).`;
  }catch{}
  return raw.slice(0,240) || `Request failed (HTTP ${status}).`;
}
async function fetchJsonSafe(url,options={}){
  const r=await fetch(url,options);
  const text=await r.text();
  let data=null;
  try{data=text?JSON.parse(text):{}}catch{}
  if(!r.ok){
    const err=new Error(data?.error||friendlyHttpError(r.status,text));
    err.status=r.status;
    err.transient=isTransientStatus(r.status) || !data || /temporary|gateway|timeout|rate.limit/i.test(err.message);
    err.raw=text;
    throw err;
  }
  if(!data){
    const err=new Error("The server returned a non-JSON response. This is usually a temporary Render interruption.");
    err.status=r.status;
    err.transient=true;
    err.raw=text;
    throw err;
  }
  return data;
}

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
  const d=await fetchJsonSafe("/api/generate",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  if(!d.ok)throw new Error(d.error||"Generation failed");
  j.result=d.image_base64;
  j.meta=d;
  j.status="complete";
  j.error=null;
  j.retryMessage=null;
  if(!reference)state.styleRefs.set(j.styleSeed,d.image_base64);
}

async function runJobs(jobs){
  if(state.running)return;
  if(!jobs.length)return toast("No jobs to process");
  state.running=true;
  $("#generateBtn").disabled=true;
  $("#retryFailedBtn").disabled=true;
  $("#generateBtn").textContent="Generating...";
  for(let idx=0;idx<jobs.length;idx++){
    const j=jobs[idx];
    j.error=null;
    j.retryMessage=null;
    let success=false;
    const maxAttempts=3;
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      j.attempt=attempt;
      j.status=attempt===1?"running":"retrying";
      j.retryMessage=attempt===1?null:`Retry ${attempt} of ${maxAttempts}`;
      renderAll();
      try{
        await generateJob(j);
        success=true;
        break;
      }catch(e){
        j.error=e.message||String(e);
        const transient=e.transient!==false;
        if(attempt<maxAttempts && transient){
          const waitMs=attempt===1?5000:10000;
          j.status="retrying";
          j.retryMessage=`Temporary interruption — retrying in ${Math.round(waitMs/1000)} seconds (${attempt+1}/${maxAttempts})`;
          renderAll();
          await sleep(waitMs);
          continue;
        }
        j.status="failed";
        j.retryMessage=null;
        break;
      }
    }
    renderAll();
    // Gentle spacing between expensive image calls protects large batches on free/low-tier hosting.
    if(success && idx<jobs.length-1)await sleep(2500);
  }
  state.running=false;
  $("#generateBtn").disabled=false;
  $("#retryFailedBtn").disabled=false;
  $("#generateBtn").textContent="Generate Images";
  toast("Generation queue finished");
}
$("#generateBtn").onclick=async()=>{
  const jobs=state.jobs.filter(j=>j.status==="queued"||j.status==="failed");
  if(!jobs.length)return toast("No queued or failed jobs to generate");
  await runJobs(jobs);
};
$("#retryFailedBtn").onclick=async()=>{
  const failed=state.jobs.filter(j=>j.status==="failed");
  if(!failed.length)return toast("No failed images to retry");
  failed.forEach(j=>{j.error=null;j.retryMessage=null;});
  await runJobs(failed);
};
function renderQueue(){
  const q=$("#queueList");
  if(!state.jobs.length){q.className="empty";q.textContent="No images queued.";progress();return}
  q.className="";
  q.innerHTML=state.jobs.map(j=>`<div class="job"><div><b>${esc(j.style)}</b><br><span class="meta">${esc(j.category)}</span></div><span>${esc(j.color)}</span><span>${esc(j.meta?.framing||"—")}</span><span class="status ${j.status}">${esc(j.status.toUpperCase())}${j.attempt&&j.status!=="complete"?` <small>(${j.attempt}/3)</small>`:""}</span>${j.retryMessage?`<div class="retryNotice">${esc(j.retryMessage)}</div>`:""}${j.error&&j.status==="failed"?`<div class="jobError"><b>Error:</b> ${esc(j.error)}</div>`:""}</div>`).join("");
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
function crc32(bytes){
  let c=0xffffffff;
  for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}
  return (c^0xffffffff)>>>0;
}
function u16(n){return new Uint8Array([n&255,(n>>>8)&255])}
function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
function concat(parts){const n=parts.reduce((a,b)=>a+b.length,0),o=new Uint8Array(n);let p=0;for(const x of parts){o.set(x,p);p+=x.length}return o}
function dataUrlBytes(url){const b64=url.split(",")[1],bin=atob(b64),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function safeName(v){return String(v).trim().replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g,"_")}
function makeZip(files){
  const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
  for(const f of files){
    const name=enc.encode(f.name),data=f.data,crc=crc32(data);
    const local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    const central=concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    locals.push(local);centrals.push(central);offset+=local.length;
  }
  const centralData=concat(centrals),end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralData.length),u32(offset),u16(0)]);
  return new Blob([...locals,centralData,end],{type:"application/zip"});
}
$("#downloadApproved").onclick=()=>{
  const approved=state.jobs.filter(j=>j.approved&&j.result);
  if(!approved.length)return toast("No approved images");
  const files=approved.map(j=>({name:`${safeName(j.style)}/${safeName(j.style)}_${safeName(j.color)}.png`,data:dataUrlBytes(j.result)}));
  const blob=makeZip(files),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="ZRADA_Approved_Product_Images.zip";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(`${approved.length} approved image(s) exported as ZIP`);
};
$("#clearApproved").onclick=()=>{
  const approved=state.jobs.filter(j=>j.approved);
  if(!approved.length)return toast("No approved products to clear");
  if(!confirm(`Clear ${approved.length} approved image(s) from this workspace? Make sure you downloaded them first.`))return;
  approved.forEach(j=>{try{if(j.sourceURL?.startsWith("blob:"))URL.revokeObjectURL(j.sourceURL)}catch(e){}});
  state.jobs=state.jobs.filter(j=>!j.approved);
  renderAll();
  toast(`${approved.length} approved image(s) cleared`);
};
function renderStats(){$("#statStyles").textContent=new Set(state.jobs.map(j=>j.styleSeed)).size;$("#statQueued").textContent=state.jobs.filter(j=>j.status==="queued"||j.status==="running"||j.status==="retrying").length;$("#statDone").textContent=state.jobs.filter(j=>j.status==="complete").length;$("#statApproved").textContent=state.jobs.filter(j=>j.approved).length}
function renderAll(){renderQueue();renderReview();renderStats()}

$("#model").value=localStorage.getItem("zradaModel")||"gpt-image-2";
$("#quality").value=localStorage.getItem("zradaQuality")||"high";
$("#size").value=localStorage.getItem("zradaSize")||"1024x1536";

async function testServerConnection(){
  $("#apiStatus").textContent="Testing server connection...";
  try{
    const d=await fetchJsonSafe("/api/test",{method:"POST"});
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
