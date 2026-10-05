const SERVICES = [
  { icon:'🛠️', title:'Development & Maintenance', desc:'Full software development lifecycle from concept to deployment. We build scalable, maintainable solutions that grow with your business.' },
  { icon:'⚡', title:'Code Review & Optimization', desc:'Comprehensive code audits to improve quality, performance and security. We find bottlenecks and optimize for efficiency.' },
  { icon:'🤝', title:'Collaboration & Project Management', desc:'Seamless team coordination and agile project management. We integrate with your workflow to ensure smooth delivery.' },
  { icon:'🛟', title:'Support & Bug Fixes', desc:'Reliable post-launch maintenance and rapid bug resolution. We keep your systems running smoothly around the clock.' },
  { icon:'🚀', title:'Integration & Deployment', desc:'Expert DevOps services for CI/CD pipelines, cloud infrastructure and seamless system integrations.' },
  { icon:'💡', title:'Innovation & Improvement', desc:'Ongoing technology evolution and feature enhancements. We help you stay ahead with cutting-edge solutions.' }
];

function renderServices(){
  const el = document.getElementById('servicesGrid');
  if(!el) return;
  el.innerHTML = SERVICES.map(s =>
    '<div class="card"><div class="ic">' + s.icon + '</div><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div>'
  ).join('');
}

const CORE_STACK = [
  'AI', 'ASP.Net', 'DevOps', 'Full-Stack', 'Graphic and Video Editing',
  'Information and Security', 'Mobile App', 'Moodle LMS', 'Network and System',
  'Programming Language', 'Utilities and Scripting', 'WordPress', 'Zoho'
];

const NOT_STACK = [
  'Australia', 'Canada', 'Chile', 'Croatia', 'Cyprus', 'India', 'Jordan',
  'Kazakhstan', 'Malaysia', 'Nepal', 'Russia', 'Saudi Arabia', 'UAE', 'USA',
  'Al Yousuf Motors', 'Awwal Tech', 'Energy Improvement', 'Fortytwo Labs',
  'Infonet Communication', 'Keam Softwares', 'Mazenet Solution', 'Permi Tech',
  'SapSG & Siga Sys', 'SharePro', 'System Canada', 'TI Systems'
];

let WORK_POSTS = [];
let workPage = 1;
const coreActive = new Set();

function postStacks(p){
  const out = [];
  const add = t => { if(t && !NOT_STACK.includes(t) && !out.includes(t)) out.push(t); };
  add(p.category);
  (p.tags || []).forEach(add);
  return out;
}

function postHasCore(p, label){
  return p.category === label || (p.tags || []).indexOf(label) !== -1;
}

function applyWorkFilter(){
  const el = document.getElementById('workGrid');
  if(!el) return;
  const si = document.getElementById('workSearch');
  const q = ((si && si.value) || '').trim().toLowerCase();
  const chips = Array.from(coreActive);
  const filtering = chips.length > 0 || !!q;
  const list = filtering
    ? WORK_POSTS.filter(p => {
        if(chips.length && !chips.some(l => postHasCore(p, l))) return false;
        if(!q) return true;
        const hay = [p.title, p.excerpt, p.category, (p.tags || []).join(' '), postStacks(p).join(' ')].join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      })
    : WORK_POSTS.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const totalPages = Math.max(1, Math.ceil(list.length / 6));
  if(workPage > totalPages) workPage = totalPages;
  if(workPage < 1) workPage = 1;
  const start = (workPage - 1) * 6;
  const pageList = list.slice(start, start + 6);
  const cnt = document.getElementById('workCount');
  if(cnt){
    if(!list.length) cnt.textContent = '';
    else if(filtering) cnt.textContent = list.length + ' of ' + WORK_POSTS.length + ' projects';
    else if(workPage === 1 && totalPages === 1) cnt.textContent = 'Latest ' + list.length + ' of ' + WORK_POSTS.length + ' projects';
    else if(workPage === 1) cnt.textContent = 'Latest 6 of ' + WORK_POSTS.length + ' projects';
    else cnt.textContent = 'Showing ' + (start + 1) + '–' + (start + pageList.length) + ' of ' + WORK_POSTS.length + ' projects';
  }
  const pager = document.getElementById('workPager');
  if(pager){
    const more = list.length > 6;
    pager.classList.toggle('on', more);
    if(more){
      const prev = document.getElementById('workPrev');
      const next = document.getElementById('workNext');
      const ind = document.getElementById('workPageInd');
      prev.disabled = workPage <= 1;
      next.disabled = workPage >= totalPages;
      if(ind) ind.textContent = 'Page ' + workPage + ' of ' + totalPages;
    }
  }
  if(!pageList.length){
    el.innerHTML = '<div class="empty"><b>No projects match that stack</b>Try another keyword or clear a Core Stack filter — or post a brief and we\'ll share references from our backlog.</div>';
    return;
  }
  el.innerHTML = pageList.map(p => {
    const stacks = postStacks(p).filter(s => s !== p.category);
    const stackHTML = stacks.slice(0, 3).map(s => '<span class="schip">' + esc(s) + '</span>').join('') +
      (stacks.length > 3 ? '<span class="schip more">+' + (stacks.length - 3) + '</span>' : '');
    return '<a class="work" href="' + esc(p.url || '#') + '" target="_blank" rel="noopener">' +
      '<div class="thumb"><img src="' + esc(p.image || '') + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"></div>' +
      '<div class="body"><div class="wtop"><span class="tag">' + esc(p.category || 'Case study') + '</span>' +
      '<span class="when">' + esc(fmtDate(p.date)) + (p.readTime ? ' · ' + esc(p.readTime) : '') + '</span></div>' +
      '<h3>' + esc(p.title || '') + '</h3>' +
      '<div class="stackline">' + stackHTML + '</div></div></a>';
  }).join('');
}

