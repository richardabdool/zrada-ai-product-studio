
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dcraw = require("dcraw");

const PORT = process.env.PORT || 8787;
const PUBLIC = path.join(__dirname, "public");

function send(res, status, body, type="application/json; charset=utf-8") {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": data.length,
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff"
  });
  res.end(data);
}
function safeError(status, text) {
  let msg = text, code = "";
  try {
    const o = JSON.parse(text);
    if (o?.error?.message) msg = o.error.message;
    if (o?.error?.code) code = o.error.code;
  } catch {}
  if (status === 401 || code === "invalid_api_key") msg = "API key rejected. Paste a valid OpenAI API key.";
  else if (status === 429 || /insufficient_quota|billing/i.test(code)) msg = "OpenAI API billing/quota problem. Check API billing, credits and project limits.";
  else if (status === 403 || /verification|organization/i.test(msg)) msg = "Your OpenAI API organization may need verification before GPT Image can be used.";
  else if (/model_not_found/i.test(code) || /not have access|does not exist/i.test(msg)) msg = "Your API project does not have access to the selected image model.";
  return msg;
}
function hashInt(s) {
  const h = crypto.createHash("sha256").update(String(s)).digest();
  return h.readUInt32BE(0);
}
function choose(arr, seed, offset=0) {
  return arr[(seed + offset) % arr.length];
}

const femaleModels = [
  "adult Afro-Caribbean fashion model, slim build",
  "adult Indo-Caribbean fashion model, slim build",
  "adult mixed-Caribbean fashion model, athletic build",
  "adult Afro-Caribbean fashion model, natural curvy build",
  "adult Indo-Caribbean fashion model, natural curvy build",
  "adult Caribbean fashion model, defined hourglass / BBL-inspired curvy silhouette, tasteful commercial fashion styling",
  "adult Afro-Caribbean fashion model, plus-size curvy build",
  "adult mixed-Caribbean fashion model, average build",
  "adult Caribbean fashion model, mature sophisticated appearance"
];
const maleModels = [
  "adult Afro-Caribbean male fashion model, lean athletic build",
  "adult Indo-Caribbean male fashion model, lean build",
  "adult mixed-Caribbean male fashion model, athletic build",
  "adult Caribbean male fashion model, average build",
  "adult Caribbean male fashion model, plus-size build",
  "adult Caribbean male fashion model, mature sophisticated appearance"
];

const scenes = {
  dress: ["tropical luxury courtyard","botanical garden walkway","upscale outdoor café","historic Caribbean streetscape","waterfront promenade","modern resort exterior"],
  top: ["upscale outdoor café","boutique shopping district","tropical courtyard","modern promenade"],
  skirt: ["garden walkway","boutique district","outdoor café","resort courtyard"],
  womensBottom: ["modern promenade","clean shopping street","resort walkway","contemporary exterior"],
  mensTop: ["marina promenade","modern city street","upscale café exterior","beachfront boardwalk"],
  mensBottom: ["marina promenade","modern city street","clean boardwalk","contemporary commercial district"],
  bag: ["luxury hotel entrance","upscale café","boutique shopping district","resort exterior"],
  shoes: ["resort walkway","clean promenade","beachfront boardwalk"]
};

function femaleProfile(body, seed) {
  let pool = femaleModels;
  const b = String(body || "Auto").toLowerCase();
  if (b === "curvy") pool = femaleModels.filter(x => /curvy/i.test(x));
  else if (b === "bbl / hourglass") pool = femaleModels.filter(x => /bbl-inspired|hourglass/i.test(x));
  else if (b === "plus size") pool = femaleModels.filter(x => /plus-size/i.test(x));
  else if (b === "athletic") pool = femaleModels.filter(x => /athletic/i.test(x));
  else if (b === "slim") pool = femaleModels.filter(x => /slim/i.test(x));
  return choose(pool.length ? pool : femaleModels, seed);
}
function maleProfile(build, seed) {
  let pool = maleModels;
  const b = String(build || "Auto").toLowerCase();
  if (b === "athletic") pool = maleModels.filter(x => /athletic/i.test(x));
  else if (b === "plus size") pool = maleModels.filter(x => /plus-size/i.test(x));
  else if (b === "lean") pool = maleModels.filter(x => /lean/i.test(x));
  return choose(pool.length ? pool : maleModels, seed);
}

