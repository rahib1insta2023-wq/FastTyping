
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateThematicWords(topic: string): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a list of 50 common, interesting words related to the topic: "${topic}". 
                 Only return the words separated by spaces. No numbers, no special characters.`,
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
    });

    const text = response.text || "";
    const words = text.split(/\s+/).filter(w => w.length > 1).map(w => w.toLowerCase());
    return words.length > 0 ? words : [];
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return [];
  }
}
