// ============================================================
// Conditor VDR AI — Frontend
// Works in two modes:
//   • DEMO   — built-in BharatKart Commerce data (no setup needed)
//   • DRIVE  — your real Google Drive (after you add a Client ID)
// AI runs through the backend at /api/ai (Gemini, free tier).
// ============================================================

const CONFIG = {
  // Paste your Google OAuth Client ID here (or set window.CONDITOR_CLIENT_ID before this script).
  GOOGLE_CLIENT_ID: (typeof window !== "undefined" && window.CONDITOR_CLIENT_ID) || "233514743688-mmdflh9g85mnbsf7ebc3j0ptc67c4ukk.apps.googleusercontent.com",
  // Paste your Gemini API key here for direct browser-side AI (free at aistudio.google.com).
  // Used as fallback when the /api/ai backend is unavailable (e.g. running with node server.js).
  GEMINI_API_KEY: (typeof window !== "undefined" && window.CONDITOR_GEMINI_KEY) || "AIzaSyCwCJKRwytsHueCQqF-h2F_yx5MClqQCc8",
  DRIVE_SCOPE: "https://www.googleapis.com/auth/drive.readonly",
  AI_ENDPOINT: "/api/ai",
  AI_PROVIDER_LABEL: "Gemini",
};

const app = document.getElementById("app");

const state = {
  source: "demo",            // 'demo' | 'drive'
  tree: null,                // current root node
  docIndex: {},              // id -> node (+ parent)
  tab: "overview",
  selectedDoc: null,
  expanded: {},
  search: "",
  chat: [],
  aiResults: {},
  busy: false,
  drive: { token: null, connected: false, ready: false, email: null },
  contentCache: {},          // id -> text content
  showConnect: false,
  liveFlags: null,
  selectedTemplate: "tpl_pnl_india",
  customTemplates: [],
  showUploadModal: false,
  uploadPreview: null,
};

// ---------- Build index from a tree ----------
function buildIndex(root){
  const idx = {};
  (function walk(node, parent){
    idx[node.id] = Object.assign({}, node, { parent });
    (node.children||[]).forEach(c => walk(c, node));
  })(root, null);
  state.docIndex = idx;
  state.tree = root;
}
function nodePath(id){
  let n = state.docIndex[id], parts=[];
  while(n && n.id!=="root"){ parts.unshift(n.name); n = n.parent ? state.docIndex[n.parent.id] : null; }
  return parts.join(" / ");
}

// ============================================================
// GOOGLE DRIVE INTEGRATION (real)
// ============================================================
let tokenClient = null;
let gapiInited = false;

function driveAvailable(){ return !!CONFIG.GOOGLE_CLIENT_ID; }

async function initGapi(){
  if (gapiInited) return;
  await new Promise((resolve)=> gapi.load("client", resolve));
  await gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"] });
  gapiInited = true;
}

function initTokenClient(){
  if (tokenClient || !window.google || !google.accounts) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: CONFIG.DRIVE_SCOPE,
    callback: async (resp)=>{
      if (resp.error){ toast("Google sign-in failed: "+resp.error); return; }
      state.drive.token = resp.access_token;
      state.drive.connected = true;
      gapi.client.setToken({ access_token: resp.access_token });
      toast("Google Drive connected");
      await loadDriveRoot();
    }
  });
}

async function connectDrive(){
  if (!driveAvailable()){ state.showConnect = true; render(); return; }
  try{
    await initGapi();
    initTokenClient();
    tokenClient.requestAccessToken({ prompt: state.drive.connected ? "" : "consent" });
  }catch(e){ toast("Could not start Google sign-in. Check your Client ID."); }
}

// Load the user's Drive root (top-level folders + files)
async function loadDriveRoot(){
  state.source = "drive";
  state.tree = { id:"root", name:"My Drive", type:"folder", children:null };
  buildIndex(state.tree);
  state.tab = "overview"; state.selectedDoc=null; state.aiResults={}; state.contentCache={}; state.liveFlags=null;
  render();
  try{
    const children = await listDriveChildren("root");
    state.tree.children = children;
    children.forEach(c=>{ if(c.type==="folder") state.expanded[c.id]=false; });
    buildIndex(state.tree);
    render();
  }catch(e){ toast("Failed to load Drive files: "+e.message); }
}

// Load a specific folder by ID/link as the "data room"
async function loadDriveFolder(linkOrId){
  const id = parseFolderId(linkOrId);
  if(!id){ toast("Could not read that folder link/ID"); return; }
  if(!state.drive.connected){ await connectDrive(); return; }
  state.source="drive"; state.aiResults={}; state.contentCache={}; state.liveFlags=null; state.selectedDoc=null;
  try{
    const meta = await gapi.client.drive.files.get({ fileId:id, fields:"id,name,mimeType" });
    const root = { id:"root", _driveId:id, name:meta.result.name||"Data Room", type:"folder", children:null };
    state.tree = root; buildIndex(root); state.tab="overview"; render();
    root.children = await listDriveChildren(id);
    buildIndex(root); render();
    toast("Loaded folder: "+(meta.result.name||id));
  }catch(e){ toast("Could not open that folder. Is it shared with your account?"); }
}

function parseFolderId(s){
  if(!s) return null;
  s=s.trim();
  const m = s.match(/folders\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if(m) return m[1];
  if(/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return null;
}

async function listDriveChildren(folderId){
  const q = `'${folderId}' in parents and trashed=false`;
  let files=[], pageToken=null;
  do{
    const resp = await gapi.client.drive.files.list({
      q, pageSize:200, pageToken:pageToken||undefined, orderBy:"folder,name",
      fields:"nextPageToken, files(id,name,mimeType,size,modifiedTime)"
    });
    files = files.concat(resp.result.files||[]);
    pageToken = resp.result.nextPageToken;
  } while(pageToken);
  return files.map(f=>{
    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
    return {
      id: f.id, name: f.name, mimeType: f.mimeType,
      type: isFolder ? "folder" : "doc",
      size: f.size ? humanSize(+f.size) : "",
      modified: f.modifiedTime ? f.modifiedTime.slice(0,10) : "",
      children: isFolder ? null : undefined,
    };
  });
}
function humanSize(b){ if(b<1024) return b+" B"; if(b<1048576) return (b/1024).toFixed(0)+" KB"; return (b/1048576).toFixed(1)+" MB"; }

// Lazily expand a Drive folder
async function ensureDriveFolderLoaded(node){
  if(node.type!=="folder" || node.children!==null) return;
  node.children = [];
  buildIndex(state.tree);
  try{
    node.children = await listDriveChildren(node.id);
    buildIndex(state.tree);
  }catch(e){ toast("Could not load folder contents"); }
}

// Fetch text content of a Drive file (Docs/Sheets/text/PDF)
async function fetchDriveText(node){
  const mt = node.mimeType||"";
  try{
    if(mt==="application/vnd.google-apps.document"){
      const r = await gapi.client.drive.files.export({ fileId:node.id, mimeType:"text/plain" });
      return r.body;
    }
    if(mt==="application/vnd.google-apps.spreadsheet"){
      const r = await gapi.client.drive.files.export({ fileId:node.id, mimeType:"text/csv" });
      return r.body;
    }
    if(mt==="application/pdf"){
      return await fetchDrivePdfText(node.id);
    }
    if(mt.startsWith("text/") || mt==="application/json"){
      const r = await gapi.client.drive.files.get({ fileId:node.id, alt:"media" });
      return r.body;
    }
    return null; // unsupported binary
  }catch(e){ return null; }
}

async function fetchDrivePdfText(fileId){
  const token = state.drive.token;
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers:{ Authorization:"Bearer "+token } });
  const buf = await resp.arrayBuffer();
  if(!window.pdfjsLib) return null;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text="";
  const maxPages = Math.min(pdf.numPages, 15);
  for(let i=1;i<=maxPages;i++){
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    text += c.items.map(it=>it.str).join(" ") + "\n";
  }
  return text.slice(0, 18000);
}

// Unified: get text for a node (demo or drive)
async function getDocText(id){
  if(state.contentCache[id]) return state.contentCache[id];
  const node = state.docIndex[id];
  if(!node) return null;
  let text=null;
  if(state.source==="demo"){
    text = (typeof DOC_CONTENT!=="undefined" && DOC_CONTENT[id]) ? DOC_CONTENT[id].body : null;
  }else{
    text = await fetchDriveText(node);
  }
  if(text) state.contentCache[id]=text;
  return text;
}

// ============================================================
// AI BACKEND CLIENT
// ============================================================
async function askAI(system, prompt, {maxTokens=1300, timeoutMs=30000}={}){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const res = await fetch(CONFIG.AI_ENDPOINT, {
      method:"POST", headers:{"Content-Type":"application/json"}, signal:ctrl.signal,
      body: JSON.stringify({ system, prompt, maxTokens })
    });
    clearTimeout(t);
    const data = await res.json().catch(()=>({}));
    if(!res.ok) return { error: data.error || ("Backend error "+res.status) };
    if(!data.text) return { error: "Empty AI response" };
    return { text: data.text, live: true };
  }catch(e){
    clearTimeout(t);
    return { error: e.name==="AbortError" ? "AI request timed out" : "Backend unreachable" };
  }
}

// Direct Gemini call — embeds system prompt into the message for maximum compatibility
async function askGeminDirect(system, prompt, {maxTokens=800}={}){
  if(!CONFIG.GEMINI_API_KEY) return { error: "No API key" };
  const body = system ? system + "\n\n" + prompt : prompt;
  try{
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          contents:[{ parts:[{ text: body }] }],
          generationConfig:{ maxOutputTokens: maxTokens, temperature: 0.7 }
        })
      }
    );
    const data = await res.json().catch(()=>({}));
    if(!res.ok){
      console.error("[Gemini] error", res.status, data);
      return { error: data.error?.message || "Gemini error "+res.status };
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if(!text){ console.error("[Gemini] empty response", data); return { error: "Empty response" }; }
    return { text, live: true };
  }catch(e){ console.error("[Gemini] fetch failed", e); return { error: e.message }; }
}

// Wrapper: tries backend first, falls back to direct Gemini
async function askAIWithFallback(system, prompt, opts={}){
  const r = await askAI(system, prompt, opts);
  if(r.text) return r;
  if(CONFIG.GEMINI_API_KEY) return await askGeminDirect(system, prompt, opts);
  return r;
}

