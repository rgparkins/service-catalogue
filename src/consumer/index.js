import amqp from 'amqplib';
import nodemailer from 'nodemailer';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin@rabbitmq:5672';
const RECONNECT_DELAY_MS = 5000;

const QUEUES = [
  'registration.created',
  'service.metadata.updated',
  'tenant.created',
  'tenant.deactivated',
];

// --- Email ---

function makeTransport() {
  if (!process.env.SMTP_HOST) return null;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user = process.env.SMTP_USER || null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
  });
}

async function sendRegistrationEmail({ email, to, tenantId, registrationLink }) {
  const recipient = email || to;
  const from = process.env.SMTP_FROM || 'no-reply@service-catalogue.local';
  const transport = makeTransport();

  if (!transport) {
    console.warn(`[registration.created] SMTP not configured — cannot email ${recipient}`);
    console.warn(`[registration.created] Registration link: ${registrationLink}`);
    return;
  }

  await transport.sendMail({
    from,
    to: recipient,
    subject: `Complete your registration for ${tenantId}`,
    text: `You have been invited to manage tenant "${tenantId}".\n\nComplete your registration here:\n${registrationLink}\n`,
    html: `
      <p>You have been invited to manage tenant <strong>${tenantId}</strong>.</p>
      <p><a href="${registrationLink}">Complete your registration</a></p>
      <p>Or copy this link into your browser:<br>${registrationLink}</p>
    `,
  });

  console.log(`[registration.created] Registration email sent to ${recipient}`);
}

// --- Message handlers ---

async function handleMessage(queue, msg) {
  let body;
  try {
    body = JSON.parse(msg.content.toString());
  } catch {
    console.error(`[${queue}] Invalid JSON in message`);
    return;
  }

  console.log(`[${queue}]`, JSON.stringify(body));

  try {
    switch (queue) {
      case 'registration.created':
        await sendRegistrationEmail(body);
        break;
      case 'service.metadata.updated': {
        const { tenantId, serviceName, version } = body;
        console.log(`Service updated: ${tenantId}/${serviceName} (schema ${version})`);
        break;
      }
      case 'tenant.created': {
        const { tenantId, companyName } = body;
        console.log(`Tenant created: ${tenantId} (${companyName})`);
        break;
      }
      case 'tenant.deactivated':
        console.log(`Tenant deactivated: ${body.tenantId}`);
        break;
      default:
        console.warn(`No handler for queue: ${queue}`);
    }
  } catch (err) {
    console.error(`[${queue}] Handler error:`, err.message);
    throw err;
  }
}

// --- RabbitMQ connection ---

async function connect() {
  try {
    console.log(`Connecting to RabbitMQ...`);
    const conn = await amqp.connect(RABBITMQ_URL);

    conn.on('error', (err) => console.error('RabbitMQ connection error:', err.message));
    conn.on('close', () => {
      console.warn('RabbitMQ connection closed — reconnecting in', RECONNECT_DELAY_MS, 'ms');
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    const ch = await conn.createChannel();
    ch.prefetch(1);

    for (const queue of QUEUES) {
      await ch.assertQueue(queue, { durable: true });
      ch.consume(queue, async (msg) => {
        if (!msg) return;
        try {
          await handleMessage(queue, msg);
          ch.ack(msg);
        } catch {
          // nack without requeue — prevents poison-pill loops
          ch.nack(msg, false, false);
        }
      });
      console.log(`Listening on queue: ${queue}`);
    }

    console.log('Consumer ready.');
  } catch (err) {
    console.error('Failed to connect:', err.message, '— retrying in', RECONNECT_DELAY_MS, 'ms');
    setTimeout(connect, RECONNECT_DELAY_MS);
  }
}

connect();
