import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { tools } from "./tools.js";
import { AIMessage, ToolMessage } from "@langchain/core/messages";

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.5,
}).bindTools(Object.values(tools));

const graph = new StateGraph(MessagesAnnotation)
    .addNode("tools", async (state, config) => {
        const lastMessage = state.messages[state.messages.length - 1];

        const toolsCall = lastMessage.tool_calls || [];
        const token = config?.metadata?.token || config?.configurable?.token || config?.token;

        const toolCallResult = await Promise.all(
            toolsCall.map(async (call) => {
                const tool = tools[call.name];
                if (!tool) {
                    throw new Error(`Tool ${call.name} not found`);
                }

                const toolInput = { ...call.args, token };

                const toolResult = await tool.invoke(toolInput);

                return new ToolMessage({
                    tool_call_id: call.id,
                    content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
                    name: call.name,
                });
            }),
        );

        return { messages: toolCallResult };
    })
    .addNode("chat", async (state, config) => {
        const response = await model.invoke(state.messages);

        return {
            messages: [response],
        };
    })
    .addEdge("__start__", "chat")
    .addConditionalEdges("chat", async (state) => {
        const lastMessage = state.messages[state.messages.length - 1];

        if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            return "tools";
        } else {
            return "__end__";
        }
    })
    .addEdge("tools", "chat");

export const agent = graph.compile();

/*
errors list 🥲
 
 
agent.js ke Bugs:
 
 


Missing tool_call_id: ToolMessage mein tool_call_id: call.id missing hai (Gemini crash kar dega).



State Mutation: state.messages.push(...) mat karo 
→
→ nodes se return { messages: [...] } karo.



Tools Binding: Line 40 par invoke mein tools pass karne ke bajaye model.bindTools(...) use karo.


*/