// ============================================================
// ICONS
// ============================================================
const I = {
  folder:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>`,
  folderOpen:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2"/><path d="m3 9 1.5 8.5A2 2 0 0 0 6.5 19h11a2 2 0 0 0 2-1.6L21 9H3Z"/></svg>`,
  chev:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>`,
  pdf:`<svg viewBox="0 0 24 24" fill="none" stroke="#a23a33" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  xls:`<svg viewBox="0 0 24 24" fill="none" stroke="#2f6b4f" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 13 6 5M15 13l-6 5"/></svg>`,
  gdoc:`<svg viewBox="0 0 24 24" fill="none" stroke="#2f5a78" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>`,
  doc:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>`,
  search:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  grid:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  compass:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>`,
  calc:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h8"/></svg>`,
  flag:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6 9 17l-5-5"/></svg>`,
  scale:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18M5 7l-3 6h6zM19 7l-3 6h6zM5 7h14M8 21h8"/></svg>`,
  drive:`<svg viewBox="0 0 24 24" fill="none"><path d="M7.7 3 2 13l3 5 5.7-10z" fill="#0066da"/><path d="m16.3 3-5.7 0L16.3 13H22z" fill="#00ac47"/><path d="M5 18h11.3L19 13H8z" fill="#ffba00"/></svg>`,
  jump:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17 17 7M9 7h8v8"/></svg>`,
  spark:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>`,
  info:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`,
  miss:`<svg viewBox="0 0 24 24" fill="none" stroke="#a23a33" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" fill="none" stroke="#2f5a78" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,
  copy:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`,
  download:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12M7 11l5 4 5-4M5 21h14"/></svg>`,
  link:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>`,
};
function docIcon(d){
  if(d.type==="folder") return I.folder;
  const mt=d.mimeType||"";
  if(mt.includes("spreadsheet")||/\.(xlsx|csv)$/.test(d.name)) return I.xls;
  if(mt.includes("document")||/\.docx?$/.test(d.name)) return I.gdoc;
  if(mt.includes("pdf")||/\.pdf$/.test(d.name)) return I.pdf;
  return I.doc;
}

// ---------- markdown + helpers ----------
function mdToHtml(md){
  const lines=(md||"").split("\n"); let html="",inList=false;
  const inline=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,'<code>$1</code>');
  for(let raw of lines){
    const l=raw.trim();
    if(!l){ if(inList){html+="</ul>";inList=false} continue; }
    if(/^#{1,4}\s/.test(l)){ if(inList){html+="</ul>";inList=false} html+="<h4>"+inline(l.replace(/^#+\s/,""))+"</h4>"; }
    else if(/^[-*•]\s/.test(l)){ if(!inList){html+="<ul>";inList=true} html+="<li>"+inline(l.replace(/^[-*•]\s/,""))+"</li>"; }
    else { if(inList){html+="</ul>";inList=false} html+="<p>"+inline(l)+"</p>"; }
  }
  if(inList) html+="</ul>"; return html;
}
function escapeHtml(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function spinner(t){ return `<div class="spinner"><span class="ring"></span><span class="thinking">${t}</span></div>`; }
function srcLine(live){
  const dot=`<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${live?'var(--green)':'var(--amber)'};flex-shrink:0"></span>`;
  return `<div class="ai-src ${live?'live':'demo'}">${dot} ${live
    ? "Generated by "+CONFIG.AI_PROVIDER_LABEL+" via Conditor backend"
    : "Demo intelligence (offline) — deploy with an API key for live "+CONFIG.AI_PROVIDER_LABEL}</div>`;
}
function toast(msg){
  const t=document.createElement("div"); t.textContent=msg;
  t.style.cssText="position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#122e25,#0c241d);color:#eef3ef;padding:12px 22px;border-radius:10px;font-size:13px;box-shadow:0 8px 32px rgba(12,36,29,.4);z-index:120;border:1px solid rgba(194,161,77,.5);animation:rise .3s cubic-bezier(.2,.7,.3,1);font-weight:600;letter-spacing:.01em;backdrop-filter:blur(8px);white-space:nowrap";
  document.body.appendChild(t); setTimeout(()=>t.remove(),2400);
}

// ============================================================
// RENDER SHELL
// ============================================================
function render(){
  app.innerHTML = `${topbar()}<div class="body">${sidePanel()}<div class="work">${tabBar()}<div class="canvas"><div class="view" id="view"></div></div></div></div>${state.showConnect?connectModal():""}${state.showUploadModal?uploadModal():""}`;
  renderView(); bindSide(); bindModal(); bindUploadModal();
}

function topbar(){
  const linked = state.drive.connected;
  return `<div class="topbar">
    <div class="brand">
      <div class="mark">${markSVG()}</div>
      <div class="brand-sep"></div>
      <div class="tag">VDR Intelligence</div>
    </div>
    <div class="tb-right">
      <button class="tour-launch" onclick="startTour()">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="11" x2="8" y2="7.5"/><circle cx="8" cy="5.5" r=".5" fill="currentColor" stroke="none"/></svg>
        Tour
      </button>
      <button class="connect ${linked?'linked':''}" onclick="connectDrive()">
        ${linked?I.drive:I.drive}
        <span>${linked?'Drive connected':'Connect Google Drive'}</span>
      </button>
    </div>
  </div>`;
}
function markSVG(){
  return `<svg viewBox="0 0 130 74" xmlns="http://www.w3.org/2000/svg">
    <rect width="130" height="74" rx="7" fill="#ffffff"/>
    <line x1="10" y1="16" x2="47" y2="16" stroke="#2d4a42" stroke-width="0.8"/>
    <text x="65" y="20" text-anchor="middle" font-family="Georgia,serif" font-size="8.5" fill="#2d4a42" letter-spacing="3.5">THE</text>
    <line x1="83" y1="16" x2="120" y2="16" stroke="#2d4a42" stroke-width="0.8"/>
    <text x="65" y="47" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="25" fill="#2d4a42">Conditor</text>
    <line x1="36" y1="53" x2="94" y2="53" stroke="#2d4a42" stroke-width="0.8"/>
    <text x="65" y="64" text-anchor="middle" font-family="Georgia,serif" font-size="9" fill="#2d4a42" letter-spacing="3">Capital</text>
  </svg>`;
}

// ---------- Side panel ----------
function sidePanel(){
  const isDemo = state.source==="demo";
  const roomName = state.tree ? state.tree.name : (isDemo ? DEAL.target : "My Drive");
  const meta = isDemo ? `CH ${DEAL.companiesHouseNo} · ${DEAL.dealStage}` : "Google Drive · live";
  return `<div class="side">
    <div class="side-head">
      <div class="src-tag ${isDemo?'demo':'drive'}">${isDemo?I.info:I.drive} ${isDemo?'Demo data room':'Live Google Drive'}</div>
      <h2>${escapeHtml(roomName)}</h2>
      <div class="room-meta">${meta}</div>
      <div class="folder-load ${state.source==='drive'?'show':''}">
        <input id="folderInput" placeholder="Paste a Drive folder link or ID…">
        <div class="fl-row">
          <button onclick="loadFolderFromInput()">${'Load folder'}</button>
          <button class="sec" onclick="useDemo()">Demo</button>
        </div>
      </div>
      <div class="search"><span>${I.search}</span><input id="search" placeholder="Search this room…" value="${escapeHtml(state.search)}"></div>
    </div>
    <div class="tree" id="tree">${renderTree(state.tree,0)}</div>
  </div>`;
}

function matchSearch(node){
  if(!state.search) return true;
  const q=state.search.toLowerCase();
  if(node.name.toLowerCase().includes(q)) return true;
  return (node.children||[]).some(matchSearch);
}
function renderTree(node, depth){
  if(!node) return `<div class="tree-loading">No data room loaded.</div>`;
  if(node.type==="folder"){
    if(node.id==="root" && node.children===null) return `<div class="tree-loading">${spinner("Loading your Drive…")}</div>`;
    const open = node.id==="root" ? true : !!state.expanded[node.id];
    const head = node.id==="root" ? "" : `<div class="row ${open?'open':''}" data-folder="${node.id}" style="padding-left:${8+depth*14}px">
      <span class="tw">${I.chev}</span><span class="ic">${open?I.folderOpen:I.folder}</span>
      <span class="nm">${escapeHtml(node.name)}</span><span class="meta">${node.children?node.children.length:''}</span></div>`;
    let kids="";
    if(open || node.id==="root"){
      if(node.children===null) kids=`<div style="padding-left:${20+depth*14}px;font-size:11px;color:var(--faint);padding-top:4px;padding-bottom:4px">loading…</div>`;
      else{
        const vis=(node.children||[]).filter(matchSearch);
        kids=`<div class="children">${vis.map(c=>renderTree(c,node.id==="root"?0:depth+1)).join("")}</div>`;
      }
    }
    return head+kids;
  }
  if(!matchSearch(node)) return "";
  const sel = state.selectedDoc===node.id?"sel":"";
  const fl = (state.source==="demo" && FLAGGED_DEMO.has(node.id))?"flagged":"";
  return `<div class="row ${sel} ${fl}" data-doc="${node.id}" style="padding-left:${8+depth*14}px">
    <span class="tw"></span><span class="ic">${docIcon(node)}</span>
    <span class="nm">${escapeHtml(node.name)}</span><span class="meta">${node.size||""}</span></div>`;
}

function bindSide(){
  const s=document.getElementById("search");
  if(s){ s.oninput=e=>{ state.search=e.target.value; const tr=document.getElementById("tree"); if(tr){tr.innerHTML=renderTree(state.tree,0); bindRows();} }; }
  const fi=document.getElementById("folderInput");
  if(fi){ fi.onkeydown=e=>{ if(e.key==="Enter") loadFolderFromInput(); }; }
  bindRows();
}
function bindRows(){
  document.querySelectorAll("[data-folder]").forEach(el=>{
    el.onclick=async ()=>{ const id=el.dataset.folder; const node=state.docIndex[id];
      state.expanded[id]=!state.expanded[id];
      if(state.source==="drive" && state.expanded[id]) await ensureDriveFolderLoaded(node);
      const tr=document.getElementById("tree"); tr.innerHTML=renderTree(state.tree,0); bindRows(); };
  });
  document.querySelectorAll("[data-doc]").forEach(el=> el.onclick=()=>openDoc(el.dataset.doc));
}
function loadFolderFromInput(){ const v=document.getElementById("folderInput").value; loadDriveFolder(v); }
function useDemo(){ bootDemo(); }

function openDoc(id){
  state.selectedDoc=id;
  let n=state.docIndex[id];
  while(n && n.parent){ state.expanded[n.parent.id]=true; n=state.docIndex[n.parent.id]; }
  if(["overview","navigate","reconcile"].includes(state.tab)) state.tab="summarise";
  render();
  setTimeout(()=>{ const r=document.querySelector(".row.sel"); if(r) r.scrollIntoView({block:"center",behavior:"smooth"}); },60);
}

// ---------- Tabs ----------
const TABS=[
  {id:"overview",label:"Overview",icon:I.grid},
  {id:"navigate",label:"Navigate & Ask",icon:I.compass},
  {id:"summarise",label:"Summarise",icon:I.doc},
  {id:"extract",label:"Financial Extract",icon:I.calc},
  {id:"flags",label:"Inconsistencies",icon:I.flag},
  {id:"reconcile",label:"Request Checklist",icon:I.scale},
];
function tabBar(){
  return `<div class="tabs">${TABS.map(t=>{
    const badge = (t.id==="flags" && state.source==="demo") ? `<span class="badge">${DEMO_FLAGS.length}</span>`:"";
    return `<button class="tab ${state.tab===t.id?'active':''}" onclick="setTab('${t.id}')">${t.icon}<span>${t.label}</span>${badge}</button>`;
  }).join("")}</div>`;
}
function setTab(id){ state.tab=id; render(); }

