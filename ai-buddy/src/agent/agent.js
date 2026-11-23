import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { tools } from "./tools.js";
import { ToolMessage } from "@langchain/core/messages";

const model = new ChatGoogleGenerativeAI({
    modelName: "gemini-1.5-flash",
    temperature: 0.5,
});

const graph = new StateGraph(MessagesAnnotation)
    .addNode("tools", async (state, config) => {
        const lastMessage = state.messages[state.messages.length - 1];

        const toolsCall = lastMessage.tool_calls;

        const toolCallResult = await Promise.all(
            toolsCall.map(async (call) => {
                const tool = tools[call.name];
                if (!tool) {
                    throw new Error(`Tool ${call.name} not found`);
                }

                const toolInput = call.args;

                const toolResult = await tool.invoke({ ...toolInput, token: config.metadata.token });

                return new ToolMessage({
                    content: toolResult,
                    toolName: call.name,
                });
            }),
        );

        state.messages.push(...toolCallResult);

        return state;
    })
    .addNode("chat", async (state, config) => {
        const response = await model.invoke(state.messages, { tools: [tools.searchproducts, tools.addProductToCart] });

        state.messages.push(
            new AIMessage({
                content: response.text,
                tool_calls: response.tool_calls,
            }),
        );
    })
    .addEdge("__start__", "chat")
    .addConditionalEdges("chat", async (state) => {
        const lastMessage = state.messages[state.messages.length - 1];

        if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            return "tools";
        } else {
            return "__end__  ";
        }
    })
    .addEdge("tools", "chat");

export const agent = graph.compile();
