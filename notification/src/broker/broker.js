import amqplib from "amqplib";

export let channel, connection;

export async function connectToRabbitMQ() {
    if (channel) return channel;

    try {
        connection = await amqplib.connect(process.env.RABBITMQ_URL);

        // amqplib TLS ECONNRESET crash prevent karne ke liye
        connection.on("error", (err) => {
            console.error("RabbitMQ connection error:", err.message);
            channel = null;
            connection = null;
        });
        connection.on("close", () => {
            console.warn("RabbitMQ connection closed. Reconnecting...");
            channel = null;
            connection = null;
        });

        channel = await connection.createChannel();
        channel.on("error", (err) => {
            console.error("RabbitMQ channel error:", err.message);
            channel = null;
        });
        channel.on("close", () => {
            channel = null;
        });

        console.log("Connected to RabbitMQ");
        return channel;
    } catch (error) {
        console.error("Failed to connect to RabbitMQ:", error.message);
        channel = null;
        connection = null;
    }
}

export async function publishToQueue(queueName, data = {}) {
    if (!channel || !connection) {
        await connectToRabbitMQ();
    }
    await channel.assertQueue(queueName, { durable: true });

    //rabbitMQ transfer the data in buffer format to the queue binary format
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)));
    console.log(`Message published to queue: ${queueName}`);
}

export async function subscribeToQueue(queueName, callback) {
    if (!channel || !connection) {
        await connectToRabbitMQ();
    }

    await channel.assertQueue(queueName, { durable: true });

    channel.consume(queueName, async (msg) => {
        if (msg !== null) {
            try {
                const data = JSON.parse(msg.content.toString());
                await callback(data);
            } catch (err) {
                console.error(`Error processing message from ${queueName}:`, err.message);
            } finally {
                channel.ack(msg);
            }
        }
    });
}