function renderView(){
  const v=document.getElementById("view"); if(!v) return;
  ({overview:()=>{v.innerHTML=viewOverview();bindOverview();},
    navigate:()=>{v.innerHTML=viewNavigate();bindNavigate();},
    summarise:()=>{v.innerHTML=viewSummarise();bindSummarise();},
    extract:()=>{v.innerHTML=viewExtract();bindExtract();},
    flags:()=>{v.innerHTML=viewFlags();bindFlags();},
    reconcile:()=>{v.innerHTML=viewReconcile();bindReconcile();}}[state.tab]||(()=>{}))();
}
function emptyState(icon,h,p){ return `<div class="empty"><div class="ill">${icon}</div><h3>${h}</h3><p>${p}</p></div>`; }

// ============================================================
// CONNECT MODAL (shown when no Client ID configured)
// ============================================================
function connectModal(){
  return `<div class="modal-bg" id="modalBg"><div class="modal">
    <div class="modal-h"><h3>${I.drive} Connect your Google Drive<span class="x" onclick="closeModal()">×</span></h3>
      <p>One-time setup so the tool can read your own deal folders.</p></div>
    <div class="modal-b">
      <p style="font-size:13px;margin-bottom:12px">This deployed copy has no Google <b>Client ID</b> yet. To enable live Drive:</p>
      <ol>
        <li>In <code>Google Cloud Console</code> → enable the <b>Drive API</b>.</li>
        <li>Create an <b>OAuth Client ID</b> (type: Web app). Under <i>Authorized JavaScript origins</i>, add this site's URL.</li>
        <li>Paste the Client ID into <code>CONFIG.GOOGLE_CLIENT_ID</code> in <code>app.js</code> (or set <code>window.CONDITOR_CLIENT_ID</code>), then redeploy.</li>
      </ol>
      <div class="note">${I.info}<div>Full step-by-step is in the project's <b>README.md</b>. Until then, you can explore everything with the built-in demo data room.</div></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">Explore demo instead</button></div>
  </div></div>`;
}
function bindModal(){ const bg=document.getElementById("modalBg"); if(bg) bg.onclick=e=>{ if(e.target===bg) closeModal(); }; }
function closeModal(){ state.showConnect=false; render(); }

// ============================================================
// UPLOAD TEMPLATE MODAL
// ============================================================
function showUploadModal(){ state.showUploadModal=true; render(); }
function closeUploadModal(){ state.showUploadModal=false; state.uploadPreview=null; render(); }
function uploadModal(){
  const p=state.uploadPreview;
  return `<div class="modal-bg" id="uploadModalBg"><div class="modal">
    <div class="modal-h"><h3>${I.calc} Upload Custom Template<span class="x" onclick="closeUploadModal()">×</span></h3>
      <p>Upload a CSV (one field name per row) or a JSON file to define your own extraction structure.</p></div>
    <div class="modal-b">
      ${!p?`
        <div class="upload-zone" id="uploadZone">
          <input type="file" id="tmplFileInput" accept=".csv,.json" style="display:none">
          <div class="upload-zone-icon">${I.download}</div>
          <div class="upload-zone-label">Drop a .csv or .json file here</div>
          <div class="upload-zone-sub">or <button class="btn ghost" style="padding:5px 12px;font-size:12px" onclick="document.getElementById('tmplFileInput').click()">browse</button></div>
        </div>
        <div class="upload-format-hint">
          <b>CSV:</b> one field name per line<br>
          <code>Net Revenue</code><code>Gross Profit</code><code>EBITDA</code>
          <br><b>JSON:</b> <code>{"name":"...","currency":"₹ Lakhs","fields":["...","..."]}</code>
        </div>`
      :`<div class="upload-preview">
          <div class="upload-preview-name">${escapeHtml(p.name||"Custom template")}</div>
          <div class="upload-preview-cur">Currency: ${escapeHtml(p.currency||"—")}</div>
          ${p.error?`<div class="err">${escapeHtml(p.error)}</div>`:`
          <div class="upload-preview-fields">
            ${(p.fields||[]).slice(0,12).map(f=>`<div class="upload-preview-field">${escapeHtml(f)}</div>`).join("")}
            ${(p.fields||[]).length>12?`<div class="upload-preview-more">+${(p.fields||[]).length-12} more fields</div>`:''}
          </div>`}
        </div>`}
    </div>
    <div class="modal-foot">
      <button class="btn ghost" onclick="closeUploadModal()">Cancel</button>
      ${p&&!p.error?`<button class="btn gold" onclick="confirmUploadTemplate()">Use this template</button>`:''}
    </div>
  </div></div>`;
}
function bindUploadModal(){
  const bg=document.getElementById("uploadModalBg");
  if(bg) bg.onclick=e=>{ if(e.target===bg) closeUploadModal(); };
  const inp=document.getElementById("tmplFileInput");
  if(inp) inp.onchange=e=>{ if(e.target.files[0]) handleTemplateFile(e.target.files[0]); };
  const zone=document.getElementById("uploadZone");
  if(zone){
    zone.ondragover=e=>{ e.preventDefault(); zone.classList.add("drag-over"); };
    zone.ondragleave=()=>zone.classList.remove("drag-over");
    zone.ondrop=e=>{ e.preventDefault(); zone.classList.remove("drag-over"); const f=e.dataTransfer.files[0]; if(f) handleTemplateFile(f); };
  }
}
async function handleTemplateFile(file){
  const text=await file.text();
  const ext=file.name.split('.').pop().toLowerCase();
  let parsed=null;
  if(ext==='json'){
    try{
      const obj=JSON.parse(text);
      if(!Array.isArray(obj.fields)||obj.fields.length===0){ parsed={error:'JSON must have a "fields" array with at least one entry.'}; }
      else{ parsed={id:"custom_"+Date.now(),name:obj.name||file.name.replace(/\.json$/,''),description:obj.description||"Custom template",currency:obj.currency||"₹ Lakhs",fields:obj.fields.map(f=>String(f).trim()).filter(Boolean),isCustom:true}; }
    }catch(e){ parsed={error:"Invalid JSON: "+e.message}; }
  }else if(ext==='csv'){
    const fields=text.split('\n').map(l=>l.trim()).filter(Boolean);
    if(!fields.length){ parsed={error:"CSV appears empty."}; }
    else{ parsed={id:"custom_"+Date.now(),name:file.name.replace(/\.csv$/,''),description:"Custom template ("+fields.length+" fields)",currency:"₹ Lakhs",fields,isCustom:true}; }
  }else{ parsed={error:"Unsupported file type. Please upload a .csv or .json file."}; }
  state.uploadPreview=parsed;
  render();
  if(parsed&&!parsed.error) bindUploadModal();
}
function confirmUploadTemplate(){
  const t=state.uploadPreview;
  if(!t||t.error) return;
  state.customTemplates.push(t);
  state.selectedTemplate=t.id;
  state.showUploadModal=false;
  state.uploadPreview=null;
  toast("Template \""+t.name+"\" added");
  render();
}

// ============================================================
// FEATURE 1: OVERVIEW
// ============================================================
function countDocs(node){ if(!node) return 0; let n=0; (node.children||[]).forEach(c=> n += c.type==="folder"?countDocs(c):1); return n; }
function viewOverview(){
  const isDemo=state.source==="demo";
  const total=countDocs(state.tree);
  const folders=(state.tree&&state.tree.children)?state.tree.children.filter(c=>c.type==="folder").length:0;
  const statBlock = isDemo ? `
    <div class="stats">
      <div class="stat t-gold"><div class="k">Documents</div><div class="v">${total}</div><div class="d">across ${folders} workstreams</div></div>
      <div class="stat t-red"><div class="k">Open Flags</div><div class="v red">${DEMO_FLAGS.length}</div><div class="d">inconsistencies</div></div>
      <div class="stat t-amber"><div class="k">Checklist</div><div class="v amber">2</div><div class="d">items outstanding</div></div>
      <div class="stat t-green"><div class="k">Jurisdiction</div><div class="v sm">India</div><div class="d">Ind AS / MCA</div></div>
    </div>` : `
    <div class="stats">
      <div class="stat t-gold"><div class="k">Top-level items</div><div class="v">${(state.tree&&state.tree.children)?state.tree.children.length:'…'}</div><div class="d">in this folder</div></div>
      <div class="stat t-green"><div class="k">Folders</div><div class="v">${folders}</div><div class="d">workstreams</div></div>
      <div class="stat t-green"><div class="k">Source</div><div class="v sm green">Google Drive</div><div class="d">live, read-only</div></div>
      <div class="stat t-blue"><div class="k">AI engine</div><div class="v sm">${CONFIG.AI_PROVIDER_LABEL}</div><div class="d">via backend</div></div>
    </div>`;
  return `<div>
    <div class="page-h">
      <div class="eyebrow">${I.grid} Data Room Overview</div>
      <h2>${escapeHtml(state.tree?state.tree.name:'Data Room')}</h2>
      <p>${isDemo
        ? `Illustrative deal for Conditor Capital — acquisition of a ${DEAL.sector} business. Connect your Google Drive (top right) to run the same tools on a real deal folder.`
        : `Live view of your Google Drive folder. Use the tools below to summarise, navigate, extract financials and flag issues.`}</p>
    </div>
    ${statBlock}
    <div class="card">
      <h3><span class="card-badge ai">AI</span> Hierarchy summary — what's where</h3>
      <p style="color:var(--muted);font-size:13px">A short orientation to each part of the room, generated from its structure.</p>
      <div id="ovOut">${state.aiResults.overview?`<div class="ai-out">${state.aiResults.overview}</div>`:''}</div>
      <div class="btn-row mt-14">
        <button class="btn gold" id="ovGen">${I.spark} Generate room summary</button>
        <button class="btn ghost" onclick="setTab('navigate')">${I.compass} Find a document</button>
      </div>
      ${isDemo?`<div class="note">${I.info}<div>Demo data is illustrative (not real Conditor deals). Live mode reads your own Drive in read-only mode; nothing is written or stored.</div></div>`:''}
    </div>
  </div>`;
}
function treeText(node,d){ let s="  ".repeat(d)+(node.type==="folder"?"[folder] ":"[file] ")+node.name+"\n"; (node.children||[]).forEach(c=>s+=treeText(c,d+1)); return s; }
function bindOverview(){
  const b=document.getElementById("ovGen"); if(!b) return;
  b.onclick=async ()=>{
    const out=document.getElementById("ovOut"); out.innerHTML=spinner("Mapping the data room…"); b.disabled=true;
    const sys=`You are Conditor VDR AI, an assistant for Conditor Capital, a London growth-capital private equity firm (sectors: business services, financial services, healthcare, tech-enabled services). Use British English and PE terminology. Output concise markdown: one bolded folder name then a one-sentence note on what's there and what to prioritise. Under 220 words.`;
    const usr=`Folder tree of a data room${state.source==='demo'?` for the acquisition of ${DEAL.target} (${DEAL.sector})`:''}:\n\n${treeText(state.tree,0)}`;
    const r=await askAI(sys,usr,{maxTokens:700});
    let html;
    if(r.text) html=mdToHtml(r.text)+srcLine(true);
    else if(state.source==="demo") html=mdToHtml(FALLBACK.overview)+srcLine(false);
    else html=`<div class="err">Couldn't reach the AI backend (${r.error}). Check that GEMINI_API_KEY is set in your Vercel project and that /api/ai is deployed.</div>`;
    state.aiResults.overview = r.text?html:state.aiResults.overview;
    out.innerHTML=`<div class="ai-out">${html}</div>`; b.disabled=false;
  };
}

