# pino-splunk

Load [pino](https://github.com/pinojs/pino) logs into
[Splunk](https://www.splunk.com/).

## Install

```
npm install pino-splunk
```

## Usage

```js
const pino = require('pino');

const splunkTransport = pino.transport({
  target: 'pino-splunk',
  options: {
    url: 'https://mysplunkserver.example.com:8088',
    token: 'my-token',
    index: 'an-index',
    source: 'my-app-name',
  },
});

const logger = pino({ level: 'info' }, splunkTransport);
```

## License

Licensed under [MIT](./LICENSE).