function consistencyRule(hasRef) {
  return hasRef
    ? `The SECOND uploaded image is the approved reference for this SAME STYLE NUMBER. Keep the SAME adult model identity, face, hairstyle, skin tone, body proportions, pose family, camera angle, framing, background and lighting. Change only the garment/product color using the FIRST image as the exact product source.`
    : `This is the first color for this style number. Establish one reusable adult model identity, pose, camera angle, framing, background and lighting. Later colors of this same style will use this image as their visual reference.`;
}
function basePreserve(color) {
  return `Use the FIRST uploaded image as the product source of truth. Preserve the exact ${color} color, print, graphic, pattern placement, neckline, collar, sleeve length, straps, buttons, zippers, seams, waistband, pockets, hem, garment length, proportions, texture, hardware and visible construction. Do NOT redesign, simplify, recolor, shorten or lengthen the product. Remove the mannequin, mannequin stand, clips, tags, packaging and original background. Do not invent branding, logos or decorative details. Photorealistic premium ecommerce fashion photography with realistic skin, anatomy, hands, shadows and fabric drape. No text and no watermark.`;
}

function buildPrompt({category, color, femaleBody, maleBuild, styleSeed, hasReference}) {
  const seed = hashInt(styleSeed || category);
  const female = femaleProfile(femaleBody, seed);
  const male = maleProfile(maleBuild, seed);
  const lock = consistencyRule(hasReference);
  const base = basePreserve(color);

  switch(category) {
    case "WOMENS_DRESS":
      return {
        prompt: `${base}
Create a FULL-BODY lifestyle fashion photograph of ${female} wearing this exact dress.
Show the ENTIRE dress from neckline to hem and show both feet. Preserve the original dress length exactly—mini stays mini, midi stays midi, maxi stays maxi. Keep sleeves, straps, neckline, waist placement, print scale and silhouette accurate.
Use a natural standing, walking or gentle-turn pose. Background: ${choose(scenes.dress, seed, 3)}. Soft natural daylight.
Do not crop the hem. Do not add a belt unless it exists on the source product. ${lock}`,
        model: female, framing: "full body", scene: choose(scenes.dress, seed, 3)
      };

    case "WOMENS_TOP":
      return {
        prompt: `${base}
Create a lifestyle fashion image of ${female} wearing this exact top.
The complete top must be visible from neckline to bottom hem, including both sleeves. Frame from head to at least upper thigh. Pair it with simple neutral pants/jeans or skirt that does not compete with the product.
Background: ${choose(scenes.top, seed, 5)}. Natural relaxed standing or walking pose. Do not tuck the top if doing so hides its real hem or shape. ${lock}`,
        model: female, framing: "head to upper thigh", scene: choose(scenes.top, seed, 5)
      };

    case "WOMENS_SKIRT":
      return {
        prompt: `${base}
Create a lifestyle fashion image of ${female} wearing this exact skirt.
The ENTIRE skirt must be visible from waistband to hem. Preserve the exact original skirt length, waistband height, pleats, slit positions, pockets, flare and fitted/loose silhouette. Never make a short skirt longer and never make a long skirt shorter.
For mini skirts frame from head to below knee; for midi/maxi skirts use full-body framing. Pair with a simple neutral fitted top.
Background: ${choose(scenes.skirt, seed, 7)}. Natural standing or walking pose. ${lock}`,
        model: female, framing: "category-adaptive full skirt", scene: choose(scenes.skirt, seed, 7)
      };

    case "WOMENS_JEANS":
      return {
        prompt: `${base}
Create a FULL-BODY lifestyle fashion image of ${female} wearing these exact women's jeans.
Show the waistband, rise, belt loops, pockets, wash, distressing if present, leg width and BOTH hems. Preserve whether the jeans are skinny, straight, bootcut, wide-leg, flare, cropped or full length.
Pair with a plain neutral fitted top. Background: ${choose(scenes.womensBottom, seed, 9)}. Natural standing or walking pose. Both feet must be visible. ${lock}`,
        model: female, framing: "full body", scene: choose(scenes.womensBottom, seed, 9)
      };

    case "WOMENS_PANTS":
      return {
        prompt: `${base}
Create a FULL-BODY lifestyle fashion image of ${female} wearing these exact women's pants.
Show waistband-to-hem completely. Preserve the exact rise, pockets, pleats, leg cut, cuffs, cargo details and length. Pair with a simple neutral top.
Background: ${choose(scenes.womensBottom, seed, 11)}. Natural standing/walking pose. Both feet visible. ${lock}`,
        model: female, framing: "full body", scene: choose(scenes.womensBottom, seed, 11)
      };

    case "MENS_TSHIRT":
      return {
        prompt: `${base}
Create a premium menswear lifestyle image of ${male} wearing this exact MEN'S T-SHIRT.
Preserve the exact crew/V-neck shape, collar ribbing, sleeve length, shoulder seam, graphic/logo placement if already printed on the shirt, fit, side seams and bottom hem. Do not change a regular-fit shirt into oversized or slim-fit.
Frame from head to upper thigh so the complete T-shirt is unobstructed. Pair with plain neutral jeans or chinos.
Background: ${choose(scenes.mensTop, seed, 13)}. Natural masculine standing or walking pose. ${lock}`,
        model: male, framing: "head to upper thigh", scene: choose(scenes.mensTop, seed, 13)
      };

    case "MENS_POLO_SHIRT":
      return {
        prompt: `${base}
Create a premium menswear lifestyle image of ${male} wearing this exact men's polo/shirt.
Preserve the exact collar shape, placket/buttons, pocket if present, sleeves, print/check/stripe placement, fit and bottom hem. Do not invent a tucked-in look if it hides product details.
Frame head-to-upper-thigh. Pair with plain neutral pants. Background: ${choose(scenes.mensTop, seed, 15)}. ${lock}`,
        model: male, framing: "head to upper thigh", scene: choose(scenes.mensTop, seed, 15)
      };

    case "MENS_JEANS":
      return {
        prompt: `${base}
Create a FULL-BODY menswear lifestyle image of ${male} wearing these exact MEN'S JEANS.
Show waistband, rise, pockets, wash, distressing, leg cut and both hems completely. Preserve slim/straight/relaxed/baggy fit exactly. Pair with a plain neutral T-shirt or polo.
Background: ${choose(scenes.mensBottom, seed, 17)}. Both feet visible. Natural masculine standing or walking pose. ${lock}`,
        model: male, framing: "full body", scene: choose(scenes.mensBottom, seed, 17)
      };

    case "MENS_PANTS_SHORTS":
      return {
        prompt: `${base}
Create a premium menswear lifestyle image of ${male} wearing these exact men's pants or shorts.
Show waistband, pockets, cargo details if present, leg opening and complete hem/length. Preserve whether the item is long pants, knee-length shorts or shorter shorts. Do not change its length.
Pair with a plain neutral top. Background: ${choose(scenes.mensBottom, seed, 19)}. Use full-body framing for pants and head-to-knee framing for shorts. ${lock}`,
        model: male, framing: "category-adaptive", scene: choose(scenes.mensBottom, seed, 19)
      };

    case "HANDBAG_LIFESTYLE":
      return {
        prompt: `${base}
Create a premium handbag lifestyle image featuring ${female} in understated neutral clothing.
Carry this exact handbag naturally at the side, on the forearm or shoulder. The ENTIRE bag must remain unobstructed and large enough to judge its real scale. Preserve handles, straps, closures, pockets, hardware, logo if already physically on the product, shape and material texture.
Background: ${choose(scenes.bag, seed, 21)}. The handbag is the focal product. ${lock}`,
        model: female, framing: "three-quarter lifestyle", scene: choose(scenes.bag, seed, 21)
      };

    case "HANDBAG_PRODUCT":
      return {
        prompt: `${base}
Create a premium PRODUCT-ONLY handbag ecommerce image. NO PERSON and NO MANNEQUIN.
Show the entire handbag, all handles/straps and its true structure. Use a clean warm-neutral luxury studio setting with soft realistic shadow. Keep material texture and hardware accurate.`,
        model: "product only", framing: "product centered", scene: "neutral luxury studio"
      };

    case "BRA_PRODUCT":
      return {
        prompt: `${base}
Create a premium PRODUCT-ONLY BRA ecommerce image. NO PERSON, NO MODEL, NO MANNEQUIN and NO BODY FORM.
Show the complete bra symmetrically on a soft warm-white or beige studio background. Preserve cup shape, underwire if present, straps, band, lace/print and hardware exactly. Tasteful retail catalog presentation.`,
        model: "product only", framing: "product centered", scene: "warm-neutral studio"
      };

    case "PANTY_PRODUCT":
      return {
        prompt: `${base}
Create a premium PRODUCT-ONLY PANTY ecommerce image. NO PERSON, NO MODEL, NO MANNEQUIN and NO BODY FORM.
Show the complete item clearly on a soft warm-white or beige studio background. Preserve waistband, leg openings, rise, cut, lace, print and proportions exactly. Tasteful retail catalog presentation.`,
        model: "product only", framing: "product centered", scene: "warm-neutral studio"
      };

    case "SHOES_SLIPPERS":
      return {
        prompt: `${base}
Create a footwear-focused lifestyle image with ${female} wearing this exact pair of shoes/slippers.
Both feet and both complete products must be visible and unobstructed. Preserve sole thickness, straps, buckles, toe shape, heel height, texture and color.
Background: ${choose(scenes.shoes, seed, 23)}. Use lower full-body or leg-focused framing that still provides lifestyle context. ${lock}`,
        model: female, framing: "footwear focused", scene: choose(scenes.shoes, seed, 23)
      };

    case "ACCESSORY_PRODUCT":
      return {
        prompt: `${base}
Create a premium product-focused ecommerce image. Show the complete accessory unobstructed and at a useful scale. Preserve exact material, shape, color, hardware and details. Use a clean premium neutral background.`,
        model: "product only", framing: "product centered", scene: "neutral studio"
      };

    case "HOUSEHOLD_PRODUCT":
      return {
        prompt: `${base}
Create a premium PRODUCT-ONLY retail image. No person. Show the complete household item clearly in a tasteful clean interior or neutral studio. Preserve exact color, pattern, proportions and texture.`,
        model: "product only", framing: "product focused", scene: "tasteful interior"
      };

    default:
      throw new Error("Unknown category: " + category);
  }
}