// ============================================================
// FEATURE 2: NAVIGATE & ASK
// ============================================================
function viewNavigate(){
  const sugg = state.source==="demo"
    ? ["Where are the audited accounts?","Show me change-of-control clauses","Which file has customer concentration?","Find the cap table"]
    : ["Where are the financial statements?","Find the latest contract","Which file mentions revenue?","Show me anything about employees"];
  return `<div>
    <div class="page-h"><div class="eyebrow">${I.compass} Navigate & Ask</div>
      <h2>Find anything in the data room</h2>
      <p>Ask in plain English. The assistant identifies the right file and takes you straight to it.</p></div>
    <div class="card">
      <div class="suggest">${sugg.map(q=>`<button class="chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("")}</div>
      <div class="chat-log" id="navLog">${state.chat.length?state.chat.map(renderMsg).join(""):`<div class="msg ai"><div class="av">CC</div><div class="bubble">Hi, I'm Conditor VDR AI. Ask me anything — where to find a document, questions about the deal, financials, risks, or general PE topics. I'll point you to the right file when relevant.</div></div>`}</div>
      <div class="chat-input"><input id="navInput" placeholder="Ask where something is…" autocomplete="off"><button class="btn" id="navSend">${I.compass} Find</button></div>
    </div></div>`;
}
function renderMsg(m){
  const jump=m.jumpTo&&state.docIndex[m.jumpTo]?`<button class="jump" onclick="openDoc('${m.jumpTo}')">${I.jump} Open ${escapeHtml(state.docIndex[m.jumpTo].name)}</button>`:"";
  return `<div class="msg ${m.role==='user'?'user':'ai'}"><div class="av">${m.role==='user'?'You':'CC'}</div><div class="bubble">${m.role==='user'?escapeHtml(m.text):mdToHtml(m.text)}${jump}</div></div>`;
}
function bindNavigate(){
  const input=document.getElementById("navInput"), send=document.getElementById("navSend");
  document.querySelectorAll(".chip").forEach(c=> c.onclick=()=>{ input.value=c.dataset.q; doNav(); });
  if(send) send.onclick=doNav;
  if(input){ input.onkeydown=e=>{ if(e.key==="Enter") doNav(); }; input.focus(); }
  const log=document.getElementById("navLog"); if(log) log.scrollTop=log.scrollHeight;
}
async function doNav(){
  const input=document.getElementById("navInput"); const q=input.value.trim(); if(!q||state.busy) return;
  state.chat.push({role:"user",text:q}); input.value=""; renderView(); state.busy=true;
  const log=document.getElementById("navLog");
  log.insertAdjacentHTML("beforeend",`<div class="msg ai" id="navPending"><div class="av">CC</div><div class="bubble">${spinner("Thinking…")}</div></div>`);
  log.scrollTop=log.scrollHeight;

  const cat=Object.values(state.docIndex).filter(d=>d.type==="doc").map(d=>`• [${d.id}] ${nodePath(d.id)}`).join("\n");
  const history=state.chat.slice(-6).map(m=>`${m.role==="user"?"User":"Assistant"}: ${m.text}`).join("\n");

  const sys=`You are Conditor VDR AI, a helpful and knowledgeable AI assistant. You answer ANY question the user asks — general knowledge, finance, markets, PE concepts, company information, or anything else. You also help navigate a data room when relevant.

Available data room documents:
${cat||"(none loaded)"}

Recent conversation:
${history}

Instructions:
- ALWAYS answer the question directly. Never say you can only help with data room questions or redirect the user away from their question.
- For general questions (finance, stocks, markets, news, concepts, etc.) — you have access to Google Search for real-time data. Use it to look up live stock prices, current news, recent events, and up-to-date information. Always provide the actual answer rather than directing the user elsewhere.
- Answer naturally and helpfully in British English.
- If your answer relates to a specific document from the list above, add a final line: DOC:[id]  (e.g. DOC:d2)
- If no specific document is relevant, do not add a DOC line.
- Do NOT use any other special formatting — just reply naturally.`;

  // Call /api/chat (server proxies to Gemini — no CORS issues)
  const fullPrompt = sys + "\n\nUser: " + q;
  console.group(`[doNav] query: "${q}"`);
  console.log("[doNav] step 1 → POST /api/chat");
  let r = await fetch("/api/chat", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ prompt: fullPrompt, maxTokens: 600, apiKey: CONFIG.GEMINI_API_KEY })
  }).then(async res => {
    const d=await res.json().catch(()=>({}));
    if(res.ok && d.text){ console.log("[doNav] step 1 ✓ /api/chat OK", {textLen:d.text.length}); return {text:d.text,live:true}; }
    console.warn("[doNav] step 1 ✗ /api/chat failed", {status:res.status, error:d.error});
    return {error:d.error||"Server error "+res.status};
  }).catch(e => { console.warn("[doNav] step 1 ✗ /api/chat network error", e.message); return {error:e.message}; });

  // Fallback: direct browser call
  if(!r.text){
    console.log("[doNav] step 2 → askGeminDirect (browser-side Gemini)");
    if(CONFIG.GEMINI_API_KEY){
      r = await askGeminDirect(sys, q, {maxTokens:600});
      if(r.text) console.log("[doNav] step 2 ✓ askGeminDirect OK", {textLen:r.text.length});
      else console.warn("[doNav] step 2 ✗ askGeminDirect failed", r.error);
    } else {
      console.warn("[doNav] step 2 ✗ skipped — no CONFIG.GEMINI_API_KEY");
    }
  }

  // Fallback: /api/ai backend
  if(!r.text){
    console.log("[doNav] step 3 → askAI (/api/ai)");
    r = await askAI(sys, q, {maxTokens:600});
    if(r.text) console.log("[doNav] step 3 ✓ askAI OK", {textLen:r.text.length});
    else console.warn("[doNav] step 3 ✗ askAI failed", r.error);
  }

  let answer=null, jumpTo=null;
  if(r.text){
    const docLineMatch = r.text.match(/\nDOC:\s*(\S+)\s*$/);
    if(docLineMatch){
      answer = r.text.slice(0, docLineMatch.index).trim();
      const rawId = docLineMatch[1].replace(/[\[\]]/g,"");
      if(state.docIndex[rawId]?.type==="doc") jumpTo = rawId;
    } else {
      answer = r.text.trim();
    }
    console.log("[doNav] answer source: AI", {jumpTo});
  }

  if(!answer){
    if(state.source==="demo"){
      const fb=navFallback(q); answer=fb.answer; jumpTo=fb.jumpTo;
      console.warn("[doNav] all AI paths failed → using navFallback (demo mode)", {query:q, fallbackAnswer:answer.slice(0,80)});
    } else {
      answer=`I couldn't reach the AI (${r.error}).`;
      console.error("[doNav] all AI paths failed", {error:r.error});
    }
  }
  console.groupEnd();

  document.getElementById("navPending")?.remove();
  state.chat.push({role:"ai",text:answer,jumpTo}); state.busy=false; renderView();
}

// ============================================================
// FEATURE 3: SUMMARISE
// ============================================================
function viewSummarise(){
  const id=state.selectedDoc;
  if(!id||!state.docIndex[id]||state.docIndex[id].type!=="doc")
    return emptyState(I.doc,"Select a document","Click any file in the left panel to open it here, or use Navigate &amp; Ask to find one.");
  const d=state.docIndex[id];
  const cached=state.aiResults["sum_"+id];
  const metaChips=[nodePath(id),d.size,d.modified?'Modified '+d.modified:null].filter(Boolean).map(m=>`<span class="chip-sm">${escapeHtml(m)}</span>`).join("");
  return `<div>
    <div class="page-h"><div class="eyebrow">${I.doc} Document Summary</div>
      <h2>${escapeHtml(d.name.replace(/\.(pdf|xlsx|docx|csv)$/,""))}</h2>
      <div class="doc-meta">${metaChips}</div></div>
    <div class="card">
      <div class="doc-bar"><span class="ic">${docIcon(d)}</span><span class="fname">${escapeHtml(d.name)}</span></div>
      <div id="docPreview"></div>
      <div class="btn-row mt-14">
        <button class="btn gold" id="sumGen">${I.spark} Summarise this document</button>
        ${(state.source==="demo"&&FLAGGED_DEMO.has(id))?`<button class="btn ghost" onclick="setTab('flags')">${I.flag} Related flags</button>`:""}
      </div>
      <div id="sumOut">${cached?`<div class="ai-out">${cached}</div>`:""}</div>
    </div></div>`;
}
function bindSummarise(){
  const b=document.getElementById("sumGen"); if(!b) return;
  // preview content
  (async()=>{
    const id=state.selectedDoc; const prev=document.getElementById("docPreview");
    const txt=await getDocText(id);
    if(txt) prev.innerHTML=`<details><summary class="mono" style="cursor:pointer;font-size:11px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">View extracted text</summary><div class="doc-paper" style="margin-top:10px">${escapeHtml(txt.slice(0,6000))}</div></details>`;
    else prev.innerHTML=`<div class="note">${I.info}<div>${state.source==="drive"?"This file type can't be read as text in-browser (e.g. scanned image or unsupported binary). Google Docs, Sheets, PDFs and text files work best.":"Preview not available for this demo file — try the financial or contract documents."}</div></div>`;
  })();
  b.onclick=async ()=>{
    const id=state.selectedDoc; const out=document.getElementById("sumOut");
    out.innerHTML=spinner("Reading the document…"); b.disabled=true;
    const txt=await getDocText(id);
    if(!txt){ out.innerHTML=`<div class="err">No readable text in this file.</div>`; b.disabled=false; return; }
    const sys=`You are Conditor VDR AI for a UK PE fund. Summarise this data-room document for an investment team. British English, PE lens. Markdown: one-line **Overview**, then **Key points** (bullets with specific figures), then **Deal considerations** (risks / conditions a buyer cares about). Under 230 words.`;
    const r=await askAI(sys,`Document: ${state.docIndex[id].name}\n\nCONTENT:\n${txt.slice(0,16000)}`,{maxTokens:800});
    let html;
    if(r.text) html=mdToHtml(r.text)+srcLine(true);
    else if(state.source==="demo") html=mdToHtml(FALLBACK.summaries[id]||FALLBACK.genericSummary(DOC_CONTENT[id]))+srcLine(false);
    else html=`<div class="err">AI backend error: ${r.error}.</div>`;
    if(r.text||state.source==="demo") state.aiResults["sum_"+id]=html;
    out.innerHTML=`<div class="ai-out">${html}</div>`; b.disabled=false;
  };
}

