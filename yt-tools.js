/* ══ YT Tools — research, outliers, title score, channel tracker ══ */
const YT_TOOLS_API = '/api/yttools';
let ytTab = 'research';
let ytToolsBooted = false;
let ytLastResults = { keywords: null, outliers: null };

const YT_PREFIXES = ['', 'how to ', 'best ', 'what is ', 'why ', 'top ', 'free '];
const YT_POWER_WORDS = ['free','easy','fast','secret','proven','ultimate','best','new','complete','essential','simple','wrong','mistake','hack','stop','never','always','actually','instantly','2026','working'];

function ytToolsInit(){
  renderYtTabs();
  renderYtPanel();
  if(!ytToolsBooted){
    ytToolsBooted = true;
    const h = $('ytResQuery');
    if(h) h.addEventListener('keydown', e => { if(e.key === 'Enter') ytRunKeywords(); });
    const o = $('ytOutQuery');
    if(o) o.addEventListener('keydown', e => { if(e.key === 'Enter') ytRunOutliers(); });
    const s = $('ytScoreInput');
    if(s) s.addEventListener('input', ytRunScore);
  }
}

function renderYtTabs(){
  const tabs = [['research','🔍 Keywords'],['audit','📺 My Channel'],['outliers','📈 Outliers'],['score','✍️ Title Score'],['tracker','📊 Tracker']];
  $('ytToolsTabs').innerHTML = tabs.map(([k,l]) =>
    '<button class="tab' + (ytTab === k ? ' on' : '') + '" data-t="' + k + '">' + l + '</button>').join('');
  document.querySelectorAll('#ytToolsTabs .tab').forEach(el => el.addEventListener('click', () => {
    ytTab = el.dataset.t; renderYtTabs(); renderYtPanel();
  }));
}

function renderYtPanel(){
  ['ytPanelResearch','ytPanelAudit','ytPanelOutliers','ytPanelScore','ytPanelTracker'].forEach(id => { const el = $(id); if(el) el.style.display = 'none'; });
  const map = { research:'ytPanelResearch', audit:'ytPanelAudit', outliers:'ytPanelOutliers', score:'ytPanelScore', tracker:'ytPanelTracker' };
  const el = $(map[ytTab]);
  if(el) el.style.display = 'block';
  if(ytTab === 'tracker') ytRenderHistory();
  if(ytTab === 'score') ytRunScore();
}

