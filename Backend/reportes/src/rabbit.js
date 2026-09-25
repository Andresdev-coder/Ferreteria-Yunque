const amqp = require('amqplib');

const EXCHANGE = 'yunque.events';
let channel;

async function connectRabbit(retries = 10) {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBIT_URL);
      channel = await conn.createChannel();
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      console.log('RabbitMQ conectado');
      return;
    } catch (e) {
      console.log(`RabbitMQ no disponible (${i}/${retries})...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('No se pudo conectar a RabbitMQ');
}

async function subscribe(queue, routingKey, handler) {
  await channel.assertQueue(queue, { durable: true });
  await channel.bindQueue(queue, EXCHANGE, routingKey);
  channel.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      console.log(`← evento recibido: ${event.type}`);
      await handler(event);
      channel.ack(msg);
    } catch (e) {
      console.error('Error procesando evento:', e.message);
      channel.nack(msg, false, false);
    }
  });
}

// Reportes es un consumidor final: no publica eventos, solo construye
// una vista de lectura (un pequeño patrón CQRS) a partir de lo que ocurre.
module.exports = { connectRabbit, subscribe };
