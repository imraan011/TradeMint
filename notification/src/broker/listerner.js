import { subscribeToQueue } from "./broker.js";

export function Broker_listener() {
    subscribeToQueue("AUTH_NOTIFICATION.USER_CREATED", async (data) => {
        console.log("Received message from queue:", data);
    });

    
}