async function ytFetch(params){
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(YT_TOOLS_API + '?' + qs, { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({ ok:false, error:'Bad server response' }));
  if(!j.ok) throw new Error(j.error || 'Request failed');
  return j;
}

/* ── Keywords ── */
async function ytRunKeywords(){
  const q = $('ytResQuery').value.trim();
  if(!q){ toast('Enter a topic', 'err'); return; }
  const btn = $('ytResBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Researching…';
  try{
    const seeds = [q].concat(YT_PREFIXES.filter(Boolean).map(p => p + q))
      .concat([q + ' tutorial', q + ' explained', q + ' for beginners']);
    const results = await Promise.allSettled(seeds.map(s => ytFetch({ op:'suggest', q:s })));
    const seen = [];
    for(const r of results){
      if(r.status !== 'fulfilled') continue;
      for(const t of r.value.terms || []){
        const low = t.toLowerCase();
        if(seen.indexOf(low) === -1) seen.push(low);
      }
    }
    ytLastResults.keywords = { query:q, terms:seen };
    ytRenderKeywords();
  }catch(err){ toast(err.message, 'err'); }
  finally{ btn.disabled = false; btn.textContent = '🔍 Research keywords'; }
}

function ytRenderKeywords(){
  const box = $('ytResResults');
  const data = ytLastResults.keywords;
  if(!data){ box.innerHTML = ''; return; }
  const groups = { broad:[], specific:[], longtail:[] };
  for(const t of data.terms){
    const w = t.split(/\s+/).length;
    if(w <= 2) groups.broad.push(t);
    else if(w <= 4) groups.specific.push(t);
    else groups.longtail.push(t);
  }
  const tagStr = data.terms.slice(0, 20).join(', ');
  let html = '<div class="yt-cols">';
  const col = (label, arr, cls) =>
    '<div class="yt-col"><div class="yt-col-head ' + cls + '">' + label + ' (' + arr.length + ')</div>' +
    (arr.length ? arr.map(t => '<div class="yt-kw">' + esc(t) + '</div>').join('') : '<div class="yt-empty">none found</div>') + '</div>';
  html += col('Broad — high volume, hard to rank', groups.broad, 'yt-broad');
  html += col('Specific — your target ✅', groups.specific, 'yt-specific');
  html += col('Long-tail — easiest for small channels ✅', groups.longtail, 'yt-longtail');
  html += '</div>';
  html += '<div class="yt-tagsbox"><div class="yt-col-head">Paste-ready tags (' + tagStr.length + '/500 chars)</div>' +
    '<textarea class="inp" id="ytTagOut" rows="3" readonly style="font-family:monospace;font-size:11px">' + esc(tagStr) + '</textarea>' +
    '<button class="btn btn-primary btn-sm" style="margin-top:6px" onclick="ytCopyTags()">📋 Copy tags</button></div>';
  box.innerHTML = html;
}

function ytCopyTags(){
  const el = $('ytTagOut');
  if(!el) return;
  navigator.clipboard.writeText(el.value).then(() => toast('Tags copied', 'ok')).catch(() => { el.select(); document.execCommand('copy'); toast('Tags copied', 'ok'); });
}

/* ── My Channel audit ── */
let ytAuditData = null;

async function ytRunAudit(){
  const target = ($('ytAuditInput').value || 'https://youtube.com/@TheDimeTechnology').trim();
  if(!target){ toast('Enter your channel URL or @handle', 'err'); return; }
  const btn = $('ytAuditBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Pulling your videos…';
  try{
    const res = await ytFetch({ op:'myvideos', t:target });
    ytAuditData = res;
    ytRenderAudit();
  }catch(err){ toast(err.message, 'err'); }
  finally{ btn.disabled = false; btn.textContent = '📺 Pull videos & analyze'; }
}

function ytCommonWords(titles, stop){
  const counts = {};
  for(const t of titles){
    const words = t.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && stop.indexOf(w) === -1);
    for(const w of words) counts[w] = (counts[w] || 0) + 1;
  }
  return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 12).map(e => e[0]);
}

function ytDaysBetween(a, b){
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function ytRenderAudit(){
  const box = $('ytAuditResults');
  const data = ytAuditData;
  if(!data || !data.videos || !data.videos.length){
    box.innerHTML = '<div class="yt-empty">No videos found on this channel.</div>';
    return;
  }
  const ch = data.channel;
  const vids = data.videos.slice();
  const avg = vids.reduce((s,v) => s + v.views, 0) / vids.length;
  const today = new Date();

  for(const v of vids){
    v.ratio = avg ? v.views / avg : 1;
    v.ageDays = Math.max(1, ytDaysBetween(v.published, today.toISOString().slice(0,10)));
    v.viewsPerDay = v.views / v.ageDays;
    v.isShort = v.duration > 0 && v.duration <= 62;
    v.engRate = v.views ? ((v.likes + v.comments) / v.views * 100) : 0;
  }

  const winners = vids.filter(v => v.ratio >= 1.5 && !v.isShort).sort((a,b) => b.views - a.views).slice(0, 5);
  const losers = vids.filter(v => v.ratio < 0.5 && v.ageDays > 14).sort((a,b) => a.ratio - b.ratio).slice(0, 5);
  const shorts = vids.filter(v => v.isShort);
  const longs = vids.filter(v => !v.isShort);
  const shortsAvg = shorts.length ? shorts.reduce((s,v) => s+v.views,0) / shorts.length : 0;
  const longsAvg = longs.length ? longs.reduce((s,v) => s+v.views,0) / longs.length : 0;

  const sortedDates = vids.map(v => v.published).sort();
  const gaps = [];
  for(let i = 1; i < sortedDates.length; i++) gaps.push(ytDaysBetween(sortedDates[i-1], sortedDates[i]));
  gaps.sort((a,b) => a-b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length/2)] : null;

  const stop = ['the','and','for','with','you','your','how','what','why','this','that','are','can','from','not','best','top','free','new','2024','2025','2026','part','video','channel','official','dime','technology'];
  const winWords = ytCommonWords(winners.map(v => v.title), stop);
  const allWords = ytCommonWords(vids.map(v => v.title), stop);

  /* ── suggestions engine ── */
  const tips = [];
  if(winners.length){
    tips.push({
      kind:'ok', title:'Double down on your winners',
      body:'These videos outperformed your average — make a follow-up or sequel to each:\n' +
        winners.slice(0,3).map(v => '  • ' + v.title + '  (' + ytFmt(v.views) + ' views, ' + v.ratio.toFixed(1) + 'x avg)').join('\n')
    });
    if(winWords.length >= 2){
      tips.push({
        kind:'ok', title:'Your winning topics cluster around: ' + winWords.slice(0,6).join(', '),
        body:'Next video title should combine 2–3 of these words. Example: "' +
          winWords.slice(0,3).map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(' ') + ' — What I Learned (2026)"\n' +
          'Click "Research this topic" below the winner list to find exact search terms.'
      });
    }
  }
  if(losers.length){
    tips.push({
      kind:'warn', title:'Rework titles/thumbnails on ' + losers.length + ' underperformers',
      body:'Old videos stuck below half your average:\n' +
        losers.slice(0,3).map(v => '  • ' + v.title + '  (' + ytFmt(v.views) + ' views, ' + v.ratio.toFixed(2) + 'x avg, ' + v.ageDays + ' days old)').join('\n') +
        '\nCopy the title into the Title Score tab — if it scores <60, rewrite it. Updating old titles/thumbnails often recovers views with zero new filming.'
    });
  }
  if(shorts.length && longs.length){
    if(shortsAvg > longsAvg * 1.5){
      tips.push({ kind:'ok', title:'Shorts outperform your long videos ' + (shortsAvg/longsAvg).toFixed(1) + 'x',
        body:'Shorts avg ' + ytFmt(shortsAvg) + ' vs long avg ' + ytFmt(longsAvg) + '. Post 2–3 Shorts per week as trailers that funnel to your long videos.' });
    }else{
      tips.push({ kind:'info', title:'Long videos are your strength',
        body:'Long-form avg ' + ytFmt(longsAvg) + ' vs Shorts avg ' + ytFmt(shortsAvg) + '. Keep focusing on long tutorials; use Shorts only as clips from them.' });
    }
  }
  if(medianGap !== null){
    if(medianGap > 14){
      tips.push({ kind:'warn', title:'Upload cadence is slow (~1 video / ' + medianGap + ' days)',
        body:'Algorithm rewards consistency. Even 1 video/week beats bursts. Batch-record so you always have 2 videos ready.' });
    }else{
      tips.push({ kind:'ok', title:'Good cadence (~1 video / ' + medianGap + ' days)',
        body:'Keep the schedule. Consistency compounds — each upload trains subscriber notifications.' });
    }
  }
  const avgEng = vids.reduce((s,v) => s+v.engRate,0) / vids.length;
  if(avgEng < 1 && avg > 100){
    tips.push({ kind:'warn', title:'Engagement rate is low (' + avgEng.toFixed(2) + '%)',
      body:'Ask a question in the first 30 seconds and end with a specific CTA ("comment which tool you want next"). Reply to every comment in the first hour — replies count as engagement.' });
  }
  if(ch.subs > 0 && avg > ch.subs * 2){
    tips.push({ kind:'ok', title:'Videos out-reach your subscriber base (' + ytFmt(avg) + ' avg views vs ' + ytFmt(ch.subs) + ' subs)',
      body:'YouTube is already recommending you beyond subscribers — keep topic consistency so the algorithm can categorize the channel.' });
  }
  tips.push({ kind:'info', title:'Weekly routine',
    body:'1) My Channel — check what moved  2) Outliers — find one proven topic in your niche  3) Keywords — lock the exact search term  4) Title Score before publishing  5) Tracker — snapshot every Sunday.' });

  /* ── render ── */
  let html = '<div class="yt-stats" style="margin-bottom:14px">' +
    '<div><b>' + esc(ch.title) + '</b><span>channel</span></div>' +
    '<div><b>' + ytFmt(ch.subs) + '</b><span>subscribers</span></div>' +
    '<div><b>' + vids.length + '</b><span>videos pulled</span></div>' +
    '<div><b>' + ytFmt(Math.round(avg)) + '</b><span>avg views/video</span></div>' +
  '</div>';

  html += '<div class="yt-col-head" style="color:var(--blue2)">💡 What to do next</div>';
  html += tips.map(t =>
    '<div class="seo-issue ' + (t.kind === 'ok' ? 'ok' : t.kind === 'warn' ? 'warn' : '') + '" style="align-items:flex-start;display:block;margin-bottom:8px">' +
    '<div style="font-weight:700;margin-bottom:4px"><span style="display:inline-flex;margin-right:6px">' + (t.kind === 'ok' ? '✓' : t.kind === 'warn' ? '!' : 'i') + '</span>' + esc(t.title) + '</div>' +
    '<div style="white-space:pre-wrap;font-size:12px;line-height:1.5">' + esc(t.body) + '</div></div>').join('');

  html += '<div class="yt-col-head" style="color:var(--blue2);margin-top:16px">All videos (best first)</div>';
  html += '<div style="overflow-x:auto"><table class="rep-table"><thead><tr>' +
    '<th>Video</th><th>Published</th><th>Views</th><th>Vs avg</th><th>Views/day</th><th>Eng%</th><th>Type</th>' +
    '</tr></thead><tbody>' +
    vids.sort((a,b) => b.views - a.views).map(v => {
      const badge = v.ratio >= 1.5 ? '<span class="pill s-won"><span class="dot"></span>' + v.ratio.toFixed(1) + 'x</span>'
        : v.ratio < 0.5 ? '<span class="pill s-lost"><span class="dot"></span>' + v.ratio.toFixed(2) + 'x</span>'
        : '<span class="v-chip">' + v.ratio.toFixed(1) + 'x</span>';
      return '<tr>' +
        '<td style="max-width:300px"><b style="font-size:12px">' + esc(v.title) + '</b><br>' +
          '<a href="https://youtube.com/watch?v=' + esc(v.id) + '" target="_blank" rel="noopener" style="font-size:10px;color:var(--dim)">watch ↗</a> ' +
          '<button class="btn btn-primary btn-sm" style="margin-left:8px;padding:2px 10px;font-size:10.5px" onclick="ytPromoteVideo(\'' + esc(v.id) + '\')">🚀 Promote</button></td>' +
        '<td style="font-size:11px">' + esc(v.published) + '</td>' +
        '<td style="font-size:12px;font-weight:700">' + ytFmt(v.views) + '</td>' +
        '<td>' + badge + '</td>' +
        '<td style="font-size:11px">' + ytFmt(Math.round(v.viewsPerDay)) + '</td>' +
        '<td style="font-size:11px">' + v.engRate.toFixed(2) + '</td>' +
        '<td><span class="v-chip">' + (v.isShort ? 'Short' : 'Long') + '</span></td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';

  if(winners.length){
    html += '<div style="margin-top:14px"><button class="btn btn-primary btn-sm" onclick="ytResearchWinner()">🔍 Research next topic from winner "' + esc(winners[0].title.slice(0,40)) + '…" →</button></div>';
  }
  box.innerHTML = html;
}

function ytResearchWinner(){
  if(!ytAuditData) return;
  const vids = ytAuditData.videos.slice().sort((a,b) => b.views - a.views);
  const words = (vids[0].title || '').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 3).slice(0,3).join(' ');
  ytTab = 'research'; renderYtTabs(); renderYtPanel();
  const input = $('ytResQuery');
  if(input){ input.value = words || 'AI tools'; ytRunKeywords(); }
}

/* ── Promote engine (self-contained) ── */
let ytPromoPosts = [];
let ytPromoVideo = null;

function ytPromoBaselines(){
  try{ return JSON.parse(localStorage.getItem('ytPromoBaselines') || '{}'); }catch(_){ return {}; }
}
function ytSavePromoBaselines(b){
  try{ localStorage.setItem('ytPromoBaselines', JSON.stringify(b)); }catch(_){}
}

function ytPromoteVideo(videoId){
  if(!ytAuditData) return;
  const v = ytAuditData.videos.find(x => x.id === videoId);
  if(!v) return;
  ytPromoVideo = v;
  const url = 'https://www.youtube.com/watch?v=' + v.id;
  const title = v.title;
  const hook = title.length > 60 ? title.slice(0, 57) + '...' : title;
  const words = title.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 3).slice(0, 4);
  const hashtags = words.map(w => '#' + w).join(' ') + ' #TheDimeTechnology #YouTube';

  ytPromoPosts = [
    { platform:'LinkedIn',
      content:'🎬 New video is live:\n\n"' + title + '"\n\nWhat you will learn:\n• ' + words.slice(0,3).map(w => w.charAt(0).toUpperCase()+w.slice(1)).join('\n• ') + '\n\nWatch here: ' + url + '\n\n' + hashtags },
    { platform:'X (Twitter)',
      content:'🎥 New video is live!\n\n"' + hook + '"\n\n' + words.slice(0,2).map(w => '#' + w.replace(/\s/g,'')).join(' ') + ' #YouTube\n\nWatch: ' + url },
    { platform:'Reddit post',
      content:'Hey everyone! I made a video on "' + title + '".\n\nKey points:\n' + words.slice(0,3).map(w => '- ' + w).join('\n') + '\n\nWould love your honest feedback: ' + url },
    { platform:'Facebook',
      content:'🎬 NEW VIDEO!\n\n"' + title + '"\n\n▶️ Watch now: ' + url + '\n\n' + hashtags },
    { platform:'Pinned comment',
      content:'Thanks for watching! Which part was most useful? Next video I will cover: ' + (words[0] || 'a follow-up') + ' — subscribe so you do not miss it.' },
  ];

  $('ytPromoTitle').textContent = '🚀 ' + title.slice(0, 70);
  $('ytPromoSub').textContent = ytFmt(v.views) + ' views · published ' + v.published + ' · ' + v.ratio.toFixed(2) + 'x your average';
  $('ytPromoCollab').href = '/collab.html';

  $('ytPromoPosts').innerHTML = ytPromoPosts.map((p, i) =>
    '<div style="background:var(--surface2);border:1px solid var(--line2,var(--line));border-radius:8px;padding:10px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
        '<span class="v-chip">' + esc(p.platform) + '</span>' +
        '<button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="ytCopyPromo(' + i + ')">📋 Copy</button>' +
      '</div>' +
      '<div style="font-size:11.5px;color:var(--muted);white-space:pre-wrap">' + esc(p.content) + '</div>' +
    '</div>').join('');

  const communities = [
    ['r/learnprogramming', 'https://www.reddit.com/r/learnprogramming/submit'],
    ['r/YouTubePromote', 'https://www.reddit.com/r/YouTubePromote/submit'],
    ['r/SmallYTChannel', 'https://www.reddit.com/r/SmallYTChannel/submit'],
    ['r/tech', 'https://www.reddit.com/r/tech/submit'],
    ['Dev.to article', 'https://dev.to/new'],
    ['Hashnode post', 'https://hashnode.com/new'],
  ];
  $('ytPromoCommunities').innerHTML = communities.map(([name, link]) =>
    '<div style="display:flex;align-items:center;gap:8px">☐ <span style="flex:1">' + esc(name) + '</span>' +
    '<a class="btn btn-ghost btn-sm" href="' + esc(link) + '" target="_blank" rel="noopener">open ↗</a></div>').join('');

  $('ytPromoChecklist').innerHTML = [
    'Boost your video on the Collab Board (button above) — the main views + subs engine',
    'Copy & post the LinkedIn + X versions NOW (first 24h views matter most)',
    'Pin the pinned-comment under the video',
    'Reply to EVERY comment within the first 60 minutes',
    'Add the video to a playlist so viewers chain-watch the next one',
    'Send the link to 5 people personally who care about the topic',
    'Post in 2 communities from the blast list (value-first, no spam)',
  ].map(t => '<div>☐ ' + esc(t) + '</div>').join('');

  ytRenderPromoBaseline();
  $('ytPromoResults').innerHTML = '';
  $('ytPromoBg').classList.add('on');
}

function ytRenderPromoBaseline(){
  if(!ytPromoVideo) return;
  const b = ytPromoBaselines()[ytPromoVideo.id];
  $('ytPromoBaseline').textContent = b
    ? 'Baseline: ' + ytFmt(b.views) + ' views · ' + ytFmt(b.subs) + ' subs · taken ' + b.date + '. Check again after 48h.'
    : 'No baseline yet — take one now, then check again after 48 hours.';
}

async function ytPromoSnapshot(){
  if(!ytPromoVideo) return;
  try{
    const res = await ytFetch({ op:'track', t: ytPromoVideo.id });
    const chRes = await ytFetch({ op:'track', t: (ytAuditData && ytAuditData.channel && ytAuditData.channel.id) || '@TheDimeTechnology' });
    const b = ytPromoBaselines();
    b[ytPromoVideo.id] = {
      date: new Date().toISOString().slice(0,10),
      views: res.row.views, likes: res.row.likes, comments: res.row.comments,
      subs: chRes.row.subs || 0,
    };
    ytSavePromoBaselines(b);
    ytRenderPromoBaseline();
    toast('Baseline saved — promote now, check in 48h', 'ok');
  }catch(err){ toast(err.message, 'err'); }
}

async function ytPromoCheckResults(){
  if(!ytPromoVideo) return;
  const b = ytPromoBaselines()[ytPromoVideo.id];
  if(!b){ toast('Take a baseline snapshot first', 'err'); return; }
  const btn = $('ytPromoCheckBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Checking…';
  try{
    const res = await ytFetch({ op:'track', t: ytPromoVideo.id });
    const chRes = await ytFetch({ op:'track', t: (ytAuditData && ytAuditData.channel && ytAuditData.channel.id) || '@TheDimeTechnology' });
    const dViews = res.row.views - b.views;
    const dLikes = res.row.likes - b.likes;
    const dComments = res.row.comments - b.comments;
    const dSubs = (chRes.row.subs || 0) - b.subs;
    const days = Math.max(0, ytDaysBetween(b.date, new Date().toISOString().slice(0,10)));
    const good = dViews > 0;
    $('ytPromoResults').innerHTML =
      '<div class="yt-stats">' +
        '<div><b style="color:' + (good ? '#6ee7b7' : '#fcd34d') + '">' + (dViews >= 0 ? '+' : '') + ytFmt(dViews) + '</b><span>views (' + days + 'd)</span></div>' +
        '<div><b style="color:' + (dSubs > 0 ? '#6ee7b7' : 'inherit') + '">' + (dSubs >= 0 ? '+' : '') + ytFmt(dSubs) + '</b><span>subscribers</span></div>' +
        '<div><b>' + (dLikes >= 0 ? '+' : '') + ytFmt(dLikes) + '</b><span>likes</span></div>' +
        '<div><b>' + (dComments >= 0 ? '+' : '') + ytFmt(dComments) + '</b><span>comments</span></div>' +
      '</div>' +
      '<p class="panel-sub" style="margin:8px 0 0">' + (good
        ? 'Engine is working. Run the same steps on your NEXT video to compound.'
        : 'No movement yet — finish every checklist item, especially your Collab Board boost. Re-check in 24–48h.') + '</p>';
  }catch(err){ toast(err.message, 'err'); }
  finally{ btn.disabled = false; btn.textContent = '🔍 Check results'; }
}

function ytCopyPromo(i){
  const p = ytPromoPosts[i];
  if(!p) return;
  navigator.clipboard.writeText(p.content).then(() => toast('Copied — paste it now', 'ok')).catch(() => toast('Copy failed', 'err'));
}

function closeYtPromo(){
  $('ytPromoBg').classList.remove('on');
}

/* ── Outliers ── */
async function ytRunOutliers(){
  const q = $('ytOutQuery').value.trim();
  if(!q){ toast('Enter a topic', 'err'); return; }
  const min = $('ytOutMin').value || '3';
  const btn = $('ytOutBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Scanning YouTube…';
  try{
    const res = await ytFetch({ op:'outliers', q, min, max:'25' });
    ytLastResults.outliers = { query:q, items:res.items || [] };
    ytRenderOutliers();
  }catch(err){ toast(err.message, 'err'); }
  finally{ btn.disabled = false; btn.textContent = '📈 Find outliers'; }
}

function ytFmt(n){
  n = Number(n) || 0;
  if(n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if(n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}

function ytRenderOutliers(){
  const box = $('ytOutResults');
  const data = ytLastResults.outliers;
  if(!data){ box.innerHTML = ''; return; }
  if(!data.items.length){ box.innerHTML = '<div class="yt-empty">No outliers found — try a broader topic or lower the minimum score.</div>'; return; }
  box.innerHTML = '<p class="panel-sub">' + data.items.length + ' videos got ' + (ytLastResults.outliers ? '' : '') + 'far more views than their channel average — the topic/format is proven.</p>' +
    data.items.map(r =>
      '<div class="yt-outlier">' +
        '<div class="yt-outlier-score">' + r.score.toFixed(1) + 'x</div>' +
        '<div class="yt-outlier-body">' +
          '<b>' + esc(r.title) + '</b>' +
          '<div class="yt-outlier-meta">' + ytFmt(r.views) + ' views · ' + ytFmt(r.subs) + ' subs · ' + ytFmt(r.video_count) + ' videos · ' + esc(r.channel) + ' · ' + esc(r.published) + '</div>' +
          '<a href="https://youtube.com/watch?v=' + esc(r.video_id) + '" target="_blank" rel="noopener" style="font-size:11px">youtube.com/watch?v=' + esc(r.video_id) + '</a>' +
        '</div>' +
      '</div>').join('');
}

/* ── Title score ── */
function ytRunScore(){
  const title = ($('ytScoreInput').value || '').trim();
  const box = $('ytScoreResults');
  if(!title){ box.innerHTML = ''; return; }
  const checks = [];
  const len = title.length;
  checks.push({ name:'Length 40–60 chars (35–70 ok)', ok: len >= 35 && len <= 70, detail: len + ' chars' });
  const hasNum = /\d/.test(title);
  checks.push({ name:'Contains a number', ok: hasNum, detail: hasNum ? 'yes' : 'no' });
  const lower = title.toLowerCase();
  const found = YT_POWER_WORDS.filter(w => lower.indexOf(w) !== -1);
  checks.push({ name:'Power word / curiosity hook', ok: found.length > 0, detail: found.join(', ') || 'none' });
  const hasSep = /[\(\)\[\]\|\{\}\-–—:·]/.test(title);
  checks.push({ name:'Separator or brackets', ok: hasSep, detail: hasSep ? 'yes' : 'no' });
  const caps = (title.match(/[A-Z]/g) || []).length;
  const capsOk = caps / Math.max(len, 1) < 0.4;
  checks.push({ name:'Not ALL-CAPS heavy', ok: capsOk, detail: caps + ' capitals' });
  const vague = ['my video','new video','untitled','vlog'].indexOf(lower) !== -1;
  checks.push({ name:'Not a vague title', ok: !vague, detail: vague ? 'too vague' : 'ok' });
  const passed = checks.filter(c => c.ok).length;
  const pct = Math.round(passed / checks.length * 100);
  const ring = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  box.innerHTML =
    '<div class="seo-score"><div class="ring" style="--ring:' + ring + '"><b>' + pct + '</b><span>Title score</span></div>' +
    '<div class="seo-issues" style="flex:1">' + checks.map(c =>
      '<div class="seo-issue ' + (c.ok ? 'ok' : 'err') + '"><span>' + (c.ok ? '✓' : '✕') + '</span>' + esc(c.name) + ' <i style="opacity:.7;font-style:normal">(' + esc(c.detail) + ')</i></div>').join('') +
    '</div></div>';
}

/* ── Tracker ── */
function ytHistory(){
  try{ return JSON.parse(localStorage.getItem('ytTrackHistory') || '[]'); }catch(_){ return []; }
}
function ytSaveHistory(rows){
  try{ localStorage.setItem('ytTrackHistory', JSON.stringify(rows.slice(0, 200))); }catch(_){}
}

async function ytRunTrack(){
  const target = $('ytTrackInput').value.trim();
  if(!target){ toast('Enter a channel URL, @handle, or video URL', 'err'); return; }
  const btn = $('ytTrackBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Fetching…';
  try{
    const res = await ytFetch({ op:'track', t:target });
    const rows = ytHistory();
    const row = Object.assign({ date: new Date().toISOString().slice(0,10), kind: res.kind }, res.row);
    rows.unshift(row);
    ytSaveHistory(rows);
    ytRenderHistory();
    toast('Snapshot saved — ' + (res.row.title || ''), 'ok');
    $('ytTrackInput').value = '';
  }catch(err){ toast(err.message, 'err'); }
  finally{ btn.disabled = false; btn.textContent = '📸 Take snapshot'; }
}

function ytRenderHistory(){
  const box = $('ytTrackResults');
  if(!box) return;
  const rows = ytHistory();
  if(!rows.length){ box.innerHTML = '<div class="yt-empty">No snapshots yet. Take one every week to see your growth trend.</div>'; return; }

  const byId = {};
  for(const r of rows){ (byId[r.id] = byId[r.id] || []).push(r); }
  let html = '';
  for(const id of Object.keys(byId)){
    const list = byId[id];
    const latest = list[0];
    const prev = list[1];
    if(latest.kind === 'channel'){
      const dSubs = prev ? latest.subs - prev.subs : null;
      const dViews = prev ? latest.total_views - prev.total_views : null;
      html += '<div class="yt-card"><div class="yt-card-head"><b>' + esc(latest.title) + '</b><span class="v-chip">channel</span></div>' +
        '<div class="yt-stats">' +
          '<div><b>' + ytFmt(latest.subs) + '</b><span>subs</span>' + (dSubs !== null ? '<i class="' + (dSubs >= 0 ? 'up' : 'down') + '">' + (dSubs >= 0 ? '+' : '') + ytFmt(dSubs) + ' vs prev</i>' : '') + '</div>' +
          '<div><b>' + ytFmt(latest.videos) + '</b><span>videos</span></div>' +
          '<div><b>' + ytFmt(latest.total_views) + '</b><span>total views</span>' + (dViews !== null ? '<i class="' + (dViews >= 0 ? 'up' : 'down') + '">' + (dViews >= 0 ? '+' : '') + ytFmt(dViews) + ' vs prev</i>' : '') + '</div>' +
          '<div><b>' + ytFmt(latest.videos ? Math.round(latest.total_views / latest.videos) : 0) + '</b><span>avg views/video</span></div>' +
        '</div>' +
        '<div class="yt-hist">' + list.slice(0, 10).map(r => '<span>' + esc(r.date) + ' · ' + ytFmt(r.subs) + ' subs · ' + ytFmt(r.total_views) + ' views</span>').join('') + '</div>' +
      '</div>';
    }else{
      html += '<div class="yt-card"><div class="yt-card-head"><b>' + esc(latest.title) + '</b><span class="v-chip">video</span></div>' +
        '<div class="yt-stats">' +
          '<div><b>' + ytFmt(latest.views) + '</b><span>views</span></div>' +
          '<div><b>' + ytFmt(latest.likes) + '</b><span>likes</span></div>' +
          '<div><b>' + ytFmt(latest.comments) + '</b><span>comments</span></div>' +
        '</div></div>';
    }
  }
  box.innerHTML = html + '<div style="margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="ytClearHistory()" style="color:var(--red)">🗑 Clear history</button></div>';
}

function ytClearHistory(){
  if(!confirm('Delete all tracker snapshots?')) return;
  try{ localStorage.removeItem('ytTrackHistory'); }catch(_){}
  ytRenderHistory();
  toast('History cleared');
}
