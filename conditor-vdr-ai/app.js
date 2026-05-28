// ============================================================
// Conditor VDR AI — Frontend
// Works in two modes:
//   • DEMO   — built-in Project Meridian data (no setup needed)
//   • DRIVE  — your real Google Drive (after you add a Client ID)
// AI runs through the backend at /api/ai (Gemini, free tier).
// ============================================================

const CONFIG = {
  // Paste your Google OAuth Client ID here (or set window.CONDITOR_CLIENT_ID before this script).
  // Leave blank to run in demo mode.
  GOOGLE_CLIENT_ID: (typeof window !== "undefined" && window.CONDITOR_CLIENT_ID) || "233514743688-mmdflh9g85mnbsf7ebc3j0ptc67c4ukk.apps.googleusercontent.com",
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
  app.innerHTML = `${topbar()}<div class="body">${sidePanel()}<div class="work">${tabBar()}<div class="canvas"><div class="view" id="view"></div></div></div></div>${state.showConnect?connectModal():""}`;
  renderView(); bindSide(); bindModal();
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
      <div class="provider"><span class="d"></span>${CONFIG.AI_PROVIDER_LABEL} · AI Engine</div>
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
// FEATURE 1: OVERVIEW
// ============================================================
function countDocs(node){ if(!node) return 0; let n=0; (node.children||[]).forEach(c=> n += c.type==="folder"?countDocs(c):1); return n; }
function viewOverview(){
  const isDemo=state.source==="demo";
  const total=countDocs(state.tree);
  const folders=(state.tree&&state.tree.children)?state.tree.children.filter(c=>c.type==="folder").length:0;
  const statBlock = isDemo ? `
    <div class="stats">
      <div class="stat"><div class="k">Documents</div><div class="v">${total}</div><div class="d">across ${folders} workstreams</div></div>
      <div class="stat"><div class="k">Open Flags</div><div class="v red">${DEMO_FLAGS.length}</div><div class="d">inconsistencies</div></div>
      <div class="stat"><div class="k">Checklist</div><div class="v amber">2</div><div class="d">items outstanding</div></div>
      <div class="stat"><div class="k">Jurisdiction</div><div class="v sm">${DEAL.jurisdiction}</div><div class="d">FRS 102</div></div>
    </div>` : `
    <div class="stats">
      <div class="stat"><div class="k">Top-level items</div><div class="v">${(state.tree&&state.tree.children)?state.tree.children.length:'…'}</div><div class="d">in this folder</div></div>
      <div class="stat"><div class="k">Folders</div><div class="v">${folders}</div><div class="d">workstreams</div></div>
      <div class="stat"><div class="k">Source</div><div class="v sm green">Google Drive</div><div class="d">live, read-only</div></div>
      <div class="stat"><div class="k">AI engine</div><div class="v sm">${CONFIG.AI_PROVIDER_LABEL}</div><div class="d">via backend</div></div>
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
      <h3><span class="num">AI</span> Hierarchy summary — what's where</h3>
      <p style="color:var(--muted);font-size:13px">A short orientation to each part of the room, generated from its structure.</p>
      <div id="ovOut">${state.aiResults.overview?`<div class="ai-out">${state.aiResults.overview}</div>`:''}</div>
      <div class="btn-row" style="margin-top:14px">
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
  const cat=Object.values(state.docIndex).filter(d=>d.type==="doc").map(d=>`[${d.id}] ${nodePath(d.id)}`).join("\n");
  const history=state.chat.slice(-6).map(m=>`${m.role==="user"?"User":"Assistant"}: ${m.text}`).join("\n");
  const sys=`You are Conditor VDR AI, a smart assistant for Conditor Capital, a London growth-capital PE firm. You help deal teams navigate data rooms, answer questions about deals, and discuss private equity topics. You are friendly and conversational but sharp and professional.

You have access to a data room with these documents:
${cat||"(no documents loaded yet)"}

Conversation history:
${history}

For every message decide whether the user is:
A) Looking for a specific document → reply with ANSWER and DOC
B) Asking a general question, greeting, or discussing PE/deals → reply with just ANSWER (no DOC line needed)

