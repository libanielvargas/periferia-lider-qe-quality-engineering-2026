import { expect } from '@playwright/test';

export class ApiClient {
  constructor(request) {
    this.request = request;
  }

  async createClient(client) {
    const response = await this.request.post('/api/clients', { data: client });
    expect(response.status(), await response.text()).toBe(201);
    return response.json();
  }

  postClient(payload) {
    return this.request.post('/api/clients', { data: payload });
  }

  postOperation(clientId, amount) {
    return this.request.post('/api/operations', { data: { clientId, amount } });
  }

  async getOperation(id) {
    const response = await this.request.get(`/api/operations/${id}`);
    expect(response.status()).toBe(200);
    return response.json();
  }

  async getSummary(clientId) {
    const response = await this.request.get(`/api/clients/${clientId}/summary`);
    expect(response.status()).toBe(200);
    return response.json();
  }
}