// ============================================================
// FEATURE 4: FINANCIAL EXTRACT
// ============================================================
// TEMPLATE HELPERS
// ============================================================
function allTemplates(){
  return [...TEMPLATE_LIBRARY, ...state.customTemplates];
}
function getActiveTemplate(){
  return allTemplates().find(t=>t.id===state.selectedTemplate) || TEMPLATE_LIBRARY[0];
}

// ============================================================
function financialCandidates(){
  return Object.values(state.docIndex).filter(d=>d.type==="doc" && (
    /account|financ|p&l|profit|ebitda|management|budget|balance|monthly|revenue|sku|cash.?flow|pnl/i.test(d.name) ||
    (d.mimeType||"").includes("spreadsheet") || /\.(xlsx|csv)$/.test(d.name)
  ));
}
function viewExtract(){
  const demoCands=["d2","d30","d31","d37"];
  const cands=state.source==="demo"?demoCands.map(i=>state.docIndex[i]).filter(Boolean):financialCandidates();
  let cur=state.selectedDoc && cands.find(c=>c.id===state.selectedDoc) ? state.selectedDoc : (cands[0]&&cands[0].id);
  if(cur && state.selectedDoc!==cur) state.selectedDoc=cur;
  const tmpl=getActiveTemplate();
  const cacheKey=cur?"ext_"+cur+"_"+tmpl.id:null;
  const cached=cacheKey?state.aiResults[cacheKey]:null;
  return `<div>
    <div class="page-h"><div class="eyebrow">${I.calc} Financial Template Extraction</div>
      <h2>Extract into a structured template</h2>
      <p>Pick a source document and a template — the AI maps figures into your chosen structure. Upload a CSV or JSON to define your own template.</p></div>
    <div class="card"><h3><span class="card-badge">01</span> Source financial document</h3>
      ${cands.length?`<div class="tmpl-list">${cands.slice(0,8).map(c=>`<div class="tmpl-opt ${cur===c.id?'sel':''}" data-fin="${c.id}">
        <div class="ti">${docIcon(c)}</div><div class="tt"><b>${escapeHtml(c.name.replace(/\.(pdf|xlsx|csv|docx)$/,''))}</b><span>${escapeHtml(nodePath(c.id))}</span></div>
        ${cur===c.id?`<span class="card-badge" style="color:var(--gold-dim)">Selected</span>`:""}</div>`).join("")}</div>`
        :`<div class="note">${I.info}<div>No financial files detected. Open any document with figures to extract from it.</div></div>`}
    </div>
    <div class="card"><h3><span class="card-badge">02</span> Choose extraction template</h3>
      <div class="tmpl-lib" id="tmplLib">
        ${allTemplates().map(t=>`<div class="tmpl-lib-card ${state.selectedTemplate===t.id?'active':''}" data-tmpl="${t.id}">
          ${t.isCustom?`<span class="tmpl-lib-badge">Custom</span>`:''}
          <div class="tmpl-lib-name">${escapeHtml(t.name)}</div>
          <div class="tmpl-lib-desc">${escapeHtml(t.description)}</div>
          <div class="tmpl-lib-cur">${escapeHtml(t.currency)}</div>
        </div>`).join('')}
        <button class="tmpl-lib-card tmpl-lib-upload" id="openUpload">
          <div class="tmpl-lib-upload-icon">${I.download}</div>
          <div class="tmpl-lib-name">Upload template</div>
          <div class="tmpl-lib-desc">CSV or JSON</div>
        </button>
      </div>
    </div>
    <div class="card"><h3><span class="card-badge">03</span> ${escapeHtml(tmpl.name)} — fields</h3>
      <div class="tmpl-preview">${tmpl.fields.map(f=>{
        const isAdd=/add.?back|add-back/i.test(f);
        const isTotal=/ebitda$|pat$|profit after tax|closing cash|contribution margin %?$|net cash from/i.test(f) && !/margin %/i.test(f);
        return `<div class="tp-row${isAdd?' tp-add':''}${isTotal?' tp-total':''}"><span class="tp-dot"></span><span>${escapeHtml(f)}</span></div>`;
      }).join("")}</div>
      <div class="btn-row mt-14"><button class="btn gold" id="extGen" ${cur?'':'disabled'}>${I.spark} Extract &amp; fill template</button></div>
      <div id="extOut">${cached||""}</div>
    </div></div>`;
}
function bindExtract(){
  document.querySelectorAll("[data-fin]").forEach(el=>el.onclick=()=>{ state.selectedDoc=el.dataset.fin; renderView(); });
  document.querySelectorAll("[data-tmpl]").forEach(el=>el.onclick=()=>{ state.selectedTemplate=el.dataset.tmpl; renderView(); });
  const up=document.getElementById("openUpload"); if(up) up.onclick=()=>showUploadModal();
  const b=document.getElementById("extGen"); if(!b) return;
  b.onclick=async ()=>{
    const id=state.selectedDoc; const tmpl=getActiveTemplate();
    const cacheKey="ext_"+id+"_"+tmpl.id;
    const out=document.getElementById("extOut");
    out.innerHTML=spinner("Mapping figures into "+tmpl.name+"…"); b.disabled=true;
    const txt=await getDocText(id);
    if(!txt){ out.innerHTML=`<div class="err">No readable figures in this file.</div>`; b.disabled=false; return; }
    const fieldsStr=tmpl.fields.join("; ");
    const sys=`You are Conditor VDR AI. Extract financial figures from the source document and populate the following template. Reply ONLY as a markdown table with columns "Line item" and "${tmpl.currency}". Rows in this exact order: ${fieldsStr}. Use 0 if a line item is not present. After the table add one line starting "Note:" with key metrics such as margin % or YoY growth.`;
    const r=await askAI(sys,`SOURCE: ${state.docIndex[id].name}\n\n${txt.slice(0,16000)}`,{maxTokens:800});
    let html;
    if(r.text) html=renderFinTable(r.text,tmpl)+srcLine(true);
    else if(state.source==="demo") html=FALLBACK.extract(id,tmpl)+srcLine(false);
    else html=`<div class="err">AI backend error: ${r.error}.</div>`;
    if(r.text||state.source==="demo") state.aiResults[cacheKey]=`<div class="ai-out" style="border-left-color:var(--green)">${html}<div class="btn-row mt-14"><button class="btn ghost" onclick="toast('Export to Excel — available when deployed')">${I.download} Export to Excel</button></div></div>`;
    out.innerHTML=state.aiResults[cacheKey]||`<div class="ai-out">${html}</div>`; b.disabled=false;
  };
}
function renderFinTable(md,tmpl){
  tmpl=tmpl||getActiveTemplate();
  const currency=tmpl?tmpl.currency:"Value";
  const title=tmpl?tmpl.name:"Financial Extract";
  const addBackSet=new Set((tmpl?tmpl.fields:[]).filter(f=>/add.?back|add-back/i.test(f)).map(f=>f.toLowerCase()));
  const totalSet=new Set((tmpl?tmpl.fields:[]).filter(f=>/ebitda$|pat$|profit after tax|closing cash|contribution margin %?$|net cash from/i.test(f)&&!/margin %/i.test(f)).map(f=>f.toLowerCase()));
  const rows=md.split("\n").filter(l=>l.includes("|")&&!/^\s*\|?[\s:\-|]+\|?\s*$/.test(l));
  if(rows.length<2) return mdToHtml(md);
  let body="",note="";
  rows.forEach((l,i)=>{ const cells=l.split("|").map(c=>c.trim()).filter(c=>c!==""); if(cells.length<2||i===0) return;
    const item=cells[0],val=cells[1]; if(/line item|header/i.test(item)) return;
    const il=item.toLowerCase();
    const isTotal=totalSet.has(il)||/adjusted ebitda|reported ebitda/i.test(item);
    const isAdd=addBackSet.has(il)||/add back/i.test(item);
    body+=`<tr class="${isTotal?'total':''} ${isAdd?'addback':''}"><td>${escapeHtml(item)}</td><td class="num">${escapeHtml(val)}</td></tr>`; });
  const nm=md.match(/Note:.*/i); if(nm) note=`<p style="font-size:12px;color:var(--muted);margin-top:10px">${escapeHtml(nm[0])}</p>`;
  return `<h4>${escapeHtml(title)} — extracted</h4><table class="fin"><thead><tr><th>Line item</th><th style="text-align:right">${escapeHtml(currency)}</th></tr></thead><tbody>${body}</tbody></table>${note}`;
}

