// Shared helpers for the Dime Technology lead app
const PMS_API = 'https://dimetechnology-pms.info-thedimetechnology.workers.dev/';
const CONTENT_API = 'https://dime-api.info-thedimetechnology.workers.dev/api/content/';
const SITE = 'https://thedimetechnology.com.np';

async function pmsPost(body){
  // text/plain matches the PMS portal's own calls — it is a "simple" header,
  // so the worker's preflight (which doesn't allow custom headers) never blocks us.
  const r = await fetch(PMS_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  if(!r.ok) throw new Error('Network error (' + r.status + ')');
  return r.json();
}

async function content(name){
  try{
    const r = await fetch(CONTENT_API + name, { signal: AbortSignal.timeout(12000) });
    if(!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  }catch(_){ return []; }
}

function asset(p){
  if(!p) return '';
  return /^https?:/i.test(p) ? p : SITE + (p.charAt(0) === '/' ? p : '/' + p);
}

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function initials(name){
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function starsHTML(n){
  const v = Math.round(Number(n) || 5);
  return '<span class="stars">' + '★'.repeat(v) + '☆'.repeat(Math.max(0, 5 - v)) + '</span>';
}

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

let toastTimer = null;
function toast(msg, kind){
  let el = document.getElementById('toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'toast'; el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast on' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast' + (kind ? ' ' + kind : ''); }, 3200);
}

const STATUSES = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost'];
function statusClass(s){
  return { 'New':'s-new', 'Contacted':'s-contacted', 'Proposal Sent':'s-proposal', 'Won':'s-won', 'Lost':'s-lost' }[s] || 's-new';
}
function statusPill(s){
  return '<span class="pill ' + statusClass(s) + '"><span class="dot"></span>' + esc(s || 'New') + '</span>';
}
