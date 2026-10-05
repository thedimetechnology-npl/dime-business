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

async function renderWork(){
  const el = document.getElementById('workGrid');
  if(!el) return;
  const posts = (await content('posts')).slice(0, 3);
  if(!posts.length){
    el.innerHTML = '<div class="empty"><b>Case studies coming soon</b>In the meantime, post a brief and ask us for references in your industry.</div>';
    return;
  }
  el.innerHTML = posts.map(p =>
    '<a class="work" href="' + esc(p.url || '#') + '" target="_blank" rel="noopener">' +
      '<div class="thumb"><img src="' + esc(p.image || '') + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"></div>' +
      '<div class="body"><span class="tag">' + esc(p.category || 'Case study') + '</span>' +
      '<h3>' + esc(p.title || '') + '</h3>' +
      '<div class="when">' + esc(fmtDate(p.date)) + (p.readTime ? ' · ' + esc(p.readTime) : '') + '</div></div></a>'
  ).join('');
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
  const list = all.slice(0, 6);
  if(!list.length){ el.closest('section').style.display = 'none'; return; }
  const avg = all.length ? (all.reduce((s, t) => s + (Number(t.rating) || 5), 0) / all.length) : 5;
  const rv = document.getElementById('ratingVal');
  const rc = document.getElementById('ratingCount');
  if(rv) rv.textContent = avg.toFixed(1);
  if(rc) rc.textContent = all.length + ' verified client reviews';
  el.innerHTML = list.map(t => {
    const av = asset(t.image);
    const who = av
      ? '<img src="' + esc(av) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<div class=&quot;av&quot;>' + esc(initials(t.name)) + '</div>\'">'
      : '<div class="av">' + esc(initials(t.name)) + '</div>';
    const role = [t.designation, t.company].filter(Boolean).join(' · ');
    return '<div class="review">' + starsHTML(t.rating) +
      '<p>“' + esc(t.feedback) + '”</p>' +
      '<div class="who">' + who + '<div><b>' + esc(t.name) + '</b><span>' + esc(role || t.location || '') + '</span></div></div></div>';
  }).join('');
}

renderServices();
renderWork();
renderClients();
renderReviews();
