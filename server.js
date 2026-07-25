// TRENDHIGHCLOTHING - Native Node.js Server with Secure Flutterwave Payment Endpoints
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Load environment variables from .env file securely on server startup
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
}
loadEnv();

const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

// Helper to parse JSON request bodies
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit for safety
        req.connection.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Helper to call Flutterwave REST API securely from server using FLUTTERWAVE_SECRET_KEY
function callFlutterwaveApi(endpointPath, method = 'GET', payload = null) {
  return new Promise((resolve, reject) => {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    
    if (!secretKey || secretKey.includes('xxxxxxxx')) {
      return resolve({
        statusCode: 400,
        body: {
          status: 'error',
          message: 'Flutterwave Secret Key is not configured. Please set FLUTTERWAVE_SECRET_KEY in your server .env file.'
        }
      });
    }

    const options = {
      hostname: 'api.flutterwave.com',
      port: 443,
      path: endpointPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    };

    const flwReq = https.request(options, (flwRes) => {
      let responseData = '';
      flwRes.on('data', chunk => responseData += chunk);
      flwRes.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ statusCode: flwRes.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: flwRes.statusCode, raw: responseData });
        }
      });
    });

    flwReq.on('error', (err) => {
      console.error('[Flutterwave API Error]:', err.message);
      reject(err);
    });

    if (payload) {
      flwReq.write(JSON.stringify(payload));
    }
    flwReq.end();
  });
}

