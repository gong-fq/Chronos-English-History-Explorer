import { GoogleGenAI, Type } from "@google/genai";
import { HistoryContent, TimelineItem } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

const SYSTEM_INSTRUCTION = `
  You are a world-class linguistic historian and educator, specializing in the History of the English Language (HEL). 
  Your goal is to explain complex linguistic evolution to an enthusiast audience.
  
  Guidelines:
  1. **Tone**: Lively, engaging, friendly, yet academically rigorous. Avoid dry textbook jargon unless explained.
  2. **Sources**: Implicitly or explicitly reference major academic works (e.g., Baugh & Cable, David Crystal, Hogg).
  3. **Detail**: Be exhaustive but structured. Cover phonology, morphology, syntax, and vocabulary changes.
  4. **Language**: Write in Chinese (Simplified) for a Chinese audience learning English history, but keep specific linguistic terms or examples in English/Old English/IPA where necessary.
  5. **Glossary**: Identify 3-6 specialized terms (e.g., "Great Vowel Shift", "cognate", "inflection") used in your text. Wrap the *first* occurrence of each specific term in the text body with double brackets, like this: [[morphology]]. Provide the definition in the glossary response field.
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    subtitle: { type: Type.STRING },
    academicContext: { type: Type.STRING },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          body: { type: Type.STRING, description: "The content paragraphs. Use markdown for bolding. Wrap glossary terms in [[double brackets]]." }
        },
        required: ["heading", "body"]
      }
    },
    glossary: {
      type: Type.ARRAY,
      description: "Definitions for the specialized terms marked in the text with [[brackets]].",
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING, description: "The term exactly as it appears in the text brackets." },
          definition: { type: Type.STRING, description: "A concise definition." }
        },
        required: ["term", "definition"]
      }
    },
    relatedTopics: {
      type: Type.ARRAY,
      description: "Suggest 3-4 specific topics, people, or events related to this content that the user should explore next.",
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING, description: "The short name of the topic to search for." },
          reason: { type: Type.STRING, description: "A very brief explanation (1 sentence) of why it is interesting." }
        },
        required: ["topic", "reason"]
      }
    },
    imagePrompt: { type: Type.STRING, description: "A detailed prompt for an image generation model to create a historical illustration." }
  },
  required: ["title", "subtitle", "sections", "academicContext", "imagePrompt", "glossary"]
};

// --- Caching Utilities ---

const CACHE_PREFIX = 'chronos_cache_v1_';

const getCacheKey = (type: 'era' | 'search' | 'image', id: string) => {
  // Simple sanitization for keys
  return `${CACHE_PREFIX}${type}_${id.replace(/[^a-zA-Z0-9-_]/g, '')}`;
};

const saveToCache = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save to cache (storage likely full):", e);
  }
};

const getFromCache = <T>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.warn("Failed to parse cache item:", e);
    return null;
  }
};

// --- API Functions ---

export const generateHistoryArticle = async (era: TimelineItem): Promise<HistoryContent> => {
  const cacheKey = getCacheKey('era', era.id);

  try {
    const ai = getClient();
    
    const prompt = `
      Create a comprehensive lesson for the era: "${era.title}" (${era.yearRange}).
      Context: ${era.description}.
      
      Structure the response to be rendered in a React app.
      Include an 'academicContext' field mentioning key scholars or theories relevant to this period.
      Include an 'imagePrompt' that describes a scene, artifact, or map that represents this era visually.
      Include 'relatedTopics' to encourage further reading.
      Ensure you identify and mark glossary terms with [[brackets]].
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    if (!response.text) {
      throw new Error("No content generated");
    }

    const content = JSON.parse(response.text) as HistoryContent;
    saveToCache(cacheKey, content);
    return content;

  } catch (error) {
    console.warn("API request failed, attempting cache fallback:", error);
    const cached = getFromCache<HistoryContent>(cacheKey);
    if (cached) {
      return cached;
    }
    throw error;
  }
};

export const generateSearchArticle = async (query: string): Promise<HistoryContent> => {
  const cacheKey = getCacheKey('search', query.trim().toLowerCase());

  try {
    const ai = getClient();
    
    const prompt = `
      Create a comprehensive lesson on the specific topic: "${query}".
      Context: This is a user search query within an app about the History of the English Language.
      
      If the term is a specific word, Explain its etymology and history in English.
      If the term is an event, explain its linguistic impact.
      If the term is a person, explain their contribution to the language.
      If the term is not directly part of English history, explain its etymology or linguistic relevance to English or why it might be misunderstood as such.
      
      Structure the response to be rendered in a React app.
      Include an 'academicContext' field mentioning key scholars or theories relevant to this topic.
      Include an 'imagePrompt' that describes a scene, artifact, or map that represents this topic visually.
      Include 'relatedTopics' to encourage further reading.
      Ensure you identify and mark glossary terms with [[brackets]].
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    if (!response.text) {
      throw new Error("No content generated");
    }

    const content = JSON.parse(response.text) as HistoryContent;
    saveToCache(cacheKey, content);
    return content;

  } catch (error) {
    console.warn("API request failed, attempting cache fallback:", error);
    const cached = getFromCache<HistoryContent>(cacheKey);
    if (cached) {
      return cached;
    }
    throw error;
  }
};

export const generateHistoricalIllustration = async (prompt: string): Promise<string> => {
  // Use a simple hash-like key derived from the prompt. 
  // We use the first 50 chars + length to create a relatively unique but short key.
  const promptKey = prompt.substring(0, 50).replace(/\s+/g, '_') + '_' + prompt.length;
  const cacheKey = getCacheKey('image', promptKey);

  try {
    const ai = getClient();

    // We use gemini-2.5-flash-image for generation as per guidelines for general tasks
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        }
      }
    });

    // Iterate parts to find the image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const url = `data:image/png;base64,${part.inlineData.data}`;
        saveToCache(cacheKey, url);
        return url;
      }
    }

    throw new Error("No image generated");

  } catch (error) {
    console.warn("Image generation failed, attempting cache fallback:", error);
    const cached = getFromCache<string>(cacheKey);
    if (cached) {
      return cached;
    }
    throw error;
  }
};