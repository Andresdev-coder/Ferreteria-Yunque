const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');
socket.on('connect', () => console.log('Conectado al gateway'));
socket.on('evento', (e) => console.log('EVENTO:', e.type, JSON.stringify(e.data)));