// ============================================================
// FEATURE 5: INCONSISTENCIES / FLAGS
// ============================================================
const DEMO_FLAGS=[
  {sev:"high",title:"Marketplace unit economics are contribution-margin negative",
   body:"Electronics and apparel SKUs on Amazon/Flipkart run negative contribution margins (-28% and -3% respectively) after platform commissions and CAC. Blended CM is -7.2% on the marketplace channel. Overall profitability depends on D2C scaling as modelled — not yet demonstrated at scale.",
   loc:"Financials / Unit Economics / SKU Profitability",docs:["d37"]},
  {sev:"high",title:"Customer concentration — top decile drives 47% of revenue",
   body:"Top 10% of customers contribute 47% of total revenue. Cohort data shows 6-month retention for the top buyer segment declining in recent quarters. If these power buyers churn, the LTV model is overstated and FY2025E projections are at risk.",
   loc:"Business and Operations / Customer and Retention",docs:["d29"]},
  {sev:"med",title:"GST compliance gap — late filings in Q2 and Q3 FY2024",
   body:"GST returns for Q2 and Q3 FY2024 were filed after the due date. This creates a potential interest and penalty liability under GST law. Obtain a clean-chit certificate from tax counsel before Series A close.",
   loc:"Financials / Tax Compliance / GST Returns",docs:["d34"]},
  {sev:"med",title:"Working capital pressure — short-term borrowing and tight cash runway",
   body:"Cash balance ₹74L against short-term NBFC borrowing of ₹25L. Monthly net revenue only turned cash-positive in FY2024. Seasonal Q3 inventory build relies on the working capital line; renewal terms and NBFC relationship need confirmation.",
   loc:"Financials / Latest Monthly Financials · Cash Flow",docs:["d30","d33"]},
  {sev:"low",title:"Two critical SaaS platform agreements on monthly rolling terms",
   body:"Technology and SaaS Agreements file shows 2 of 3 critical platform contracts (including logistics management system) on rolling monthly terms with no SLA. Recommend locking in minimum 12-month agreements as a Series A condition.",
   loc:"Company and Compliance / Legal and Compliance / Technology and SaaS Agreements",docs:["d22"]},
];
function viewFlags(){
  if(state.source==="demo") return flagsDemoView();
  return flagsLiveView();
}
function flagsDemoView(){
  const c={high:0,med:0,low:0}; DEMO_FLAGS.forEach(f=>c[f.sev]++);
  return `<div>
    <div class="page-h"><div class="eyebrow">${I.flag} Inconsistencies & Risk Flags</div>
      <h2>What doesn't add up</h2><p>Automated cross-document review of the data room. Flags are ranked by severity and link to source files.</p></div>
    <div class="stats cols-3">
      <div class="stat t-red"><div class="k">High severity</div><div class="v red">${c.high}</div><div class="d">deal-impacting</div></div>
      <div class="stat t-amber"><div class="k">Medium</div><div class="v amber">${c.med}</div><div class="d">diligence required</div></div>
      <div class="stat t-blue"><div class="k">Low / quality</div><div class="v" style="color:var(--blue)">${c.low}</div><div class="d">noting items</div></div></div>
    <div class="card"><div class="btn-row mb-14">
      <button class="btn gold" id="flagGen">${I.spark} AI narrative for IC paper</button>
      <button class="btn ghost" onclick="toast('Export — available when deployed')">${I.download} Export red-flag report</button></div>
      <div id="flagNarr">${state.aiResults.flagNarr?`<div class="ai-out">${state.aiResults.flagNarr}</div>`:''}</div></div>
    ${DEMO_FLAGS.map(f=>flagCard(f)).join("")}</div>`;
}
function flagCard(f){
  const jumps=(f.docs||[]).filter(d=>state.docIndex[d]).map(d=>`<button class="jump" onclick="openDoc('${d}')">${I.jump} ${escapeHtml(state.docIndex[d].name)}</button>`).join("");
  return `<div class="flag ${f.sev}"><span class="sev">${f.sev==="high"?"HIGH":f.sev==="med"?"MED":"LOW"}</span>
    <div class="ftxt"><b>${escapeHtml(f.title)}</b><span>${escapeHtml(f.body)}</span>
    ${f.loc?`<span class="floc">${escapeHtml(f.loc)}</span>`:""}
    ${jumps?`<div class="flag-actions">${jumps}</div>`:""}</div></div>`;
}
function flagsLiveView(){
  return `<div>
    <div class="page-h"><div class="eyebrow">${I.flag} Inconsistencies & Risk Flags</div>
      <h2>Scan documents for issues</h2><p>The assistant reads the documents in this folder and flags inconsistencies, risks and missing detail. Larger rooms are sampled (first several readable files).</p></div>
    <div class="card"><div class="btn-row"><button class="btn gold" id="flagScan">${I.spark} Scan this folder for inconsistencies</button></div>
      <div id="flagOut" style="margin-top:6px">${state.liveFlags||''}</div></div></div>`;
}
function bindFlags(){
  const b=document.getElementById("flagGen");
  if(b){ b.onclick=async ()=>{
    const out=document.getElementById("flagNarr"); out.innerHTML=spinner("Drafting IC-ready risk narrative…"); b.disabled=true;
    const sys=`You are Conditor VDR AI for a Series A investor in India. Write a concise investment committee risk narrative. Group into **Key risks (conditions precedent)** and **Diligence / monitoring items**. Reference specifics. Under 200 words. Markdown.`;
    const r=await askAI(sys,`Flags in the ${DEAL.target} room:\n`+DEMO_FLAGS.map(f=>`- [${f.sev}] ${f.title}: ${f.body}`).join("\n"),{maxTokens:700});
    const html=r.text?mdToHtml(r.text)+srcLine(true):mdToHtml(FALLBACK.flagNarr)+srcLine(false);
    state.aiResults.flagNarr=html; out.innerHTML=`<div class="ai-out">${html}</div>`; b.disabled=false; };
  }
  const s=document.getElementById("flagScan");
  if(s){ s.onclick=async ()=>{
    const out=document.getElementById("flagOut"); out.innerHTML=spinner("Reading documents (this can take a moment)…"); s.disabled=true;
    const docs=Object.values(state.docIndex).filter(d=>d.type==="doc").slice(0,6);
    let corpus="";
    for(const d of docs){ const t=await getDocText(d.id); if(t) corpus+=`\n\n===== ${d.name} (${nodePath(d.id)}) =====\n`+t.slice(0,4000); }
    if(!corpus){ out.innerHTML=`<div class="err">No readable documents found to scan.</div>`; s.disabled=false; return; }
    const sys=`You are Conditor VDR AI for a Series A investor in India. Review these data-room documents and flag inconsistencies, risks, and missing detail an investor should worry about. For each, output markdown: a bullet starting with **[HIGH]**, **[MED]** or **[LOW]**, the issue in one sentence, and which file it relates to. Up to 8 flags.`;
    const r=await askAI(sys,corpus.slice(0,28000),{maxTokens:900});
    out.innerHTML = r.text ? `<div class="ai-out">${mdToHtml(r.text)}${srcLine(true)}</div>` : `<div class="err">AI backend error: ${r.error}.</div>`;
    state.liveFlags=out.innerHTML; s.disabled=false; };
  }
}

// ============================================================
// FEATURE 6: REQUEST CHECKLIST RECONCILIATION
// ============================================================
function defaultChecklist(){ return FUND_REQUEST_LIST.map(r=>r.item).join("\n"); }
function viewReconcile(){
  return `<div>
    <div class="page-h"><div class="eyebrow">${I.scale} Document Request Reconciliation</div>
      <h2>Checklist vs. what's in the room</h2>
      <p>Compares Conditor's due-diligence request list against the files actually present — surfacing what's missing and what's extra. Edit the list to match your deal.</p></div>
    <div class="card"><h3><span class="card-badge">01</span> Your request checklist <span style="font-weight:400;color:var(--muted);font-size:12px">(one item per line)</span></h3>
      <textarea class="checklist-edit" id="checklist" spellcheck="false" placeholder="Paste your due-diligence request list here, one item per line…">${escapeHtml(defaultChecklist())}</textarea>
      <div class="btn-row mt-12"><button class="btn gold" id="recRun">${I.spark} Reconcile against the room</button></div>
    </div>
    <div id="recResult"></div></div>`;
}
function bindReconcile(){
  const b=document.getElementById("recRun"); if(!b) return;
  b.onclick=async ()=>{
    const items=document.getElementById("checklist").value.split("\n").map(s=>s.trim()).filter(Boolean);
    const res=document.getElementById("recResult"); res.innerHTML=spinner("Matching requested items to files…"); b.disabled=true;
    const files=Object.values(state.docIndex).filter(d=>d.type==="doc").map(d=>d.name);
    const sys=`You are Conditor VDR AI for a UK PE fund. Compare a due-diligence REQUEST LIST against the FILES present in a data room. Decide which requested items are satisfied by a file (match generously on meaning, not exact words) and which are missing. Also list files that don't correspond to any requested item ("extra"). Reply ONLY as JSON: {"received":[{"item":"...","file":"..."}],"missing":["..."],"extra":["..."]}. No prose.`;
    const usr=`REQUEST LIST:\n${items.map(i=>"- "+i).join("\n")}\n\nFILES IN ROOM:\n${files.map(f=>"- "+f).join("\n")}`;
    const r=await askAI(sys,usr,{maxTokens:1200});
    let data=null;
    if(r.text){ try{ data=JSON.parse(r.text.replace(/```json|```/g,"").trim()); }catch(e){} }
    if(!data && state.source==="demo") data=demoReconcile(items);
    if(!data){ res.innerHTML=`<div class="err">Couldn't parse the reconciliation${r.error?(' ('+r.error+')'):''}. Try again, or simplify the checklist.</div>`; b.disabled=false; return; }
    res.innerHTML=reconResultHtml(data, !!r.text); b.disabled=false;
  };
  // auto-run for demo so it's instantly populated
  if(state.source==="demo" && !document.getElementById("recResult").innerHTML.trim()){
    const items=FUND_REQUEST_LIST.map(r=>r.item);
    document.getElementById("recResult").innerHTML=reconResultHtml(demoReconcile(items), false);
  }
}
function demoReconcile(items){
  const present=Object.values(state.docIndex).filter(d=>d.type==="doc");
  const MAP={
    "Certificate of Incorporation":"d7","MoA and AoA":"d10","PAN and GST Certificate":"d8",
    "ROC Filings (last 3 years)":"d15","Shareholding Structure / Cap Table":"d3",
    "Board and Shareholder Resolutions":"d13","Company Deck / Investor Presentation":"d1",
    "Financial Model (3-year projection)":"d2","Latest Monthly Financials":"d30",
    "Historical P&L (3 years)":"d31","Balance Sheet (latest audited)":"d32",
    "Cash Flow Statement":"d33","GST Returns (last 4 quarters)":"d34",
    "TDS Returns (last 4 quarters)":"d35","Audit Reports (last 2 years)":"d36",
    "SKU Profitability / Unit Economics":"d37","Revenue Analytics by Channel":"d28",
    "Customer Cohort and Retention Analysis":"d29","Vendor Partnerships (top 10)":"d27",
    "Warehouse Lease Agreements":"d21","Technology and SaaS Agreements":"d22",
    "Previous Round Documents (SHA, SSA)":"d39","Investor Updates (last 6 months)":"d41",
    "Business Licenses and Permits":"d18","Key Business KPIs Dashboard":"d6"};
  const received=[],missing=[],used=new Set();
  items.forEach(it=>{ const id=MAP[it]; if(id&&state.docIndex[id]){ received.push({item:it,file:state.docIndex[id].name}); used.add(id);} else missing.push(it); });
  const extra=present.filter(d=>!used.has(d.id)).map(d=>d.name);
  return {received,missing,extra};
}
function reconResultHtml(d,live){
  const R=d.received||[],M=d.missing||[],E=d.extra||[];
  return `<div class="card">
    <div class="stats cols-3" style="margin-bottom:16px">
      <div class="stat t-green"><div class="k">Received</div><div class="v green">${R.length}</div><div class="d">matched to files</div></div>
      <div class="stat t-red"><div class="k">Outstanding</div><div class="v red">${M.length}</div><div class="d">to chase the vendor</div></div>
      <div class="stat t-blue"><div class="k">Extra / unrequested</div><div class="v" style="color:var(--blue)">${E.length}</div><div class="d">in room, not on list</div></div></div>
    <div class="recon-grid">
      <div class="recon-col ok"><h4>Received <span class="cnt">${R.length}</span></h4>${R.map(x=>`<div class="recon-item">${I.check}<span>${escapeHtml(x.item)}</span></div>`).join("")||'<p style="font-size:12px;color:var(--muted)">None.</p>'}</div>
      <div class="recon-col miss"><h4>Outstanding <span class="cnt">${M.length}</span></h4>${M.map(x=>`<div class="recon-item">${I.miss}<span>${escapeHtml(x)}</span></div>`).join("")||'<p style="font-size:12px;color:var(--muted)">Nothing outstanding.</p>'}</div>
      <div class="recon-col extra"><h4>Extra in room <span class="cnt">${E.length}</span></h4>${E.map(x=>`<div class="recon-item">${I.plus}<span>${escapeHtml(x.replace(/\.(pdf|xlsx|csv|docx)$/,''))}</span></div>`).join("")||'<p style="font-size:12px;color:var(--muted)">None.</p>'}</div></div>
    <div class="btn-row mt-16"><button class="btn ghost" id="chaserBtn">${I.copy} Draft chaser email for outstanding items</button></div>
    <div id="chaserOut"></div>
    ${srcLine(live)}</div>`;
}

