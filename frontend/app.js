const CFG = window.QUEUELESS_CONFIG;
let currentTicketId = null, currentServiceId = null, idToken = null, pollTimer = null, staffTimer = null;
const $ = (s) => document.querySelector(s);
const message = (s, text = '') => { $(s).textContent = text; };
const escapeHtml = (v = '') => String(v).replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[c]));
const busy = (button, state) => { button.disabled = state; button.dataset.text ||= button.innerHTML; button.innerHTML = state ? 'Please wait…' : button.dataset.text; };

function switchView(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
  document.getElementById(name).scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchView(b.dataset.tab)));

async function loadServices() {
  try {
    const response = await fetch(`${CFG.API_URL}/services`);
    if (!response.ok) throw Error();
    const services = await response.json();
    const options = '<option value="">Select a service</option>' + services.map(s => `<option value="${escapeHtml(s.serviceId)}">${escapeHtml(s.name)}</option>`).join('');
    $('#serviceSelect').innerHTML = options; $('#staffServiceSelect').innerHTML = options;
  } catch { $('#serviceSelect').innerHTML = $('#staffServiceSelect').innerHTML = '<option value="">Could not load services</option>'; message('#joinError', 'We could not load services. Please refresh and try again.'); }
}

$('#joinForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const serviceId = $('#serviceSelect').value, name = $('#nameInput').value.trim() || 'Guest', button = $('#joinBtn'); message('#joinError');
  if (!serviceId) return message('#joinError', 'Please select a service before joining the queue.');
  busy(button, true);
  try {
    const response = await fetch(`${CFG.API_URL}/queue/${encodeURIComponent(serviceId)}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name}) });
    const data = await response.json(); if (!response.ok || !data.ticketId) throw Error(data.message || 'Unable to join the queue.');
    currentTicketId = data.ticketId; currentServiceId = serviceId;
    $('#ticketCard').hidden = false; $('#tokenDisplay').textContent = data.token || '—'; $('#peopleAhead').textContent = data.peopleAhead ?? '—'; $('#estWait').textContent = data.estimatedWaitMinutes ?? '—';
    clearInterval(pollTimer); pollTimer = setInterval(pollStatus, 3000); $('#ticketCard').scrollIntoView({behavior:'smooth',block:'center'});
  } catch (err) { message('#joinError', err.message || 'Unable to join the queue. Please try again.'); } finally { busy(button, false); }
});
$('#leaveQueueBtn').addEventListener('click', () => { clearInterval(pollTimer); currentTicketId = currentServiceId = null; $('#ticketCard').hidden = true; $('#joinForm').reset(); });
async function pollStatus() {
  if (!currentTicketId) return;
  try { const r = await fetch(`${CFG.API_URL}/queue/${encodeURIComponent(currentServiceId)}/status/${encodeURIComponent(currentTicketId)}`); if (!r.ok) return; const d = await r.json(); $('#peopleAhead').textContent=d.peopleAhead??'—'; $('#estWait').textContent=d.estimatedWaitMinutes??'—'; $('#statusText').textContent=d.status==='SERVING'?'● It’s your turn now!':d.status==='COMPLETED'?'● Service completed. Thank you!':'● Waiting for your turn'; if(d.status==='COMPLETED')clearInterval(pollTimer); } catch {}
}

$('#passwordToggle').addEventListener('click', () => { const input=$('#staffPass'), visible=input.type==='text'; input.type=visible?'password':'text'; $('#passwordToggle').textContent=visible?'Show':'Hide'; });
$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const username=$('#staffUser').value.trim(), password=$('#staffPass').value, button=$('#loginBtn'); message('#loginError');
  if(!username || !password) return message('#loginError','Enter both your username and password.'); busy(button,true);
  try {
    const r=await fetch(`https://cognito-idp.${CFG.COGNITO_REGION}.amazonaws.com/`,{method:'POST',headers:{'Content-Type':'application/x-amz-json-1.1','X-Amz-Target':'AWSCognitoIdentityProviderService.InitiateAuth'},body:JSON.stringify({AuthFlow:'USER_PASSWORD_AUTH',ClientId:CFG.COGNITO_CLIENT_ID,AuthParameters:{USERNAME:username,PASSWORD:password}})});
    const d=await r.json(); if(!r.ok || !d.AuthenticationResult?.IdToken) throw Error(d.message || 'Sign-in failed. Please check your details.'); idToken=d.AuthenticationResult.IdToken; $('#loginCard').hidden=true; $('#dashboardCard').hidden=false; await refreshStaff(); clearInterval(staffTimer); staffTimer=setInterval(refreshStaff,4000);
  } catch(err) { message('#loginError',err.message || 'Could not sign in. Check your connection and configuration.'); } finally { busy(button,false); }
});
$('#signOutBtn').addEventListener('click',()=>{idToken=null;clearInterval(staffTimer);$('#loginForm').reset();$('#dashboardCard').hidden=true;$('#loginCard').hidden=false;});
const authFetch=(url,opts={})=>fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:idToken}});
$('#staffServiceSelect').addEventListener('change',refreshStaff);
$('#callNextBtn').addEventListener('click',async()=>{const service=$('#staffServiceSelect').value,button=$('#callNextBtn');message('#staffError');if(!service)return message('#staffError','Select a service before calling the next customer.');busy(button,true);try{const r=await authFetch(`${CFG.API_URL}/queue/${encodeURIComponent(service)}/call-next`,{method:'POST'});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.message||'Unable to call the next customer.')}await refreshStaff()}catch(err){message('#staffError',err.message||'Unable to call the next customer.')}finally{busy(button,false)}});
async function refreshStaff(){const service=$('#staffServiceSelect').value;if(!service||!idToken)return;try{const r=await authFetch(`${CFG.API_URL}/queue/${encodeURIComponent(service)}/staff`);if(!r.ok)throw Error('Unable to refresh the queue.');const d=await r.json(),serving=d.serving||[],waiting=d.waiting||[];$('#servingList').textContent=serving.length?serving.map(t=>`${t.token} (${t.name})`).join(', '):'No customer is currently being served';$('#waitingCount').textContent=`${waiting.length} waiting`;$('#waitingList').innerHTML=waiting.length?waiting.map(t=>`<li><span>${escapeHtml(t.token)}</span><span>${escapeHtml(t.name)}</span></li>`).join(''):'<li><span>Queue is clear</span><span>—</span></li>'}catch(err){message('#staffError',err.message||'Unable to refresh the queue.')}}
loadServices();
