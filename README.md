# pino-splunk

Load [pino](https://github.com/pinojs/pino) logs into
[Splunk](https://www.splunk.com/).

The logs are sent in batches to reduce the load. The batch

## Install

```
# npm
npm i pino-splunk

# yarn
yarn add pino-splunk

# pnpm
pnpm i pino-splunk
```

## Usage

```js
import pino from 'pino';

const splunkTransport = pino.transport({
  target: 'pino-splunk',
  options: {
    // These parameters are required
    url: 'https://mysplunkserver.example.com:8088',
    token: 'my-token',
    source: 'my-app-name',
    index: 'stage',

    // Optional parameters, default values listed
    // Batching - Flushes the logs after given number of log events
    flushSize: 10,
    // Batching - Flushes the if the specified number of milliseconds has passed since the last log event
    flushIntervalMs: 10000, // 10 seconds
    // URL path for the Splunk instance
    path: '/services/collector/event',
  },
});

const logger = pino({ level: 'info' }, splunkTransport);
```

## License

Licensed under [MIT](./LICENSE).
