import { expect, test, beforeEach } from 'vitest';
import { mockPost, mockFetch } from 'vi-fetch';
import pino from 'pino';

import pinoSplunk from '../lib';

// TODO: Figure out why the vi-fetch toHaveFetched doesn't work

beforeEach(() => {
  mockFetch.clearAll();
});

const splunkOptions = {
  baseURL: 'http://localhost',
  token: '123',
  index: 'dev',
  source: 'unit-test',
};

test.skip("batches the log entries' uploads", async () => {
  const stream = pinoSplunk({ ...splunkOptions, flushSize: 2 });

  const mock = mockPost(
    'http://localhost/services/collector/event'
  ).willResolve();

  const logger = pino(stream);

  logger.info('test1');
  logger.info('test2');

  expect(mock).toHaveFetched();

  logger.info('test3');
});

test.skip('handles request errors "gracefully"', async () => {
  const stream = pinoSplunk(splunkOptions);

  const mock = mockPost('http://localhost/services/collector/event').willFail();

  const logger = pino(stream);

  logger.info('will fail');
  expect(mock).toHaveFetched();
});
