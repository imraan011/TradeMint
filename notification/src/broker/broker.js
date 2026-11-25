import amqplib from "amqplib";

export let channel, connection;

export async function connect() {
    if (channel) return channel;

    try {
        connection = await amqplib.connect(process.env.RABBITMQ_URL);
        console.log("Connected to RabbitMQ");
        channel = await connection.createChannel();
    } catch (error) {
        console.error("Failed to connect to RabbitMQ:", error);
    }
}

export async function publishToQueue(queueName, data = {}) {
    if (!channel || !connection) {
        await connect();
    }
    await channel.assertQueue(queueName, { durable: true });

    //rabbitMQ transfer the data in buffer format to the queue binary format
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)));
    console.log(`Message published to queue: ${queueName}`);
}

export async function subscribeToQueue(queueName, callback) {
    if (!channel || !connection) {
        await connect();
    }
    await channel.assertQueue(queueName, { durable: true });

    channel.consume(queueName, async (msg) => {
        if (msg !== null) {
            const data = JSON.parse(msg.content.toString());
            await callback(data);
            channel.ack(msg);
        }
    });
}
