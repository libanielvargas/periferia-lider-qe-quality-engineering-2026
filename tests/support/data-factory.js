import crypto from 'node:crypto';
import { dataRules } from './data-rules.js';

const issuedDocuments = new Set();

function pick(list) {
  return list[crypto.randomInt(list.length)];
}

export function uniqueDocument(rules = dataRules.client) {
  const randomLength = rules.documentLength - rules.documentPrefix.length;
  let document;
  do {
    const digits = Array.from({ length: randomLength }, () => crypto.randomInt(10)).join('');
    document = `${rules.documentPrefix}${digits}`;
  } while (issuedDocuments.has(document));
  issuedDocuments.add(document);
  return document;
}

export function validClient(overrides = {}) {
  const rules = dataRules.client;
  const document = uniqueDocument(rules);
  return {
    name: `${pick(rules.firstNames)} ${pick(rules.lastNames)} ${document.slice(-4)}`,
    document,
    email: `qa.${document}@${rules.emailDomain}`,
    balance: rules.defaultBalance,
    ...overrides
  };
}

export function clientWithInsufficientBalance() {
  const { balance, amount } = dataRules.insufficientBalance;
  return { client: validClient({ balance }), amount };
}

export function invalidClients() {
  return dataRules.invalidClients.map(item => ({
    ...item,
    payload: validClient(item.override)
  }));
}

export function invalidAmounts() {
  return dataRules.invalidAmounts;
}

export function expectedBalanceAfterApproval(balance, amount) {
  return balance - amount * (1 + dataRules.operation.serviceChargeRate);
}

export function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}
