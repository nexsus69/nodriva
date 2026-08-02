/* eslint-disable @typescript-eslint/no-require-imports */
const Pusher = require('pusher-js');

const pusher = new Pusher('dashboard-app-key-123', {
  wsHost: '127.0.0.1',
  wsPort: 6001,
  forceTLS: false,
  enableStats: false,
  enabledTransports: ['ws', 'wss'],
  cluster: 'mt1'
});

pusher.connection.bind('connected', () => {
  console.log('Successfully connected to WebSocket!');
  process.exit(0);
});

pusher.connection.bind('error', (err) => {
  console.error('WebSocket Error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout waiting for connection');
  process.exit(1);
}, 5000);
