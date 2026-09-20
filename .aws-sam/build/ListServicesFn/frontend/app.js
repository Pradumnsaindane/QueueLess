const CFG = window.QUEUELESS_CONFIG;
let currentTicketId = null, currentServiceId = null, pollTimer = null, idToken = null;

// ---- Tabs ----
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ---- Load services ----
async function loadServices() {
  const res = await fetch(`${CFG.API_URL}/services`);
  const services = await res.json();
  const opts = services.map(s => `<option value="${s.serviceId}">${s.name}</option>`).join('');
  document.getElementById('serviceSelect').innerHTML = opts;
  document.getElementById('staffServiceSelect').innerHTML = opts;
}

// ---- Customer: join ----
document.getElementById('joinBtn').addEventListener('click', async () => {
  const serviceId = document.getElementById('serviceSelect').value;
  const name = document.getElementById('nameInput').value || 'Guest';
  const res = await fetch(`${CFG.API_URL}/queue/${serviceId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  currentTicketId = data.ticketId;
  currentServiceId = serviceId;

  document.getElementById('ticketCard').style.display = 'block';
  document.getElementById('tokenDisplay').textContent = data.token;
  document.getElementById('peopleAhead').textContent = data.peopleAhead;
  document.getElementById('estWait').textContent = data.estimatedWaitMinutes;

  clearInterval(pollTimer);
  pollTimer = setInterval(pollStatus, 3000);
});

async function pollStatus() {
  if (!currentTicketId) return;
  const res = await fetch(`${CFG.API_URL}/queue/${currentServiceId}/status/${currentTicketId}`);
  if (!res.ok) return;
  const data = await res.json();
  document.getElementById('peopleAhead').textContent = data.peopleAhead;
  document.getElementById('estWait').textContent = data.estimatedWaitMinutes;
  const statusEl = document.getElementById('statusText');
  if (data.status === 'SERVING') statusEl.textContent = "It's your turn now!";
  else if (data.status === 'COMPLETED') { statusEl.textContent = 'Service completed. Thank you!'; clearInterval(pollTimer); }
  else statusEl.textContent = 'Waiting...';
}

// ---- Staff: Cognito login (plain fetch, no SDK needed) ----
document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('staffUser').value;
  const password = document.getElementById('staffPass').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  try {
    const res = await fetch(`https://cognito-idp.${CFG.COGNITO_REGION}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CFG.COGNITO_CLIENT_ID,
        AuthParameters: { USERNAME: username, PASSWORD: password }
      })
    });
    const data = await res.json();
    if (!res.ok || !data.AuthenticationResult) {
      errEl.textContent = data.message || 'Login failed';
      return;
    }
    idToken = data.AuthenticationResult.IdToken;
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('dashboardCard').style.display = 'block';
    refreshStaff();
  } catch (e) {
    errEl.textContent = 'Could not reach Cognito — check config.js';
  }
});

document.getElementById('staffServiceSelect').addEventListener('change', refreshStaff);
document.getElementById('callNextBtn').addEventListener('click', async () => {
  const serviceId = document.getElementById('staffServiceSelect').value;
  await authFetch(`${CFG.API_URL}/queue/${serviceId}/call-next`, { method: 'POST' });
  refreshStaff();
});

async function authFetch(url, opts = {}) {
  opts.headers = { ...(opts.headers || {}), Authorization: idToken };
  return fetch(url, opts);
}

async function refreshStaff() {
  const serviceId = document.getElementById('staffServiceSelect').value;
  if (!serviceId || !idToken) return;
  const res = await authFetch(`${CFG.API_URL}/queue/${serviceId}/staff`);
  if (!res.ok) return;
  const data = await res.json();
  document.getElementById('servingList').innerHTML =
    data.serving.length ? data.serving.map(t => `${t.token} (${t.name})`).join(', ') : 'None';
  document.getElementById('waitingList').innerHTML =
    data.waiting.map(t => `<li>${t.token} — ${t.name}</li>`).join('') || '<li>Queue empty</li>';
}

setInterval(() => { if (idToken) refreshStaff(); }, 4000);

loadServices();