async function parseJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (Buffer.byteLength(raw) > 40 * 1024 * 1024) throw new Error("Upload too large. Reduce the source image file size.");
  return JSON.parse(raw || "{}");
}
function detectSupportedImageMime(buffer, declaredMime="", filename="") {
  if (buffer.length >= 3 &&
      buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "image/jpeg";

  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E &&
      buffer[3] === 0x47 && buffer[4] === 0x0D && buffer[5] === 0x0A &&
      buffer[6] === 0x1A && buffer[7] === 0x0A) return "image/png";

  if (buffer.length >= 12 &&
      buffer.toString("ascii",0,4) === "RIFF" &&
      buffer.toString("ascii",8,12) === "WEBP") return "image/webp";

  const declared = String(declaredMime || "").toLowerCase();
  const ext = path.extname(String(filename || "")).toLowerCase();

  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";

  // Windows/Edge can label ordinary camera/catalog JPEGs as image/dng.
  if (declared === "image/dng" || declared === "image/x-adobe-dng" ||
      String(filename||"").toLowerCase().endsWith(".dng")) return "image/dng";

  if (["image/jpeg","image/png","image/webp"].includes(declared)) return declared;

  throw new Error(
    `Unsupported source image format (${declared || "unknown"}). ` +
    `Use JPEG, PNG or WebP.`
  );
}

