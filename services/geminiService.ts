import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { ChatMessage, GroundedSource } from '../types';
import { SYSTEM_INSTRUCTION } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateProContent = async (
  history: ChatMessage[],
  newUserMessage: string
): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-pro',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      history: history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }))
    });

    const response: GenerateContentResponse = await chat.sendMessage({ message: newUserMessage });
    
    return response.text;
  } catch (error) {
    console.error("Error generating content with Gemini Pro:", error);
    return "I'm sorry, I encountered an error. Please try again.";
  }
};


export async function* generateFlashWithGroundingStream(
  history: ChatMessage[],
  newUserMessage: string
): AsyncGenerator<GenerateContentResponse> {
  try {
     const contents = [...history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      })), { role: 'user', parts: [{ text: newUserMessage }] }];

    const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{googleSearch: {}}],
        }
    });

    for await (const chunk of responseStream) {
        yield chunk;
    }

  } catch (error) {
    console.error("Error generating content stream with Gemini Flash and grounding:", error);
    const errorChunk: Partial<GenerateContentResponse> = {
        text: "I'm sorry, I encountered an error with the stream. Please try again."
    };
    yield errorChunk as GenerateContentResponse;
  }
};


export const generateSpeech = async (text: string): Promise<string | null> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio || null;

    } catch (error) {
        console.error("Error generating speech:", error);
        return null;
    }
}