import { tool } from "@langchain/core/tools";
import axios from "axios";

const searchproducts = tool(
    async ({ query, token }) => {
        const response = await axios.get(`http://localhost:3001/api/products?q=${data.query}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return JSON.stringify(response.data);
    },
    {
        name: "searchproducts",
        description: "Search for products based on a query and return relevant results.",
        inputSchema: {
            query: z.string().describe("The search query for products."),
        },
    },
);
