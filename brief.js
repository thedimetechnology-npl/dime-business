const SERVICE_OPTIONS = [
  'Web Development', 'Mobile App Development', 'UI/UX Design', 'E-commerce',
  'Cloud & DevOps', 'Branding & Identity', 'Digital Marketing', 'SEO & Analytics',
  'Maintenance & Support', 'IT Consulting'
];
const FALLBACK_BUDGETS = {
  NPR: ['Under 50,000', '50,000 - 150,000', '150,000 - 500,000', '500,000 - 1,000,000', '1,000,000+'],
  USD: ['Under 1,000', '1,000 - 5,000', '5,000 - 10,000', '10,000 - 25,000', '25,000+']
};
const FALLBACK_TIMELINES = ['ASAP', 'Within 1 month', '1 - 3 months', '3 - 6 months', '6 months+', 'Not sure yet'];

let META = { categories: {}, budgets: FALLBACK_BUDGETS, timelines: FALLBACK_TIMELINES };
let B = Object.assign({
  services: [], description: '', currency: 'NPR', budget: '', timeline: '',
  company: '', person: '', email: '', phone: '', country: '', website: '',
  category: '', subcategory: '', startedAt: Date.now()
}, (() => { try { return JSON.parse(sessionStorage.getItem('dimeBrief')) || {}; } catch (_) { return {}; } })());
if(!B.startedAt) B.startedAt = Date.now();
let step = 1;

function saveB(){ try { sessionStorage.setItem('dimeBrief', JSON.stringify(B)); } catch (_) {} }

