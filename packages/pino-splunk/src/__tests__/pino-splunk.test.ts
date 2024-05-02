import { DeferredPromise } from '@open-draft/deferred-promise';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import pino from 'pino';
import { afterAll, beforeAll, expect, test } from 'vitest';

import pinoSplunk from '../lib';

const MOCK_BASE_URL = 'https://splunk-mock.com';

// TODO: add mocking for invalid token `{ text: 'Invalid token', code: 4 }`
const server = setupServer(
  http.post(`${MOCK_BASE_URL}/*`, () => {
    return HttpResponse.json({ text: 'Success', code: 0 });
  }),
);

beforeAll(() => {
  server.listen();
});

afterAll(() => {
  server.close();
});

function getRequestPromise(): DeferredPromise<Request> {
  const requestPromise = new DeferredPromise<Request>();
  // Await the requests for the mocked responses
  server.events.on('request:match', ({ request }) => {
    requestPromise.resolve(request);
  });

  return requestPromise;
}
const splunkOptions = {
  baseUrl: MOCK_BASE_URL,
  token: 'test-token',
  index: 'dev',
  source: 'unit-test',
};

test('it sets Authorization header with the HEC token', async () => {
  const stream = pinoSplunk({ ...splunkOptions, flushSize: 1 });
  const logger = pino(stream);

  logger.info('foobar');

  const request = await getRequestPromise();

  expect(request.headers.get('Authorization')).toBe(
    `Splunk ${splunkOptions.token}`,
  );
});

test('flushes the log entries when flush size is reached', async () => {
  const stream = pinoSplunk({ ...splunkOptions, flushSize: 2 });

  const logger = pino(stream);

  logger.info('foo');
  logger.info('bar');

  const request = await getRequestPromise();

  const data = await request.json();

  expect(data).toHaveLength(2);
});
