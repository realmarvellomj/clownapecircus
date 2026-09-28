const cfg = window.CARCUS_CONFIG || {};
const hasConfig = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");
const db = hasConfig && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;

const intro = document.getElementById("intro"), video = document.getElementById("introVideo"), site = document.getElementById("site");
const siteAudio = document.getElementById("siteAudio");
const introSoundToggle = document.getElementById("soundToggle");
const siteSoundToggle = document.getElementById("siteSoundToggle");
let soundEnabled = false;

function updateSoundButtons(){
  const label = soundEnabled ? "🔊 Sound" : "🔇 Sound";
  introSoundToggle.textContent = label;
  siteSoundToggle.textContent = label;
  introSoundToggle.setAttribute("aria-label", soundEnabled ? "Mute sound" : "Turn on sound");
  siteSoundToggle.setAttribute("aria-label", soundEnabled ? "Mute sound" : "Turn on sound");
}

async function startSiteAudio(startTime=0){
  if(!soundEnabled) return;
  try{
    if(Number.isFinite(startTime) && siteAudio.readyState >= 1){
      const duration = Number.isFinite(siteAudio.duration) ? siteAudio.duration : 0;
      siteAudio.currentTime = duration > 0 ? Math.min(startTime, Math.max(0, duration - 0.05)) : startTime;
    }
    await siteAudio.play();
  }catch(e){}
}

function enterSite(){
  if(intro.classList.contains("done")) return;
  const handoffTime = video.ended ? 0 : video.currentTime;
  if(soundEnabled){
    video.muted = true;
    startSiteAudio(handoffTime);
  }
  intro.classList.add("done");
  site.classList.add("visible");
  site.setAttribute("aria-hidden","false");
  document.body.classList.remove("intro-active");
}

video.addEventListener("ended",()=>enterSite());
document.getElementById("skipIntro").addEventListener("click",enterSite);

async function toggleSound(){
  soundEnabled = !soundEnabled;
  updateSoundButtons();
  video.muted = !soundEnabled;
  if(soundEnabled){
    try{ await video.play(); }catch(e){}
    if(intro.classList.contains("done")) await startSiteAudio(siteAudio.currentTime || 0);
  }else{
    video.muted = true;
    siteAudio.pause();
  }
}

introSoundToggle.addEventListener("click",toggleSound);
siteSoundToggle.addEventListener("click",toggleSound);
updateSoundButtons();

setTimeout(()=>{if(video.readyState===0)enterSite()},7000);

const navWrap=document.querySelector(".nav-wrap");
document.getElementById("menuBtn").addEventListener("click",()=>navWrap.classList.toggle("nav-open"));
document.querySelectorAll("#nav a").forEach(a=>a.addEventListener("click",()=>navWrap.classList.remove("nav-open")));

function openModal(id){document.getElementById(id)?.classList.add("open");document.body.style.overflow="hidden";}
function closeModal(m){m.classList.remove("open");if(!document.querySelector(".modal.open"))document.body.style.overflow="";}
document.querySelectorAll("[data-modal]").forEach(b=>b.addEventListener("click",()=>openModal(b.dataset.modal)));
document.querySelectorAll(".modal").forEach(m=>m.querySelectorAll("[data-close]").forEach(x=>x.addEventListener("click",()=>closeModal(m))));
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal.open").forEach(closeModal)});

async function ensureAnonymousSession(){
  if(!db) throw new Error("Supabase is not configured yet. Open config.js and add your Supabase URL and anon/publishable key.");
  const {data:{session}}=await db.auth.getSession();
  if(session) return session;
  const {data,error}=await db.auth.signInAnonymously();
  if(error) throw error;
  return data.session;
}
function status(el,msg,type=""){el.textContent=msg;el.className="form-status "+type;}
function formDataObject(form){const fd=new FormData(form), o={};for(const [k,v] of fd.entries())if(k!=="proof")o[k]=v;return o;}
function isValidXStatusUrl(value){
  try{
    const u=new URL(String(value).trim());
    const host=u.hostname.toLowerCase().replace(/^www\./,"");
    if(host!=="x.com" && host!=="twitter.com") return false;
    const parts=u.pathname.split("/").filter(Boolean);
    const statusIndex=parts.findIndex(p=>p.toLowerCase()==="status");
    if(statusIndex<1 || !parts[statusIndex+1]) return false;
    return /^\d+$/.test(parts[statusIndex+1]);
  }catch(e){return false;}
}

