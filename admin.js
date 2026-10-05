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
function periodLabel(){
  const a = new Date(), b = new Date(Date.now() + 30*24*60*60*1000);
  const f = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return 'From ' + f(a) + ' to ' + f(b);
}
async function loadCampaigns(){
  if(!TOKEN) return;
  try{
    const res = await pmsPost({ action: 'campaignList', token: TOKEN });
    if(!res.ok) throw new Error(res.error || 'Failed to load campaigns');
    CAMPAIGNS = res.campaigns || [];
    $('periodLabel').textContent = periodLabel();
    renderCampTabs(); renderCampList();
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
  return { Active: 's-active', Paused: 's-paused', Draft: 's-draft', Archived: 's-archived' }[s] || 's-draft';
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
    const st = stats[c.id] || { impressions: 0, clicks: 0, boosted: chips.length };
    const spent = (st.clicks * (REPORT ? REPORT.avgCpc : 3.19));
    const pct = c.budget > 0 ? Math.min(100, Math.round(spent / c.budget * 100)) : 0;
    const active = c.status === 'Active';
    return '<div class="camp-card">' +
      '<div class="camp-top">' +
        '<div class="camp-title"><b>' + esc(c.name || ('Campaign #' + (i + 1))) + '</b>' +
          '<span class="camp-status ' + campStatusClass(c.status) + '">' + esc(c.status) + '</span></div>' +
        '<div class="camp-ctrl">' +
          '<label class="switch" title="Toggle campaign"><input type="checkbox" data-camp-toggle="' + esc(c.id) + '"' + (active ? ' checked' : '') + '><span></span></label>' +
          '<button class="icon-btn" data-camp-edit="' + esc(c.id) + '" title="Settings">⚙</button>' +
        '</div>' +
      '</div>' +
      '<div class="camp-targets"><span class="lbl">Targets</span>' +
        '<div class="chips">' + chips.map(x => '<span class="chip static">' + esc(x) + '</span>').join('') + '</div></div>' +
      '<div class="camp-cons"><span class="lbl">Consumption</span>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<span class="cons-num">' + Math.round(spent) + '/' + c.budget + '</span></div>' +
      '<div class="camp-metrics">' +
        '<div><b>' + st.boosted + '</b><span>Boosted directories</span></div>' +
        '<div><b>' + st.impressions + '</b><span>Impressions</span></div>' +
        '<div><b>' + st.clicks + '</b><span>Clicks to profile</span></div>' +
        '<div><b>' + (st.clicks > 0 ? Math.round(spent) + ' credits' : '0 credits') + '</b><span>Cost per click (avg.)</span></div>' +
      '</div></div>';
  }).join('');
  document.querySelectorAll('[data-camp-toggle]').forEach(el => el.addEventListener('change', () => {
    const c = CAMPAIGNS.find(x => x.id === el.dataset.campToggle);
    if(!c) return;
    updateCampaign(c.id, { status: el.checked ? 'Active' : 'Paused' });
  }));
  document.querySelectorAll('[data-camp-edit]').forEach(el => el.addEventListener('click', () => {
    const c = CAMPAIGNS.find(x => x.id === el.dataset.campEdit);
    if(c) openCampModal(c);
  }));
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
  $('ccBudget').value = edit ? (c.budget || 150) : 150;
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
  const budget = Math.max(0, Number($('ccBudget').value) || 0);
  const editing = !!window._editCampId;
  try{
    let res;
    if(editing){
      res = await pmsPost({ action: 'campaignUpdate', token: TOKEN, id: window._editCampId, name, budget, targets: ccSel });
    }else{
      res = await pmsPost({ action: 'campaignCreate', token: TOKEN, name, budget, targets: ccSel });
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
async function loadReport(){
  if(!TOKEN) return;
  try{
    const res = await pmsPost({ action: 'report', token: TOKEN });
    if(!res.ok) throw new Error(res.error || 'Failed to load report');
    REPORT = res;
    if(VIEW === 'campaigns') renderCampList();
    renderRepCards(); renderChart(); renderConv(); renderBreakdown(); renderTable();
  }catch(err){
    toast(err.message || 'Could not load report', 'err');
  }
}
function renderRepCards(){
  const r = REPORT;
  const cards = [
    [r.paidImpressions, 'Paid impressions'],
    [r.paidClicks, 'Paid clicks'],
    [r.organicClicks, 'Organic clicks'],
    [r.conversions, 'Conversions'],
    [r.avgCpc.toFixed(2), 'Average CPC']
  ];
  $('repCards').innerHTML = cards.map(([v, l]) =>
    '<div class="rep-card"><span class="info">i</span><b>' + v + '</b><span>' + l + '</span></div>'
  ).join('');
}
function renderChart(){
  const months = (REPORT && REPORT.months) || [];
  const max = Math.max(1, ...months.map(m => Math.max(m.paid, m.organic, m.credits)));
  $('repChart').innerHTML = '<div class="chart-bars">' + months.map(m => {
    const h = v => Math.round(v / max * 100);
    return '<div class="chart-col">' +
      '<div class="chart-stack">' +
        '<i class="b-cred" style="height:' + h(m.credits) + '%" title="Credits: ' + Math.round(m.credits) + '"></i>' +
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
  const rows = (REPORT && REPORT.clicksBreakdown) || [];
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
  tb.innerHTML = rows.length ? rows.map(p =>
    '<tr><td><span class="pg">▦</span> ' + esc(p.page) + '</td>' +
    '<td>' + esc(p.expertise || '—') + '</td>' +
    '<td>' + esc(p.location || '—') + '</td>' +
    '<td class="num">' + p.impressions + '</td>' +
    '<td class="num">' + p.paidClicks + '</td>' +
    '<td class="num">' + p.organicClicks + '</td>' +
    '<td class="num">' + p.avgCpc.toFixed(2) + '</td></tr>'
  ).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:26px">No page data yet — traffic to your profile will appear here.</td></tr>';
}
$('exportCsv').addEventListener('click', () => {
  const rows = (REPORT && REPORT.topPages) || [];
  const head = 'Page,Expertise,Location,Impressions,Paid clicks,Organic clicks,Avg. CPC';
  const lines = rows.map(p => [p.page, p.expertise || '', p.location || '', p.impressions, p.paidClicks, p.organicClicks, p.avgCpc.toFixed(2)].join(','));
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

document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeDrawer(); closeCampModal(); } });

// boot
if(TOKEN){ showApp(true); loadList(); } else { showApp(false); }
setInterval(() => {
  if(TOKEN && VIEW === 'dashboard' && $('appView').style.display !== 'none' && document.visibilityState === 'visible') loadList();
}, 60000);
