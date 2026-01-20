import "dotenv/config";

const getOpenAIAPIResponse = async (messages) => {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are ForgeChat, a helpful AI assistant. Use the conversation history provided to maintain context."
        },
        ...messages
      ]
    })
  };

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      options
    );

    const data = await response.json();

    if (data.error) {
      console.error("OpenAI Error:", data.error.message);
      return "I'm sorry, I encountered an error processing that.";
    }

    return data.choices[0].message.content;

  } catch (err) {
    console.error("Fetch Error:", err);
    return "Error connecting to AI service.";
  }
};

export default getOpenAIAPIResponse;