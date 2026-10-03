const { gmd } = require("../gift");
const axios = require("axios");

async function queryAI(endpoint, query, conText) {
  const { reply, KlausTechApi, KlausApiKey } = conText;

  if (!query) {
    return reply("Please provide a question or prompt.");
  }

  try {
    const apiUrl = `${KlausTechApi}/api/ai/${endpoint}?apikey=${KlausApiKey}&q=${encodeURIComponent(query)}`;
    const res = await axios.get(apiUrl, { timeout: 100000 });

    if (!res.data?.success || !res.data?.result) {
      return reply("Failed to get a response. Try again.");
    }

    reply(res.data.result);
  } catch (err) {
    console.error(`AI ${endpoint} error:`, err.message);
    reply("Error: " + err.message);
  }
}

gmd(
  {
    pattern: "klausai",
    aliases: ["ai"],
    description: "Chat with Klaus AI assistant",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("ai", conText.q || "What's your model?", conText);
  },
);

gmd(
  {
    pattern: "chatai",
    description: "General AI chat assistant",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("chat", conText.q, conText);
  },
);

gmd(
  {
    pattern: "gpt",
    aliases: ["chatgpt"],
    description: "Chat with GPT model",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("gpt", conText.q, conText);
  },
);

gmd(
  {
    pattern: "gpt4",
    aliases: ["chatgpt4"],
    description: "Chat with GPT-4 model",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("gpt4", conText.q, conText);
  },
);

gmd(
  {
    pattern: "gpt4o",
    aliases: ["chatgpt4o"],
    description: "Chat with GPT-4o model",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("gpt4o", conText.q, conText);
  },
);

gmd(
  {
    pattern: "gpt4o-mini",
    aliases: ["chatgpt4o-mini"],
    description: "Chat with GPT-4o Mini (faster)",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("gpt4o-mini", conText.q, conText);
  },
);

gmd(
  {
    pattern: "openai",
    description: "Chat with OpenAI model",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("openai", conText.q, conText);
  },
);

gmd(
  {
    pattern: "gemini",
    description: "Chat with Google Gemini",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("geminiai", conText.q, conText);
  },
);


gmd(
  {
    pattern: "venice",
    aliases: ["veniceai"],
    description: "Chat with Venice AI model",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("mistral", conText.q, conText);
  },
);

gmd(
  {
    pattern: "letmegpt",
    description: "Simple GPT-style AI chat",
    category: "Ai",
    filename: __filename,
  },
  async (from, Klaus, conText) => {
    await queryAI("letmegpt", conText.q, conText);
  },
);