function techStackLabels(){
  const counts = {};
  WORK_POSTS.forEach(p => {
    const seen = {};
    const add = l => {
      if(l && NOT_STACK.indexOf(l) === -1 && CORE_STACK.indexOf(l) === -1) seen[l] = true;
    };
    add(p.category);
    (p.tags || []).forEach(add);
    Object.keys(seen).forEach(l => { counts[l] = (counts[l] || 0) + 1; });
  });
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
}

function renderChipRow(cc, labels){
  if(!cc) return;
  cc.innerHTML = labels.map(l => {
    const n = WORK_POSTS.filter(p => postHasCore(p, l)).length;
    return '<button type="button" class="chip' + (n ? '' : ' off') + '" data-core="' + esc(l) + '">' +
      esc(l) + '<span class="n">' + n + '</span></button>';
  }).join('');
  Array.prototype.forEach.call(cc.querySelectorAll('[data-core]'), b => {
    b.addEventListener('click', () => {
      const l = b.getAttribute('data-core');
      if(coreActive.has(l)){ coreActive.delete(l); b.classList.remove('on'); }
      else { coreActive.add(l); b.classList.add('on'); }
      workPage = 1;
      applyWorkFilter();
    });
  });
}

function renderCoreChips(){
  renderChipRow(document.getElementById('coreChips'), CORE_STACK);
  const techRow = document.getElementById('techChips');
  if(techRow){
    const labels = techStackLabels();
    const row = techRow.closest('.core-row');
    if(!labels.length){ if(row) row.style.display = 'none'; }
    else renderChipRow(techRow, labels);
  }
}

async function renderWork(){
  const el = document.getElementById('workGrid');
  if(!el) return;
  try{ WORK_POSTS = (await content('posts')) || []; }catch(e){ WORK_POSTS = []; }
  if(!WORK_POSTS.length){
    el.innerHTML = '<div class="empty"><b>Case studies coming soon</b>In the meantime, post a brief and ask us for references in your industry.</div>';
    return;
  }
  renderCoreChips();
  const si = document.getElementById('workSearch');
  if(si) si.addEventListener('input', () => { workPage = 1; applyWorkFilter(); });
  const prev = document.getElementById('workPrev');
  const next = document.getElementById('workNext');
  if(prev) prev.addEventListener('click', () => { workPage--; applyWorkFilter(); scrollToWork(); });
  if(next) next.addEventListener('click', () => { workPage++; applyWorkFilter(); scrollToWork(); });
  applyWorkFilter();
}

function scrollToWork(){
  const s = document.getElementById('work');
  if(s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function renderClients(){
  const el = document.getElementById('clientsGrid');
  if(!el) return;
  const clients = await content('clients');
  if(!clients.length){ el.closest('section').style.display = 'none'; return; }
  el.innerHTML = clients.map(c =>
    '<div class="client" title="' + esc(c.name) + '"><img src="' + esc(asset(c.logo)) + '" alt="' + esc(c.name) + '" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'b\'),{textContent:\'' + String(c.name || '').replace(/'/g, '') + '\'}))"></div>'
  ).join('');
}

async function renderReviews(){
  const el = document.getElementById('reviewsGrid');
  if(!el) return;
  const all = await content('testimonials');
  if(!all.length){ el.closest('section').style.display = 'none'; return; }
  const avg = all.length ? (all.reduce((s, t) => s + (Number(t.rating) || 5), 0) / all.length) : 5;
  const rv = document.getElementById('ratingVal');
  const rc = document.getElementById('ratingCount');
  if(rv) rv.textContent = avg.toFixed(1);
  if(rc) rc.textContent = all.length + ' verified client reviews';
  const card = t => {
    const av = asset(t.image);
    const who = av
      ? '<img src="' + esc(av) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<div class=&quot;av&quot;>' + esc(initials(t.name)) + '</div>\'">'
      : '<div class="av">' + esc(initials(t.name)) + '</div>';
    const role = [t.designation, t.company].filter(Boolean).join(' · ');
    return '<div class="review">' + starsHTML(t.rating) +
      '<p>“' + esc(t.feedback) + '”</p>' +
      '<div class="who">' + who + '<div><b>' + esc(t.name) + '</b><span>' + esc(role || t.location || '') + '</span></div></div></div>';
  };
  el.innerHTML = all.map(card).join('') + all.map(card).join('');
  const arrows = document.getElementById('revArrows');
  if(arrows) arrows.style.display = all.length >= 3 ? '' : 'none';
  const prev = document.getElementById('revPrev');
  const next = document.getElementById('revNext');
  if(prev) prev.addEventListener('click', () => revGo(1));
  if(next) next.addEventListener('click', () => revGo(-1));
}

const REV_CARD = 336;
let revOffsetState = 0;

function revGo(dir){
  const box = document.getElementById('revOffset');
  const track = document.getElementById('reviewsGrid');
  if(!box || !track) return;
  const n = track.children.length / 2;
  if(n < 1) return;
  const cycle = REV_CARD * n;
  let norm = (revOffsetState + dir * REV_CARD) % cycle;
  if(norm > 0) norm -= cycle;
  revOffsetState = norm;
  box.style.transition = 'none';
  box.style.transform = 'translateX(' + norm + 'px)';
  requestAnimationFrame(() => requestAnimationFrame(() => { box.style.transition = ''; }));
}

renderServices();
renderWork();
renderClients();
renderReviews();
