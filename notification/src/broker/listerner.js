import { sendEmail } from "../email.js";
import { subscribeToQueue } from "./broker.js";

// recipient ka naam safely extract karne ke liye (object ya string dono handle karta hai)
function getRecipientName(fullname) {
    if (typeof fullname === "object" && fullname !== null) {
        return `${fullname.firstname || ""} ${fullname.lastname || ""}`.trim() || "Customer";
    }
    if (typeof fullname === "string" && fullname.trim()) {
        return fullname.trim();
    }
    return "Customer";
}

export function Broker_listener() {
    subscribeToQueue("AUTH_NOTIFICATION.USER_CREATED", async (data) => {
        console.log("Received message from queue:", data);

        const name = getRecipientName(data.fullname);
        const emailHTML = `
        <p>Dear ${name},</p>
        <p>Thank you for registering with us. We're excited to have you on board!</p>
        <p>Best regards,<br/>The TradeMint Team</p>
        `;

        // Send email to the user
        await sendEmail(data.email, "Welcome to TradeMint!", "Thank you for registering with us.", emailHTML);
    });

    subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_COMPLETED", async (data) => {
        console.log("Received payment completed message from queue:", data);

        const name = getRecipientName(data.fullname || data.fullName);
        const emailHTML = `
        <p>Dear ${name},</p>
        <p>We have successfully received your payment of ${data.currency} ${data.amount} for the order ${data.orderId}.</p>
        <p>Thank you for your business!</p>
        <p>Best regards,<br/>The TradeMint Team</p>
        `;

        await sendEmail(data.email, "Payment Confirmation", "We have successfully received your payment.", emailHTML);
    });

    subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_FAILED", async (data) => {
        console.log("Received payment failed message from queue:", data);
        
        const name = getRecipientName(data.fullname || data.fullName);
        const emailHTML = `
        <p>Dear ${name},</p>
        <p>We regret to inform you that your payment for the order ${data.orderId} has failed.</p>
        <p>Please check your payment details and try again.</p>
        <p>Best regards,<br/>The TradeMint Team</p>
        `;

        await sendEmail(data.email, "Payment Failed", "Your payment could not be processed.", emailHTML);
    });
}
