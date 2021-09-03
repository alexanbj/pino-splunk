const { request } = require('undici');
const stream = require('stream');
const split = require('split2');
const batch = require('batch2');
const pumpify = require('pumpify');

// TODO: Is there a way of getting the levels out of the logger instead of maintaining our own map?
const LEVEL_MAP = new Map([
  [10, 'TRACE'],
  [20, 'DEBUG'],
  [30, 'INFO'],
  [40, 'WARN'],
  [50, 'ERROR'],
  [60, 'FATAL'],
]);

function transformStream(opts) {
  return new stream.Transform({
    objectMode: true,
    transform(log, _, next) {
      const { level, time, err, hostname, msg, ...props } = log;

      const context = {
        event: {
          message: msg,
          level: LEVEL_MAP.get(level) ?? 'INFO',
        },
        time,
        index: opts.index,
        source: opts.source,
        sourcetype: opts.sourceType,
        host: hostname,
      };

      if (err) {
        context.event.throwable = err;
      }

      // Put all extra properties here
      if (Object.keys(props).length > 0) {
        context.event.properties = props;
      }

      next(null, context);
    },
  });
}

function jsonStream() {
  return split((line) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      console.log(error);
    }
  });
}

function splunkStream(opts) {
  const url = new URL(opts.path, opts.url);

  return new stream.Writable({
    objectMode: true,
    write(logs, _, next) {
      // TODO: handle failures
      request(url, {
        method: 'POST',
        body: JSON.stringify(logs),
        headers: {
          Authorization: `Splunk ${opts.token}`,
          'Content-Type': 'application/json',
        },
      });
      next();
    },
  });
}

const defaultOptions = {
  path: '/services/collector/event',
  flushSize: 10,
  soruceType: '_json',
};

/**
 * @param {Object} opts - Options for Pino Splunk
 * @param {string} opts.url - URL to the Splunk instance.
 * @param {string} opts.token - HTTP Event Collector token.
 * @param {string} [opts.index] - The name of the index by which the event data is to be indexed. The index you specify here must be within the list of allowed indexes if the token has the indexes parameter set.
 * @param {string} [opts.source] - The source value to assign to the event data. For example, if you're sending data from an app you're developing, set this key to the name of the app.
 * @param {string} [opts.path=/services/collector/event] - URL path to send data to on the Splunk instance.
 * @param {string} [opts.sourceType="_json"] - The sourcetype value to assign to the event data.
 * @param {number} [opts.flushSize=10] - Automatically flush after specified number of events have been reached.
 * @returns {stream.Writable}
 */
function pinoSplunk(opts) {
  opts = {
    ...defaultOptions,
    ...opts,
  };

  // TODO: Add support for flushInterval
  return pumpify(
    jsonStream(),
    transformStream(opts),
    batch.obj({ size: opts.flushSize }),
    splunkStream(opts)
  );
}

module.exports = pinoSplunk;
