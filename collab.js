/* Collab Board — creators watch each other, earn/spend credits */
const $ = id => document.getElementById(id);
let CB_TOKEN = localStorage.getItem('collabToken') || '';
let CB_ME = null;

async function cbApi(body){
  const r = await fetch('/api/collab', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(Object.assign({ token: CB_TOKEN }, body)),
    signal: AbortSignal.timeout(20000)
  });
  const j = await r.json().catch(() => ({ error:'Server error' }));
  if(j.error) throw new Error(j.error);
  return j;
}

function cbEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function cbFmt(n){
  n = Number(n) || 0;
  if(n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if(n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return String(n);
}

/* ── join ── */
$('cbJoinBtn').addEventListener('click', async () => {
  const btn = $('cbJoinBtn');
  $('cbErr').style.display = 'none';
  btn.disabled = true; btn.textContent = 'Joining…';
  try{
    const res = await cbApi({ op:'join', name:$('cbName').value.trim(), channel:$('cbChannel').value.trim(), invite:$('cbInvite').value.trim() });
    CB_TOKEN = res.token;
    localStorage.setItem('collabToken', CB_TOKEN);
    toast('Welcome! You have 2 free credits', 'ok');
    cbShowApp();
  }catch(err){
    $('cbErr').textContent = err.message;
    $('cbErr').style.display = '';
  }finally{
    btn.disabled = false; btn.textContent = 'Join & get 2 free credits';
  }
});

function cbLogout(){
  CB_TOKEN = ''; CB_ME = null;
  localStorage.removeItem('collabToken');
  $('cbApp').style.display = 'none';
  $('cbJoin').style.display = '';
}

/* ── app ── */
async function cbShowApp(){
  $('cbJoin').style.display = 'none';
  $('cbApp').style.display = '';
  await cbRefresh();
}

async function cbRefresh(){
  try{
    const me = await cbApi({ op:'me' });
    CB_ME = me;
    $('cbMeName').textContent = me.creator.name;
    $('cbMeChannel').textContent = me.creator.channel_url;
    $('cbCredits').textContent = me.creator.credits;
    $('cbStatTasks').textContent = me.tasksDone;
    $('cbStatCreators').textContent = me.community.creators;
    $('cbStatPool').textContent = me.community.pool;
    $('cbBoostBtn').disabled = me.creator.credits < 1;
    $('cbBoostBtn').textContent = me.creator.credits < 1
      ? 'Not enough credits — do tasks first'
      : '🚀 Boost — spend 1 credit';
    cbRenderMyVideos(me.videos);
    await cbLoadPool();
  }catch(err){
    toast(err.message, 'err');
    if(/not signed in/i.test(err.message)) cbLogout();
  }
}

async function cbLoadPool(){
  const box = $('cbPool');
  try{
    const res = await cbApi({ op:'pool' });
    if(!res.items.length){
      box.innerHTML = '<div style="font-size:12.5px;color:var(--dim);padding:8px 0">Pool is empty right now. Boost your video or invite more creators — share this page: <b>' + esc(location.origin + '/collab.html') + '</b></div>';
      return;
    }
    box.innerHTML = res.items.map(v =>
      '<div class="cb-video">' +
        '<b>' + esc(v.title || 'Untitled video') + '</b>' +
        '<div class="meta">by ' + esc(v.creator_name) + ' · ' + cbFmt(v.slots_done) + '/' + cbFmt(v.slots_total) + ' creators helped</div>' +
        '<div class="cb-bar"><i style="width:' + Math.round(v.slots_done / Math.max(v.slots_total,1) * 100) + '%"></i></div>' +
        '<div class="cb-row">' +
          '<a class="btn btn-primary btn-sm" href="' + esc(v.url) + '" target="_blank" rel="noopener">▶ Watch, like &amp; subscribe</a>' +
          '<button class="btn btn-ghost btn-sm" data-id="' + esc(v.id) + '" onclick="cbComplete(this)">✅ I did it (+1 credit)</button>' +
        '</div>' +
      '</div>').join('');
  }catch(err){
    box.innerHTML = '<div style="font-size:12.5px;color:var(--red)">' + esc(err.message) + '</div>';
  }
}

async function cbComplete(btn){
  btn.disabled = true;
  try{
    const res = await cbApi({ op:'complete', taskId: btn.dataset.id });
    toast('+' + res.earned + ' credit earned! Balance: ' + res.credits, 'ok');
    await cbRefresh();
  }catch(err){
    toast(err.message, 'err');
    btn.disabled = false;
  }
}

function cbRenderMyVideos(videos){
  const box = $('cbMyVideos');
  if(!videos.length){
    box.innerHTML = '<div style="font-size:12.5px;color:var(--dim)">No boosted videos yet.</div>';
    return;
  }
  box.innerHTML = videos.map(v =>
    '<div class="cb-video">' +
      '<b>' + esc(v.title || v.url) + '</b>' +
      '<div class="meta">' + (v.active ? '🟢 Active' : '✅ Boost complete') + ' · ' + cbFmt(v.slots_done) + '/' + cbFmt(v.slots_total) + ' creators watched</div>' +
      '<div class="cb-bar"><i style="width:' + Math.round(v.slots_done / Math.max(v.slots_total,1) * 100) + '%"></i></div>' +
      '<a href="' + esc(v.url) + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--blue2)">' + esc(v.url) + '</a>' +
    '</div>').join('');
}

/* ── boost ── */
$('cbBoostBtn').addEventListener('click', async () => {
  const btn = $('cbBoostBtn');
  btn.disabled = true; btn.textContent = 'Boosting…';
  try{
    const res = await cbApi({ op:'boost', url:$('cbBoostUrl').value.trim(), title:$('cbBoostTitle').value.trim() });
    toast(res.message, 'ok');
    $('cbBoostUrl').value = ''; $('cbBoostTitle').value = '';
    await cbRefresh();
  }catch(err){
    toast(err.message, 'err');
  }finally{
    btn.disabled = false;
  }
});

/* ── boot ── */
if(CB_TOKEN){
  cbApi({ op:'me' }).then(() => cbShowApp()).catch(() => cbLogout());
}