async function submitApplication(type,form,statusEl){
  status(statusEl,"Sending your application…");
  try{
    const session=await ensureAnonymousSession();
    const values=formDataObject(form);
    if(type==="join" && !isValidXStatusUrl(values.quote_tweet_link)){
      throw new Error("Quote Tweet Link must be a valid X/Twitter status URL (for example: https://x.com/ClownApeCircus/status/2097299125070966944?s=20).");
    }
    let proofPath=null;
    const proof=form.querySelector('input[name="proof"]')?.files?.[0];
    if(proof){
      if(proof.size>10*1024*1024) throw new Error("Proof file must be 10MB or smaller.");
      const safe=proof.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      proofPath=`${session.user.id}/${crypto.randomUUID()}-${safe}`;
      const {error}=await db.storage.from("application-proof").upload(proofPath,proof,{upsert:false,contentType:proof.type||"application/octet-stream"});
      if(error) throw error;
    }
    const payload={type, applicant_id:session.user.id, status:"pending", data:values, proof_path:proofPath};
    const {error}=await db.from("applications").insert(payload);
    if(error) throw error;
    status(statusEl,"Application received. Welcome to the queue.","success");
    form.reset();
    if(type==="join"){
      const shareText="I just joined & got a ticket to the circus 🎪 Wanna join too? Click here: https://x.com/ClownApeCircus/status/2097299125070966944?s=20";
      const shareLink="https://twitter.com/intent/tweet?text="+encodeURIComponent(shareText);
      const shareBtn=document.getElementById("shareTicket");
      if(shareBtn) shareBtn.href=shareLink;
    }
    setTimeout(()=>{closeModal(form.closest(".modal"));openModal("successModal");},650);
  }catch(e){console.error(e);status(statusEl,e.message||"Something went wrong. Please try again.","error");}
}
document.getElementById("joinForm").addEventListener("submit",e=>{e.preventDefault();submitApplication("join",e.currentTarget,document.getElementById("joinStatus"));});
document.getElementById("collabForm").addEventListener("submit",e=>{e.preventDefault();submitApplication("collab",e.currentTarget,document.getElementById("collabStatus"));});


function normalizeWallet(value){
  const v=String(value||'').trim();
  if(!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error('Please enter a valid EVM wallet address (0x followed by 40 hexadecimal characters).');
  return v.toLowerCase();
}

async function checkWhitelist(wallet){
  if(!db) throw new Error('Supabase is not configured yet. Open config.js and add your Supabase URL and publishable key.');
  const normalized=normalizeWallet(wallet);
  const {data,error}=await db.rpc('check_whitelist',{p_wallet_address:normalized});
  if(error) throw error;
  return data;
}

const whitelistForm=document.getElementById('whitelistForm');
if(whitelistForm){
  whitelistForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const statusEl=document.getElementById('whitelistStatus'), result=document.getElementById('whitelistResult');
    status(statusEl,'Checking the Ringmaster list…'); result.hidden=true; result.innerHTML='';
    try{
      const wallet=normalizeWallet(new FormData(whitelistForm).get('wallet_address'));
      const found=await checkWhitelist(wallet);
      if(found===true || found?.status==='whitelisted'){
        const shareText='Hi, I have just been accepted to join the circus, @ClownApeCircus';
        const shareLink='https://twitter.com/intent/tweet?text='+encodeURIComponent(shareText);
        result.innerHTML=`<div class="whitelist-success"><span class="kicker">TICKET CONFIRMED</span><h3>YOU'RE IN!</h3><p>The Ringmaster has whitelisted this wallet.</p><code>${wallet}</code><a class="btn btn-primary" href="${shareLink}" target="_blank" rel="noopener">𝕏 Post Your Acceptance On X →</a><small>Let the Circus know: “Hi, I have just been accepted to join the circus, @ClownApeCircus”</small></div>`;
        result.hidden=false; status(statusEl,'Whitelist confirmed. Welcome to the Circus.','success');
      }else{
        result.innerHTML='<div class="whitelist-pending"><span class="kicker">NOT FOUND</span><h3>NOT ON THE LIST YET.</h3><p>This wallet is not currently marked as whitelisted. Make sure you are checking the same wallet you submitted with your application.</p></div>';
        result.hidden=false; status(statusEl,'No whitelist entry found for this wallet.');
      }
    }catch(err){status(statusEl,err.message||'Unable to check the whitelist.','error');}
  });
}
