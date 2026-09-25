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

// Cola temporal: existe solo mientras el gateway está encendido.
// Las alertas son "en vivo"; no queremos que, al arrancar, lluevan
// avisos viejos acumulados de cuando estuvo apagado.
async function escucharTodo(handler) {
  const q = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(q.queue, EXCHANGE, '#');
  channel.consume(
    q.queue,
    (msg) => {
      if (!msg) return;
      const event = JSON.parse(msg.content.toString());
      console.log(`← evento recibido: ${event.type}`);
      handler(event);
    },
    { noAck: true }
  );
}

module.exports = { connectRabbit, escucharTodo };