Always reply in this format:
ANSWER: <your response in British English — conversational for chat, precise for navigation>
DOC: <[id] of the best matching document, or NONE if not applicable>`;
  const r=await askAI(sys,`USER: ${q}`,{maxTokens:400});
  let answer,jumpTo=null;
  if(r.text){ const m=r.text.match(/ANSWER:\s*([\s\S]*?)\s*(?:DOC:\s*(\S+))?$/i);
    if(m){ answer=m[1].trim(); const rawId=(m[2]||"").replace(/[\[\]]/g,""); if(rawId&&rawId!=="NONE"&&state.docIndex[rawId]&&state.docIndex[rawId].type==="doc") jumpTo=rawId; } else answer=r.text.trim(); }
  if(!answer){ if(state.source==="demo"){ const fb=navFallback(q); answer=fb.answer; jumpTo=fb.jumpTo; } else answer=`I couldn't reach the AI backend (${r.error}). I can still help once the backend is live — or browse the tree on the left.`; }
  document.getElementById("navPending")?.remove();
  state.chat.push({role:"ai",text:answer,jumpTo}); state.busy=false; renderView();
}

// ============================================================
// FEATURE 3: SUMMARISE
// ============================================================
function viewSummarise(){
  const id=state.selectedDoc;
  if(!id||!state.docIndex[id]||state.docIndex[id].type!=="doc")
    return emptyState(I.doc,"Select a document","Pick a file from the data room on the left, or use Navigate to find one.");
  const d=state.docIndex[id];
  const cached=state.aiResults["sum_"+id];
  return `<div>
    <div class="page-h"><div class="eyebrow">${I.doc} Document Summary</div>
      <h2>${escapeHtml(d.name.replace(/\.(pdf|xlsx|docx|csv)$/,""))}</h2>
      <p>${escapeHtml(nodePath(id))}${d.size?' · '+d.size:''}${d.modified?' · modified '+d.modified:''}</p></div>
    <div class="card">
      <div class="doc-bar"><span class="ic">${docIcon(d)}</span><span class="fname">${escapeHtml(d.name)}</span></div>
      <div id="docPreview"></div>
      <div class="btn-row" style="margin-top:14px">
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
function financialCandidates(){
  return Object.values(state.docIndex).filter(d=>d.type==="doc" && (
    /account|financ|p&l|profit|ebitda|management|budget|balance/i.test(d.name) ||
    (d.mimeType||"").includes("spreadsheet") || /\.(xlsx|csv)$/.test(d.name)
  ));
}
function viewExtract(){
  const cands=state.source==="demo"?["d6","d7","d8","d9"].map(i=>state.docIndex[i]):financialCandidates();
  let cur=state.selectedDoc && cands.find(c=>c.id===state.selectedDoc) ? state.selectedDoc : (cands[0]&&cands[0].id);
  const cached=cur?state.aiResults["ext_"+cur]:null;
  return `<div>
    <div class="page-h"><div class="eyebrow">${I.calc} Financial Template Extraction</div>
      <h2>Reformat to Conditor's EBITDA template</h2>
      <p>Statutory accounts rarely show EBITDA directly — it's derived. Pick a source document and the AI maps the figures into Conditor's internal Adjusted EBITDA bridge.</p></div>
    <div class="card"><h3><span class="num">1</span> Source financial document</h3>
      ${cands.length?`<div class="tmpl-list">${cands.slice(0,8).map(c=>`<div class="tmpl-opt ${cur===c.id?'sel':''}" data-fin="${c.id}">
        <div class="ti">${docIcon(c)}</div><div class="tt"><b>${escapeHtml(c.name.replace(/\.(pdf|xlsx|csv|docx)$/,''))}</b><span>${escapeHtml(nodePath(c.id))}</span></div>
        ${cur===c.id?`<span class="mono" style="color:var(--gold-dim);font-size:11px;font-weight:600">SELECTED</span>`:""}</div>`).join("")}</div>`
        :`<div class="note">${I.info}<div>No obvious financial files detected in this room. Open any document with figures and it can still be extracted.</div></div>`}
    </div>
    <div class="card"><h3><span class="num">2</span> Conditor Adjusted EBITDA template</h3>
      <div class="mono" style="font-size:11.5px;color:var(--muted);background:var(--card2);border:1px solid var(--line);border-radius:7px;padding:12px">${EBITDA_TEMPLATE_FIELDS.map(f=>"• "+f).join("<br>")}</div>
      <div class="btn-row" style="margin-top:14px"><button class="btn gold" id="extGen" ${cur?'':'disabled'}>${I.spark} Extract & fill template</button></div>
      <div id="extOut">${cached||""}</div>
    </div></div>`;
}
function bindExtract(){
  document.querySelectorAll("[data-fin]").forEach(el=> el.onclick=()=>{ state.selectedDoc=el.dataset.fin; renderView(); });
  const b=document.getElementById("extGen"); if(!b) return;
  b.onclick=async ()=>{
    const id=state.selectedDoc; const out=document.getElementById("extOut");
    out.innerHTML=spinner("Mapping figures into the EBITDA bridge…"); b.disabled=true;
    const txt=await getDocText(id);
    if(!txt){ out.innerHTML=`<div class="err">No readable figures in this file.</div>`; b.disabled=false; return; }
    const sys=`You are Conditor VDR AI for a UK PE fund. Extract figures from the source and populate Conditor's Adjusted EBITDA template. Reply ONLY as a markdown table, columns "Line item" and "£'000". Rows in order: Revenue; Gross Profit; Operating Profit (EBIT); Add back: Depreciation; Add back: Amortisation; Reported EBITDA; Add back: Exceptional / restructuring; Add back: Owner discretionary; Adjusted EBITDA. EBITDA = EBIT + Depreciation + Amortisation. Use 0 if an item isn't present. After the table add one line starting "Note:" giving the EBITDA margin %.`;
    const r=await askAI(sys,`SOURCE: ${state.docIndex[id].name}\n\n${txt.slice(0,16000)}`,{maxTokens:700});
    let html;
    if(r.text) html=renderFinTable(r.text)+srcLine(true);
    else if(state.source==="demo") html=FALLBACK.extract(id)+srcLine(false);
    else html=`<div class="err">AI backend error: ${r.error}.</div>`;
    if(r.text||state.source==="demo") state.aiResults["ext_"+id]=`<div class="ai-out" style="border-left-color:var(--green)">${html}<div class="btn-row" style="margin-top:14px"><button class="btn ghost" onclick="toast('Export to Excel — available when deployed')">${I.download} Export to Excel</button></div></div>`;
    out.innerHTML=state.aiResults["ext_"+id]||`<div class="ai-out">${html}</div>`; b.disabled=false;
  };
}
function renderFinTable(md){
  const rows=md.split("\n").filter(l=>l.includes("|")&&!/^\s*\|?[\s:\-|]+\|?\s*$/.test(l));
  if(rows.length<2) return mdToHtml(md);
  let body="",note="";
  rows.forEach((l,i)=>{ const cells=l.split("|").map(c=>c.trim()).filter(c=>c!==""); if(cells.length<2||i===0) return;
    const item=cells[0],val=cells[1]; if(/line item|header/i.test(item)) return;
    const isTotal=/adjusted ebitda|reported ebitda/i.test(item), isAdd=/add back/i.test(item);
    body+=`<tr class="${isTotal?'total':''} ${isAdd?'addback':''}"><td>${escapeHtml(item)}</td><td class="num">${escapeHtml(val)}</td></tr>`; });
  const nm=md.match(/Note:.*/i); if(nm) note=`<p style="font-size:12px;color:var(--muted);margin-top:10px">${escapeHtml(nm[0])}</p>`;
  return `<h4>Conditor Adjusted EBITDA — extracted</h4><table class="fin"><thead><tr><th>Line item</th><th style="text-align:right">£'000</th></tr></thead><tbody>${body}</tbody></table>${note}`;
}

