import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const RECONNECT_DELAY_MS = 5000;

let channel = null;
let connecting = false;

async function connect() {
    if (connecting || !RABBITMQ_URL) return;
    connecting = true;
    try {
        const conn = await amqp.connect(RABBITMQ_URL);
        conn.on('error', (err) => {
            console.error('[publisher] RabbitMQ error:', err.message);
            channel = null;
        });
        conn.on('close', () => {
            console.warn('[publisher] RabbitMQ connection closed — reconnecting...');
            channel = null;
            connecting = false;
            setTimeout(connect, RECONNECT_DELAY_MS);
        });
        channel = await conn.createChannel();
        connecting = false;
        console.log('[publisher] Connected to RabbitMQ');
    } catch (err) {
        console.error('[publisher] Failed to connect:', err.message, '— retrying in', RECONNECT_DELAY_MS, 'ms');
        channel = null;
        connecting = false;
        setTimeout(connect, RECONNECT_DELAY_MS);
    }
}

export async function publish(queue, payload) {
    if (!RABBITMQ_URL) return;
    if (!channel) {
        connect().catch(console.error);
        return;
    }
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { persistent: true });
}

if (RABBITMQ_URL) connect().catch(console.error);