// Helper to call Supabase REST API for database synchronization
function callSupabaseRest(endpoint, method = 'GET', payload = null) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://xbgohwvxrvvrbjbzbwkx.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

    try {
      const url = new URL(endpoint, supabaseUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : {} });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      });

      req.on('error', (err) => {
        console.error('[Supabase REST Error]:', err.message);
        reject(err);
      });

      if (payload) {
        req.write(JSON.stringify(payload));
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// Local Webhook Log Persistence
const WEBHOOK_LOG_FILE = path.join(__dirname, 'webhook_events.json');

function saveWebhookLog(logItem) {
  try {
    let logs = [];
    if (fs.existsSync(WEBHOOK_LOG_FILE)) {
      const content = fs.readFileSync(WEBHOOK_LOG_FILE, 'utf8');
      logs = content ? JSON.parse(content) : [];
    }
    logs.push(logItem);
    if (logs.length > 100) logs = logs.slice(-100);
    fs.writeFileSync(WEBHOOK_LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.error('[Webhook Log Save Error]:', e.message);
  }
}

function getWebhookLogs() {
  try {
    if (fs.existsSync(WEBHOOK_LOG_FILE)) {
      const content = fs.readFileSync(WEBHOOK_LOG_FILE, 'utf8');
      return content ? JSON.parse(content) : [];
    }
  } catch (e) {
    console.error('[Webhook Log Read Error]:', e.message);
  }
  return [];
}

const server = http.createServer(async (req, res) => {
  // CORS Headers for API calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, verif-hash');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- SECURITY CHECK: Protect sensitive server files ---
  const forbiddenFiles = ['.env', 'server.js', '.git', '.gitignore'];
  if (forbiddenFiles.some(file => pathname.toLowerCase().includes(file))) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'error', message: 'Access Denied: Protected File' }));
  }

  // --- API ENDPOINT 1: Get Safe Public Configuration ---
  if (pathname === '/api/config/public-key' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || ''
    }));
  }

  // --- API ENDPOINT 2: Initialize Flutterwave Payment (Server-Side) ---
  if (pathname === '/api/flutterwave/initialize' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const { amount, email, phone_number, name, tx_ref, redirect_url, title, description } = body;

      if (!amount || !email || !tx_ref) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'error', message: 'Missing required parameters (amount, email, tx_ref)' }));
      }

      const host = req.headers.host || 'localhost:8080';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const defaultRedirect = `${protocol}://${host}/index.html?payment=success`;

      const flwPayload = {
        tx_ref: tx_ref,
        amount: String(amount),
        currency: 'NGN',
        redirect_url: redirect_url || defaultRedirect,
        customer: {
          email: email,
          phone_number: phone_number || '',
          name: name || 'Customer'
        },
        meta: {
          subtotal: body.subtotal || amount,
          shipping: body.shipping || 0
        },
        customizations: {
          title: title || 'TRENDHIGH CLOTHING',
          description: description || 'Order Payment (Subtotal + Shipping)',
          logo: `${protocol}://${host}/logo.png`
        }
      };

      console.log(`[Flutterwave] Initializing payment ${tx_ref} for ₦${amount} (${email})...`);
      const response = await callFlutterwaveApi('/v3/payments', 'POST', flwPayload);

      res.writeHead(response.statusCode, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(response.body || response));
    } catch (err) {
      console.error('[Error Initializing Payment]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
  }

  // --- API ENDPOINT 3: Verify Flutterwave Transaction (Server-Side Verification) ---
  if (pathname === '/api/flutterwave/verify' && req.method === 'GET') {
    try {
      const transaction_id = parsedUrl.searchParams.get('transaction_id');
      const tx_ref = parsedUrl.searchParams.get('tx_ref');

      if (!transaction_id && !tx_ref) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'error', message: 'Missing transaction_id or tx_ref query parameter' }));
      }

      console.log(`[Flutterwave] Verifying transaction ID ${transaction_id || tx_ref} server-side...`);
      
      const endpoint = transaction_id 
        ? `/v3/transactions/${transaction_id}/verify`
        : `/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`;

      const response = await callFlutterwaveApi(endpoint, 'GET');

      res.writeHead(response.statusCode, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(response.body || response));
    } catch (err) {
      console.error('[Error Verifying Payment]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
  }

  // --- API ENDPOINT 4: Flutterwave Webhook Listener ---
  if (pathname === '/api/flutterwave/webhook' && req.method === 'POST') {
    try {
      const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
      const signature = req.headers['verif-hash'];

      // 1. Signature Verification Security Check
      if (secretHash && signature !== secretHash) {
        console.warn('[Webhook Warning]: Invalid signature header verif-hash.');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'error', message: 'Invalid webhook signature' }));
      }

      const payload = await parseRequestBody(req);
      const event = payload.event || 'charge.completed';
      const data = payload.data || {};
      const txRef = data.tx_ref;
      const transactionId = data.id;

      console.log(`[Flutterwave Webhook Received]: Event '${event}' | ID: ${transactionId} | Ref: ${txRef}`);

      // 2. Server-Side Double Verification with Flutterwave API
      let verified = false;
      let verificationData = null;

      if (transactionId || txRef) {
        const verifyEndpoint = transactionId 
          ? `/v3/transactions/${transactionId}/verify`
          : `/v3/transactions/verify_by_reference?tx_ref=${txRef}`;

        const verifyRes = await callFlutterwaveApi(verifyEndpoint, 'GET');
        if (verifyRes.statusCode === 200 && verifyRes.body && verifyRes.body.data && verifyRes.body.data.status === 'successful') {
          verified = true;
          verificationData = verifyRes.body.data;
        }
      }

      // 3. Log Webhook Event
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: event,
        tx_ref: txRef,
        transaction_id: transactionId,
        amount: data.amount,
        customer: data.customer ? data.customer.email : '',
        verified: verified,
        status: data.status
      };
      saveWebhookLog(logEntry);

      // 4. Synchronize Order into Supabase Database if Verified
      if (verified && verificationData) {
        try {
          const orderPayload = {
            id: verificationData.tx_ref || txRef || `THC-FLW-${Date.now()}`,
            customer_name: verificationData.customer ? (verificationData.customer.name || 'Customer') : 'Customer',
            email: verificationData.customer ? verificationData.customer.email : '',
            phone: verificationData.customer ? verificationData.customer.phone_number : '',
            shipping_address: 'Confirmed via Webhook',
            city: 'Lagos',
            state: 'Lagos',
            items: [],
            total: Number(verificationData.amount),
            payment_reference: verificationData.tx_ref || txRef,
            payment_status: 'Paid',
            payment_method: verificationData.payment_type || 'Flutterwave Webhook'
          };

          await callSupabaseRest('/rest/v1/orders', 'POST', orderPayload);
          console.log(`[Webhook Auto-Sync]: Order ${orderPayload.id} logged to database.`);
        } catch (syncErr) {
          console.error('[Webhook Supabase Sync Error]:', syncErr.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'success',
        message: 'Webhook received and processed automatically',
        verified: verified,
        tx_ref: txRef
      }));
    } catch (err) {
      console.error('[Flutterwave Webhook Error]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
  }

  // --- API ENDPOINT 5: Webhook Status & Live Event Logs ---
  if (pathname === '/api/flutterwave/webhook/status' && req.method === 'GET') {
    const host = req.headers.host || 'localhost:8080';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const logs = getWebhookLogs();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'success',
      webhook_endpoint_url: `${protocol}://${host}/api/flutterwave/webhook`,
      secret_hash_configured: !!process.env.FLUTTERWAVE_SECRET_HASH,
      secret_hash_value: process.env.FLUTTERWAVE_SECRET_HASH || 'Not set',
      logged_events_count: logs.length,
      recent_events: logs.slice(-10)
    }));
  }

  // --- STATIC FILE SERVER ---
  const urlPath = pathname === '/' ? 'index.html' : pathname;
  let filePath = path.join(__dirname, urlPath);

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>File Not Found (404)</h1><p>The requested file does not exist.</p>', 'utf-8');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Server Error (500)</h1><p>${error.code}</p>`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`TRENDHIGHCLOTHING Server running at http://localhost:${PORT}/`);
  console.log(`[Security] Flutterwave Secret Key is protected on server-side.`);
});
