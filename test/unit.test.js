const tap = require('tap');
const pinoSplunk = require('../lib');
const { MockAgent, setGlobalDispatcher } = require('undici');

const url = 'https://mysplunkserver.example.com:8088';

// Setup an undici mock that intercepts all requests
const agent = new MockAgent();
agent.disableNetConnect();
setGlobalDispatcher(agent);
const mockPool = agent.get(host);

tap.test('ignores invalid json', (t) => {
  const writeStream = pinoSplunk({ url });

  writeStream
    .on('data', (chunk) => {
      t.fail('Should not be here');
    })
    .on('end', () => {
      t.end();
    });

  writeStream.write('{invalid json}');
  writeStream.end();
});
