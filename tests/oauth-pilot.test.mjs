import assert from 'node:assert/strict';
import test from 'node:test';

import { allowedOAuthClients, isAllowedOAuthClient, isAllowedOAuthRedirect } from '../src/lib/oauth-pilot.ts';

const previous = {
  id: process.env.CENTRAL_OAUTH_ALLOWED_CLIENT_ID,
  uri: process.env.CENTRAL_OAUTH_ALLOWED_REDIRECT_URI,
  extra: process.env.CENTRAL_OAUTH_ADDITIONAL_CLIENTS,
};

test('only exact registered clients and callback paths can be authorized', () => {
  process.env.CENTRAL_OAUTH_ALLOWED_CLIENT_ID = 'production-client';
  process.env.CENTRAL_OAUTH_ALLOWED_REDIRECT_URI = 'https://production.example.com/auth/v1/callback';
  process.env.CENTRAL_OAUTH_ADDITIONAL_CLIENTS = JSON.stringify([
    { id: 'portal-client', redirectUri: 'https://portal.example.com/auth/v1/callback' },
  ]);

  assert.equal(allowedOAuthClients().length, 2);
  assert.equal(isAllowedOAuthClient('production-client', 'https://production.example.com/auth/v1/callback'), true);
  assert.equal(isAllowedOAuthClient('portal-client', 'https://portal.example.com/auth/v1/callback'), true);
  assert.equal(isAllowedOAuthClient('portal-client', 'https://production.example.com/auth/v1/callback'), false);
  assert.equal(isAllowedOAuthRedirect('https://portal.example.com/auth/v1/callback?code=abc&state=xyz'), true);
  assert.equal(isAllowedOAuthRedirect('https://portal.example.com/other?code=abc'), false);
  assert.equal(isAllowedOAuthRedirect('https://evil.example.com/auth/v1/callback'), false);

  process.env.CENTRAL_OAUTH_ADDITIONAL_CLIENTS = '[{"id":"portal-client","redirectUri":"http://portal.example.com/callback"}]';
  assert.deepEqual(allowedOAuthClients().map((client) => client.id), ['production-client']);

  for (const [key, value] of [
    ['CENTRAL_OAUTH_ALLOWED_CLIENT_ID', previous.id],
    ['CENTRAL_OAUTH_ALLOWED_REDIRECT_URI', previous.uri],
    ['CENTRAL_OAUTH_ADDITIONAL_CLIENTS', previous.extra],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