// ============================================================
// FEATURE 5: INCONSISTENCIES / FLAGS
// ============================================================
const DEMO_FLAGS=[
  {sev:"high",title:"Change-of-control triggers in two material agreements",
   body:"Brookfield NHS Trust contract (£3.2m/yr, 14.6% of revenue) and the NatWest bank facility both contain change-of-control clauses. The facility becomes immediately repayable on completion unless consent is obtained — a condition precedent.",
   loc:"03. Commercial / Top 20 Customer Contracts · 06. Material Contracts / Bank Facility Agreement",docs:["d11","d20"]},
  {sev:"high",title:"Customer concentration above Conditor's screening threshold",
   body:"Top-1 customer (Brookfield NHS) is 14.6% of FY2024 revenue, exceeding Conditor's internal 12% threshold, and is also the source of the growing 90+ day debtor balance.",
   loc:"03. Commercial / Customer Concentration Analysis",docs:["d12","d10"]},
  {sev:"high",title:"Leeds site lease expiry + landlord redevelopment notice",
   body:"Leeds depot lease expires Jul 2026 with no renewal option, and a landlord redevelopment notice has been received. ~70 staff are based there — operational continuity risk inside 8 months of completion.",
   loc:"06. Material Contracts / Property Leases",docs:["d19","d14"]},
  {sev:"med",title:"Aged debtor balance deteriorating",
   body:"90+ day debtors rose from £210k (Jun) to £510k (Oct), of which £310k sits with a single customer. Potential bad-debt / working-capital adjustment to completion accounts.",
   loc:"02. Financial Information / Aged Debtors & Creditors",docs:["d10"]},
  {sev:"med",title:"Missing FD service agreement",
   body:"FD R. Patel is listed as a key person in the census but no signed service agreement is in the room. Key-person retention and restrictive-covenant exposure.",
   loc:"04. HR & Pensions / Key Employee Service Agreements",docs:["d15","d14"]},
  {sev:"low",title:"EBITDA quality — add-backs require diligence",
   body:"FY2024 includes a £180k restructuring exceptional and a £95k owner-discretionary add-back. Both inflate Adjusted EBITDA and should be validated by FDD before being credited in valuation.",
   loc:"02. Financial Information / Audited Accounts FY2024 · Management Accounts",docs:["d7","d8"]},
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
    <div class="stats" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat"><div class="k">High severity</div><div class="v red">${c.high}</div><div class="d">deal-impacting</div></div>
      <div class="stat"><div class="k">Medium</div><div class="v amber">${c.med}</div><div class="d">diligence required</div></div>
      <div class="stat"><div class="k">Low / quality</div><div class="v" style="color:var(--blue)">${c.low}</div><div class="d">noting items</div></div></div>
    <div class="card"><div class="btn-row" style="margin-bottom:14px">
      <button class="btn gold" id="flagGen">${I.spark} AI narrative for IC paper</button>
      <button class="btn ghost" onclick="toast('Export — available when deployed')">${I.download} Export red-flag report</button></div>
      <div id="flagNarr">${state.aiResults.flagNarr?`<div class="ai-out">${state.aiResults.flagNarr}</div>`:''}</div></div>
    ${DEMO_FLAGS.map(f=>flagCard(f)).join("")}</div>`;
}
function flagCard(f){
  return `<div class="flag ${f.sev}"><span class="sev">${f.sev==="high"?"HIGH":f.sev==="med"?"MED":"LOW"}</span>
    <div class="ftxt"><b>${escapeHtml(f.title)}</b><span>${escapeHtml(f.body)}</span>
    ${f.loc?`<span class="floc">${escapeHtml(f.loc)}</span>`:""}
    ${(f.docs||[]).filter(d=>state.docIndex[d]).map(d=>`<button class="jump" style="margin-right:6px" onclick="openDoc('${d}')">${I.jump} ${escapeHtml(state.docIndex[d].name)}</button>`).join("")}</div></div>`;
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
    const sys=`You are Conditor VDR AI for a UK PE fund. Write a concise IC-paper risk narrative, British English. Group into **Key risks (conditions precedent)** and **Diligence / monitoring items**. Reference specifics. Under 200 words. Markdown.`;
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
    const sys=`You are Conditor VDR AI for a UK PE fund. Review these data-room documents and flag inconsistencies, risks, and missing detail a buyer should worry about. For each, output markdown: a bullet starting with **[HIGH]**, **[MED]** or **[LOW]**, the issue in one sentence, and which file it relates to. British English. Up to 8 flags.`;
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
    <div class="card"><h3><span class="num">1</span> Your request checklist <span style="font-weight:400;color:var(--muted);font-size:12px">(one item per line)</span></h3>
      <textarea class="checklist-edit" id="checklist">${escapeHtml(defaultChecklist())}</textarea>
      <div class="btn-row" style="margin-top:12px"><button class="btn gold" id="recRun">${I.spark} Reconcile against the room</button></div>
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
  const MAP={"Certificate of Incorporation":"d1","Articles of Association":"d2","Statutory Registers":"d3","Cap Table":"d4",
    "Audited Accounts (last 3 years)":"d7","Management Accounts (YTD)":"d8","Budget / Forecast":"d9","Aged Debtors & Creditors":"d10",
    "Top Customer Contracts":"d11","Customer Concentration Analysis":"d12","Employee Census & Org Chart":"d14",
    "Key Employee Service Agreements":"d15","Pension Scheme Summary":"d16","Corporation Tax Computations":"d17",
    "VAT Returns":"d18","Property Leases":"d19","Bank Facility Agreement":"d20","Insurance Policies":"d21"};
  const received=[],missing=[],used=new Set();
  items.forEach(it=>{ const id=MAP[it]; if(id&&state.docIndex[id]){ received.push({item:it,file:state.docIndex[id].name}); used.add(id);} else missing.push(it); });
  const extra=present.filter(d=>!used.has(d.id)).map(d=>d.name);
  return {received,missing,extra};
}
function reconResultHtml(d,live){
  const R=d.received||[],M=d.missing||[],E=d.extra||[];
  return `<div class="card">
    <div class="stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      <div class="stat"><div class="k">Received</div><div class="v green">${R.length}</div><div class="d">matched to files</div></div>
      <div class="stat"><div class="k">Outstanding</div><div class="v red">${M.length}</div><div class="d">to chase the vendor</div></div>
      <div class="stat"><div class="k">Extra / unrequested</div><div class="v" style="color:var(--blue)">${E.length}</div><div class="d">in room, not on list</div></div></div>
    <div class="recon-grid">
      <div class="recon-col ok"><h4>Received <span class="cnt">${R.length}</span></h4>${R.map(x=>`<div class="recon-item">${I.check}<span>${escapeHtml(x.item)}</span></div>`).join("")||'<p style="font-size:12px;color:var(--muted)">None.</p>'}</div>
      <div class="recon-col miss"><h4>Outstanding <span class="cnt">${M.length}</span></h4>${M.map(x=>`<div class="recon-item">${I.miss}<span>${escapeHtml(x)}</span></div>`).join("")||'<p style="font-size:12px;color:var(--muted)">Nothing outstanding.</p>'}</div>
      <div class="recon-col extra"><h4>Extra in room <span class="cnt">${E.length}</span></h4>${E.map(x=>`<div class="recon-item">${I.plus}<span>${escapeHtml(x.replace(/\.(pdf|xlsx|csv|docx)$/,''))}</span></div>`).join("")||'<p style="font-size:12px;color:var(--muted)">None.</p>'}</div></div>
    <div class="btn-row" style="margin-top:16px"><button class="btn ghost" id="chaserBtn">${I.copy} Draft chaser email for outstanding items</button></div>
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
  const sys=`You are Conditor VDR AI for a UK PE fund. Draft a short professional email (British English) from the Conditor deal team to the vendor's corporate finance adviser, chasing outstanding due-diligence items. Polite, specific, numbered list. Under 160 words. Markdown.`;
  const r=await askAI(sys,`Outstanding items:\n${miss.map(m=>"- "+m).join("\n")}`,{maxTokens:600});
  const html=r.text?mdToHtml(r.text)+srcLine(true):mdToHtml(FALLBACK.chaser(miss))+srcLine(false);
  out.innerHTML=`<div class="ai-out" style="margin-top:14px">${html}<div class="btn-row" style="margin-top:12px"><button class="btn ghost" onclick="toast('Copied (demo)')">${I.copy} Copy email</button></div></div>`;
  btn.disabled=false;
});

