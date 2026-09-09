// The console script pasted at elvebredd.com/create-listing: it reads the live
// Turnstile token + csrf cookie from that page and POSTs each listing. Elvebredd
// can't be posted server-side (Cloudflare Turnstile), so this is how the
// owner-only Elve trade tools ship their payloads.
export function buildElveScript (payloads: unknown[]): string {
  const p = JSON.stringify(payloads)
  return `(async()=>{if(!window.turnstile){alert('Run this on elvebredd.com/create-listing');return;}const csrf=document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('csrfToken='))?.replace('csrfToken=','')||'';const token=window.turnstile.getResponse();if(!token){alert('No token — reload the page');return;}const payloads=${p};let ok=0,fail=0;for(const p of payloads){p.turnstileToken=token;try{const r=await fetch('/api/create-listing',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','x-csrf-token':csrf},body:JSON.stringify(p)});const d=await r.json();if(d.id||d.success){ok++;console.log('OK',p.ownerGet[0]?.name);}else{fail++;console.error('FAIL',d);}}catch(e){fail++;console.error(e);}}alert('Done: '+ok+' ok, '+fail+' failed');})();`
}