// chaser email (delegated handler since button is injected dynamically)
document.addEventListener("click", async (e)=>{
  const btn=e.target.closest && e.target.closest("#chaserBtn");
  if(!btn) return;
  const out=document.getElementById("chaserOut"); if(!out) return;
  // gather current outstanding from the rendered miss column
  const miss=[...document.querySelectorAll(".recon-col.miss .recon-item span")].map(s=>s.textContent);
  if(!miss.length){ out.innerHTML=`<div class="note">${I.info}<div>Nothing outstanding to chase.</div></div>`; return; }
  out.innerHTML=spinner("Drafting a polite chaser…"); btn.disabled=true;
  const sys=`You are Conditor VDR AI for a Series A investor. Draft a short professional email from the Conditor investment team to the founder's CA/adviser, chasing outstanding due-diligence items for an Indian startup data room. Polite, specific, numbered list. Under 160 words. Markdown.`;
  const r=await askAI(sys,`Outstanding items:\n${miss.map(m=>"- "+m).join("\n")}`,{maxTokens:600});
  const html=r.text?mdToHtml(r.text)+srcLine(true):mdToHtml(FALLBACK.chaser(miss))+srcLine(false);
  out.innerHTML=`<div class="ai-out" style="margin-top:14px">${html}<div class="btn-row mt-12"><button class="btn ghost" onclick="toast('Copied (demo)')">${I.copy} Copy email</button></div></div>`;
  btn.disabled=false;
});

// ============================================================
// DEMO FALLBACK INTELLIGENCE (offline resilience)
// ============================================================
const FLAGGED_DEMO=new Set(["d3","d29","d30","d33","d37","d41"]);
const FALLBACK={
  overview:`**Overview** — Company Deck, Financial Model, Cap Table and Investor FAQ; start here for the investment thesis and headline metrics. FY2024 revenue ₹842 Lakhs, EBITDA ₹56 Lakhs (first profitable year).
**Company and Compliance** — Certificate of Incorporation, PAN, GST, MoA/AoA, ROC filings and shareholding structure; verify clean corporate history with RoC Maharashtra.
**Business and Operations** — Operational workflow, supply chain, product catalogue, vendor partnerships and revenue analytics by channel (D2C 38%, Amazon 35%, Flipkart 21%).
**Financials** — Latest monthly P&L, 3-year historical financials, GST/TDS returns, audit reports and SKU-level unit economics; EBITDA margin expanding from -15% (FY2022) to +6.6% (FY2024).
**Fundraising** — Previous round documents (seed SHA/SSA at ₹20 Cr pre-money), investor updates; proposed Series A ₹20–25 Cr at ₹80–100 Cr pre-money.
**Archive** — Historical documents from pre-seed phase.`,
  flagNarr:`**Key risks (conditions precedent)**
- Customer concentration: top 10% of customers contribute 47% of revenue and top buyer cohort shows rising churn — LTV model may be overstated.
- Marketplace unit economics: Apparel and Electronics on Amazon/Flipkart run negative contribution margins — blended profitability depends on D2C channel scaling as planned.
- GST compliance gap: Q2 and Q3 returns filed late in FY2024 — potential interest and penalty liability; obtain clean-chit certificate from tax counsel before close.

**Diligence / monitoring items**
- Validate FY2025E EBITDA margin expansion assumption (11.6%) — requires D2C mix to reach 42%, which has not yet been demonstrated at scale.
- Confirm working capital line (NBFC ₹25L) terms and renewal; short-term borrowing adds refinancing risk.
- Technology and SaaS agreements include 2 critical platform contracts on monthly rolling terms — negotiate minimum 12-month lock-in as a Series A condition.`,
  summaries:{
    d2:`**Overview** Financial Model covering FY2022 actuals through FY2025E projection (₹ Lakhs).
**Key points**
- Revenue CAGR FY2022–FY2024: 73%; FY2025E target ₹1,280L (+52% YoY).
- EBITDA turned positive in FY2024 at ₹56L (6.6% margin); FY2025E model assumes 11.6%.
- CAC improving: ₹820 (FY2022) → ₹450 (FY2024). LTV:CAC 4.9x.
- D2C channel mix growing: 28% (FY2022) → 38% (FY2024) → 42% (FY2025E).
**Deal considerations**
- EBITDA margin expansion depends on D2C scaling and marketplace SKU rationalisation — verify with actual FY2025 monthly trading data.`,
    d30:`**Overview** Management accounts for March 2026 (latest month) and YTD FY2026.
**Key points**
- March revenue ₹118L; EBITDA ₹14L (11.9% margin) — above the FY2025E model assumption.
- YTD FY2026 revenue ₹1,120L; annualised run-rate ~₹1,416L.
- Gross margin at 44.9% in March, improving from FY2024 average of 42.3%.
**Deal considerations**
- Strong March likely includes year-end inventory clearance — review April trends before anchoring to 11%+ EBITDA margin.`,
    d37:`**Overview** SKU-level contribution margin analysis for FY2024 across top 50 SKUs.
**Key points**
- D2C contribution margin: 21%. Marketplace contribution margin: -28% (electronics), -3% (apparel).
- Blended CM negative on marketplace channel due to commissions + CAC.
- Breakeven D2C volume: ~1,800 units/month at current cost base.
**Deal considerations**
- Recommend restricting marketplace SKU mix or renegotiating platform fees as a Series A condition.`,
  },
  genericSummary(c){ if(!c) return "**Overview** Document summary unavailable offline."; return `**Overview** ${c.title}.
**Key points**
- ${c.body.split("\n").filter(l=>l.trim()).slice(1,5).map(l=>l.trim()).join("\n- ")}
**Deal considerations**
- Review against Conditor's investment thesis for D2C e-commerce and cross-check with the financial workstream.`; },
  extract(id,tmpl){
    const currency=tmpl?tmpl.currency:"₹ Lakhs";
    const title=tmpl?tmpl.name:"P&L Summary";
    const T={
      d2:[["Net Revenue","842"],["Cost of Goods Sold","(486)"],["Gross Profit","356"],["Gross Margin %","42.3%"],["Employee Costs","(128)"],["Marketing & Advertising","(94)"],["Technology & Platform","(31)"],["G&A / Overheads","(47)"],["EBITDA","56"],["EBITDA Margin %","6.6%"],["Depreciation & Amortisation","(18)"],["EBIT","38"],["Finance Costs / Interest","(12)"],["Profit Before Tax","26"],["Tax","(9)"],["Profit After Tax (PAT)","17"]],
      d30:[["Net Revenue","118"],["Cost of Goods Sold","(65)"],["Gross Profit","53"],["Gross Margin %","44.9%"],["Employee Costs","(15)"],["Marketing & Advertising","(11)"],["Technology & Platform","(4)"],["G&A / Overheads","(9)"],["EBITDA","14"],["EBITDA Margin %","11.9%"],["Depreciation & Amortisation","(2)"],["EBIT","12"],["Finance Costs / Interest","(1)"],["Profit Before Tax","11"],["Tax","(4)"],["Profit After Tax (PAT)","7"]],
      d31:[["Net Revenue","842 / 520 / 280"],["Cost of Goods Sold","(486) / (317) / (176)"],["Gross Profit","356 / 203 / 104"],["Gross Margin %","42.3% / 39.0% / 37.1%"],["EBITDA","56 / (28) / (42)"],["EBITDA Margin %","6.6% / -5.4% / -15.0%"],["Profit After Tax (PAT)","17 / (54) / (62)"]],
      d37:[["Avg Selling Price (ASP)","₹1,240"],["Cost of Goods (COGS per unit)","₹(720)"],["Gross Margin per unit","₹520"],["Gross Margin %","42.0%"],["Fulfilment & Logistics cost","₹(145)"],["Marketing / CAC (per unit)","₹(161)"],["Payment Gateway fees","₹(17)"],["Returns & Damage allowance","₹(75)"],["Contribution Margin per unit","₹(89) blended / ₹311 D2C"],["Contribution Margin %","-7.2% blended / 21.0% D2C"],["Breakeven volume (monthly)","1,800 units (D2C only)"]]
    };
    const addBackSet=new Set((tmpl?tmpl.fields:[]).filter(f=>/add.?back/i.test(f)).map(f=>f.toLowerCase()));
    const totalSet=new Set((tmpl?tmpl.fields:[]).filter(f=>/ebitda$|pat$|profit after tax|closing cash|contribution margin %?$|net cash from/i.test(f)&&!/margin %/i.test(f)).map(f=>f.toLowerCase()));
    const rows=T[id]||T.d2;
    const body=rows.map(r=>{
      const il=r[0].toLowerCase();
      const isTotal=totalSet.has(il)||/^ebitda$|^pat$|profit after tax/i.test(r[0]);
      const isAdd=addBackSet.has(il)||/add back/i.test(r[0]);
      return `<tr class="${isTotal?'total':''} ${isAdd?'addback':''}"><td>${r[0]}</td><td class="num">${r[1]}</td></tr>`;
    }).join("");
    const notes={d2:"EBITDA margin 6.6% (FY2024); first profitable year. Series A target ₹1,500L ARR.",d30:"March EBITDA margin 11.9%; annualised run-rate ~₹1,416L.",d31:"FY2024 / FY2023 / FY2022 — EBITDA turning positive in FY2024.",d37:"Marketplace channels are contribution-margin negative; D2C at 21% CM."};
    return `<h4>${escapeHtml(title)} — ${DOC_CONTENT[id]?DOC_CONTENT[id].title:''}</h4><table class="fin"><thead><tr><th>Line item</th><th style="text-align:right">${escapeHtml(currency)}</th></tr></thead><tbody>${body}</tbody></table><p style="font-size:12px;color:var(--muted);margin-top:10px">Note: ${notes[id]||"—"}</p>`;
  },
  chaser(miss){ return `**Subject:** Outstanding due diligence items — BharatKart Commerce Pvt. Ltd.\n\nDear [Adviser],\n\nThank you for the materials uploaded to the data room to date. To progress our Series A diligence, we would be grateful if you could arrange the following outstanding items at your earliest convenience:\n\n${miss.map((m,i)=>`${i+1}. ${m}`).join("\n")}\n\nKindly share these by the end of next week so we can maintain the agreed timeline.\n\nBest regards,\nConditor Capital — Investment Team`; }
};
function navFallback(q){
  const ql=q.toLowerCase();
  const rules=[
    [/financial model|projection|forecast|three.?year/,"d2","The **Financial Model** is in **Overview** — 3-year actuals (FY2022–FY2024) plus FY2025E projection. FY2024 revenue ₹842L, EBITDA ₹56L (6.6% margin)."],
    [/cap.?table|sharehold|founder|dilut|ownership/,"d3","The **Cap Table** is in **Overview** — founders hold 53% combined, Matrix Partners India 20% (seed). Proposed Series A at ₹80–100 Cr pre-money."],
    [/gst.?return|tds|tax.?filing/,"d34","**GST Returns** are in **Financials → Tax Compliance and Banking → Tax Filings**. Note: Q2 and Q3 FY2024 returns were filed late."],
    [/revenue.?analytic|channel|gmv|amazon|flipkart|marketplace/,"d28","**Revenue Analytics** is in **Business and Operations → Sales Growth and Analytics**. FY2024: GMV ₹1,050L, D2C 38%, Amazon 35%, Flipkart 21%."],
    [/cohort|retention|churn|ltv|cac|customer/,"d29","**Customer Cohorts and Retention** is in **Business and Operations → Customer and Retention**. LTV:CAC 4.9x; 6-month retention improving to ~22% for recent cohorts."],
    [/sku|unit.?econ|contribution.?margin|per.?unit/,"d37","**SKU Profitability** is in **Financials → Unit Economics and Working Capital**. D2C CM: 21%; marketplace CM: -28% (electronics). Recommend SKU rationalisation."],
    [/cash.?flow|burn|runway|working.?capital/,"d33","**Cash Flow** is in **Financials → Historical Financials**. FY2024 closing cash ₹74L; free cash flow turned positive at ₹4L."],
    [/balance.?sheet|asset|liabilit|net.?debt/,"d32","**Balance Sheet** is in **Financials → Historical Financials**. Net debt ₹31L (cash ₹74L vs debt ₹105L)."],
    [/p&l|profit.?loss|historical.?financ|three.?year.?p/,"d31","**Historical P&L** is in **Financials → Historical Financials** — FY2022, FY2023, FY2024 side by side."],
    [/monthly.?financ|latest.?month|management.?account/,"d30","**Latest Monthly Financials** are in **Financials → Latest** — March 2026, revenue ₹118L, EBITDA 11.9%."],
    [/previous.?round|sha|ssa|seed|investor.?update/,"d38","**Previous Rounds** and legal docs (SHA, SSA) are in **Fundraising → Fundraising History and Legal**. Seed: ₹5 Cr at ₹20 Cr pre-money (Matrix Partners India)."],
    [/incorporat|pan|gst.?cert|moa|aoa|roc/,"d7","**Certificate of Incorporation**, PAN and GST Certificate are in **Company and Compliance → Corporate and Governance**."],
    [/vendor|supplier|procurement/,"d27","**Vendor Partnerships** is in **Business and Operations → Vendor and Procurement**."],
    [/warehouse|lease|propert/,"d21","**Warehouse Leases** are in **Company and Compliance → Legal and Compliance**."],
    [/audit.?report|statutory.?audit/,"d36","**Audit Reports** are in **Financials → Tax Compliance and Banking → Audit and Compliance**."],
  ];
  for(const [re,id,a] of rules){ if(re.test(ql)) return {answer:a,jumpTo:id}; }

  // Greetings
  if(/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)/i.test(ql))
    return {answer:"Hello! I'm Conditor VDR AI. Ask me where to find a document in this data room, or try the tabs above — **Summarise** reads individual files, **Financial Extract** extracts financials into a template, and **Inconsistencies** flags risks across the room.",jumpTo:null};

  // Thanks
  if(/^(thanks|thank you|cheers|great|perfect|brilliant)/i.test(ql))
    return {answer:"Happy to help. Let me know if you need anything else from the data room.",jumpTo:null};

  // Investment / deal questions with no matching doc
  if(/valuation|multiple|irr|return|exit|entry|deal|ebitda|series.?a|venture|due diligence/i.test(ql))
    return {answer:"That sounds deal-related. Try the **Financial Model** in Overview or **Latest Monthly Financials** in the sidebar, then use the **Financial Extract** tab to map figures into a template.",jumpTo:"d2"};

  return {answer:"I'm not sure where that is in the data room. Try rephrasing, or use the **Navigate & Ask** tab for AI-powered answers to any question.",jumpTo:null};
}