// ============================================================
// DEMO FALLBACK INTELLIGENCE (offline resilience)
// ============================================================
const FLAGGED_DEMO=new Set(["d10","d11","d12","d15","d19","d20"]);
const FALLBACK={
  overview:`**01. Corporate & Legal** — Constitutional documents, statutory registers and the cap table; verify ownership, the Marlow Ventures liquidation preference and the 75% drag threshold.
**02. Financial Information** — Two years of FRS 102 audited accounts plus YTD management accounts and the FY2026 budget; build the Adjusted EBITDA bridge here.
**03. Commercial** — Customer contracts and concentration; prioritise the Brookfield NHS dependency and change-of-control consents.
**04. HR & Pensions** — Census, key service agreements and a low-risk DC pension; note the missing FD agreement.
**05. Tax** — Corporation tax computations and VAT returns; standard clearance review.
**06. Material Contracts** — Property leases, the NatWest facility and insurance; the Leeds lease and the facility's change-of-control clause are priority items.`,
  flagNarr:`**Key risks (conditions precedent)**
- Change-of-control consents required from Brookfield NHS Trust and NatWest; the facility is repayable on completion absent consent.
- Customer concentration (Brookfield 14.6%) exceeds Conditor's 12% threshold and overlaps with deteriorating debtors.
- Leeds lease expires Jul 2026 with a redevelopment notice; secure alternative premises pre-completion.

**Diligence / monitoring items**
- Validate FY2024 add-backs (£180k restructuring, £95k owner discretionary) via FDD before crediting EBITDA.
- Obtain the FD's signed service agreement and confirm restrictive covenants.
- Track the 90+ day debtor build (£510k) for a working-capital adjustment.`,
  summaries:{
    d7:`**Overview** FY2024 statutory accounts (FRS 102, unqualified).
**Key points**
- Revenue £21.86m, up 18.7% on FY2023.
- Operating profit £3.15m; PBT £2.74m.
- Reported EBITDA ≈ £4.03m.
- Includes a £180k restructuring exceptional (Leeds).
**Deal considerations**
- The £180k exceptional is an add-back to normalise EBITDA — validate via FDD.`,
    d20:`**Overview** NatWest commercial term facility, £2.4m outstanding.
**Key points**
- Amortising, matures 2028, SONIA + 3.1%.
- Covenants: net debt/EBITDA ≤ 2.5x; interest cover ≥ 4.0x.
**Deal considerations**
- **Change-of-control clause makes the facility immediately repayable on completion** unless consent is obtained.`,
    d11:`**Overview** Top 20 customer contract summary.
**Key points**
- Brookfield NHS £3.2m/yr — change-of-control consent required.
- Two top contracts expire within 12 months.
**Deal considerations**
- Brookfield consent is a key CP; near-term renewal risk.`,
  },
  genericSummary(c){ if(!c) return "**Overview** Document summary unavailable offline."; return `**Overview** ${c.title}.
**Key points**
- ${c.body.split("\n").filter(l=>l.trim()).slice(1,5).map(l=>l.trim()).join("\n- ")}
**Deal considerations**
- Review against Conditor's thesis and cross-check with the financial workstream.`; },
  extract(id){
    const T={d6:[["Revenue","18,420"],["Gross Profit","6,470"],["Operating Profit (EBIT)","2,260"],["Add back: Depreciation","610"],["Add back: Amortisation","140"],["Reported EBITDA","3,010"],["Add back: Exceptional / restructuring","0"],["Add back: Owner discretionary","0"],["Adjusted EBITDA","3,010"]],
      d7:[["Revenue","21,860"],["Gross Profit","8,140"],["Operating Profit (EBIT)","3,150"],["Add back: Depreciation","720"],["Add back: Amortisation","160"],["Reported EBITDA","4,030"],["Add back: Exceptional / restructuring","180"],["Add back: Owner discretionary","0"],["Adjusted EBITDA","4,210"]],
      d8:[["Revenue (10m)","19,340"],["Gross Profit","7,540"],["Operating Profit (EBIT)","3,230"],["Add back: Depreciation","640"],["Add back: Amortisation","140"],["Reported EBITDA","4,010"],["Add back: Exceptional / restructuring","0"],["Add back: Owner discretionary","95"],["Adjusted EBITDA","4,105"]],
      d9:[["Revenue","25,500"],["Gross Profit","10,073"],["Operating Profit (EBIT)","3,720"],["Add back: Depreciation","760"],["Add back: Amortisation","160"],["Reported EBITDA","4,640"],["Add back: Exceptional / restructuring","0"],["Add back: Owner discretionary","0"],["Adjusted EBITDA","4,640"]]};
    const rows=T[id]||T.d7;
    const body=rows.map(r=>{ const t=/adjusted ebitda|reported ebitda/i.test(r[0]),a=/add back/i.test(r[0]);
      return `<tr class="${t?'total':''} ${a?'addback':''}"><td>${r[0]}</td><td class="num">${r[1]}</td></tr>`; }).join("");
    const mg={d6:"16.3%",d7:"19.3%",d8:"21.2% (annualised)",d9:"18.2%"};
    return `<h4>Conditor Adjusted EBITDA — ${DOC_CONTENT[id]?DOC_CONTENT[id].title:''}</h4><table class="fin"><thead><tr><th>Line item</th><th style="text-align:right">£'000</th></tr></thead><tbody>${body}</tbody></table><p style="font-size:12px;color:var(--muted);margin-top:10px">Note: Adjusted EBITDA margin ≈ ${mg[id]||"—"}.</p>`;
  },
  chaser(miss){ return `**Subject:** Outstanding due diligence items\n\nDear [Adviser],\n\nThank you for the materials uploaded to date. To progress our diligence, please could you arrange for the following outstanding items:\n\n${miss.map((m,i)=>`${i+1}. ${m}`).join("\n")}\n\nWe would be grateful to receive these by the end of next week to keep to the agreed timetable.\n\nKind regards,\nConditor Capital — Deal Team`; }
};
function navFallback(q){
  const ql=q.toLowerCase();
  const rules=[
    [/audit|accounts|fy20|ebitda|p&l|profit/,"d7","The audited figures are in **Audited Accounts FY2024** under 02. Financial Information. FY2024 revenue is £21.86m with reported EBITDA ~£4.03m."],
    [/change.?of.?control|consent/,"d20","Change-of-control provisions appear in the **Bank Facility Agreement** (repayable on completion without consent) and the Brookfield NHS customer contract."],
    [/concentration|customer/,"d12","See **Customer Concentration Analysis** in 03. Commercial — top-1 customer is 14.6%, above Conditor's 12% threshold."],
    [/cap.?table|sharehold|ownership/,"d4","The **Cap Table — Nov 2025** is in 01. Corporate & Legal; founder holds 52%, Marlow Ventures 22%."],
    [/bank|facility|loan|debt|covenant/,"d20","The **Bank Facility Agreement** is in 06. Material Contracts — £2.4m NatWest term loan with a change-of-control clause."],
    [/lease|propert|site/,"d19","**Property Leases** is in 06. Material Contracts; note the Leeds lease expires Jul 2026 with a redevelopment notice."],
    [/debtor|credit|aged|working capital/,"d10","**Aged Debtors & Creditors** is in 02. Financial Information; the 90+ day balance has grown to £510k."],
    [/employee|staff|hr|headcount|org/,"d14","**Employee Census & Org Chart** is in 04. HR & Pensions — 238 headcount across three sites."],
    [/pension/,"d16","**Pension Scheme Summary** is in 04. HR & Pensions — a low-risk DC auto-enrolment scheme."],
    [/tax|vat|corporation/,"d17","Tax materials are in 05. Tax — corporation tax computations and VAT returns."],
    [/budget|forecast|plan/,"d9","The **FY2026 Budget & Forecast** is in 02. Financial Information — £25.5m revenue target."],
    [/article|incorporat|register|constitut/,"d2","Constitutional documents are in 01. Corporate & Legal."],
  ];
  for(const [re,id,a] of rules){ if(re.test(ql)) return {answer:a,jumpTo:id}; }

  // Greetings
  if(/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)/i.test(ql))
    return {answer:"Hello! I'm Conditor VDR AI. Ask me where to find a document in this data room, or try the tabs above — **Summarise** reads individual files, **Financial Extract** builds an EBITDA bridge, and **Inconsistencies** flags risks across the room.",jumpTo:null};

  // Thanks
  if(/^(thanks|thank you|cheers|great|perfect|brilliant)/i.test(ql))
    return {answer:"Happy to help. Let me know if you need anything else from the data room.",jumpTo:null};

  // General knowledge / off-topic (stock prices, news, maths, etc.)
  const offTopic=/stock price|weather|news|who (is|was|are)|what is \w+(?! (in|at|on|the))|how (do|does|to|many)|calculate|convert|translate|tell me a joke|capital of/i;
  if(offTopic.test(ql))
    return {answer:"I'm focused on this deal's data room — I can't look up live information or answer general knowledge questions. Try asking me where to find a specific document, or use the **Navigate & Ask** chips above for deal-relevant queries.",jumpTo:null};

  // PE / deal questions with no matching doc
  if(/valuation|multiple|irr|return|exit|entry|deal|ebitda|pe|private equity|due diligence/i.test(ql))
    return {answer:"That sounds deal-related. I don't have live AI in demo mode, but you can explore the financial workstream — try **Audited Accounts FY2024** or **Management Accounts** in the sidebar, then use the **Financial Extract** tab to build the EBITDA bridge.",jumpTo:"d7"};

  return {answer:"I didn't find a document that matches that. Try asking about something in the data room — financials, contracts, HR, tax, or the cap table.",jumpTo:null};
}

// ============================================================
// BOOT
// ============================================================
function bootDemo(){
  state.source="demo"; state.search=""; state.selectedDoc=null; state.aiResults={}; state.contentCache={}; state.liveFlags=null; state.chat=[];
  state.expanded={root:true,f1:true,f2:true,f3:false,f4:false,f5:false,f6:false};
  buildIndex(JSON.parse(JSON.stringify(TREE)));
  state.tab="overview"; render();
}
bootDemo();
