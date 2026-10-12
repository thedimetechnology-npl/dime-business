let TOKEN = sessionStorage.getItem('briefToken') || '';
let USERNAME = sessionStorage.getItem('briefUser') || '';
let BRIEFS = [];
let filter = 'All';
let openId = null;
let VIEW = sessionStorage.getItem('briefView') || localStorage.getItem('briefView') || (location.hash.replace('#','')) || 'dashboard';
let CAMPAIGNS = [];
let campFilter = 'open';
let REPORT = null;
let cbMode = 'services';
const $ = id => document.getElementById(id);

const CAMP_SERVICES = ['Development & Maintenance','Code Review & Optimization','Collaboration & Project Management','Support & Bug Fixes','Integration & Deployment','Innovation & Improvement','Software Development','Mobile App','Web Development','Cloud Consulting','DevOps','AI / ML','UI/UX Design','E-Commerce','Cyber Security','App Marketing'];
const CAMP_LANGUAGES = ['English','Hindi','Nepali','German','Arabic','Japanese'];

function showApp(on){
  $('loginView').style.display = on ? 'none' : 'flex';
  $('appView').style.display = on ? 'block' : 'none';
  if(on && USERNAME) document.querySelectorAll('.side-brand small').forEach(el => el.textContent = USERNAME);
}

function logout(){
  TOKEN = ''; USERNAME = '';
  sessionStorage.removeItem('briefToken');
  sessionStorage.removeItem('briefUser');
  showApp(false);
}

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('lgBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Signing in…';
  $('lgErr').classList.remove('on');
  try{
    const res = await pmsPost({ action: 'briefLogin', username: $('lgUser').value.trim(), password: $('lgPass').value });
    if(!res.ok) throw new Error(res.error || 'Login failed');
    TOKEN = res.token;
    USERNAME = res.username || $('lgUser').value.trim();
    sessionStorage.setItem('briefToken', TOKEN);
    sessionStorage.setItem('briefUser', USERNAME);
    $('lgPass').value = '';
    showApp(true);
    loadList();
  }catch(err){
    $('lgErr').textContent = err.message || 'Login failed';
    $('lgErr').classList.add('on');
  }finally{
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});

/* ── view switching ── */
function switchView(v){
  VIEW = v;
  try{ sessionStorage.setItem('briefView', v); localStorage.setItem('briefView', v); }catch(_){}
  try{ history.replaceState(null, '', '#' + v); }catch(_){}
  document.querySelectorAll('.side-nav a').forEach(a => a.classList.toggle('on', a.dataset.view === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'view-' + v));
  try{
    if(v === 'dashboard') loadList();
    if(v === 'campaigns') loadCampaigns();
    if(v === 'reporting') loadReport();
    if(v === 'visitors') loadVisitors();
    if(v === 'emails') loadEmails();
    if(v === 'companies') loadCompanies();
    if(v === 'social') loadSocial();
    if(v === 'youtube') loadYTVideos();
    if(v === 'seo'){ loadSeo().then(() => { renderSeoTabs(); renderSeoPanels(); runAudit(); }); }
  }catch(_){}
}
document.querySelectorAll('.side-nav a').forEach(a => a.addEventListener('click', () => switchView(a.dataset.view)));

/* ══ Dashboard — brief inbox ══ */
async function loadList(manual){
  if(!TOKEN){ showApp(false); return; }
  try{
    const res = await pmsPost({ action: 'briefList', token: TOKEN });
    if(!res.ok){
      if(/unauthor/i.test(res.error || '')){ logout(); toast('Session expired — please sign in again', 'err'); return; }
      throw new Error(res.error || 'Failed to load briefs');
    }
    BRIEFS = res.briefs || [];
    $('syncedAt').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    renderMinis(); renderTabs(); renderList();
    if(manual) toast('Inbox refreshed', 'ok');
  }catch(err){
    toast(err.message || 'Could not load briefs', 'err');
  }
}

function counts(){
  const c = { All: BRIEFS.length, New: 0, Contacted: 0, 'Proposal Sent': 0, Won: 0, Lost: 0 };
  BRIEFS.forEach(b => { if(c[b.status] !== undefined) c[b.status]++; });
  return c;
}
function renderMinis(){
  const c = counts();
  $('mTotal').textContent = c.All;
  $('mNew').textContent = c.New;
  $('mProg').textContent = c.Contacted + c['Proposal Sent'];
  $('mWon').textContent = c.Won;
}
function renderTabs(){
  const c = counts();
  const tabs = ['All'].concat(STATUSES);
  $('tabs').innerHTML = tabs.map(t =>
    '<button class="tab' + (filter === t ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) +
    '<span class="n">' + c[t] + '</span></button>'
  ).join('');
  document.querySelectorAll('#tabs .tab').forEach(el => el.addEventListener('click', () => {
    filter = el.dataset.t; renderTabs(); renderList();
  }));
}
function filtered(){
  const q = ($('q').value || '').trim().toLowerCase();
  return BRIEFS.filter(b => {
    if(filter !== 'All' && b.status !== filter) return false;
    if(!q) return true;
    const l = b.lead || {}, br = b.brief || {};
    return [l.company, l.person, l.email, l.phone, l.country, (br.services || []).join(' '), br.description]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });
}
function renderList(){
  const rows = filtered();
  if(!rows.length){
    $('list').innerHTML = '<div class="empty"><b>' +
      (BRIEFS.length ? 'No briefs match your filters' : 'No project briefs yet') + '</b>' +
      (BRIEFS.length ? 'Try another tab or clear the search.' : 'Share your brief link — new submissions appear here instantly.') +
      '</div>';
    return;
  }
  $('list').innerHTML = rows.map(b => {
    const l = b.lead || {}, br = b.brief || {};
    const services = (br.services || []).slice(0, 3).join(' · ');
    return '<div class="brief-row" data-id="' + esc(b.id) + '">' +
      statusPill(b.status) +
      '<div><div class="co">' + esc(l.company || l.person || 'Untitled') +
        ' <span class="tag-web">Web</span></div>' +
        '<div class="sub"><b>' + esc(l.person || '') + '</b><span>' + esc(l.email || '') + '</span>' +
        (services ? '<span>' + esc(services) + '</span>' : '') + '</div></div>' +
      '<div class="right"><b style="color:var(--muted)">' + esc((br.currency || 'NPR') + ' ' + (br.budget || '—')) + '</b><br>' +
        esc(fmtDateTime(b.createdAt)) + '</div></div>';
  }).join('');
  document.querySelectorAll('.brief-row').forEach(el =>
    el.addEventListener('click', () => openDrawer(el.dataset.id)));
}

function openDrawer(id){
  const b = BRIEFS.find(x => x.id === id);
  if(!b) return;
  openId = id;
  const l = b.lead || {}, br = b.brief || {};
  const kv = (rows) => rows.filter(r => r[1]).map(([k, v]) =>
    '<span class="k">' + esc(k) + '</span><span class="v">' + v + '</span>').join('');
  const link = (href, text) => '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(text) + '</a>';
  const services = (br.services || []).join(', ');
  $('drawerBody').innerHTML =
    '<h2>' + esc(l.company || l.person || 'Untitled brief') + '</h2>' +
    '<div class="d-sub">' + statusPill(b.status) + ' &nbsp; Ref <b>' + esc(b.id) + '</b> · ' + esc(fmtDateTime(b.createdAt)) + '</div>' +

    '<div class="d-sec"><h4>Contact</h4><div class="kv">' + kv([
      ['Person', esc(l.person || '')],
      ['Email', l.email ? '<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a>' : ''],
      ['Phone', l.phone ? '<a href="tel:' + esc(l.phone) + '">' + esc(l.phone) + '</a>' : ''],
      ['Website', l.website ? link(/^https?:/i.test(l.website) ? l.website : 'https://' + l.website, l.website) : ''],
      ['LinkedIn', l.linkedin ? link(l.linkedin, 'View profile') : ''],
      ['Country', esc(l.country || '')],
      ['Industry', esc([br.category || l.category, br.subcategory || l.subcategory].filter(Boolean).join(' — '))]
    ]) + '</div></div>' +

    '<div class="d-sec"><h4>Project brief</h4><div class="kv">' + kv([
      ['Services', esc(services)],
      ['Budget', esc((br.currency || 'NPR') + ' ' + (br.budget || ''))],
      ['Timeline', esc(br.timeline || '')]
    ]) + '</div>' +
    (br.description ? '<div class="brief-text" style="margin-top:12px">' + esc(br.description) + '</div>' : '') + '</div>' +

    '<div class="d-sec"><h4>Pipeline</h4>' +
      '<div class="field"><label>Status</label><select class="inp" id="dStatus">' +
      STATUSES.map(s => '<option' + (b.status === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') +
      '</select></div>' +
      '<div class="field"><label>Notes (private)</label><textarea class="inp" id="dNotes" style="min-height:90px" ' +
      'placeholder="Call booked, pricing sent…">' + esc(b.notes || '') + '</textarea></div>' +
      '<div class="d-actions">' +
        '<button class="btn btn-primary btn-sm" id="dSave" onclick="saveDetail()">Save changes</button>' +
        '<a class="btn btn-ghost btn-sm" href="https://pms.thedimetechnology.com.np" target="_blank" rel="noopener">Open in PMS →</a>' +
        (l.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(l.email) + '?subject=' + encodeURIComponent('Your project brief — ' + (l.company || '')) + '">Email lead</a>' : '') +
      '</div></div>';
  $('drawerBg').classList.add('on');
  $('drawer').classList.add('on');
}
function closeDrawer(){
  openId = null;
  $('drawerBg').classList.remove('on');
  $('drawer').classList.remove('on');
}
async function saveDetail(){
  const b = BRIEFS.find(x => x.id === openId);
  if(!b) return;
  const btn = $('dSave');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving…';
  try{
    const res = await pmsPost({
      action: 'briefUpdate', token: TOKEN, id: b.id,
      status: $('dStatus').value, notes: $('dNotes').value
    });
    if(!res.ok) throw new Error(res.error || 'Save failed');
    b.status = res.brief.status;
    b.notes = res.brief.notes;
    renderMinis(); renderTabs(); renderList();
    toast('Brief updated', 'ok');
    closeDrawer();
  }catch(err){
    toast(err.message || 'Save failed', 'err');
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = 'Save changes'; }
  }
}

/* ══ Campaigns ══ */
async function loadCampaigns(){
  if(!TOKEN) return;
  try{
    const res = await pmsPost({ action: 'campaignList', token: TOKEN });
    if(!res.ok) throw new Error(res.error || 'Failed to load campaigns');
    CAMPAIGNS = res.campaigns || [];
    renderCampTabs(); renderCampList();
    loadReport(true);
  }catch(err){
    toast(err.message || 'Could not load campaigns', 'err');
  }
}
function renderCampTabs(){
  const open = CAMPAIGNS.filter(c => c.status !== 'Archived').length;
  const arch = CAMPAIGNS.length - open;
  $('campTabs').innerHTML =
    '<button class="tab' + (campFilter === 'open' ? ' on' : '') + '" data-t="open">Open (' + open + ')</button>' +
    '<button class="tab' + (campFilter === 'arch' ? ' on' : '') + '" data-t="arch">Archived (' + arch + ')</button>';
  document.querySelectorAll('#campTabs .tab').forEach(el => el.addEventListener('click', () => {
    campFilter = el.dataset.t; renderCampTabs(); renderCampList();
  }));
}
function campStatusClass(s){
  return { Active: 's-active', Paused: 's-paused', Draft: 's-draft', Archived: 's-archived', Finished: 's-finished' }[s] || 's-draft';
}
function renderCampList(){
  const list = CAMPAIGNS.filter(c => campFilter === 'arch' ? c.status === 'Archived' : c.status !== 'Archived');
  if(!list.length){
    $('campList').innerHTML = '<div class="empty"><b>No campaigns yet</b>Start your first campaign to get visible to customers searching for your services.</div>';
    return;
  }
  const stats = (REPORT && REPORT.campaignStats) || {};
  $('campList').innerHTML = list.map((c, i) => {
    const t = c.targets || {};
    const chips = [].concat(t.services || [], t.locations || [], t.languages || []);
    const st = stats[c.id] || { impressions: 0, clicks: 0, boosted: chips.length, progress: 0, daysLeft: 0, finished: false };
    const ctr = st.impressions > 0 ? Math.round(st.clicks / st.impressions * 100) + '%' : '0%';
    const active = c.status === 'Active' && !st.finished;
    const statusLabel = st.finished ? 'Finished' : c.status;
    return '<div class="camp-card' + (st.finished ? ' done' : '') + '">' +
      '<div class="camp-top">' +
        '<div class="camp-title"><b>' + esc(c.name || ('Campaign #' + (i + 1))) + '</b>' +
          '<span class="camp-status ' + campStatusClass(statusLabel) + '">' + esc(statusLabel) + '</span></div>' +
        '<div class="camp-ctrl">' +
          '<label class="switch" title="Toggle campaign"><input type="checkbox" data-camp-toggle="' + esc(c.id) + '"' + (active ? ' checked' : '') + (st.finished ? ' disabled' : '') + '><span></span></label>' +
          '<button class="icon-btn" data-camp-logs="' + esc(c.id) + '" title="View activity log">▤</button>' +
          '<button class="icon-btn" data-camp-edit="' + esc(c.id) + '" title="Edit campaign">✎</button>' +
          '<button class="icon-btn danger" data-camp-del="' + esc(c.id) + '" title="Delete campaign">🗑</button>' +
        '</div>' +
      '</div>' +
      '<div class="camp-targets"><span class="lbl">Targets</span>' +
        '<div class="chips">' + chips.map(x => '<span class="chip static">' + esc(x) + '</span>').join('') + '</div></div>' +
      '<div class="camp-progress"><span class="lbl">' + (st.finished ? 'Campaign finished' : 'Time remaining') + '</span>' +
        '<div class="bar"><i style="width:' + (st.progress || 0) + '%"></i></div>' +
        '<span class="cons-num">' + (st.finished ? 'Finished' : (st.daysLeft || 0) + ' days left') + '</span></div>' +
      '<div class="camp-metrics">' +
        '<div><b>' + st.boosted + '</b><span>Boosted directories</span></div>' +
        '<div><b>' + st.impressions + '</b><span>Impressions</span></div>' +
        '<div><b>' + st.clicks + '</b><span>Clicks to profile</span></div>' +
        '<div><b>' + ctr + '</b><span>Click-through rate</span></div>' +
      '</div></div>';
  }).join('');
  document.querySelectorAll('[data-camp-toggle]').forEach(el => el.addEventListener('change', () => {
    const c = CAMPAIGNS.find(x => x.id === el.dataset.campToggle);
    if(!c) return;
    updateCampaign(c.id, { status: el.checked ? 'Active' : 'Paused' });
  }));
  document.querySelectorAll('[data-camp-logs]').forEach(el => el.addEventListener('click', () => {
    const c = CAMPAIGNS.find(x => x.id === el.dataset.campLogs);
    if(c) openCampLogs(c);
  }));
  document.querySelectorAll('[data-camp-edit]').forEach(el => el.addEventListener('click', () => {
    const c = CAMPAIGNS.find(x => x.id === el.dataset.campEdit);
    if(c) openCampModal(c);
  }));
  document.querySelectorAll('[data-camp-del]').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.campDel;
    if(!el.dataset.arm){
      el.dataset.arm = '1';
      el.textContent = 'Sure?';
      el.classList.add('armed');
      setTimeout(() => { el.dataset.arm = ''; el.textContent = '🗑'; el.classList.remove('armed'); }, 3000);
      return;
    }
    deleteCampaign(id);
  }));
}
async function deleteCampaign(id){
  try{
    const res = await pmsPost({ action: 'campaignDelete', token: TOKEN, id });
    if(!res.ok) throw new Error(res.error || 'Delete failed');
    CAMPAIGNS = CAMPAIGNS.filter(x => x.id !== id);
    renderCampTabs(); renderCampList();
    toast('Campaign deleted', 'ok');
  }catch(err){
    toast(err.message || 'Delete failed', 'err');
  }
}
async function updateCampaign(id, patch){
  try{
    const res = await pmsPost({ action: 'campaignUpdate', token: TOKEN, id, ...patch });
    if(!res.ok) throw new Error(res.error || 'Update failed');
    const i = CAMPAIGNS.findIndex(x => x.id === id);
    if(i > -1) CAMPAIGNS[i] = res.campaign;
    renderCampTabs(); renderCampList();
    toast('Campaign updated', 'ok');
  }catch(err){
    toast(err.message || 'Update failed', 'err');
  }
}