function dataUrlToBuffer(data, filename="") {
  const m=String(data||"").match(/^data:([^;]+);base64,(.+)$/s);
  if(!m) throw new Error("Invalid image data.");
  const buffer=Buffer.from(m[2],"base64");
  const lower=String(filename||"").toLowerCase();
  const declared=String(m[1]||"").toLowerCase();

  // Preserve genuine RAW/DNG bytes for server-side decoding.
  if(lower.endsWith(".dng") || declared==="image/dng" || declared==="image/x-adobe-dng"){
    return {mime:"image/dng",buffer};
  }
  const mime=detectSupportedImageMime(buffer,m[1],filename);
  return {mime,buffer};
}


async function normalizeSourceForOpenAI(source, filename="source.jpg") {
  const lower=String(filename||"").toLowerCase();
  const isDng = source.mime === "image/dng" || lower.endsWith(".dng");
  if (!isDng) return {mime:source.mime, buffer:source.buffer, filename};

  try {
    // dcraw.js decodes camera RAW/DNG and exports a standard TIFF.
    // TIFF is then converted to JPEG by sharp if available; otherwise we
    // extract the embedded camera JPEG preview as a compatibility fallback.
    let rawOut;
    try {
      rawOut = dcraw(source.buffer, {
        exportAsTiff:true,
        useCameraWhiteBalance:true,
        setHalfSizeMode:true
      });
    } catch (fullErr) {
      rawOut = dcraw(source.buffer, {extractThumbnail:true});
    }

    const outBuf=Buffer.from(rawOut);
    // dcraw thumbnail output is commonly JPEG; detect it directly.
    if(outBuf.length>3 && outBuf[0]===0xff && outBuf[1]===0xd8 && outBuf[2]===0xff){
      return {mime:"image/jpeg",buffer:outBuf,filename:filename.replace(/\.dng$/i,".jpg")};
    }

    // If decoder returned TIFF, convert to JPEG using sharp.
    const sharp=require("sharp");
    const jpg=await sharp(outBuf).rotate().jpeg({quality:92,mozjpeg:true}).toBuffer();
    return {mime:"image/jpeg",buffer:jpg,filename:filename.replace(/\.dng$/i,".jpg")};
  } catch(e) {
    throw new Error(`RAW/DNG conversion failed for ${filename}. The original RAW file reached the server, but the decoder could not convert it. ${e?.message||e}`);
  }
}

