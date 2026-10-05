let TOKEN = sessionStorage.getItem('briefToken') || '';
let USERNAME = sessionStorage.getItem('briefUser') || '';
let BRIEFS = [];
let filter = 'All';
let openId = null;
const $ = id => document.getElementById(id);

function showApp(on){
  $('loginView').style.display = on ? 'none' : 'flex';
  $('appView').style.display = on ? 'block' : 'none';
  if(on && USERNAME) $('whoami').textContent = USERNAME;
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

document.addEventListener('keydown', e => { if(e.key === 'Escape') closeDrawer(); });

// boot
if(TOKEN){ showApp(true); loadList(); } else { showApp(false); }
setInterval(() => {
  if(TOKEN && $('appView').style.display !== 'none' && document.visibilityState === 'visible') loadList();
}, 60000);