function logElLabel(el){
  if(!el) return '';
  if(el.indexOf('convert:') === 0) return 'Started a brief';
  if(el.indexOf('service:') === 0) return 'Service: ' + el.slice(8);
  if(el.indexOf('stack:') === 0) return 'Stack: ' + el.slice(6);
  if(el === 'message') return 'Sent a message';
  if(el === 'website') return 'Visited website';
  if(el === 'social') return 'Opened social link';
  return el.replace(/:/g, ' · ');
}
async function openCampLogs(c){
  $('drawerBody').innerHTML =
    '<h2>' + esc(c.name || 'Campaign') + ' — activity log</h2>' +
    '<div class="d-sub">Every impression and click attributed to this campaign, newest first. ' +
      'Logs cover the campaign run: ' + esc(fmtDateTime(c.createdAt)) + ' → +' + (c.duration || 30) + ' days</div>' +
    '<div class="d-sec"><h4>Summary</h4><div class="log-sum" id="logSum">Loading…</div></div>' +
    '<div class="d-sec"><h4>Events</h4><div class="log-rows" id="logRows"><div class="log-empty">Loading activity…</div></div></div>';
  $('drawerBg').classList.add('on');
  $('drawer').classList.add('on');
  try{
    const res = await pmsPost({ action: 'campaignLogs', token: TOKEN, id: c.id });
    if(!res.ok) throw new Error(res.error || 'Could not load activity log');
    const rows = res.logs || [];
    const sum = $('logSum');
    if(sum) sum.innerHTML = '<b>' + res.views + '</b> views · <b>' + res.clicks + '</b> clicks' +
      (res.total > rows.length ? '<span class="log-more">latest ' + rows.length + ' of ' + res.total + '</span>' : '');
    const rowsEl = $('logRows');
    if(rowsEl) rowsEl.innerHTML = rows.length ? rows.map(ev => {
      const where = ev.country || ev.location || '';
      const clk = ev.type === 'click';
      return '<div class="log-row">' +
        '<span class="log-t">' + esc(fmtDateTime(ev.at)) + '</span>' +
        '<span class="log-k ' + (clk ? 'clk' : 'imp') + '">' + (clk ? 'CLICK' : 'VIEW') + '</span>' +
        '<span class="log-p">' + esc(ev.page || '/') + (ev.element ? ' — ' + esc(logElLabel(ev.element)) : '') + '</span>' +
        (where ? '<span class="log-c">' + esc(where) + '</span>' : '') +
      '</div>';
    }).join('') : '<div class="log-empty">No activity yet — events appear here as visitors view or click your profile while the campaign runs.</div>';
  }catch(err){
    const rowsEl = $('logRows');
    if(rowsEl) rowsEl.innerHTML = '<div class="log-empty">' + esc(err.message || 'Could not load logs') + '</div>';
  }
}

/* campaign create/edit modal */
let ccSel = { services: [], locations: [], languages: [], platforms: [] };
function renderCampChips(id, list, key){
  const el = $(id);
  if(!el) return;
  el.innerHTML = list.map(item =>
    '<span class="chip' + (ccSel[key].indexOf(item) !== -1 ? ' on' : '') + '" data-v="' + esc(item) + '" title="Click to ' + (ccSel[key].indexOf(item) !== -1 ? 'remove' : 'add') + '">' + esc(item) + '</span>'
  ).join('');
  el.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
    const v = ch.dataset.v;
    const idx = ccSel[key].indexOf(v);
    if(idx === -1) ccSel[key].push(v);
    else ccSel[key].splice(idx, 1);
    ch.classList.toggle('on');
    ch.title = 'Click to ' + (ch.classList.contains('on') ? 'remove' : 'add');
  }));
}
function renderPlatformChips(){
  document.querySelectorAll('#ccPlatforms .chip').forEach(ch => {
    const on = ccSel.platforms.indexOf(ch.dataset.v) !== -1;
    ch.classList.toggle('on', on);
    ch.title = 'Click to ' + (on ? 'remove' : 'add');
  });
}
document.querySelectorAll('#ccPlatforms .chip').forEach(ch => ch.addEventListener('click', () => {
  const v = ch.dataset.v;
  const idx = ccSel.platforms.indexOf(v);
  if(idx === -1) ccSel.platforms.push(v);
  else ccSel.platforms.splice(idx, 1);
  ch.classList.toggle('on');
  ch.title = 'Click to ' + (ch.classList.contains('on') ? 'remove' : 'add');
}));
/* location cascade — continent → country → province → district → city */
const CONT_NAMES = { AF: 'Africa', AS: 'Asia', EU: 'Europe', NA: 'North America', SA: 'South America', OC: 'Oceania', AN: 'Antarctica' };
let LOC_INDEX = null;
const LOC_CACHE = {};
function locIndex(){
  if(LOC_INDEX) return Promise.resolve(LOC_INDEX);
  return fetch('locations/index.json').then(r => r.json()).then(j => { LOC_INDEX = j; return j; });
}
function locCountry(cc){
  if(LOC_CACHE[cc]) return Promise.resolve(LOC_CACHE[cc]);
  return fetch('locations/' + encodeURIComponent(cc) + '.json').then(r => r.json());
}
function fillLocSelect(sel, options, ph){
  sel.innerHTML = '<option value="">' + ph + '</option>' + options.map(o => '<option value="' + esc(o.value) + '">' + esc(o.name) + '</option>').join('');
  sel.disabled = options.length === 0;
}
function resetLocBelow(after){
  const order = ['ccCont','ccCountry','ccProv','ccDist','ccCity'];
  const ph = { ccCont: 'Continent…', ccCountry: 'Country…', ccProv: 'Province…', ccDist: 'District…', ccCity: 'City…' };
  const start = order.indexOf(after);
  if(start === -1) return;
  for(let i = start + 1; i < order.length; i++){
    fillLocSelect($(order[i]), [], ph[order[i]]);
    $(order[i]).disabled = true;
  }
  $('ccLocAdd').disabled = !$('ccCountry').value;
}
function locPath(){
  if(!$('ccCountry').value) return null;
  const parts = [];
  const cont = $('ccCont').value;
  if(cont) parts.push(CONT_NAMES[cont] || cont);
  let cName = $('ccCountry').value;
  if(LOC_INDEX){
    for(const c of LOC_INDEX.continents){
      const row = c.countries.find(x => x.code === cName);
      if(row){ cName = row.name; break; }
    }
  }
  parts.push(cName);
  const j = LOC_CACHE[$('ccCountry').value];
  if(j){
    const pv = $('ccProv').value;
    if(pv !== ''){
      const p = j.provinces.find(x => x.code === pv);
      if(p){
        if(p.name !== 'All') parts.push(p.name);
        const dv = $('ccDist').value;
        if(dv !== ''){
          const d = p.districts.find(x => x.code === dv);
          if(d){
            if(d.name !== 'All') parts.push(d.name);
            const ci = $('ccCity').value;
            if(ci !== ''){
              const name = d.cities[parseInt(ci, 10)];
              if(name) parts.push(name);
            }
          }
        }
      }
    }
  }
  return parts.join(' / ');
}
function renderLocChips(){
  $('ccLocations').innerHTML = ccSel.locations.length
    ? ccSel.locations.map((l, i) =>
        '<span class="chip on" title="' + esc(l) + '">' + esc(l) + '<b class="chip-x" data-i="' + i + '" title="Remove">×</b></span>'
      ).join('')
    : '<span class="loc-empty">Pick from the lists above, then Add</span>';
  const clearBtn = $('ccLocClear');
  if(clearBtn) clearBtn.style.display = ccSel.locations.length > 0 ? '' : 'none';
  document.querySelectorAll('#ccLocations .chip-x').forEach(x => x.addEventListener('click', () => {
    ccSel.locations.splice(parseInt(x.dataset.i, 10), 1);
    renderLocChips();
  }));
}
try{
$('ccCont').addEventListener('change', () => {
  const cont = $('ccCont').value;
  const c = cont && LOC_INDEX ? (LOC_INDEX.continents.find(x => x.code === cont) || { countries: [] }) : null;
  fillLocSelect($('ccCountry'), c ? c.countries.map(x => ({ value: x.code, name: x.name })) : [], 'Country…');
  resetLocBelow('ccCountry');
});
$('ccCountry').addEventListener('change', () => {
  resetLocBelow('ccCountry');
  const cc = $('ccCountry').value;
  if(!cc) return;
  locCountry(cc).then(j => {
    LOC_CACHE[cc] = j;
    if($('ccCountry').value === cc){
      fillLocSelect($('ccProv'), (j.provinces || []).map(p => ({ value: p.code, name: p.name })), 'Province…');
      $('ccLocAdd').disabled = false;
    }
  }).catch(() => {});
});
$('ccProv').addEventListener('change', () => {
  resetLocBelow('ccProv');
  const j = LOC_CACHE[$('ccCountry').value];
  const pv = $('ccProv').value;
  if(!j || pv === '') return;
  const p = j.provinces.find(x => x.code === pv);
  if(!p) return;
  fillLocSelect($('ccDist'), (p.districts || []).map(d => ({ value: d.code, name: d.name })), 'District…');
});
$('ccDist').addEventListener('change', () => {
  resetLocBelow('ccDist');
  const j = LOC_CACHE[$('ccCountry').value];
  const pv = $('ccProv').value;
  const dv = $('ccDist').value;
  if(!j || pv === '' || dv === '') return;
  const p = j.provinces.find(x => x.code === pv);
  const d = p ? p.districts.find(x => x.code === dv) : null;
  if(!d) return;
  fillLocSelect($('ccCity'), (d.cities || []).map((name, i) => ({ value: String(i), name })), 'City…');
});
$('ccLocAdd').addEventListener('click', () => {
  const p = locPath();
  if(!p) return;
  if(ccSel.locations.indexOf(p) === -1) ccSel.locations.push(p);
  renderLocChips();
});
locIndex().then(j => {
  if(j && Array.isArray(j.continents)){
    $('ccCont').innerHTML = '<option value="">Continent…</option>' +
      j.continents.map(c => '<option value="' + esc(c.code) + '">' + esc(CONT_NAMES[c.code] || c.code) + '</option>').join('');
  }
}).catch(() => {});
}catch(_){}
function openCampModal(c){
  const edit = !!c;
  window._editCampId = edit ? c.id : null;
  $('campModalTitle').textContent = edit ? 'Campaign settings' : 'Start new campaign';
  $('ccName').value = edit ? (c.name || '') : '';
  const durEl = $('ccDuration');
  if(durEl) durEl.value = edit ? (c.duration || 30) : 30;
  ccSel = edit
    ? { services: (c.targets.services || []).slice(), locations: (c.targets.locations || []).slice(), languages: (c.targets.languages || []).slice(), platforms: ((c.targets && c.targets.platforms) || []).slice() }
    : { services: [], locations: [], languages: [], platforms: [] };
  renderCampChips('ccServices', CAMP_SERVICES, 'services');
  renderLocChips();
  renderCampChips('ccLanguages', CAMP_LANGUAGES, 'languages');
  renderPlatformChips();
  if(!edit){
    $('ccCont').value = '';
    resetLocBelow('ccCont');
  }
  $('ccErr').classList.remove('on');
  $('ccCreate').textContent = edit ? 'Save changes' : 'Create campaign';
  $('campModalBg').classList.add('on');
}
function closeCampModal(){ $('campModalBg').classList.remove('on'); }
try{
$('newCampaignBtn').addEventListener('click', () => openCampModal(null));
$('ccCreate').addEventListener('click', async () => {
  const name = $('ccName').value.trim();
  const durEl = $('ccDuration');
  const duration = Math.max(1, Math.min(365, parseInt(durEl && durEl.value, 10) || 30));
  const editing = !!window._editCampId;
  try{
    let res;
    if(editing){
      res = await pmsPost({ action: 'campaignUpdate', token: TOKEN, id: window._editCampId, name, duration, targets: ccSel });
    }else{
      res = await pmsPost({ action: 'campaignCreate', token: TOKEN, name, duration, targets: ccSel });
    }
    if(!res.ok) throw new Error(res.error || 'Save failed');
    closeCampModal();
    await loadCampaigns();
    toast(editing ? 'Campaign updated' : 'Campaign created — toggle it on to go live', 'ok');
  }catch(err){
    $('ccErr').textContent = err.message || 'Save failed';
    $('ccErr').classList.add('on');
  }
});
}catch(_){}