/* ── render option groups ── */
function renderChips(){
  document.getElementById('svcChips').innerHTML = SERVICE_OPTIONS.map(s =>
    '<label class="chip' + (B.services.includes(s) ? ' on' : '') + '" data-svc="' + esc(s) + '">' + esc(s) +
    '<input type="checkbox" ' + (B.services.includes(s) ? 'checked' : '') + '></label>'
  ).join('');
  document.querySelectorAll('#svcChips .chip').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const s = el.dataset.svc;
      const i = B.services.indexOf(s);
      if(i >= 0) B.services.splice(i, 1); else B.services.push(s);
      saveB(); renderChips(); hideErr(1);
    });
  });
}
function renderBudgets(){
  const ranges = (META.budgets && META.budgets[B.currency]) || FALLBACK_BUDGETS[B.currency];
  document.getElementById('budgetOpts').innerHTML = ranges.map(r =>
    '<button type="button" class="opt' + (B.budget === r ? ' on' : '') + '" data-b="' + esc(r) + '">' + esc(r) + '</button>'
  ).join('');
  document.querySelectorAll('#budgetOpts .opt').forEach(el => el.addEventListener('click', () => {
    B.budget = el.dataset.b; saveB(); renderBudgets(); hideErr(2);
  }));
}
function renderTimelines(){
  const list = META.timelines || FALLBACK_TIMELINES;
  document.getElementById('timeOpts').innerHTML = list.map(t =>
    '<button type="button" class="opt' + (B.timeline === t ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>'
  ).join('');
  document.querySelectorAll('#timeOpts .opt').forEach(el => el.addEventListener('click', () => {
    B.timeline = el.dataset.t; saveB(); renderTimelines(); hideErr(2);
  }));
}
function renderCategories(){
  const sel = document.getElementById('fCategory');
  const keys = Object.keys(META.categories || {});
  if(!keys.length){ sel.closest('.row2').style.display = 'none'; return; }
  sel.innerHTML = '<option value="">— Select industry —</option>' +
    keys.map(k => '<option' + (B.category === k ? ' selected' : '') + '>' + esc(k) + '</option>').join('');
  renderSubs();
}
function renderSubs(){
  const sub = document.getElementById('fSubcategory');
  const list = (META.categories || {})[B.category] || [];
  if(!list.length){ sub.innerHTML = '<option value="">— Select segment —</option>'; return; }
  sub.innerHTML = '<option value="">— Select segment —</option>' +
    list.map(s => '<option' + (B.subcategory === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
}
function renderCurrency(){
  document.querySelectorAll('#curToggle button').forEach(b =>
    b.classList.toggle('on', b.dataset.cur === B.currency));
}

/* ── step navigation ── */
function showStep(n){
  step = n;
  for(let i = 1; i <= 4; i++) document.getElementById('p' + i).classList.toggle('on', i === n);
  document.getElementById('pDone').classList.remove('on');
  document.querySelectorAll('#progress .pstep').forEach(el => {
    const s = Number(el.dataset.s);
    el.classList.toggle('on', s === n);
    el.classList.toggle('done', s < n);
  });
  if(n === 4) renderReview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showErr(n, msg){
  const el = document.getElementById('e' + n);
  if(msg) el.textContent = msg;
  el.classList.add('on');
}
function hideErr(n){ const el = document.getElementById('e' + n); if(el) el.classList.remove('on'); }

function readStep3(){
  B.company = document.getElementById('fCompany').value.trim();
  B.person = document.getElementById('fPerson').value.trim();
  B.email = document.getElementById('fEmail').value.trim();
  B.phone = document.getElementById('fPhone').value.trim();
  B.country = document.getElementById('fCountry').value.trim();
  B.website = document.getElementById('fWebsite').value.trim();
  saveB();
}
function validate(n){
  if(n === 1){
    if(!B.services.length){ showErr(1); return false; }
    hideErr(1); return true;
  }
  if(n === 2){
    B.description = document.getElementById('fDesc').value.trim();
    saveB();
    if(B.description.length < 30 || !B.budget || !B.timeline){ showErr(2); return false; }
    hideErr(2); return true;
  }
  if(n === 3){
    readStep3();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(B.email);
    if(!B.company || !B.person || !emailOk){ showErr(3); return false; }
    hideErr(3); return true;
  }
  return true;
}
function gotoStep(n){
  if(n > step && !validate(step)) return;
  if(n === 3){ // entering step 3 from 2 — bind inputs
    setTimeout(() => {
      document.getElementById('fDesc').value = B.description;
    }, 0);
  }
  if(n === 4){ readStep3(); if(!validate(2) || !validate(3)) return; }
  if(n < 3 && step === 3) readStep3();
  showStep(n);
}

/* ── review ── */
function renderReview(){
  document.getElementById('fDesc').value = B.description;
  const rows = [
    ['Services', B.services.join(', ')],
    ['Description', B.description.length > 300 ? B.description.slice(0, 300) + '…' : B.description],
    ['Budget', B.currency + ' ' + B.budget],
    ['Timeline', B.timeline],
    ['Company', B.company],
    ['Name', B.person],
    ['Email', B.email],
    ['Phone', B.phone],
    ['Country', B.country],
    ['Website', B.website],
    ['Industry', [B.category, B.subcategory].filter(Boolean).join(' — ')]
  ];
  document.getElementById('revList').innerHTML = rows.map(([k, v]) =>
    '<div class="rev-item"><span class="k">' + esc(k) + '</span><span class="v' + (v ? '' : ' empty') + '">' +
    esc(v || 'not provided') + '</span></div>'
  ).join('');
}

/* ── submit ── */
async function submitBrief(){
  const errBox = document.getElementById('e4');
  errBox.classList.remove('on');
  if(!validate(1) || !validate(2) || !validate(3)){
    gotoStep(!B.services.length ? 1 : (B.description.length < 30 || !B.budget || !B.timeline ? 2 : 3));
    return;
  }
  if(Date.now() - (B.startedAt || 0) < 3000){
    errBox.textContent = 'That was quick — please take a moment to review your brief and submit again.';
    errBox.classList.add('on');
    return;
  }
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Sending…';
  try{
    const res = await pmsPost({
      action: 'briefSubmit',
      services: B.services, description: B.description,
      budget: B.budget, currency: B.currency, timeline: B.timeline,
      company: B.company, person: B.person, email: B.email, phone: B.phone,
      country: B.country, website: B.website,
      category: B.category, subcategory: B.subcategory,
      website_bot: document.getElementById('fHoneypot').value
    });
    if(!res.ok) throw new Error(res.error || 'Submission failed');
    document.getElementById('doneEmail').textContent = B.email;
    document.getElementById('doneRef').textContent = 'Ref: ' + res.id;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
    document.getElementById('pDone').classList.add('on');
    document.querySelectorAll('#progress .pstep').forEach(el => { el.classList.remove('on'); el.classList.add('done'); });
    try { sessionStorage.removeItem('dimeBrief'); } catch (_) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }catch(err){
    errBox.textContent = err.message || 'Could not submit — please try again.';
    errBox.classList.add('on');
  }finally{
    btn.disabled = false;
    btn.textContent = 'Submit my brief ✓';
  }
}

/* ── init ── */
document.getElementById('fDesc').addEventListener('input', e => {
  document.getElementById('descCount').textContent = e.target.value.length;
});
document.querySelectorAll('#curToggle button').forEach(b => b.addEventListener('click', () => {
  B.currency = b.dataset.cur;
  const ranges = (META.budgets && META.budgets[B.currency]) || FALLBACK_BUDGETS[B.currency];
  if(!ranges.includes(B.budget)) B.budget = '';
  saveB(); renderCurrency(); renderBudgets();
}));
['fCompany','fPerson','fEmail','fPhone','fCountry','fWebsite'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => { if(step === 3) readStep3(); });
});
document.getElementById('fCategory').addEventListener('change', e => {
  B.category = e.target.value; B.subcategory = ''; saveB(); renderSubs();
});
document.getElementById('fSubcategory').addEventListener('change', e => {
  B.subcategory = e.target.value; saveB();
});

(async function init(){
  renderChips(); renderCurrency(); renderBudgets(); renderTimelines();
  // restore step-3 inputs from state
  document.getElementById('fCompany').value = B.company || '';
  document.getElementById('fPerson').value = B.person || '';
  document.getElementById('fEmail').value = B.email || '';
  document.getElementById('fPhone').value = B.phone || '';
  document.getElementById('fCountry').value = B.country || '';
  document.getElementById('fWebsite').value = B.website || '';
  document.getElementById('fDesc').value = B.description || '';
  document.getElementById('descCount').textContent = (B.description || '').length;
  try{
    const meta = await pmsPost({ action: 'briefMeta' });
    if(meta.ok) META = Object.assign(META, meta);
  }catch(_){ /* keep fallbacks */ }
  renderBudgets(); renderTimelines(); renderCategories();
})();