// ============================================================
// BOOT
// ============================================================
function bootDemo(){
  state.source="demo"; state.search=""; state.selectedDoc=null; state.aiResults={}; state.contentCache={}; state.liveFlags=null; state.chat=[];
  state.selectedTemplate="tpl_pnl_india"; state.customTemplates=[]; state.showUploadModal=false; state.uploadPreview=null;
  state.expanded={root:true,f1:true,f2:false,f2a:false,f2b:false,f3:false,f3a:false,f3b:false,f3b1:false,f3b2:false,f3c:false,f3c1:false,f3c2:false,f4:true,f4a:false,f4b:false,f4c:false,f4c1:false,f4c2:false,f4d:false,f5:false,f5a:false,f5b:false,f6:false};
  buildIndex(JSON.parse(JSON.stringify(TREE)));
  state.tab="overview"; render();
}
bootDemo();
if(!localStorage.getItem("conditor_tour_done")) setTimeout(startTour, 500);

// ============================================================
// ONBOARDING TOUR
// ============================================================
const TOUR_STEPS = [
  {
    title: "Welcome to Conditor VDR AI",
    body: "Conditor helps investment teams navigate Virtual Data Rooms more efficiently — reducing manual work around document navigation, information retrieval, and financial formatting. This quick tour covers the six core workflows.",
    anchor: null,
  },
  {
    title: "Your Data Room",
    body: "The left panel shows the full document tree for the deal room. In demo mode you're exploring BharatKart Commerce — a fictional Indian D2C e-commerce startup under Series A diligence. Connect Google Drive to load a real deal.",
    anchor: ".side", pos: "right",
  },
  {
    title: "Six Workflows",
    body: "Each tab unlocks a different AI workflow. Jump between them at any point — your AI results and chat history are preserved across tabs throughout your session.",
    anchor: ".tabs", pos: "bottom",
  },
  {
    title: "Data Room Overview",
    body: "An AI-generated snapshot of the entire deal — document counts by category, deal metrics, and a structured narrative to orient your investment team before deep-dive diligence.",
    anchor: ".tabs .tab:nth-child(1)", pos: "bottom",
  },
  {
    title: "Natural Language Search",
    body: "Ask questions like 'Find the latest management accounts' or 'What is the customer concentration for this business?' and the AI locates relevant documents instantly.",
    anchor: ".tabs .tab:nth-child(2)", pos: "bottom",
  },
  {
    title: "AI Document Summaries",
    body: "Select any document from the left panel and get an AI summary in seconds — covering key clauses, financial figures, risks, and management commentary.",
    anchor: ".tabs .tab:nth-child(3)", pos: "bottom",
  },
  {
    title: "Financial Data Extraction",
    body: "Extract financial data into a chosen template — pick from 5 pre-built templates (P&L, EBITDA bridge, unit economics, cash flow, revenue analytics) or upload your own CSV/JSON template.",
    anchor: ".tabs .tab:nth-child(4)", pos: "bottom",
  },
  {
    title: "Inconsistency Detection",
    body: "Cross-references documents to surface conflicts across management accounts, forecasts, and presentations — so risks are flagged before they surface in deal meetings.",
    anchor: ".tabs .tab:nth-child(5)", pos: "bottom",
  },
  {
    title: "Deal Checklist Reconciliation",
    body: "Paste your diligence request list or Deal Binder checklist and instantly see which documents are present, missing, duplicated, or additional in the data room.",
    anchor: ".tabs .tab:nth-child(6)", pos: "bottom",
  },
  {
    title: "Connect Your Own Deal",
    body: "Ready to run Conditor on a real deal? Click 'Connect Google Drive' to link a folder and let the AI work against your own data room. Or keep exploring in demo mode.",
    anchor: ".connect", pos: "left",
  },
];

const tour = { active: false, step: 0 };

function startTour(){
  tour.active = true;
  tour.step = 0;
  renderTourStep();
}

function endTour(){
  tour.active = false;
  const el = document.getElementById("tour-wrap");
  if(el) el.remove();
  localStorage.setItem("conditor_tour_done", "1");
}

function tourNext(){
  if(tour.step >= TOUR_STEPS.length - 1){ endTour(); return; }
  tour.step++;
  renderTourStep();
}

function tourPrev(){
  if(tour.step <= 0) return;
  tour.step--;
  renderTourStep();
}

function renderTourStep(){
  let wrap = document.getElementById("tour-wrap");
  if(wrap) wrap.remove();
  if(!tour.active) return;

  const step = TOUR_STEPS[tour.step];
  const isLast = tour.step === TOUR_STEPS.length - 1;
  const isFirst = tour.step === 0;
  const pct = Math.round(((tour.step + 1) / TOUR_STEPS.length) * 100);

  wrap = document.createElement("div");
  wrap.id = "tour-wrap";
  wrap.style.cssText = "position:fixed;inset:0;z-index:200;pointer-events:none";

  const navHtml = `
    <div class="tour-progress"><div class="tour-progress-bar" style="width:${pct}%"></div></div>
    <div class="tour-btns">
      <span class="tour-counter">${tour.step + 1} / ${TOUR_STEPS.length}</span>
      <button class="tour-btn skip" onclick="endTour()">Skip</button>
      ${!isFirst ? `<button class="tour-btn sec" onclick="tourPrev()">Back</button>` : ""}
      <button class="tour-btn prim" onclick="tourNext()">${isLast ? "Finish ✓" : "Next →"}</button>
    </div>`;

  if(!step.anchor){
    // Centered welcome modal
    wrap.innerHTML = `
      <div class="tour-center-bg"></div>
      <div class="tour-tip center" style="pointer-events:all">
        <div class="tour-welcome-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="tour-eyebrow">Getting started</div>
        <div class="tour-title">${step.title}</div>
        <div class="tour-body">${step.body}</div>
        ${navHtml}
      </div>`;
  } else {
    const target = document.querySelector(step.anchor);
    if(!target){ tourNext(); return; }

    const rect = target.getBoundingClientRect();
    const pad = 7;
    const sr = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };

    const TIP_W = 320;
    let tipStyle = "", arrowClass = "";

    if(step.pos === "bottom"){
      const tipTop = sr.top + sr.height + 16;
      let tipLeft = sr.left + sr.width / 2 - TIP_W / 2;
      tipLeft = Math.max(16, Math.min(tipLeft, window.innerWidth - TIP_W - 16));
      // Clamp arrow to follow real center
      const arrowOff = Math.round(sr.left + sr.width / 2 - tipLeft);
      tipStyle = `top:${tipTop}px;left:${tipLeft}px;width:${TIP_W}px;--arrow-left:${arrowOff}px`;
      arrowClass = "arrow-top";
    } else if(step.pos === "right"){
      const tipLeft = sr.left + sr.width + 16;
      const tipTop = Math.max(16, sr.top + sr.height / 2 - 110);
      tipStyle = `top:${tipTop}px;left:${tipLeft}px;width:${TIP_W}px`;
      arrowClass = "arrow-left";
    } else if(step.pos === "left"){
      const tipLeft = Math.max(16, sr.left - TIP_W - 16);
      const tipTop = Math.max(16, sr.top + sr.height / 2 - 110);
      tipStyle = `top:${tipTop}px;left:${tipLeft}px;width:${TIP_W}px`;
      arrowClass = "arrow-right";
    }

    wrap.innerHTML = `
      <div class="tour-spotlight" style="top:${sr.top}px;left:${sr.left}px;width:${sr.width}px;height:${sr.height}px"></div>
      <div class="tour-tip ${arrowClass}" style="${tipStyle};pointer-events:all">
        <div class="tour-eyebrow">Step ${tour.step + 1} of ${TOUR_STEPS.length}</div>
        <div class="tour-title">${step.title}</div>
        <div class="tour-body">${step.body}</div>
        ${navHtml}
      </div>`;
  }

  document.body.appendChild(wrap);
}