/* ══ Reporting ══ */
async function loadReport(silent){
  if(!TOKEN) return;
  try{
    const res = await pmsPost({ action: 'report', token: TOKEN });
    if(!res.ok) throw new Error(res.error || 'Failed to load report');
    REPORT = res;
    if(silent){ renderCampList(); return; }
    if(VIEW === 'campaigns'){ renderCampList(); return; }
    renderRepCards(); renderChart(); renderConv(); renderBreakdown(); renderTable();
  }catch(err){
    if(!silent) toast(err.message || 'Could not load report', 'err');
  }
}
function renderRepCards(){
  const r = REPORT;
  const cards = [
    [r.paidImpressions, 'Paid impressions'],
    [r.paidClicks, 'Paid clicks'],
    [r.organicClicks, 'Organic clicks'],
    [r.conversions, 'Conversions']
  ];
  $('repCards').innerHTML = cards.map(([v, l]) =>
    '<div class="rep-card"><span class="info">i</span><b>' + v + '</b><span>' + l + '</span></div>'
  ).join('');
}
function renderChart(){
  const months = (REPORT && REPORT.months) || [];
  const max = Math.max(1, ...months.map(m => Math.max(m.paid, m.organic)));
  $('repChart').innerHTML = '<div class="chart-bars">' + months.map(m => {
    const h = v => Math.round(v / max * 100);
    return '<div class="chart-col">' +
      '<div class="chart-stack">' +
        '<i class="b-org" style="height:' + h(m.organic) + '%" title="Organic: ' + m.organic + '"></i>' +
        '<i class="b-paid" style="height:' + h(m.paid) + '%" title="Paid: ' + m.paid + '"></i>' +
      '</div><span>' + esc(m.label) + '</span></div>';
  }).join('') + '</div>';
}
function renderConv(){
  const c = (REPORT && REPORT.conversionsBreakdown) || { website: 0, social: 0, messages: 0 };
  const cards = [
    [c.website, 'Website clicks'],
    [c.social, 'Social media clicks'],
    [c.messages, 'Messages sent']
  ];
  $('repConv').innerHTML = cards.map(([v, l]) =>
    '<div class="rep-card"><span class="info">i</span><b>' + v + '</b><span>' + l + '</span></div>'
  ).join('');
}
function renderBreakdown(){
  const rows = cbMode === 'locations'
    ? ((REPORT && REPORT.clicksByCountry) || [])
    : ((REPORT && REPORT.clicksBreakdown) || []);
  const max = Math.max(1, ...rows.map(r => r.paid + r.organic));
  $('repBreakdown').innerHTML = rows.length ? rows.map(r => {
    const tot = r.paid + r.organic;
    const pw = Math.round(r.paid / max * 100), ow = Math.round(r.organic / max * 100);
    return '<div class="cb-row"><span class="cb-name">' + esc(r.name) + '</span>' +
      '<div class="cb-bar"><i class="b-paid" style="width:' + pw + '%"></i><i class="b-org" style="width:' + ow + '%"></i></div>' +
      '<b>' + tot + '</b></div>';
  }).join('') : '<div class="empty" style="padding:26px"><b>No clicks yet</b>Share your profile link — clicks will appear here.</div>';
}
function renderTable(){
  const rows = (REPORT && REPORT.topPages) || [];
  const tb = document.querySelector('#repTable tbody');
  if(!tb) return;
  tb.innerHTML = rows.length ? rows.map(p =>
    '<tr><td><span class="pg">▦</span> ' + esc(p.page) + '</td>' +
    '<td>' + esc(p.expertise || '—') + '</td>' +
    '<td>' + esc(p.location || '—') + '</td>' +
    '<td class="num">' + p.impressions + '</td>' +
    '<td class="num">' + p.paidClicks + '</td>' +
    '<td class="num">' + p.organicClicks + '</td></tr>'
  ).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:26px">No page data yet — traffic to your profile will appear here.</td></tr>';
}
try{
$('exportCsv').addEventListener('click', () => {
  const rows = (REPORT && REPORT.topPages) || [];
  const head = 'Page,Expertise,Location,Impressions,Paid clicks,Organic clicks';
  const lines = rows.map(p => [p.page, p.expertise || '', p.location || '', p.impressions, p.paidClicks, p.organicClicks].join(','));
  const blob = new Blob([[head].concat(lines).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'top-pages.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});
document.querySelectorAll('#cbSeg button').forEach(b => b.addEventListener('click', () => {
  cbMode = b.dataset.cb;
  document.querySelectorAll('#cbSeg button').forEach(x => x.classList.toggle('on', x === b));
  renderBreakdown();
}));
}catch(_){}

/* ══ SEO Tools ══ */
let seoTab = 'audit';
let SEO = { meta: {}, schema: {}, robots: '', sitemap: '' };
const SEO_PAGES = ['/', '/brief'];

function renderSeoTabs(){
  const tabs = [['audit','Audit'],['meta','Meta Tags'],['sitemap','Sitemap & Robots'],['schema','Schema Markup']];
  $('seoTabs').innerHTML = tabs.map(([k, l]) =>
    '<button class="tab' + (seoTab === k ? ' on' : '') + '" data-t="' + k + '">' + l + '</button>'
  ).join('');
  document.querySelectorAll('#seoTabs .tab').forEach(el => el.addEventListener('click', () => {
    seoTab = el.dataset.t; renderSeoTabs(); renderSeoPanels();
  }));
}
function renderSeoPanels(){
  ['seoAudit','seoMeta','seoSitemap','seoSchema'].forEach(id => { const el = $(id); if(el) el.style.display = 'none'; });
  const map = { audit: 'seoAudit', meta: 'seoMeta', sitemap: 'seoSitemap', schema: 'seoSchema' };
  const panel = $(map[seoTab]);
  if(panel) panel.style.display = 'block';
  if(seoTab === 'audit') renderAudit();
  if(seoTab === 'meta') renderMetaForm();
  if(seoTab === 'sitemap') renderSitemapForm();
  if(seoTab === 'schema') renderSchemaForm();
}
async function loadSeo(){
  if(!TOKEN) return;
  try{
    const res = await pmsPost({ action: 'seoMeta' });
    if(res.ok) SEO = Object.assign(SEO, res);
  }catch(_){}
}
async function runAudit(){
  const btn = $('runAudit');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Auditing…';
  try{
    const res = await pmsPost({ action: 'seoAudit', token: TOKEN });
    if(!res.ok) throw new Error(res.error || 'Audit failed');
    SEO.robots = res.robots; SEO.sitemap = res.sitemap;
    renderAudit(res);
  }catch(err){
    toast(err.message || 'Audit failed', 'err');
  }finally{
    btn.disabled = false; btn.textContent = 'Run audit';
  }
}
function renderAudit(res){
  const data = res || { results: [], robotsIssues: [], sitemapUrls: 0 };
  const avg = data.results.length ? Math.round(data.results.reduce((s, r) => s + r.score, 0) / data.results.length) : 0;
  const ringColor = avg >= 80 ? 'var(--green)' : avg >= 50 ? 'var(--amber)' : 'var(--red)';
  let html = '<div class="seo-score"><div class="ring" style="--ring:' + ringColor + '"><b>' + avg + '</b><span>SEO score</span></div>' +
    '<div class="seo-audit-pages">' + data.results.map(r =>
      '<div class="seo-page"><div class="seo-page-head"><b>' + esc(r.page) + '</b><span class="pill ' + (r.score >= 80 ? 's-won' : r.score >= 50 ? 's-proposal' : 's-lost') + '"><span class="dot"></span>' + r.score + '/100</span></div>' +
      '<div class="kv"><span class="k">Title</span><span class="v">' + esc(r.title || '—') + ' <i>(' + (r.title || '').length + ' chars)</i></span></div>' +
      '<div class="kv"><span class="k">Description</span><span class="v">' + esc(r.desc || '—') + ' <i>(' + (r.desc || '').length + ' chars)</i></span></div>' +
      '<div class="kv"><span class="k">Structure</span><span class="v">H1: ' + r.h1 + ' · H2: ' + r.h2 + ' · Images: ' + r.imgs + ' (' + r.imgAlt + ' with alt)</span></div>' +
      (r.issues.length ? '<div class="seo-issues">' + r.issues.map(i =>
        '<div class="seo-issue ' + i.level + '"><span>' + (i.level === 'err' ? '✕' : '!') + '</span>' + esc(i.msg) + '</div>').join('') + '</div>'
        : '<div class="seo-issue ok"><span>✓</span>No issues — looks good!</div>') +
      '</div>').join('') + '</div></div>';
  if(data.robotsIssues && data.robotsIssues.length){
    html += '<div class="seo-subhead">robots.txt & sitemap.xml</div><div class="seo-issues">' +
      data.robotsIssues.map(i => '<div class="seo-issue ' + i.level + '"><span>' + (i.level === 'err' ? '✕' : '!') + '</span>' + esc(i.msg) + '</div>').join('') + '</div>';
  }else{
    html += '<div class="seo-subhead">robots.txt & sitemap.xml</div><div class="seo-issue ok"><span>✓</span>robots.txt and sitemap.xml are in place (' + (data.sitemapUrls || 0) + ' URLs).</div>';
  }
  $('seoAudit').innerHTML = html;
}
function renderMetaForm(){
  $('seoMeta').innerHTML = '<h3>Meta tags</h3><p class="panel-sub">Saved meta overrides the page defaults. Changes apply to the live site immediately.</p>' +
    SEO_PAGES.map(p => {
      const m = SEO.meta[p] || {};
      return '<div class="seo-card"><div class="seo-card-head"><b>' + esc(p) + '</b><span>' + (p === '/' ? 'Agency profile' : 'Project brief') + '</span></div>' +
        '<div class="field"><label>Title <span class="cnt" data-cnt="title|' + esc(p) + '">' + (m.title || '').length + '/60</span></label>' +
        '<input class="inp" data-meta="' + esc(p) + '|title" maxlength="120" value="' + esc(m.title || '') + '" placeholder="The Dime Technology — …"></div>' +
        '<div class="field"><label>Description <span class="cnt" data-cnt="desc|' + esc(p) + '">' + (m.description || '').length + '/160</span></label>' +
        '<textarea class="inp" data-meta="' + esc(p) + '|desc" rows="3" maxlength="320" placeholder="Describe the page in 150–160 characters…">' + esc(m.description || '') + '</textarea></div>' +
        '<div class="field"><label>Keywords</label>' +
        '<input class="inp" data-meta="' + esc(p) + '|keywords" maxlength="200" value="' + esc(m.keywords || '') + '" placeholder="web development, mobile app, Nepal"></div>' +
        '</div>';
    }).join('') +
    '<div class="d-actions"><button class="btn btn-primary btn-sm" id="seoMetaSave">Save meta tags</button></div>';
  document.querySelectorAll('[data-meta]').forEach(el => el.addEventListener('input', () => {
    const [p, k] = el.dataset.meta.split('|');
    const cnt = document.querySelector('[data-cnt="' + k + '|' + p + '"]');
    if(cnt) cnt.textContent = el.value.length + '/' + (k === 'title' ? '60' : k === 'desc' ? '160' : '200');
  }));
  $('seoMetaSave').addEventListener('click', async () => {
    const meta = {};
    document.querySelectorAll('[data-meta]').forEach(el => {
      const [p, k] = el.dataset.meta.split('|');
      meta[p] = meta[p] || {};
      meta[p][k] = el.value.trim();
    });
    try{
      const res = await pmsPost({ action: 'seoSave', token: TOKEN, meta });
      if(!res.ok) throw new Error(res.error || 'Save failed');
      SEO.meta = meta;
      toast('Meta tags saved — live now', 'ok');
    }catch(err){ toast(err.message || 'Save failed', 'err'); }
  });
}
function renderSitemapForm(){
  $('seoSitemap').innerHTML = '<h3>Sitemap & robots.txt</h3><p class="panel-sub">Stored as the canonical version. The live files at the domain root update when you ask me to publish.</p>' +
    '<div class="seo-card"><div class="seo-card-head"><b>sitemap.xml</b><span>' + (SEO.sitemap.match(/<loc>/g) || []).length + ' URLs</span></div>' +
    '<textarea class="inp" id="seoSitemapTxt" rows="10" style="font-family:monospace;font-size:12px">' + esc(SEO.sitemap) + '</textarea></div>' +
    '<div class="seo-card"><div class="seo-card-head"><b>robots.txt</b></div>' +
    '<textarea class="inp" id="seoRobotsTxt" rows="6" style="font-family:monospace;font-size:12px">' + esc(SEO.robots) + '</textarea></div>' +
    '<div class="d-actions"><button class="btn btn-primary btn-sm" id="seoSitemapSave">Save sitemap & robots</button></div>';
  $('seoSitemapSave').addEventListener('click', async () => {
    try{
      const res = await pmsPost({ action: 'seoSave', token: TOKEN, sitemap: $('seoSitemapTxt').value, robots: $('seoRobotsTxt').value });
      if(!res.ok) throw new Error(res.error || 'Save failed');
      SEO.sitemap = $('seoSitemapTxt').value; SEO.robots = $('seoRobotsTxt').value;
      toast('Saved — ask me to publish and I will update the live files', 'ok');
    }catch(err){ toast(err.message || 'Save failed', 'err'); }
  });
}
function renderSchemaForm(){
  $('seoSchema').innerHTML = '<h3>Schema markup (JSON-LD)</h3><p class="panel-sub">Structured data helps search engines understand your pages. Injected into the page head.</p>' +
    SEO_PAGES.map(p => {
      const s = SEO.schema[p] || '';
      return '<div class="seo-card"><div class="seo-card-head"><b>' + esc(p) + '</b><span>' + (p === '/' ? 'Organization + WebSite' : 'Service + FAQPage') + '</span></div>' +
        '<textarea class="inp" data-schema="' + esc(p) + '" rows="10" style="font-family:monospace;font-size:12px" placeholder=\'{"@context":"https://schema.org","@type":"Organization",…}\'>' + esc(s) + '</textarea>' +
        '<div class="seo-schema-status" data-status="' + esc(p) + '">' + (s ? '' : 'Empty — no schema on this page') + '</div></div>';
    }).join('') +
    '<div class="d-actions"><button class="btn btn-primary btn-sm" id="seoSchemaSave">Validate & save schema</button></div>';
  document.querySelectorAll('[data-schema]').forEach(el => el.addEventListener('input', () => {
    const st = document.querySelector('[data-status="' + el.dataset.schema + '"]');
    if(!st) return;
    try{ JSON.parse(el.value); st.innerHTML = '<span class="ok">✓ Valid JSON</span>'; }
    catch(e){ st.innerHTML = '<span class="bad">✕ ' + esc(e.message) + '</span>'; }
  }));
  $('seoSchemaSave').addEventListener('click', async () => {
    const schema = {};
    document.querySelectorAll('[data-schema]').forEach(el => {
      const v = el.value.trim();
      if(!v) return;
      try{ JSON.parse(v); schema[el.dataset.schema] = v; }
      catch(e){ toast('Invalid JSON on ' + el.dataset.schema + ': ' + e.message, 'err'); throw e; }
    });
    try{
      const res = await pmsPost({ action: 'seoSave', token: TOKEN, schema });
      if(!res.ok) throw new Error(res.error || 'Save failed');
      SEO.schema = schema;
      toast('Schema saved — live now', 'ok');
    }catch(err){ if(err.message !== 'Invalid JSON') toast(err.message || 'Save failed', 'err'); }
  });
}
try{ $('runAudit').addEventListener('click', runAudit); }catch(_){}

document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeDrawer(); closeCampModal(); } });

/* ══ Visitors ══ */
let VISITORS = [];
const GEO_REGIONS = (typeof Intl !== 'undefined' && Intl.DisplayNames) ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
function countryName(code){
  const c = String(code || '').trim().toUpperCase();
  if(!c) return '';
  if(GEO_REGIONS){ try{ const n = GEO_REGIONS.of(c); if(n) return n; }catch(_){} }
  return c;
}
function siteMatch(site, want){
  const s = String(site || '').toLowerCase();
  if(!want) return true;
  if(!s) return false;
  if(s === want) return true;
  if(!s.endsWith('.' + want)) return false;
  if(want === 'thedimetechnology.com.np') return s.indexOf('business.') !== 0;
  return true;
}
function shortSite(site){
  const h = String(site || '').toLowerCase();
  if(!h) return '—';
  if(h === 'thedimetechnology.com.np' || h === 'www.thedimetechnology.com.np') return 'Main site';
  if(h.indexOf('business.') === 0) return 'Business';
  return h;
}
async function loadVisitors(manual){
  if(!TOKEN){ showApp(false); return; }
  try{
    const res = await pmsPost({ action: 'trackList', token: TOKEN });
    if(!res.ok){
      if(/unauthor/i.test(res.error || '')){ logout(); toast('Session expired — please sign in again', 'err'); return; }
      throw new Error(res.error || 'Failed to load visitors');
    }
    VISITORS = Array.isArray(res.events) ? res.events : [];
    renderVisitors();
    if(manual) toast('Visitor log updated');
  }catch(err){ toast(err.message || 'Failed to load visitors', 'err'); }
}
function isLocalhostSite(site){
  const s = String(site || '').toLowerCase();
  return !s || s === 'localhost' || s.indexOf('localhost:') === 0 || s.indexOf('127.0.0.1') === 0 || s.indexOf('[::1]') === 0;
}
function visitorSource(e){
  if(e.utm_source) return e.utm_source + (e.utm_medium ? ' (' + e.utm_medium + ')' : '');
  if(e.referrer){
    try{ return new URL(e.referrer).hostname; }catch(_){ return e.referrer.slice(0, 40); }
  }
  return '';
}
const EXCLUDED_IPS = ['103.1.92.2'];
function visitorsFiltered(){
  const site = $('vSite').value, type = $('vType').value, q = $('vQ').value.trim().toLowerCase();
  return VISITORS.filter(e => {
    if(isLocalhostSite(e.site)) return false;
    if(e.ip && EXCLUDED_IPS.indexOf(e.ip) !== -1) return false;
    if(type && String(e.type || '') !== type) return false;
    if(!siteMatch(e.site, site)) return false;
    if(q){
      const hay = [e.page, e.element, countryName(e.country), e.country, e.city, e.region, e.ip, e.isp, e.device, e.site, e.type, visitorSource(e), e.utm_campaign].join(' ').toLowerCase();
      if(hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}
function visitorsCsv(rows){
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = ['When','Website','Page','Type','Element','Source','UTM Source','UTM Medium','UTM Campaign','Country','City','Region','IP','ISP','Device'].join(',');
  const lines = rows.map(e => [e.at, e.site, e.page, e.type, e.element, visitorSource(e), e.utm_source, e.utm_medium, e.utm_campaign, countryName(e.country) || e.country, e.city, e.region, e.ip, e.isp, e.device].map(q).join(','));
  return [head].concat(lines).join('\n');
}
function exportVisitorsCsv(){
  const rows = visitorsFiltered();
  if(!rows.length){ toast('Nothing to export', 'err'); return; }
  const blob = new Blob([visitorsCsv(rows)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'visitors-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
function renderVisitors(){
  const todayLocal = new Date().toLocaleDateString('en-CA');
  let todayN = 0, total = 0;
  const countries = new Set(), cities = new Set();
  VISITORS.forEach(e => {
    if(isLocalhostSite(e.site)) return;
    total++;
    if(e.country) countries.add(String(e.country).toUpperCase());
    if(e.city) cities.add(String(e.city));
    const d = new Date(e.at);
    if(!isNaN(d) && d.toLocaleDateString('en-CA') === todayLocal) todayN++;
  });
  $('vTotal').textContent = total;
  $('vToday').textContent = todayN;
  $('vCountries').textContent = countries.size;
  $('vCities').textContent = cities.size;
  const rows = visitorsFiltered();
  const tb = document.querySelector('#vTable tbody');
  if(!rows.length){
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--dim)">' +
      (total ? 'No visits match these filters' : 'No visits recorded yet') + '</td></tr>';
  }else{
    tb.innerHTML = rows.map(e => {
      const host = String(e.site || '');
      const src = visitorSource(e);
      return '<tr>' +
        '<td style="white-space:nowrap">' + esc(fmtDateTime(e.at)) + '</td>' +
        '<td title="' + esc(host) + '">' + esc(shortSite(host)) + '</td>' +
        '<td>' + esc(e.page || '/') + (e.element ? ' <span style="color:var(--dim)">· ' + esc(e.element) + '</span>' : '') + '</td>' +
        '<td><span class="v-chip' + (e.type === 'click' ? ' v-click' : '') + '">' + esc(e.type || '') + '</span></td>' +
        '<td>' + (src ? '<span class="v-chip" style="background:rgba(99,102,241,.13);color:#5b5bd6" title="' + esc(e.utm_campaign || '') + '">' + esc(src) + '</span>' : '<span style="color:var(--dim)">—</span>') + '</td>' +
        '<td>' + esc(countryName(e.country) || '—') + '</td>' +
        '<td>' + esc(e.city || e.region || '—') + '</td>' +
        '<td style="font-variant-numeric:tabular-nums">' + esc(e.ip || '—') + '</td>' +
        '<td style="color:var(--dim)" title="' + esc(e.isp || '') + '">' + esc(e.isp || '—') + '</td>' +
        '<td><span class="v-chip">' + esc(e.device || '—') + '</span></td>' +
      '</tr>';
    }).join('');
  }
  $('vCount').textContent = 'Showing ' + rows.length + ' of ' + total + ' events (latest 500 kept)';
}

/* ══ Emails ══ */
let EMAILS = [];
async function loadEmails(manual){
  if(!TOKEN){ showApp(false); return; }
  try{
    const res = await pmsPost({ action: 'emailList', token: TOKEN });
    if(!res.ok){
      if(/unauthor/i.test(res.error || '')){ logout(); toast('Session expired — please sign in again', 'err'); return; }
      throw new Error(res.error || 'Failed to load emails');
    }
    EMAILS = Array.isArray(res.emails) ? res.emails : [];
    renderEmails();
    if(manual) toast('Subscriber list updated');
  }catch(err){ toast(err.message || 'Failed to load emails', 'err'); }
}
function emailsFiltered(){
  const site = $('eSite').value, q = $('eQ').value.trim().toLowerCase();
  return EMAILS.filter(e => {
    if(isLocalhostSite(e.site)) return false;
    if(e.ip && EXCLUDED_IPS.indexOf(e.ip) !== -1) return false;
    if(!siteMatch(e.site, site)) return false;
    if(q){
      const hay = [e.email, e.page, countryName(e.country), e.country, e.city, e.region, e.ip, e.isp, e.device, e.site].join(' ').toLowerCase();
      if(hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}
function emailsCsv(rows){
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = ['When','Email','Website','Page','Country','City','Region','IP','ISP','Device'].join(',');
  const lines = rows.map(e => [e.at, e.email, e.site, e.page, countryName(e.country) || e.country, e.city, e.region, e.ip, e.isp, e.device].map(q).join(','));
  return [head].concat(lines).join('\n');
}
function exportEmailsCsv(){
  const rows = emailsFiltered();
  if(!rows.length){ toast('Nothing to export', 'err'); return; }
  const blob = new Blob([emailsCsv(rows)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'subscribers-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
function renderEmails(){
  const todayLocal = new Date().toLocaleDateString('en-CA');
  let todayN = 0, mainN = 0;
  const countries = new Set();
  const visible = EMAILS.filter(e => !isLocalhostSite(e.site));
  visible.forEach(e => {
    const h = String(e.site || '').toLowerCase();
    if(h === 'thedimetechnology.com.np' || h === 'www.thedimetechnology.com.np') mainN++;
    if(e.country) countries.add(String(e.country).toUpperCase());
    const d = new Date(e.at);
    if(!isNaN(d) && d.toLocaleDateString('en-CA') === todayLocal) todayN++;
  });
  $('eTotal').textContent = visible.length;
  $('eToday').textContent = todayN;
  $('eCountries').textContent = countries.size;
  $('eMain').textContent = mainN;
  const rows = emailsFiltered();
  const tb = document.querySelector('#eTable tbody');
  if(!rows.length){
    tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--dim)">' +
      (visible.length ? 'No emails match this filter' : 'No subscribers yet — the Get Updates boxes will collect them here') + '</td></tr>';
  }else{
    tb.innerHTML = rows.map(e =>
      '<tr>' +
        '<td style="white-space:nowrap">' + esc(fmtDateTime(e.at)) + '</td>' +
        '<td style="font-weight:600">' + esc(e.email) + '</td>' +
        '<td title="' + esc(String(e.site || '')) + '">' + esc(shortSite(e.site)) + '</td>' +
        '<td>' + esc(e.page || '/') + '</td>' +
        '<td>' + esc(countryName(e.country) || '—') + '</td>' +
        '<td>' + esc(e.city || e.region || '—') + '</td>' +
        '<td style="font-variant-numeric:tabular-nums">' + esc(e.ip || '—') + '</td>' +
        '<td style="color:var(--dim)" title="' + esc(e.isp || '') + '">' + esc(e.isp || '—') + '</td>' +
        '<td><span class="v-chip">' + esc(e.device || '—') + '</span></td>' +
      '</tr>'
    ).join('');
  }
  $('eCount').textContent = 'Showing ' + rows.length + ' of ' + visible.length + ' subscribers (latest 500 kept)';
}

/* ══ Social Promoter ══ */
let SOCIAL = [];
let spPlatforms = [];
const PLATFORM_NAMES = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', reddit: 'Reddit', twitter: 'X (Twitter)', tiktok: 'TikTok', youtube: 'YouTube' };
const SOCIAL_COMPOSE_URLS = {
  linkedin: 'https://www.linkedin.com/feed/',
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  reddit: 'https://www.reddit.com/',
  twitter: 'https://twitter.com/',
  tiktok: 'https://www.tiktok.com/upload',
  youtube: 'https://studio.youtube.com/channel/UC/videos/upload'
};

/* ══ Companies Database ══ */
let COMPANIES = [];

async function loadCompanies(manual){
  if(!TOKEN){ showApp(false); return; }
  try{
    const res = await pmsPost({ action: 'companyList', token: TOKEN });
    if(!res.ok){
      if(/unauthor/i.test(res.error || '')){ logout(); toast('Session expired — please sign in again', 'err'); return; }
      throw new Error(res.error || 'Failed to load companies');
    }
    COMPANIES = Array.isArray(res.companies) ? res.companies : [];
    renderCompanies();
    if(manual) toast('Company list updated');
  }catch(err){ toast(err.message || 'Failed to load companies', 'err'); }
}

function companiesFiltered(){
  const industry = $('coIndustry').value, country = $('coCountry').value, status = $('coStatus').value, q = $('coQ').value.trim().toLowerCase();
  return COMPANIES.filter(c => {
    if(industry && c.industry !== industry) return false;
    if(country && c.country !== country) return false;
    if(status && c.status !== status) return false;
    if(q){
      const hay = [c.name, c.url, c.website, c.industry, c.country, c.notes].join(' ').toLowerCase();
      if(hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

function renderCompanies(){
  // Update stats
  $('coTotal').textContent = COMPANIES.length;
  $('coTargeted').textContent = COMPANIES.filter(c => c.status === 'targeted').length;
  $('coFollowers').textContent = COMPANIES.reduce((sum, c) => sum + (c.followers || 0), 0).toLocaleString();
  // Update filter dropdowns
  const industries = [...new Set(COMPANIES.map(c => c.industry).filter(Boolean))].sort();
  const countries = [...new Set(COMPANIES.map(c => c.country).filter(Boolean))].sort();
  const indSel = $('coIndustry'), ctrySel = $('coCountry');
  const curInd = indSel.value, curCtry = ctrySel.value;
  indSel.innerHTML = '<option value="">All industries</option>' + industries.map(i => '<option value="' + esc(i) + '">' + esc(i) + '</option>').join('');
  ctrySel.innerHTML = '<option value="">All countries</option>' + countries.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
  indSel.value = curInd; ctrySel.value = curCtry;
  // Render table
  const rows = companiesFiltered();
  const tb = document.querySelector('#coTable tbody');
  if(!rows.length){
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--dim)">' +
      (COMPANIES.length ? 'No companies match these filters' : 'No companies yet — click "+ Add Company" or use Bulk Import') + '</td></tr>';
  }else{
    const statusColors = { targeted: '#5b5bd6', contacted: '#d97706', client: '#059669', skip: '#9ca3af' };
    tb.innerHTML = rows.map(c => {
      const statusColor = statusColors[c.status] || '#5b5bd6';
      return '<tr>' +
        '<td><b>' + esc(c.name || 'Untitled') + '</b>' + (c.website ? '<br><a href="' + esc(c.website) + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--dim)">' + esc(c.website) + '</a>' : '') + '</td>' +
        '<td>' + (c.industry ? '<span class="v-chip">' + esc(c.industry) + '</span>' : '—') + '</td>' +
        '<td>' + esc(c.country || '—') + '</td>' +
        '<td style="text-align:right;font-variant-numeric:tabular-nums">' + (c.followers ? c.followers.toLocaleString() : '—') + '</td>' +
        '<td>' + (c.url ? '<a href="' + esc(c.url) + '" target="_blank" rel="noopener" style="font-size:11px">LinkedIn ↗</a>' : '—') + '</td>' +
        '<td><span class="v-chip" style="background:' + statusColor + '22;color:' + statusColor + '">' + esc(c.status || '—') + '</span></td>' +
        '<td style="font-size:11px;color:var(--dim);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(c.notes || '') + '">' + esc(c.notes || '—') + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn btn-ghost btn-sm" onclick="editCompany(\'' + esc(c.id) + '\')" title="Edit">✏️</button> ' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteCompany(\'' + esc(c.id) + '\')" title="Delete" style="color:var(--red)">🗑</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }
  $('coCount').textContent = 'Showing ' + rows.length + ' of ' + COMPANIES.length + ' companies';
}

function openCompanyModal(c){
  const edit = !!c;
  window._editCompanyId = edit ? c.id : null;
  $('companyModalTitle').textContent = edit ? 'Edit Company' : 'Add Company';
  $('coName').value = edit ? (c.name || '') : '';
  $('coUrl').value = edit ? (c.url || '') : '';
  $('coWebsite').value = edit ? (c.website || '') : '';
  $('coIndustryInput').value = edit ? (c.industry || '') : '';
  $('coCountryInput').value = edit ? (c.country || '') : '';
  $('coFollowers').value = edit && c.followers ? c.followers : '';
  $('coSize').value = edit ? (c.size || '') : '';
  $('coStatusInput').value = edit ? (c.status || 'targeted') : 'targeted';
  $('coNotes').value = edit ? (c.notes || '') : '';
  $('coErr').classList.remove('on');
  $('coSave').textContent = edit ? 'Save changes' : 'Save Company';
  $('companyModalBg').classList.add('on');
}

function closeCompanyModal(){ $('companyModalBg').classList.remove('on'); }

function editCompany(id){
  const c = COMPANIES.find(x => x.id === id);
  if(c) openCompanyModal(c);
}

async function deleteCompany(id){
  if(!confirm('Delete this company?')) return;
  try{
    const res = await pmsPost({ action: 'companyDelete', token: TOKEN, id });
    if(!res.ok) throw new Error(res.error || 'Delete failed');
    toast('Company deleted', 'ok');
    await loadCompanies();
  }catch(err){ toast(err.message, 'err'); }
}

$('coSave').addEventListener('click', async () => {
  const name = $('coName').value.trim();
  const url = $('coUrl').value.trim();
  const website = $('coWebsite').value.trim();
  const industry = $('coIndustryInput').value.trim();
  const country = $('coCountryInput').value.trim();
  const followers = $('coFollowers').value ? Number($('coFollowers').value) : 0;
  const size = $('coSize').value;
  const status = $('coStatusInput').value;
  const notes = $('coNotes').value.trim();
  if(!name){ $('coErr').textContent = 'Company name is required'; $('coErr').classList.add('on'); return; }
  const editing = !!window._editCompanyId;
  try{
    let res;
    if(editing){
      res = await pmsPost({ action: 'companyUpdate', token: TOKEN, id: window._editCompanyId, name, url, website, industry, country, followers, size, status, notes });
    }else{
      res = await pmsPost({ action: 'companyCreate', token: TOKEN, name, url, website, industry, country, followers, size, status, notes });
    }
    if(!res.ok) throw new Error(res.error || 'Save failed');
    closeCompanyModal();
    await loadCompanies();
    toast(editing ? 'Company updated' : 'Company added', 'ok');
  }catch(err){
    $('coErr').textContent = err.message || 'Save failed';
    $('coErr').classList.add('on');
  }
});

async function bulkImportCompanies(){
  const input = $('coBulkInput').value.trim();
  if(!input){ toast('Paste company data first', 'err'); return; }
  const lines = input.split('\n').filter(l => l.trim());
  let imported = 0;
  for(const line of lines){
    const parts = line.split('|').map(s => s.trim());
    if(!parts[0]) continue;
    try{
      const res = await pmsPost({ action: 'companyCreate', token: TOKEN,
        name: parts[0] || '', url: parts[1] || '', industry: parts[2] || '', country: parts[3] || '',
        followers: parts[4] ? Number(parts[4]) : 0, status: 'targeted'
      });
      if(res.ok) imported++;
    }catch(_){}
  }
  $('coBulkInput').value = '';
  toast('Imported ' + imported + ' companies', 'ok');
  await loadCompanies();
}

async function loadSocial(manual){
  if(!TOKEN){ showApp(false); return; }
  try{
    const res = await pmsPost({ action: 'socialList', token: TOKEN });
    if(!res.ok){
      if(/unauthor/i.test(res.error || '')){ logout(); toast('Session expired — please sign in again', 'err'); return; }
      throw new Error(res.error || 'Failed to load social posts');
    }
    SOCIAL = Array.isArray(res.posts) ? res.posts : [];
    renderSocial();
    if(manual) toast('Social queue updated');
  }catch(err){ toast(err.message || 'Failed to load social posts', 'err'); }
}

function socialFiltered(){
  const plat = $('sPlatform').value, status = $('sStatus').value, loc = $('sLocation').value, q = $('sQ').value.trim().toLowerCase();
  return SOCIAL.filter(p => {
    if(plat && p.platform !== plat) return false;
    if(status && p.status !== status) return false;
    if(loc){
      const locs = p.locations && p.locations.length ? p.locations : (p.location ? [p.location] : []);
      if(locs.indexOf(loc) === -1) return false;
    }
    if(q){
      const hay = [p.title, p.content, p.url, p.profileUrl, p.tags, p.platform, (p.locations||[]).join(' '), p.location].join(' ').toLowerCase();
      if(hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

function renderSocial(){
  let queued = 0, published = 0, failed = 0;
  const platforms = new Set();
  const locations = new Set();
  SOCIAL.forEach(p => {
    if(p.status === 'queued') queued++;
    else if(p.status === 'published') published++;
    else if(p.status === 'failed') failed++;
    if(p.platform) platforms.add(p.platform);
    if(p.location) locations.add(p.location);
  });
  $('sQueued').textContent = queued;
  $('sPublished').textContent = published;
  $('sFailed').textContent = failed;
  $('sPlatforms').textContent = platforms.size;
  // Update location filter dropdown
  const locSel = $('sLocation');
  const curLoc = locSel.value;
  let locHtml = '<option value="">All locations</option>';
  for(const l of Array.from(locations).sort()){
    locHtml += '<option value="' + esc(l) + '">' + esc(l) + '</option>';
  }
  locSel.innerHTML = locHtml;
  locSel.value = curLoc;
  const rows = socialFiltered();
  const tb = document.querySelector('#sTable tbody');
  if(!rows.length){
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--dim)">' +
      (SOCIAL.length ? 'No posts match these filters' : 'No posts queued yet — click "+ New post" to create one') + '</td></tr>';
  }else{
    tb.innerHTML = rows.map(p => {
      const statusClass = p.status === 'published' ? 's-won' : p.status === 'failed' ? 's-lost' : 's-proposal';
      const platName = PLATFORM_NAMES[p.platform] || p.platform || '—';
      const locs = p.locations && p.locations.length ? p.locations : (p.location ? [p.location] : []);
      const locHtml = locs.length
        ? locs.slice(0, 3).map(c => '<span class="v-chip" style="background:rgba(16,185,129,.13);color:#059669;font-size:10px">📍 ' + esc(c) + '</span>').join(' ') + (locs.length > 3 ? ' <span style="color:var(--dim);font-size:10px">+' + (locs.length - 3) + '</span>' : '')
        : '<span style="color:var(--dim)">🌍 Global</span>';
      const impHtml = p.impressions
        ? '<span class="v-chip" style="background:rgba(99,102,241,.13);color:#5b5bd6" title="' + esc(p.notes || '') + '">' + p.impressions.toLocaleString() + ' 👁</span>' + (p.engagement ? '<br><span style="font-size:10px;color:var(--dim)">' + p.engagement + ' eng</span>' : '')
        : '<span style="color:var(--dim);font-size:11px">—</span>';
      return '<tr>' +
        '<td><b>' + esc(p.title || 'Untitled') + '</b>' + (p.notes ? '<br><span style="font-size:10px;color:var(--dim)">' + esc(p.notes) + '</span>' : '') + '</td>' +
        '<td><span class="v-chip">' + esc(platName) + '</span></td>' +
        '<td>' + locHtml + '</td>' +
        '<td style="text-align:center">' + impHtml + '</td>' +
        '<td><span class="pill ' + statusClass + '"><span class="dot"></span>' + esc(p.status || 'queued') + '</span></td>' +
        '<td style="white-space:nowrap;font-size:12px">' + esc(p.scheduledAt ? fmtDateTime(p.scheduledAt) : '—') + '</td>' +
        '<td style="white-space:nowrap">' +
          (p.status === 'queued' ? '<button class="btn btn-primary btn-sm" onclick="copyAndOpenSocial(\'' + esc(p.id) + '\')" title="Copy content and open platform">📋</button> ' : '') +
          (p.status === 'published' ? '<button class="btn btn-ghost btn-sm" onclick="quickImpressions(\'' + esc(p.id) + '\')" title="Update impressions">📊</button> ' : '') +
          '<button class="btn btn-ghost btn-sm" onclick="editSocial(\'' + esc(p.id) + '\')" title="Edit post">✏️</button> ' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteSocial(\'' + esc(p.id) + '\')" title="Delete" style="color:var(--red)">🗑</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }
  $('sCount').textContent = 'Showing ' + rows.length + ' of ' + SOCIAL.length + ' posts';
}

function openSocialModal(p){
  const edit = !!p;
  window._editSocialId = edit ? p.id : null;
  $('socialModalTitle').textContent = edit ? 'Edit social post' : 'New social post';
  $('spTitle').value = edit ? (p.title || '') : '';
  $('spContent').value = edit ? (p.content || '') : '';
  $('spUrl').value = edit ? (p.url || '') : '';
  $('spProfileUrl').value = edit ? (p.profileUrl || '') : '';
  $('spTags').value = edit ? (p.tags || '') : '';
  $('spSchedule').value = edit && p.scheduledAt ? p.scheduledAt.slice(0, 16) : '';
  $('spImpressions').value = edit && p.impressions ? p.impressions : '';
  $('spEngagement').value = edit && p.engagement ? p.engagement : '';
  $('spNotes').value = edit ? (p.notes || '') : '';
  spPlatforms = edit && p.platforms ? p.platforms.slice() : (edit && p.platform ? [p.platform] : []);
  document.querySelectorAll('#spPlatforms .chip').forEach(ch => {
    const on = spPlatforms.indexOf(ch.dataset.v) !== -1;
    ch.classList.toggle('on', on);
  });
  spLocations = edit && p.locations ? p.locations.slice() : (edit && p.location ? [p.location] : []);
  $('spLocCont').value = '';
  $('spLocCountry').innerHTML = '<option value="">All countries</option>';
  renderSpLocChips();
  initSpLocCascade();
  $('spErr').classList.remove('on');
  $('spSave').textContent = edit ? 'Save changes' : 'Queue post';
  $('socialModalBg').classList.add('on');
}

let spLocations = [];
let spLocIdx = null;

async function ensureSpLocIdx(){
  if(spLocIdx) return spLocIdx;
  try{
    const res = await fetch('locations/index.json');
    const data = await res.json();
    spLocIdx = data.continents || [];
  }catch(_){ spLocIdx = []; }
  return spLocIdx;
}

async function initSpLocCascade(){
  await ensureSpLocIdx();
  const contSel = $('spLocCont');
  if(contSel.dataset.init) return;
  let html = '<option value="">Select continent…</option>';
  for(const cont of spLocIdx){
    html += '<option value="' + esc(cont.code) + '">' + esc(cont.name) + '</option>';
  }
  contSel.innerHTML = html;
  contSel.dataset.init = '1';
  contSel.onchange = () => {
    const cc = contSel.value;
    const countrySel = $('spLocCountry');
    if(!cc){
      countrySel.innerHTML = '<option value="">Select country…</option>';
      return;
    }
    const cont = spLocIdx.find(c => c.code === cc);
    let ch = '<option value="">Select country…</option>';
    ch += '<option value="__CONTINENT__">📍 All of ' + esc(cont ? cont.name : '') + '</option>';
    for(const c of (cont ? cont.countries : [])){
      ch += '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>';
    }
    countrySel.innerHTML = ch;
  };
  $('spLocCountry').onchange = () => {
    const val = $('spLocCountry').value;
    if(!val) return;
    let name = val;
    if(val === '__CONTINENT__'){
      const cont = spLocIdx.find(c => c.code === contSel.value);
      name = 'All ' + (cont ? cont.name : 'Continent');
    }
    if(name && spLocations.indexOf(name) === -1){
      spLocations.push(name);
      renderSpLocChips();
    }
    $('spLocCountry').value = '';
  };
}

function addSpLocAllCountries(){
  if(spLocations.indexOf('All Countries') === -1){
    spLocations.push('All Countries');
    renderSpLocChips();
  }
}

function renderSpLocChips(){
  $('spLocChips').innerHTML = spLocations.length
    ? spLocations.map(c => {
      const isGlobal = c === 'All Countries' || c.indexOf('All ') === 0;
      const bg = isGlobal ? 'rgba(99,102,241,.13)' : 'rgba(16,185,129,.13)';
      const color = isGlobal ? '#5b5bd6' : '#059669';
      return '<span class="chip on" style="background:' + bg + ';color:' + color + '">' + esc(c) + '<span class="chip-x" onclick="removeSpLoc(\'' + esc(c) + '\')">✕</span></span>';
    }).join('')
    : '<span style="color:var(--dim);font-size:12px">No locations selected — defaults to global</span>';
}

function removeSpLoc(name){
  const i = spLocations.indexOf(name);
  if(i !== -1){ spLocations.splice(i, 1); renderSpLocChips(); }
}

function closeSocialModal(){ $('socialModalBg').classList.remove('on'); }

document.querySelectorAll('#spPlatforms .chip').forEach(ch => ch.addEventListener('click', () => {
  const v = ch.dataset.v;
  const idx = spPlatforms.indexOf(v);
  if(idx === -1) spPlatforms.push(v);
  else spPlatforms.splice(idx, 1);
  ch.classList.toggle('on');
}));

$('spSave').addEventListener('click', async () => {
  const title = $('spTitle').value.trim();
  const content = $('spContent').value.trim();
  const url = $('spUrl').value.trim();
  const profileUrl = $('spProfileUrl').value.trim();
  const tags = $('spTags').value.trim();
  const locations = spLocations.slice();
  const schedule = $('spSchedule').value;
  const impressions = $('spImpressions').value ? Number($('spImpressions').value) : 0;
  const engagement = $('spEngagement').value ? Number($('spEngagement').value) : 0;
  const notes = $('spNotes').value.trim();
  if(!title){ $('spErr').textContent = 'Title is required'; $('spErr').classList.add('on'); return; }
  if(!content){ $('spErr').textContent = 'Content is required'; $('spErr').classList.add('on'); return; }
  if(!spPlatforms.length){ $('spErr').textContent = 'Select at least one platform'; $('spErr').classList.add('on'); return; }
  const editing = !!window._editSocialId;
  try{
    let res;
    if(editing){
      res = await pmsPost({ action: 'socialUpdate', token: TOKEN, id: window._editSocialId, title, content, url, profileUrl, tags, locations, platforms: spPlatforms, scheduledAt: schedule || null, impressions, engagement, notes });
    }else{
      res = await pmsPost({ action: 'socialCreate', token: TOKEN, title, content, url, profileUrl, tags, locations, platforms: spPlatforms, scheduledAt: schedule || null, impressions, engagement, notes });
    }
    if(!res.ok) throw new Error(res.error || 'Save failed');
    closeSocialModal();
    await loadSocial();
    toast(editing ? 'Post updated' : 'Post queued', 'ok');
  }catch(err){
    $('spErr').textContent = err.message || 'Save failed';
    $('spErr').classList.add('on');
  }
});

function editSocial(id){
  const p = SOCIAL.find(x => x.id === id);
  if(p) openSocialModal(p);
}

async function deleteSocial(id){
  if(!confirm('Delete this post?')) return;
  try{
    const res = await pmsPost({ action: 'socialDelete', token: TOKEN, id });
    if(!res.ok) throw new Error(res.error || 'Delete failed');
    await loadSocial();
    toast('Post deleted', 'ok');
  }catch(err){ toast(err.message || 'Delete failed', 'err'); }
}

async function publishSocial(id){
  try{
    const res = await pmsPost({ action: 'socialPublish', token: TOKEN, id });
    if(!res.ok) throw new Error(res.error || 'Publish failed');
    await loadSocial();
    toast('Post marked as published', 'ok');
  }catch(err){ toast(err.message || 'Publish failed', 'err'); }
}

async function quickImpressions(id){
  const p = SOCIAL.find(x => x.id === id);
  if(!p) return;
  const imp = prompt('Impressions (views):', p.impressions || '');
  if(imp === null) return;
  const eng = prompt('Engagement (likes/comments):', p.engagement || '');
  if(eng === null) return;
  const notes = prompt('Notes (optional):', p.notes || '');
  if(notes === null) return;
  try{
    const res = await pmsPost({ action: 'socialUpdate', token: TOKEN, id, impressions: Number(imp)||0, engagement: Number(eng)||0, notes: notes.trim() });
    if(!res.ok) throw new Error(res.error || 'Update failed');
    toast('Impressions updated', 'ok');
    await loadSocial();
  }catch(err){ toast(err.message, 'err'); }
}

function copyAndOpenSocial(id){
  const p = SOCIAL.find(x => x.id === id);
  if(!p) return;
  const plat = p.platform || 'linkedin';
  const platName = PLATFORM_NAMES[plat] || plat;
  let text = p.content || '';
  if(p.url) text += '\n\n' + p.url;
  if(p.tags) text += '\n\n' + p.tags;
  const locs = p.locations && p.locations.length ? p.locations : (p.location ? [p.location] : []);
  for(const c of locs){
    text += ' #' + c.replace(/[^a-zA-Z]/g, '');
  }
  // Copy to clipboard
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(() => {
      toast('Content copied — paste it on ' + platName, 'ok');
    }).catch(() => {
      fallbackCopy(text);
      toast('Content copied — paste it on ' + platName, 'ok');
    });
  }else{
    fallbackCopy(text);
    toast('Content copied — paste it on ' + platName, 'ok');
  }
  // Open platform compose page
  let composeUrl = SOCIAL_COMPOSE_URLS[plat] || 'https://www.linkedin.com/feed/';
  if(plat === 'reddit' && p.url){
    composeUrl = 'https://www.reddit.com/submit?url=' + encodeURIComponent(p.url) + '&title=' + encodeURIComponent(p.title || '');
  }else if(plat === 'twitter'){
    composeUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
  }
  window.open(composeUrl, '_blank', 'noopener');
}

function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand('copy'); }catch(_){}
  document.body.removeChild(ta);
}

function viewSocial(id){
  const p = SOCIAL.find(x => x.id === id);
  if(!p) return;
  const platName = PLATFORM_NAMES[p.platform] || p.platform || 'Unknown';
  const locs = p.locations && p.locations.length ? p.locations : (p.location ? [p.location] : []);
  const locHtml = locs.map(c => '<span class="v-chip" style="background:rgba(16,185,129,.13);color:#059669">📍 ' + esc(c) + '</span>').join(' ');
  let html = '<div style="padding:20px;max-width:600px">' +
    '<h3 style="margin-bottom:12px">' + esc(p.title || 'Untitled') + '</h3>' +
    '<div style="margin-bottom:12px"><span class="v-chip">' + esc(platName) + '</span> <span class="pill ' + (p.status === 'published' ? 's-won' : 's-proposal') + '"><span class="dot"></span>' + esc(p.status) + '</span>' + (locs.length ? ' ' + locHtml : '') + '</div>' +
    '<div style="background:var(--surface2);border:1px solid var(--line2);border-radius:10px;padding:16px;margin-bottom:12px;white-space:pre-wrap;font-size:14px;line-height:1.6">' + esc(p.content || '') + '</div>';
  if(p.url) html += '<div style="margin-bottom:8px"><b>Post URL:</b> <a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.url) + '</a></div>';
  if(p.profileUrl) html += '<div style="margin-bottom:8px"><b>Profile URL:</b> <a href="' + esc(p.profileUrl) + '" target="_blank" rel="noopener">' + esc(p.profileUrl) + '</a></div>';
  if(p.tags) html += '<div style="margin-bottom:8px"><b>Tags:</b> ' + esc(p.tags) + '</div>';
  if(p.impressions || p.engagement) html += '<div style="margin-bottom:8px;display:flex;gap:16px">' + (p.impressions ? '<span><b>👁 Impressions:</b> ' + p.impressions.toLocaleString() + '</span>' : '') + (p.engagement ? '<span><b>💬 Engagement:</b> ' + p.engagement.toLocaleString() + '</span>' : '') + '</div>';
  if(p.notes) html += '<div style="margin-bottom:8px"><b>Notes:</b> ' + esc(p.notes) + '</div>';
  if(p.scheduledAt) html += '<div style="margin-bottom:8px"><b>Scheduled:</b> ' + esc(fmtDateTime(p.scheduledAt)) + '</div>';
  if(p.publishedAt) html += '<div style="margin-bottom:8px"><b>Published:</b> ' + esc(fmtDateTime(p.publishedAt)) + '</div>';
  html += '<div style="display:flex;gap:10px;margin-top:16px">' +
    '<button class="btn btn-primary btn-sm" onclick="copyAndOpenSocial(\'' + esc(p.id) + '\');closeDrawer()">📋 Copy & Open</button>' +
    (p.status === 'published' ? '<button class="btn btn-ghost btn-sm" onclick="quickImpressions(\'' + esc(p.id) + '\');closeDrawer()">📊 Update Stats</button>' : '') +
    '<button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Close</button>' +
    '</div></div>';
  $('drawerBody').innerHTML = html;
  $('drawerBg').classList.add('on');
  $('drawer').classList.add('on');
}

/* ══ YouTube Growth Studio ══ */
let YT_VIDEOS = [];
let ytGeneratedPosts = [];

function toggleYTStudio(){
  const el = $('ytStudio');
  const btn = el.previousElementSibling;
  if(el.style.display === 'none'){
    el.style.display = '';
    btn.textContent = '▲ Hide';
  }else{
    el.style.display = 'none';
    btn.textContent = '▼ Show';
  }
}

function ytExtractId(url){
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function generateYTPromo(){
  const url = $('ytUrl').value.trim();
  const title = $('ytTitle').value.trim();
  const keywords = $('ytKeywords').value.split(',').map(s => s.trim()).filter(Boolean);
  const type = $('ytType').value;
  if(!url){ toast('Enter a YouTube URL', 'err'); return; }
  if(!title){ toast('Enter a video title', 'err'); return; }
  const videoId = ytExtractId(url);
  const videoUrl = videoId ? 'https://www.youtube.com/watch?v=' + videoId : url;
  const keywordsStr = keywords.join(', ') || 'software development';
  const tags = keywords.slice(0, 5).map(k => '#' + k.replace(/[^a-zA-Z0-9]/g, '')).join(' ') + ' #TheDimeTechnology #YouTube';

  // Generate platform-specific promotion posts
  const posts = [];
  const hook = title.length > 60 ? title.slice(0, 57) + '...' : title;

  posts.push({
    platform: 'linkedin',
    title: 'New YouTube Video: ' + title,
    content: `🎬 Just published a new video: "${title}"\n\nIn this video, we cover:\n• ${keywords.slice(0, 3).join('\n• ')}\n\nWatch here: ${videoUrl}\n\n#YouTube #ContentCreator ${tags}`,
    url: videoUrl,
    tags: tags
  });

  posts.push({
    platform: 'twitter',
    title: 'New video: ' + hook,
    content: `🎥 New video is live!\n\n"${hook}"\n\n${keywords.slice(0, 2).map(k => '#' + k.replace(/[^a-zA-Z0-9]/g, '')).join(' ')}\n\nWatch: ${videoUrl}`,
    url: videoUrl,
    tags: tags
  });

  posts.push({
    platform: 'facebook',
    title: 'New Video: ' + title,
    content: `🎬 New YouTube Video!\n\n"${title}"\n\n${type === 'tutorial' ? 'In this tutorial, you\'ll learn:' : 'In this video, we cover:'}\n• ${keywords.slice(0, 3).join('\n• ')}\n\n▶️ Watch now: ${videoUrl}\n\nDon't forget to like, comment, and subscribe! 🔔\n\n${tags}`,
    url: videoUrl,
    tags: tags
  });

  posts.push({
    platform: 'reddit',
    title: title,
    content: `Hey everyone! I just published a new video on "${title}".\n\n${type === 'tutorial' ? 'This tutorial covers:' : 'Key topics:'}\n${keywords.slice(0, 4).map(k => '- ' + k).join('\n')}\n\nWould love your feedback! ${videoUrl}`,
    url: videoUrl,
    tags: tags
  });

  posts.push({
    platform: 'instagram',
    title: title,
    content: `🎬 NEW VIDEO IS LIVE!\n\n"${title}"\n\n${type === 'tutorial' ? '📝 Tutorial' : '🎥 Video'} · ${keywords.slice(0, 2).join(' · ')}\n\n👉 Link in bio!\n\n${tags}`,
    url: videoUrl,
    tags: tags
  });

  ytGeneratedPosts = posts;
  renderYTGenerated(videoUrl, title, keywordsStr, type);
  renderYTSeoPreview(title, keywords, type, videoUrl);
  saveYTVideo(url, title, keywords, type);
  toast('Generated ' + posts.length + ' promotion posts', 'ok');
}

function renderYTGenerated(videoUrl, title, keywords, type){
  $('ytGenerated').style.display = '';
  $('ytPosts').innerHTML = '<div style="margin-bottom:8px"><button class="btn btn-primary btn-sm" onclick="queueAllYTPromo()">📋 Queue All Posts</button></div>' +
    posts.map((p, i) => {
      const platName = PLATFORM_NAMES[p.platform] || p.platform;
      const short = p.content.length > 120 ? p.content.slice(0, 117) + '...' : p.content;
      return '<div style="background:var(--surface2);border:1px solid var(--line2);border-radius:8px;padding:10px;display:flex;align-items:center;gap:12px">' +
        '<span class="v-chip" style="min-width:70px">' + esc(platName) + '</span>' +
        '<div style="flex:1;font-size:12px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(short) + '</div>' +
        '<button class="btn btn-primary btn-sm" onclick="queueYTPromo(' + i + ')">+ Queue</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="copyYTPromo(' + i + ')">📋</button>' +
      '</div>';
    }).join('');
}

function renderYTSeoPreview(title, keywords, type, videoUrl){
  const kwStr = keywords.join(', ');
  const hashtags = keywords.slice(0, 5).map(k => '#' + k.replace(/[^a-zA-Z0-9]/g, '')).join(' ');
  const desc = `${title}\n\nIn this ${type === 'tutorial' ? 'tutorial' : 'video'}, we cover ${kwStr}.\n\n🔗 Links:\n• Website: https://business.thedimetechnology.com.np\n• Video: ${videoUrl}\n\n📌 Topics:\n${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}\n\n⏱️ Timestamps:\n0:00 - Introduction\n0:30 - Main Content\n${keywords.length > 1 ? '5:00 - ' + keywords[1] : ''}\n\n🔔 Subscribe for more content!\n\n${hashtags} #YouTube #TheDimeTechnology`;
  const tagsList = [...keywords, 'youtube tutorial', 'software development', 'custom software', 'thedime technology', 'programming'].join(', ');
  $('ytSeoPreview').innerHTML =
    '<div style="margin-bottom:10px"><b style="color:var(--text)">Title (SEO):</b><br>' + esc(title.length > 60 ? title.slice(0, 57) + '...' : title) + '</div>' +
    '<div style="margin-bottom:10px"><b style="color:var(--text)">Description:</b><br><pre style="white-space:pre-wrap;font-family:inherit;margin:4px 0;font-size:11px">' + esc(desc.slice(0, 400)) + '...</pre></div>' +
    '<div style="margin-bottom:10px"><b style="color:var(--text)">Tags:</b><br><span style="font-size:11px">' + esc(tagsList) + '</span></div>' +
    '<div><b style="color:var(--text)">Hashtags:</b><br><span style="font-size:11px">' + esc(hashtags + ' #YouTube #TheDimeTechnology') + '</span></div>';
}

function copyYTPromo(i){
  const p = ytGeneratedPosts[i];
  if(!p) return;
  const platName = PLATFORM_NAMES[p.platform] || p.platform;
  navigator.clipboard.writeText(p.content).then(() => toast('Copied ' + platName + ' post', 'ok')).catch(() => { fallbackCopy(p.content); toast('Copied ' + platName + ' post', 'ok'); });
}

async function queueYTPromo(i){
  const p = ytGeneratedPosts[i];
  if(!p) return;
  try{
    const res = await pmsPost({ action: 'socialCreate', token: TOKEN, title: p.title, content: p.content, url: p.url, tags: p.tags, platforms: [p.platform] });
    if(!res.ok) throw new Error(res.error || 'Failed to queue');
    toast('Queued ' + (PLATFORM_NAMES[p.platform] || p.platform) + ' post', 'ok');
    await loadSocial();
  }catch(err){ toast(err.message, 'err'); }
}

async function queueAllYTPromo(){
  for(let i = 0; i < ytGeneratedPosts.length; i++){
    await queueYTPromo(i);
  }
  toast('All ' + ytGeneratedPosts.length + ' posts queued!', 'ok');
}

/* ══ Channel Profile Booster ══ */
let ytChannelPosts = [];

function generateChannelBoost(){
  const channelUrl = $('ytChannelUrl').value.trim();
  const channelName = $('ytChannelName').value.trim() || 'The Dime Technology';
  const niche = $('ytChannelNiche').value.trim() || 'Software Development';
  const value = $('ytChannelValue').value.trim() || 'custom software tutorials and case studies';
  if(!channelUrl){ toast('Enter your YouTube channel URL', 'err'); return; }
  const handle = channelUrl.match(/@([a-zA-Z0-9_-]+)/) ? '@' + channelUrl.match(/@([a-zA-Z0-9_-]+)/)[1] : channelUrl;
  const tags = niche.split(',').map(s => '#' + s.trim().replace(/[^a-zA-Z0-9]/g, '')).join(' ') + ' #YouTube #Subscribe #TheDimeTechnology';

  const posts = [];

  posts.push({
    platform: 'linkedin',
    title: 'Subscribe to ' + channelName + ' on YouTube',
    content: `🎬 We're growing on YouTube!\n\n${channelName} shares ${value}.\n\n🔔 Subscribe: ${channelUrl}\n\nNew videos every week on ${niche}.\n\n${tags}`,
    url: channelUrl,
    tags: tags
  });

  posts.push({
    platform: 'twitter',
    title: 'Subscribe to our YouTube',
    content: `🎥 We create ${value}\n\n🔔 Subscribe: ${channelUrl}\n\n${niche.split(',').map(s => '#' + s.trim().replace(/[^a-zA-Z0-9]/g, '')).join(' ')}`,
    url: channelUrl,
    tags: tags
  });

  posts.push({
    platform: 'facebook',
    title: 'Join us on YouTube',
    content: `🎬 Want to learn ${niche}?\n\n${channelName} shares ${value}.\n\n🔔 Subscribe now: ${channelUrl}\n\nNew videos every week!\n\n${tags}`,
    url: channelUrl,
    tags: tags
  });

  posts.push({
    platform: 'reddit',
    title: 'Free ' + niche + ' content on YouTube',
    content: `Hey! We share ${value} on our YouTube channel.\n\nIf you're interested in ${niche}, check it out: ${channelUrl}\n\nWould love your feedback on what topics to cover next!`,
    url: channelUrl,
    tags: tags
  });

  posts.push({
    platform: 'instagram',
    title: 'YouTube Channel',
    content: `🎬 NEW ON YOUTUBE!\n\n${channelName}\n\n📺 ${value}\n\n👉 Link in bio!\n\n${tags}`,
    url: channelUrl,
    tags: tags
  });

  ytChannelPosts = posts;
  renderChannelPosts();
  toast('Generated ' + posts.length + ' channel promotion posts', 'ok');
}

function renderChannelPosts(){
  $('ytChannelGenerated').style.display = '';
  $('ytChannelPosts').innerHTML = '<div style="margin-bottom:8px"><button class="btn btn-primary btn-sm" onclick="queueAllChannelBoost()">📋 Queue All Posts</button></div>' +
    ytChannelPosts.map((p, i) => {
      const platName = PLATFORM_NAMES[p.platform] || p.platform;
      const short = p.content.length > 100 ? p.content.slice(0, 97) + '...' : p.content;
      return '<div style="background:var(--surface2);border:1px solid var(--line2);border-radius:8px;padding:10px;display:flex;align-items:center;gap:12px">' +
        '<span class="v-chip" style="min-width:70px">' + esc(platName) + '</span>' +
        '<div style="flex:1;font-size:12px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(short) + '</div>' +
        '<button class="btn btn-primary btn-sm" onclick="queueChannelBoost(' + i + ')">+ Queue</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="copyChannelBoost(' + i + ')">📋</button>' +
      '</div>';
    }).join('');
}

function copyChannelBoost(i){
  const p = ytChannelPosts[i];
  if(!p) return;
  const platName = PLATFORM_NAMES[p.platform] || p.platform;
  navigator.clipboard.writeText(p.content).then(() => toast('Copied ' + platName + ' post', 'ok')).catch(() => { fallbackCopy(p.content); toast('Copied ' + platName + ' post', 'ok'); });
}

async function queueChannelBoost(i){
  const p = ytChannelPosts[i];
  if(!p) return;
  try{
    const res = await pmsPost({ action: 'socialCreate', token: TOKEN, title: p.title, content: p.content, url: p.url, tags: p.tags, platforms: [p.platform] });
    if(!res.ok) throw new Error(res.error || 'Failed to queue');
    toast('Queued ' + (PLATFORM_NAMES[p.platform] || p.platform) + ' post', 'ok');
    await loadSocial();
  }catch(err){ toast(err.message, 'err'); }
}

async function queueAllChannelBoost(){
  for(let i = 0; i < ytChannelPosts.length; i++){
    await queueChannelBoost(i);
  }
  toast('All ' + ytChannelPosts.length + ' channel posts queued!', 'ok');
}

async function loadYTVideos(manual){
  try{
    const res = await pmsPost({ action: 'ytList', token: TOKEN });
    if(res.ok){
      YT_VIDEOS = Array.isArray(res.videos) ? res.videos : [];
      renderYTTable();
      updateYTStats();
      if(manual) toast('YouTube data refreshed');
    }
  }catch(_){}
}

function updateYTStats(){
  $('ytVideos').textContent = YT_VIDEOS.length;
  const promoCount = SOCIAL.filter(p => p.url && p.url.indexOf('youtube.com') !== -1).length;
  $('ytPromos').textContent = promoCount;
  $('ytQueued').textContent = SOCIAL.filter(p => p.status === 'queued').length;
}

function renderYTTable(){
  const tb = document.querySelector('#ytTable tbody');
  if(!YT_VIDEOS.length){
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--dim)">No videos added yet</td></tr>';
    $('ytCount').textContent = '';
    return;
  }
  tb.innerHTML = YT_VIDEOS.map(v => {
    const promoCount = SOCIAL.filter(p => p.url && v.url && p.url.indexOf(v.url) !== -1).length;
    return '<tr>' +
      '<td><b>' + esc(v.title || 'Untitled') + '</b><br><a href="' + esc(v.url) + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--dim)">' + esc(v.url) + '</a></td>' +
      '<td><span class="v-chip">' + esc(v.type || '—') + '</span></td>' +
      '<td style="font-size:11px;color:var(--dim)">' + esc((v.keywords || []).join(', ') || '—') + '</td>' +
      '<td><span class="v-chip" style="background:rgba(99,102,241,.13);color:#5b5bd6">' + promoCount + ' posts</span></td>' +
      '<td style="font-size:11px">' + esc(fmtDateTime(v.createdAt)) + '</td>' +
      '<td><button class="btn btn-ghost btn-sm" onclick="deleteYTVideo(\'' + esc(v.id) + '\')" style="color:var(--red)">🗑</button></td>' +
    '</tr>';
  }).join('');
  $('ytCount').textContent = YT_VIDEOS.length + ' videos tracked';
}

async function deleteYTVideo(id){
  if(!confirm('Delete this video?')) return;
  try{
    const res = await pmsPost({ action: 'ytDelete', token: TOKEN, id });
    if(!res.ok) throw new Error(res.error || 'Delete failed');
    toast('Video deleted', 'ok');
    await loadYTVideos();
  }catch(err){ toast(err.message, 'err'); }
}

// Save video to tracker when generating promo
async function saveYTVideo(url, title, keywords, type){
  const videoId = ytExtractId(url);
  const videoUrl = videoId ? 'https://www.youtube.com/watch?v=' + videoId : url;
  try{
    await pmsPost({ action: 'ytSave', token: TOKEN, url: videoUrl, title, keywords, type });
    await loadYTVideos();
  }catch(_){}
}

// boot
if(TOKEN){
  showApp(true);
  const savedView = (location.hash && location.hash.length > 1) ? location.hash.slice(1) : (localStorage.getItem('briefView') || sessionStorage.getItem('briefView') || 'dashboard');
  const validViews = ['dashboard','campaigns','reporting','visitors','emails','companies','seo','social','youtube'];
  switchView(validViews.indexOf(savedView) !== -1 ? savedView : 'dashboard');
}else{ showApp(false); }
window.addEventListener('hashchange', () => {
  if(!TOKEN) return;
  const v = location.hash.slice(1);
  if(v && v !== VIEW && ['dashboard','campaigns','reporting','visitors','emails','companies','seo','social','youtube'].indexOf(v) !== -1) switchView(v);
});
setInterval(() => {
  if(TOKEN && VIEW === 'dashboard' && $('appView').style.display !== 'none' && document.visibilityState === 'visible') loadList();
}, 60000);
