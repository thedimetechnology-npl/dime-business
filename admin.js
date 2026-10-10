let TOKEN = sessionStorage.getItem('briefToken') || '';
let USERNAME = sessionStorage.getItem('briefUser') || '';
let BRIEFS = [];
let filter = 'All';
let openId = null;
let VIEW = 'dashboard';
let CAMPAIGNS = [];
let campFilter = 'open';
let REPORT = null;
let cbMode = 'services';
const $ = id => document.getElementById(id);

const CAMP_SERVICES = ['Development & Maintenance','Code Review & Optimization','Collaboration & Project Management','Support & Bug Fixes','Integration & Deployment','Innovation & Improvement','Software Development','Mobile App','Web Development','Cloud Consulting','DevOps','AI / ML','UI/UX Design','E-Commerce','Cyber Security','App Marketing'];
const CAMP_LOCATIONS = ['World','UK','USA','Australia','India','Germany','Netherlands','UAE','Canada','Nepal','Lalitpur (NP)','Saudi Arabia','Japan'];
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
  document.querySelectorAll('.side-nav a').forEach(a => a.classList.toggle('on', a.dataset.view === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'view-' + v));
  if(v === 'campaigns') loadCampaigns();
  if(v === 'reporting') loadReport();
  if(v === 'visitors') loadVisitors();
  if(v === 'seo'){ loadSeo().then(() => { renderSeoTabs(); renderSeoPanels(); runAudit(); }); }
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
let ccSel = { services: [], locations: [], languages: [] };
function renderCampChips(container, options, key){
  $(container).innerHTML = options.map(o =>
    '<button type="button" class="chip' + (ccSel[key].includes(o) ? ' on' : '') + '" data-cc="' + esc(o) + '">' + esc(o) + '</button>'
  ).join('');
  document.querySelectorAll('#' + container + ' [data-cc]').forEach(el => el.addEventListener('click', () => {
    const v = el.dataset.cc, i = ccSel[key].indexOf(v);
    if(i > -1) ccSel[key].splice(i, 1); else ccSel[key].push(v);
    el.classList.toggle('on');
  }));
}
function openCampModal(c){
  const edit = !!c;
  window._editCampId = edit ? c.id : null;
  $('campModalTitle').textContent = edit ? 'Campaign settings' : 'Start new campaign';
  $('ccName').value = edit ? (c.name || '') : '';
  const durEl = $('ccDuration');
  if(durEl) durEl.value = edit ? (c.duration || 30) : 30;
  ccSel = edit
    ? { services: (c.targets.services || []).slice(), locations: (c.targets.locations || []).slice(), languages: (c.targets.languages || []).slice() }
    : { services: [], locations: [], languages: [] };
  renderCampChips('ccServices', CAMP_SERVICES, 'services');
  renderCampChips('ccLocations', CAMP_LOCATIONS, 'locations');
  renderCampChips('ccLanguages', CAMP_LANGUAGES, 'languages');
  $('ccErr').classList.remove('on');
  $('ccCreate').textContent = edit ? 'Save changes' : 'Create campaign';
  $('campModalBg').classList.add('on');
}
function closeCampModal(){ $('campModalBg').classList.remove('on'); }
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
$('runAudit').addEventListener('click', runAudit);

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
function renderVisitors(){
  const site = $('vSite').value, type = $('vType').value, q = $('vQ').value.trim().toLowerCase();
  const todayLocal = new Date().toLocaleDateString('en-CA');
  let todayN = 0;
  const countries = new Set(), cities = new Set();
  VISITORS.forEach(e => {
    if(e.country) countries.add(String(e.country).toUpperCase());
    if(e.city) cities.add(String(e.city));
    const d = new Date(e.at);
    if(!isNaN(d) && d.toLocaleDateString('en-CA') === todayLocal) todayN++;
  });
  $('vTotal').textContent = VISITORS.length;
  $('vToday').textContent = todayN;
  $('vCountries').textContent = countries.size;
  $('vCities').textContent = cities.size;
  const rows = VISITORS.filter(e => {
    if(type && String(e.type || '') !== type) return false;
    if(!siteMatch(e.site, site)) return false;
    if(q){
      const hay = [e.page, e.element, countryName(e.country), e.country, e.city, e.region, e.ip, e.site, e.type].join(' ').toLowerCase();
      if(hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  const tb = document.querySelector('#vTable tbody');
  if(!rows.length){
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--dim)">' +
      (VISITORS.length ? 'No visits match these filters' : 'No visits recorded yet') + '</td></tr>';
  }else{
    tb.innerHTML = rows.map(e => {
      const host = String(e.site || '');
      return '<tr>' +
        '<td style="white-space:nowrap">' + esc(fmtDateTime(e.at)) + '</td>' +
        '<td title="' + esc(host) + '">' + esc(shortSite(host)) + '</td>' +
        '<td>' + esc(e.page || '/') + (e.element ? ' <span style="color:var(--dim)">· ' + esc(e.element) + '</span>' : '') + '</td>' +
        '<td><span class="v-chip' + (e.type === 'click' ? ' v-click' : '') + '">' + esc(e.type || '') + '</span></td>' +
        '<td>' + esc(countryName(e.country) || '—') + '</td>' +
        '<td>' + esc(e.city || e.region || '—') + '</td>' +
        '<td style="font-variant-numeric:tabular-nums">' + esc(e.ip || '—') + '</td>' +
      '</tr>';
    }).join('');
  }
  $('vCount').textContent = 'Showing ' + rows.length + ' of ' + VISITORS.length + ' events (latest 500 kept)';
}

// boot
if(TOKEN){ showApp(true); loadList(); } else { showApp(false); }
setInterval(() => {
  if(TOKEN && VIEW === 'dashboard' && $('appView').style.display !== 'none' && document.visibilityState === 'visible') loadList();
}, 60000);
