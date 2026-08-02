/* eslint-disable @typescript-eslint/no-require-imports */
const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'app-id',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || 'app-key',
  secret: process.env.PUSHER_SECRET || 'app-secret',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
  useTLS: false,
  host: '127.0.0.1',
  port: '6001',
});

pusher.trigger('test-channel', 'test-event', { message: 'hello world' })
  .then(() => console.log('Successfully triggered event'))
  .catch((e) => console.error('Error triggering event', e));
