import { tool } from "@langchain/core/tools";
import axios from "axios";
import z from "zod";        

export const searchproducts = tool(
    async ({ query, token }) => {
        const response = await axios.get(`http://localhost:3001/api/products?q=${query}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return JSON.stringify(response.data);
    },
    {
        name: "searchproducts",
        description: "Search for products based on a query and return relevant results.",
        schema: {
            query: z.string().describe("The search query for products."),
        },
    },
);

export const addProductToCart = tool(
    async ({ productId, quantity = 1, token }) => {
        const response = await axios.post(
            `http://localhost:3002/api/cart/items`,
            {
                productId,
                quantity,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );
        return JSON.stringify(response.data);
    },
    {
        name: "addProductToCart",
        description: "Add a product to the user's cart.",
        inputSchema: {
            productId: z.string().describe("The ID of the product to add to the cart."),
            quantity: z.number().describe("The quantity of the product to add to the cart.").default(1),
        },
    },
);
