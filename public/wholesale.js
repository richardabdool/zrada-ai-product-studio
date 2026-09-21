// ===== v3.4.1 WHOLESALE PHOTO PREP + POSTER GENERATOR =====
(() => {
  const q = s => document.querySelector(s);
  const qa = s => [...document.querySelectorAll(s)];
  const ws = {items:[], template:"clothing", cleanedReady:false, aiReady:false};

  const canvas = q("#wholesaleCanvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d", {alpha:false});

  function notify(msg){
    try{ if(typeof toast === "function") return toast(msg); }catch(e){}
    console.log(msg);
  }
  function money(v){
    const n=String(v??"").trim().replace(/^\$/,'');
    return n ? `$${n}` : "$0";
  }
  function safe(v){
    try{ if(typeof safeName === "function") return safeName(v); }catch(e){}
    return String(v||"product").replace(/[^a-z0-9_-]+/gi,"_");
  }
  function loadImage(src){
    return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
  }
  function fileToDataURL(file){
    return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  }
  async function imageDataURLFromFile(file,maxSide=1800,quality=.96){
    const raw=await fileToDataURL(file), im=await loadImage(raw);
    const sc=Math.min(1,maxSide/Math.max(im.naturalWidth,im.naturalHeight));
    const c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(im.naturalWidth*sc));
    c.height=Math.max(1,Math.round(im.naturalHeight*sc));
    const x=c.getContext("2d");
    x.fillStyle="#fff";
    x.fillRect(0,0,c.width,c.height);
    x.drawImage(im,0,0,c.width,c.height);
    return c.toDataURL("image/jpeg",quality);
  }

  function estimateBackground(data,w,h){
    let rs=0,gs=0,bs=0,n=0;
    const step=Math.max(1,Math.floor(Math.min(w,h)/180));
    function add(x,y){
      const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),lum=(r+g+b)/3;
      if(lum>120 && mx-mn<85){rs+=r;gs+=g;bs+=b;n++;}
    }
    for(let x=0;x<w;x+=step){add(x,0);add(x,h-1);if(h>8){add(x,4);add(x,h-5)}}
    for(let y=0;y<h;y+=step){add(0,y);add(w-1,y);if(w>8){add(4,y);add(w-5,y)}}
    return n?[rs/n,gs/n,bs/n]:[235,235,235];
  }

  async function localClean(file,strength=55,doWhite=true){
    const raw=await fileToDataURL(file), im=await loadImage(raw);
    const maxSide=1100, sc=Math.min(1,maxSide/Math.max(im.naturalWidth,im.naturalHeight));
    const w=Math.max(1,Math.round(im.naturalWidth*sc)),h=Math.max(1,Math.round(im.naturalHeight*sc));
    const c=document.createElement("canvas");c.width=w;c.height=h;
    const x=c.getContext("2d",{willReadFrequently:true});
    x.drawImage(im,0,0,w,h);
    const id=x.getImageData(0,0,w,h), d=id.data;
    const bg=estimateBackground(d,w,h), th=Number(strength);
    const seen=new Uint8Array(w*h), queue=new Int32Array(w*h);let qh=0,qt=0;
    const isBg=(p)=>{
      const i=p*4,r=d[i],g=d[i+1],b=d[i+2];
      const dr=r-bg[0],dg=g-bg[1],db=b-bg[2],dist=Math.sqrt(dr*dr+dg*dg+db*db);
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),lum=(r+g+b)/3;
      return dist < th*1.9 || (lum > 225-th*.2 && mx-mn < th*.72);
    };
    const push=p=>{if(!seen[p]&&isBg(p)){seen[p]=1;queue[qt++]=p;}};
    for(let xx=0;xx<w;xx++){push(xx);push((h-1)*w+xx)}
    for(let yy=0;yy<h;yy++){push(yy*w);push(yy*w+w-1)}
    while(qh<qt){const p=queue[qh++],xx=p%w,yy=(p/w)|0;if(xx>0)push(p-1);if(xx<w-1)push(p+1);if(yy>0)push(p-w);if(yy<h-1)push(p+w)}

    let minx=w,miny=h,maxx=-1,maxy=-1;
    for(let p=0;p<w*h;p++){
      const i=p*4;
      if(seen[p]&&doWhite){d[i]=255;d[i+1]=255;d[i+2]=255;}
      else if(!seen[p]){
        const xx=p%w,yy=(p/w)|0;
        if(xx<minx)minx=xx;if(xx>maxx)maxx=xx;if(yy<miny)miny=yy;if(yy>maxy)maxy=yy;
        d[i]=Math.min(255,d[i]*1.035+2);d[i+1]=Math.min(255,d[i+1]*1.035+2);d[i+2]=Math.min(255,d[i+2]*1.035+2);
      }
    }
    x.putImageData(id,0,0);
    if(maxx<0){minx=0;miny=0;maxx=w-1;maxy=h-1;}
    const pad=Math.round(Math.max(maxx-minx,maxy-miny)*.04);
    minx=Math.max(0,minx-pad);miny=Math.max(0,miny-pad);maxx=Math.min(w-1,maxx+pad);maxy=Math.min(h-1,maxy+pad);
    const sw=maxx-minx+1,sh=maxy-miny+1;
    const out=document.createElement("canvas");out.width=1200;out.height=1200;
    const o=out.getContext("2d");o.fillStyle="#fff";o.fillRect(0,0,1200,1200);
    const scale=Math.min(1120/sw,1120/sh),dw=sw*scale,dh=sh*scale,dx=(1200-dw)/2,dy=(1200-dh)/2;
    o.drawImage(c,minx,miny,sw,sh,dx,dy,dw,dh);
    return out.toDataURL("image/png");
  }

  async function aiCleanOne(item){
    const resp = await fetch("/api/wholesale-clean", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        image_base64:item.original,
        filename:item.name,
        white_background:!!q("#wholesaleWhiteBg")?.checked,
        product_name:(q("#wholesaleProduct")?.value||"PRODUCT").trim(),
        template:ws.template
      })
    });
    const data = await resp.json().catch(()=>({ok:false,error:"Unreadable server response"}));
    if(!resp.ok || !data?.ok) throw new Error(data?.error || `Server error ${resp.status}`);
    return data.image_base64;
  }

  function renderThumbs(){
    const box=q("#wholesalePhotoGrid");
    if(!ws.items.length){box.innerHTML='<div class="empty">Upload product photos to begin.</div>';return;}
    const source=q("#wholesalePhotoSource")?.value||"cleaned";
    box.innerHTML=ws.items.map((it)=>{
      const using = source==="cleaned" && it.cleaned ? it.cleaned : it.original;
      const label = source==="cleaned" ? (it.cleanedSource || (it.cleaned?"CLEANED":"ORIGINAL")) : "ORIGINAL";
      return `<div class="wPhoto"><img src="${using}"><div class="wPhotoMeta"><b>${it.name}</b><span>${label}</span></div></div>`;
    }).join("");
  }

  q("#wholesaleFiles").addEventListener("change",async e=>{
    const files=[...e.target.files]
      .filter(f=>/^image\/(jpeg|png|webp)/i.test(f.type)||/\.(jpe?g|png|webp)$/i.test(f.name))
      .slice(0,6);
    ws.items=[];
    for(const f of files){
      ws.items.push({file:f,name:f.name,original:await imageDataURLFromFile(f),cleaned:null,cleanedSource:""});
    }
    ws.cleanedReady=false;
    ws.aiReady=false;
    q("#wholesalePhotoSource").value="original";
    renderThumbs();
    await renderPoster();
    notify(`${files.length} product photo(s) loaded`);
  });

  q("#wholesaleStrength").addEventListener("input",e=>q("#wholesaleStrengthValue").textContent=e.target.value);
  q("#wholesaleUseOriginals").onclick=async()=>{q("#wholesalePhotoSource").value="original";renderThumbs();await renderPoster();notify("Using original photos")};

  q("#wholesaleCleanAll").onclick=async()=>{
    if(!ws.items.length)return notify("Upload product photos first");
    const btn=q("#wholesaleCleanAll"), old=btn.textContent;
    btn.disabled=true;
    try{
      for(let i=0;i<ws.items.length;i++){
        btn.textContent=`Cleaning ${i+1}/${ws.items.length}...`;
        ws.items[i].cleaned=await localClean(ws.items[i].file,q("#wholesaleStrength").value,q("#wholesaleWhiteBg").checked);
        ws.items[i].cleanedSource="LOCAL CLEANED";
        renderThumbs();
      }
      ws.cleanedReady=true;
      q("#wholesalePhotoSource").value="cleaned";
      renderThumbs();
      await renderPoster();
      notify("Photos cleaned locally");
    }catch(err){
      notify("Cleanup failed: "+(err.message||err));
    }finally{
      btn.textContent=old;
      btn.disabled=false;
    }
  };

  q("#wholesaleCleanAi").onclick=async()=>{
    if(!ws.items.length)return notify("Upload product photos first");
    const btn=q("#wholesaleCleanAi"), old=btn.textContent;
    btn.disabled=true;
    try{
      for(let i=0;i<ws.items.length;i++){
        btn.textContent=`OpenAI ${i+1}/${ws.items.length}...`;
        ws.items[i].cleaned=await aiCleanOne(ws.items[i]);
        ws.items[i].cleanedSource="OPENAI CLEANED";
        renderThumbs();
      }
      ws.aiReady=true;
      ws.cleanedReady=true;
      q("#wholesalePhotoSource").value="cleaned";
      renderThumbs();
      await renderPoster();
      notify("OpenAI cleanup complete");
    }catch(err){
      notify("OpenAI cleanup failed: "+(err.message||err));
    }finally{
      btn.textContent=old;
      btn.disabled=false;
    }
  };

  q("#wholesaleDownloadCleaned").onclick=()=>{
    const imgs=ws.items.filter(x=>x.cleaned);
    if(!imgs.length)return notify("Clean photos first");
    try{
      const files=imgs.map((it,i)=>({name:`${String(i+1).padStart(2,'0')}_${safe(it.name.replace(/\.[^.]+$/,''))}.png`,data:dataUrlBytes(it.cleaned)}));
      const blob=makeZip(files),a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download=`${safe(q("#wholesaleStyle").value||"ZRADA")}_Cleaned_Photos.zip`;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      notify("Cleaned photos exported");
    }catch(e){notify("Could not create ZIP: "+e.message)}
  };

  qa(".templateCard").forEach(b=>b.onclick=async()=>{qa(".templateCard").forEach(x=>x.classList.remove("active"));b.classList.add("active");ws.template=b.dataset.template;await renderPoster();});
  q("#wholesalePhotoSource").onchange=async()=>{renderThumbs();await renderPoster();};
  ["#wholesaleProduct","#wholesaleStyle","#wholesaleMinimum","#wholesalePrice","#wholesalePriceType","#wholesaleSrp","#wholesaleInfo","#wholesaleSize"].forEach(sel=>q(sel).addEventListener("input",()=>renderPoster()));
  q("#wholesalePreviewBtn").onclick=renderPoster;
  q("#wholesaleExportBtn").onclick=async()=>{
    await renderPoster();
    const a=document.createElement("a");
    a.download=`${safe(q("#wholesaleStyle").value||"ZRADA")}_Wholesale.jpg`;
    a.href=canvas.toDataURL("image/jpeg",.94);
    document.body.appendChild(a);a.click();a.remove();
    notify("Wholesale JPEG exported");
  };
  q("#wholesaleResetBtn").onclick=async()=>{
    ws.items=[];q("#wholesaleFiles").value="";q("#wholesalePhotoSource").value="cleaned";
    renderThumbs();await renderPoster();notify("Wholesale workspace reset");
  };

  function roundedRect(c,x,y,w,h,r,fill){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();}
  function fitText(c,text,maxW,size,min=20,font="Arial Black"){
    let s=size;c.font=`900 ${s}px ${font}`;while(s>min&&c.measureText(text).width>maxW){s-=2;c.font=`900 ${s}px ${font}`;}return s;
  }
  function drawCenteredText(c,text,y,maxW,size,color="#000",font="Arial Black"){
    const s=fitText(c,text,maxW,size,18,font);c.font=`900 ${s}px ${font}`;c.fillStyle=color;c.textAlign="center";c.textBaseline="alphabetic";c.fillText(text,canvas.width/2,y);return s;
  }
  function drawContain(c,im,x,y,w,h,pad=2){
    c.fillStyle="#fff";c.fillRect(x,y,w,h);
    const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
    const sc=Math.min((w-pad*2)/iw,(h-pad*2)/ih);
    const dw=iw*sc,dh=ih*sc;
    c.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  }
  async function currentImages(){
    const source=q("#wholesalePhotoSource").value;
    const urls=ws.items.map(it=>source==="cleaned"?(it.cleaned||it.original):it.original);
    return await Promise.all(urls.map(loadImage));
  }

  function photoRects(n,x,y,w,h,template){
    const gap=12;
    if(n<=0)return [];
    if(n===1)return [[x,y,w,h]];

    if(template==="handbags"){
      if(n===2){
        const left=(w-gap)/2;
        return [[x,y,left,h],[x+left+gap,y,left,h]];
      }
      const heroW=Math.round(w*0.6), rightW=w-heroW-gap;
      const countRight=n-1, eachH=(h-gap*(countRight-1))/countRight;
      const rects=[[x,y,heroW,h]];
      for(let i=0;i<countRight;i++) rects.push([x+heroW+gap,y+i*(eachH+gap),rightW,eachH]);
      return rects;
    }

    if(template==="home" && n>=2){
      const heroH=Math.round(h*0.6), botH=h-heroH-gap;
      const rects=[[x,y,w,heroH]];
      const cols=n-1, cellW=(w-gap*(cols-1))/cols;
      for(let i=0;i<n-1;i++) rects.push([x+i*(cellW+gap),y+heroH+gap,cellW,botH]);
      return rects;
    }

    if(n===2){
      const cellW=(w-gap)/2;
      return [[x,y,cellW,h],[x+cellW+gap,y,cellW,h]];
    }
    if(n===3){
      const heroW=Math.round(w*0.56), sideW=w-heroW-gap, cellH=(h-gap)/2;
      return [[x,y,heroW,h],[x+heroW+gap,y,sideW,cellH],[x+heroW+gap,y+cellH+gap,sideW,cellH]];
    }
    if(n===4){
      const cellW=(w-gap)/2, cellH=(h-gap)/2;
      return [
        [x,y,cellW,cellH],[x+cellW+gap,y,cellW,cellH],
        [x,y+cellH+gap,cellW,cellH],[x+cellW+gap,y+cellH+gap,cellW,cellH]
      ];
    }
    if(n===5){
      const topH=Math.round((h-gap)*0.5), botH=h-topH-gap;
      const topW=(w-gap*2)/3, botW=(w-gap)/2;
      return [
        [x,y,topW,topH],[x+topW+gap,y,topW,topH],[x+(topW+gap)*2,y,topW,topH],
        [x+(w-(botW*2+gap))/2,y+topH+gap,botW,botH],[x+(w-(botW*2+gap))/2+botW+gap,y+topH+gap,botW,botH]
      ];
    }
    const cellW=(w-gap*2)/3, cellH=(h-gap)/2;
    const rects=[];
    for(let row=0;row<2;row++){
      for(let col=0;col<3;col++) rects.push([x+col*(cellW+gap),y+row*(cellH+gap),cellW,cellH]);
    }
    return rects.slice(0,n);
  }

  async function renderPoster(){
    const [cw,ch]=q("#wholesaleSize").value.split("x").map(Number);
    canvas.width=cw;canvas.height=ch;
    ctx.fillStyle="#fff";ctx.fillRect(0,0,cw,ch);
    const portrait=ch>cw;
    const headerH=portrait?190:165;
    const footerH=portrait?88:82;
    const infoH=portrait?225:210;

    ctx.fillStyle="#060606";
    ctx.fillRect(0,0,cw,headerH);
    ctx.textAlign="center";
    ctx.fillStyle="#fff";
    ctx.font=`800 ${portrait?28:24}px Arial`;
    ctx.fillText("ZRADA  WHOLESALE",cw/2,36);
    drawCenteredText(ctx,"WHOLESALE",portrait?160:138,cw-40,portrait?118:104,"#fff","Impact, Arial Black");

    const product=(q("#wholesaleProduct").value||"PRODUCT").trim().toUpperCase();
    const style=(q("#wholesaleStyle").value||"").trim().toUpperCase();
    const extra=(q("#wholesaleInfo").value||"").trim().toUpperCase();
    const min=q("#wholesaleMinimum").value;
    const price=q("#wholesalePrice").value;
    const ptype=q("#wholesalePriceType").value;
    const srp=q("#wholesaleSrp").value;

    const titleArea=portrait?120:108;
    const imageY=headerH+12;
    const imageH=ch-headerH-footerH-infoH-titleArea-18;
    const images=await currentImages();
    if(images.length){
      const rects=photoRects(images.length,24,imageY,cw-48,imageH,ws.template);
      rects.forEach((r,i)=>drawContain(ctx,images[i],...r,2));
    }else{
      ctx.fillStyle="#f5f3f0";
      ctx.fillRect(24,imageY,cw-48,imageH);
      ctx.fillStyle="#888";
      ctx.textAlign="center";
      ctx.font="700 28px Arial";
      ctx.fillText("UPLOAD PRODUCT PHOTOS",cw/2,imageY+imageH/2);
    }

    const titleY=imageY+imageH+(portrait?58:50);
    const titleSize=drawCenteredText(ctx,product,titleY,cw-60,portrait?68:58,"#050505","Impact, Arial Black");
    let styleY=titleY+36;
    if(extra){
      drawCenteredText(ctx,extra,titleY+(portrait?40:34),cw-90,portrait?26:23,"#111","Arial Black");
      styleY=titleY+(portrait?72:62);
    } else {
      styleY=titleY+(portrait?38:34);
    }
    if(style){
      ctx.font=`900 ${portrait?23:20}px Arial`;
      ctx.fillStyle="#111";
      ctx.textAlign="center";
      ctx.fillText(`STYLE NO: ${style}`,cw/2,styleY);
    }

    const infoY=ch-footerH-infoH+10;
    const sideW=portrait?235:220;
    const gap=14;
    const centerW=cw-sideW*2-gap*4;
    ctx.strokeStyle="#111";ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(sideW+gap*1.5,infoY+14);ctx.lineTo(sideW+gap*1.5,infoY+infoH-20);
    ctx.moveTo(cw-sideW-gap*1.5,infoY+14);ctx.lineTo(cw-sideW-gap*1.5,infoY+infoH-20);
    ctx.stroke();

    ctx.fillStyle="#050505";
    ctx.textAlign="center";
    ctx.font=`900 ${portrait?60:54}px Impact, Arial Black`;
    ctx.fillText(min,sideW/2,infoY+95);
    ctx.font=`900 ${portrait?30:27}px Impact, Arial Black`;
    ctx.fillText("MINIMUM",sideW/2,infoY+136);

    const px=sideW+gap*2, py=infoY+12, pw=centerW, ph=infoH-28;
    roundedRect(ctx,px,py,pw,ph,16,"#e50914");
    ctx.fillStyle="#fff";
    ctx.textAlign="center";
    ctx.font=`900 ${portrait?27:24}px Arial`;
    ctx.fillText("PRICE:",px+pw/2,py+34);
    ctx.font=`900 ${portrait?76:70}px Arial Black`;
    ctx.fillText(money(price),px+pw/2,py+108);
    ctx.font=`900 ${portrait?24:21}px Arial`;
    ctx.fillText("WHOLESALE PRICE",px+pw/2,py+140);
    ctx.font=`800 ${portrait?18:16}px Arial`;
    ctx.fillText(ptype,px+pw/2,py+168);

    const rx=cw-sideW/2;
    ctx.fillStyle="#050505";
    ctx.font=`900 ${portrait?33:28}px Arial Black`;
    ctx.fillText("SRP",rx,infoY+45);
    ctx.font=`900 ${portrait?62:56}px Impact, Arial Black`;
    ctx.fillText(money(srp),rx,infoY+108);
    ctx.font=`800 ${portrait?16:14}px Arial`;
    ctx.fillText("(SUGGESTED",rx,infoY+136);
    ctx.fillText("RETAIL PRICE)",rx,infoY+157);

    const fy=ch-footerH;
    ctx.fillStyle="#050505";
    ctx.fillRect(0,fy,cw,footerH);
    ctx.fillStyle="#fff";
    ctx.textBaseline="middle";
    ctx.font=`800 ${portrait?23:20}px Arial`;
    ctx.textAlign="left";
    ctx.fillText("●  San Fernando Showroom",26,fy+footerH/2);
    ctx.textAlign="center";
    ctx.fillText("◎  ZRADATT.COM",cw/2,fy+footerH/2);
    ctx.textAlign="right";
    ctx.fillText("◉  708-7761",cw-26,fy+footerH/2);
    ctx.textBaseline="alphabetic";
  }

  renderPoster();
})();
