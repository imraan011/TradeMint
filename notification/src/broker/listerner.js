import { sendEmail } from "../email.js";
import { subscribeToQueue } from "./broker.js";

export function Broker_listener() {
    subscribeToQueue("AUTH_NOTIFICATION.USER_CREATED", async (data) => {
        console.log("Received message from queue:", data);

        const emailHTML = `
        <h1>Welcome to TradeMint!</h1>
        <p>Dear ${data.fullname.firstname} ${data.fullname.lastname || ""},</p>
        <p>Thank you for registering with us. We're excited to have you on board!</p>
        <p>Best regards,<br/>The TradeMint Team</p>
        `;

        // Send email to the user
        await sendEmail(data.email, "Welcome to TradeMint!", "Thank you for registering with us.", emailHTML);
    });
}
