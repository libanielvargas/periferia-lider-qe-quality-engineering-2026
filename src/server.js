import express from 'express';
import crypto from 'node:crypto';
import { registerQualityReview } from './qa-runner.js';
import { fileURLToPath } from 'node:url';
import {
  createClient,
  createOperation,
  findClient,
  findOperation,
  getClientSummary,
  initializeDatabase,
  updateClientBalance
} from './db.js';

initializeDatabase();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/clients', (req, res) => {
  const { name, document, email, balance = 0 } = req.body;
  if (!name || !document || !email) {
    return res.status(400).json({ error: 'name, document and email are required' });
  }

  if (!/^\d{8,10}$/.test(String(document))) {
    return res.status(400).json({ error: 'document must contain 8 to 10 digits' });
  }

  try {
    const client = createClient({
      name,
      document: String(document),
      email,
      balance: Number(balance)
    });
    return res.status(201).json(client);
  } catch (error) {
    if (error.code === 'DUPLICATE_DOCUMENT') {
      return res.status(409).json({ error: 'document already exists' });
    }
    return res.status(500).json({ error: 'unable to create client' });
  }
});

app.get('/api/clients/:id', (req, res) => {
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'client not found' });
  return res.json(client);
});

app.get('/api/clients/:id/summary', (req, res) => {
  const summary = getClientSummary(req.params.id);
  if (!summary) return res.status(404).json({ error: 'client not found' });
  return res.json(summary);
});

app.post('/external/risk', async (req, res) => {
  const mode = process.env.RISK_MODE || 'random';
  await new Promise(resolve => setTimeout(resolve, 150 + Math.floor(Math.random() * 900)));
  if (mode === 'approved') return res.json({ decision: 'approved', score: 820 });
  if (mode === 'rejected') return res.json({ decision: 'rejected', score: 410 });
  const approved = Math.random() > 0.15;
  return res.json({ decision: approved ? 'approved' : 'rejected', score: approved ? 790 : 430 });
});

async function evaluateRisk(clientId, amount) {
  const riskUrl = process.env.RISK_SERVICE_URL || `http://127.0.0.1:${port}/external/risk`;
  const response = await fetch(riskUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.RISK_API_TOKEN || 'local-token'}`
    },
    body: JSON.stringify({ clientId, amount })
  });
  if (!response.ok) throw new Error('risk service unavailable');
  return response.json();
}

app.post('/api/operations', async (req, res) => {
  const clientId = Number(req.body.clientId);
  const amount = Number(req.body.amount);
  const client = findClient(clientId);

  if (!client) return res.status(404).json({ error: 'client not found' });
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount must be greater than zero' });
  }
  if (client.balance < amount) {
    return res.status(422).json({ error: 'insufficient balance' });
  }

  try {
    const risk = await evaluateRisk(clientId, amount);
    const status = risk.decision === 'approved' ? 'APPROVED' : 'REJECTED';
    const reference = crypto.randomUUID();
    const operation = createOperation({
      client_id: clientId,
      amount,
      status,
      external_reference: reference
    });

    if (status === 'APPROVED') {
      const serviceCharge = amount * 0.1;
      updateClientBalance(clientId, amount + serviceCharge);
    }

    return res.status(201).json(operation);
  } catch (_error) {
    return res.status(503).json({ error: 'risk validation unavailable' });
  }
});

app.get('/api/operations/:id', (req, res) => {
  const operation = findOperation(req.params.id);
  if (!operation) return res.status(404).json({ error: 'operation not found' });
  return res.json(operation);
});

registerQualityReview(app);

app.listen(port, '0.0.0.0', () => {
  console.log(`Quality Lab running at http://127.0.0.1:${port}`);
});
