import build from 'pino-abstract-transport';
// @ts-expect-error no types defined here
import streamBatch from 'stream-batch';
import fetch from 'node-fetch-native';

interface Options {
  /** base URL to the Splunk instance */
  baseURL: string;
  /** HTTP Event Collector token */
  token: string;
  /** The name of the index by which the event data is to be indexed. The index you specify here must be within the list of allowed indexes if the token has the indexes parameter set. */
  index: string;
  /** The source value to assign to the event data. For example, if you're sending data from an app you're developing, set this key to the name of the app. */
  source: string;
  /** URL path to send data to on the Splunk instance.
   * @default /services/collector/event
   */
  path?: string;
  /** Automatically flush after specified number of log events.
   * @default 10
   */
  flushSize?: number;
  /** Automatically flush after the specified number of milliseconds since the last event has arrived.
   * @default 10000
   */
  flushInterval?: number;
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

export default function (opts: Options) {
  opts.flushSize ??= 10;
  opts.flushInterval ??= 10000;
  opts.path ??= '/services/collector/event';

  // Create the URL and headers object on initialization instead of on every request
  const url = new URL(opts.path, opts.baseURL).toString();
  const headers: HeadersInit = {
    Authorization: `Splunk ${opts.token}`,
    'Content-Type': 'application/json',
  };

  const destination = streamBatch({
    maxItems: opts.flushSize,
    maxWait: opts.flushInterval,
  });

  destination.on('data', (logs: any) => processLogs(logs, url, headers));

  return build(
    function (source) {
      // destination = source.pipe(
      //   streamBatch({ maxItems: opts.flushSize, maxWait: opts.flushInterval })
      // );

      // destination.on('data', (logs: any) => processLogs(logs, url, headers));
      source.pipe(destination);
    },
    {
      close(err, cb) {
        // am i called?
        console.log('in err thingy');
        destination.end();
        destination.on('close', cb.bind(null, err));
        // if (err) {
        //   console.error('error in pino-splunk', err);
        // }
      },
    }
  );
}

function processLogs(logs: Array<any>, url: string, headers: HeadersInit) {
  logs = logs.map(transformLogEntry);

  uploadLogs(logs, url, headers);
}

function transformLogEntry(source: any) {
  const { level, time, err, hostname, msg, ...rest } = source;

  const context = {
    event: {
      message: msg,
      // @ts-expect-error mkay
      level: LEVEL_NAMES[level] ?? 'INFO',
    },
    time,
    host: hostname,
  };

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

async function uploadLogs(logs: Array<any>, url: string, headers: HeadersInit) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(logs),
      headers,
      keepalive: true,
    });

    if (!res.ok) {
      console.warn(
        `pino-splunk got an unexpected response while uploading logs. Log entries will be lost. {statusCode=${res.status}}`
      );
    }
  } catch (err) {
    console.warn(
      `pino-splunk caught an exception while uploading logs. Log entries will be lost. {error=${err?.toString()}}`
    );
  }
}