async function handleGenerate(req, res) {
  const body = await parseJson(req);
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) return send(res, 500, {ok:false, error:"OpenAI API key is not configured on the server. Add OPENAI_API_KEY in Render Environment settings."});

  const sourceRaw = dataUrlToBuffer(body.source_base64, body.filename || "source.jpg");
  const source = await normalizeSourceForOpenAI(sourceRaw, body.filename || "source.jpg");
  const ref = body.reference_base64 ? dataUrlToBuffer(body.reference_base64, "style-reference.png") : null;
  const meta = buildPrompt({
    category: body.category,
    color: body.color || "product",
    femaleBody: body.female_body || "Auto",
    maleBuild: body.male_build || "Auto",
    styleSeed: body.style_seed,
    hasReference: !!ref
  });

  const form = new FormData();
  form.append("model", body.model || "gpt-image-2");
  form.append("prompt", meta.prompt);
  form.append("size", body.size || "1024x1536");
  form.append("quality", body.quality || "high");
  form.append("output_format", "png");
  form.append("image[]", new Blob([source.buffer], {type: source.mime}), source.filename || "source.jpg");
  if (ref) form.append("image[]", new Blob([ref.buffer], {type: ref.mime}), "style-reference.png");

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(), 8*60*1000);
  let r;
  try{
    r = await fetch("https://api.openai.com/v1/images/edits", {
      method:"POST",
      headers:{Authorization:`Bearer ${key}`},
      body:form,
      signal:controller.signal
    });
  }catch(e){
    if(e?.name==="AbortError")return send(res,504,{ok:false,error:"Image generation timed out. This is temporary; retry the image."});
    throw e;
  }finally{
    clearTimeout(timer);
  }
  const text = await r.text();
  if (!r.ok) return send(res, r.status, {ok:false, error:safeError(r.status, text), raw:text});

  let out;
  try { out = JSON.parse(text); } catch { return send(res, 500, {ok:false,error:"OpenAI returned an unreadable response."}); }
  const b64 = out?.data?.[0]?.b64_json;
  if (!b64) return send(res, 500, {ok:false,error:"OpenAI returned no image data."});
  send(res, 200, {
    ok:true,
    image_base64:`data:image/png;base64,${b64}`,
    model_profile:meta.model,
    framing:meta.framing,
    scene:meta.scene,
    used_reference:!!ref
  });
}

