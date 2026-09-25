const amqp = require('amqplib');
const { randomUUID } = require('crypto');

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

// Todos los eventos viajan con el mismo "sobre"
function publish(routingKey, type, data) {
  const event = {
    eventId: randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    source: 'compras',
    data,
  };
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(event)), {
    persistent: true,
    contentType: 'application/json',
  });
  console.log(`→ evento publicado: ${type}`);
  return event;
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

module.exports = { connectRabbit, publish, subscribe };
