import build from 'pino-abstract-transport';
// @ts-ignore
import { batchIterator } from './batchIterator.mjs';

export interface PinoSplunkOptions {
  /** base URL to the Splunk instance */
  url: string;

  /** URL path to send data to on the Splunk instance.
   * @default /services/collector/event
   */
  path?: string;

  /** HTTP Event Collector token */
  token: string;

  /** The name of the index by which the event data is to be indexed. The index you specify here must be within the list of allowed indexes if the token has the indexes parameter set. */
  index: string;

  /** The source value to assign to the event data. For example, if you're sending data from an app you're developing, set this key to the name of the app. */
  source: string;

  /** Automatically flush after specified number of log events.
   * @default 10
   */
  flushSize?: number;

  /** Automatically flush after the specified number of milliseconds since the last event arrived.
   * @default 10000
   */
  flushIntervalMs?: number;
}

// TODO: Is there a way of getting the levels out of the logger instead of maintaining our own map?
const LEVEL_NAMES = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
} as const;

export default function (opts: PinoSplunkOptions) {
  opts.flushSize ??= 10;
  opts.flushIntervalMs ??= 10000;
  opts.path ??= '/services/collector/event';

  // Create the URL and headers object on initialization instead of on every request
  const url = new URL(opts.path, opts.url).toString();
  const headers: HeadersInit = {
    Authorization: `Splunk ${opts.token}`,
    'Content-Type': 'application/json',
  };

  return build(
    async (source) => {
      const batchedSource = batchIterator(source, {
        timeout: opts.flushIntervalMs,
        count: opts.flushSize,
      });

      for await (const logs of batchedSource) {
        if (logs.length > 0) {
          processLogs(logs, opts.source, opts.index, url, headers);
        }
      }
    },
    {
      async close(err, cb) {
        // TODO: Flush the batchedIterator
      },
    },
  );
}

function processLogs(
  // biome-ignore lint/suspicious/noExplicitAny: TODO: remove usage of any
  logs: Array<any>,
  source: string,
  index: string,
  url: string,
  headers: HeadersInit,
) {
  uploadLogs(
    logs.map((log) => transformLogEntry(log, source, index)),
    url,
    headers,
  );
}

// biome-ignore lint/suspicious/noExplicitAny: TODO: remove usage of any
function transformLogEntry(log: any, source: string, index: string) {
  const { level, time, err, hostname, msg, ...rest } = log;

  const context = {
    event: {
      message: msg,
      // @ts-expect-error mkay ts...?
      level: LEVEL_NAMES[level] ?? 'INFO',
    },
    time,
    source,
    index,
  };

  if (hostname) {
    // @ts-ignore
    context.host = hostname;
  }

  if (err) {
    // @ts-ignore
    context.event.throwable = err;
  }

  // Put all extra properties here
  if (Object.keys(rest).length > 0) {
    // @ts-ignore
    context.event.properties = rest;
  }

  return context;
}

// biome-ignore lint/suspicious/noExplicitAny: TODO: remove usage of any
async function uploadLogs(logs: Array<any>, url: string, headers: HeadersInit) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(logs),
      headers,
    });

    if (!res.ok) {
      console.warn(
        `pino-splunk got an unexpected HTTP response while uploading logs. Log entries will be lost. {statusCode=${res.status}}`,
      );
    }
  } catch (err) {
    console.warn(
      `pino-splunk caught an exception while uploading logs. Log entries will be lost. {error=${err?.toString()}}`,
    );
  }
}