async function handleTest(req, res) {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) return send(res, 500, {ok:false,error:"OPENAI_API_KEY is not configured in Render."});
  const r = await fetch("https://api.openai.com/v1/models", {headers:{Authorization:`Bearer ${key}`}});
  const text = await r.text();
  if (!r.ok) return send(res, r.status, {ok:false,error:safeError(r.status,text)});
  send(res, 200, {ok:true});
}
function staticFile(req, res) {
  const urlPath = new URL(req.url, "http://localhost").pathname;
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/,"");
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(path.resolve(PUBLIC)) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
    return send(res,404,"Not found","text/plain");
  const ext = path.extname(file).toLowerCase();
  const types = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json"};
  send(res,200,fs.readFileSync(file),types[ext]||"application/octet-stream");
}


// ===== v2.7 SECURE LOGIN =====
const LOGIN_USER = String(process.env.ZRADA_USERNAME || "admin").trim();
const LOGIN_PASS = process.env.ZRADA_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_AGE = 60*60*12;

function cookieMap(req){
  const out={};
  String(req.headers.cookie||"").split(";").forEach(part=>{
    const i=part.indexOf("=");
    if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  });
  return out;
}
function timingEqual(a,b){
  const aa=Buffer.from(String(a)), bb=Buffer.from(String(b));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function sessionToken(){
  const exp=Math.floor(Date.now()/1000)+SESSION_AGE;
  const payload=`${LOGIN_USER}.${exp}`;
  const sig=crypto.createHmac("sha256",SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}
function isAuthed(req){
  const token=cookieMap(req).zrada_session;
  if(!token) return false;
  const p=token.split(".");
  if(p.length!==3) return false;
  const [u,e,sig]=p;
  if(u!==LOGIN_USER || Number(e)<Math.floor(Date.now()/1000)) return false;
  const expected=crypto.createHmac("sha256",SESSION_SECRET).update(`${u}.${e}`).digest("hex");
  return timingEqual(sig,expected);
}
async function parseSmallJson(req){
  return await new Promise((resolve,reject)=>{
    let d="";
    req.on("data",c=>{d+=c;if(d.length>1024*64){reject(new Error("Request too large"));req.destroy();}});
    req.on("end",()=>{try{resolve(JSON.parse(d||"{}"))}catch(e){reject(e)}});
    req.on("error",reject);
  });
}
async function loginHandler(req,res){
  if(!LOGIN_PASS) return send(res,503,{error:"Login not configured. Add ZRADA_PASSWORD in Render Environment."});
  const b=await parseSmallJson(req);
  if(!timingEqual(String(b.username||"").trim(),LOGIN_USER)||!timingEqual(String(b.password||""),LOGIN_PASS))
    return send(res,401,{error:"Incorrect username or password."});
  const token=sessionToken();
  const data=Buffer.from(JSON.stringify({ok:true}));
  res.writeHead(200,{
    "Content-Type":"application/json; charset=utf-8",
    "Content-Length":data.length,
    "Set-Cookie":`zrada_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_AGE}`,
    "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
  });
  res.end(data);
}
function logoutHandler(req,res){
  const data=Buffer.from(JSON.stringify({ok:true}));
  res.writeHead(200,{
    "Content-Type":"application/json; charset=utf-8",
    "Content-Length":data.length,
    "Set-Cookie":"zrada_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
    "Cache-Control":"no-store"
  });
  res.end(data);
}

http.createServer(async (req,res)=>{
  try {
    const pathname = new URL(req.url, "https://zrada.local").pathname;
    if (req.method === "POST" && pathname === "/api/login") return await loginHandler(req,res);
    if (req.method === "POST" && pathname === "/api/logout") return logoutHandler(req,res);
    if (req.method === "GET" && pathname === "/api/auth-status") return send(res,200,{authenticated:isAuthed(req)});
    if (pathname.startsWith("/api/") && !isAuthed(req)) return send(res,401,{error:"LOGIN_REQUIRED"});
    if (req.method === "POST" && pathname === "/api/generate") return await handleGenerate(req,res);
    if (req.method === "POST" && pathname === "/api/test") return await handleTest(req,res);
    if (req.method === "GET" && pathname === "/api/health") return send(res,200,{ok:true,version:"2.9.0",openai_configured:!!process.env.OPENAI_API_KEY,login_configured:!!LOGIN_PASS,username_configured:!!LOGIN_USER});
    return staticFile(req,res);
  } catch(e) {
    send(res,500,{ok:false,error:e.message || String(e)});
  }
}).listen(PORT, ()=>console.log(`ZRADA AI Product Studio running on port ${PORT}`));
