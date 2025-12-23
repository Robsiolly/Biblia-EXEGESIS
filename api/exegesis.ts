import { GoogleGenAI, Type, Modality } from "@google/genai";

export const handler = async (event: any) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // Trata pre-flight do CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido. Use POST.' }),
    };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Chave de API ausente', 
        details: 'A variável de ambiente API_KEY não foi configurada no servidor.' 
      }),
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action, payload } = body;

    if (!action) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nenhuma ação especificada.' }) };
    }

    switch (action) {
      case 'getExegesis':
        const exegesisResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Realize uma exegese profunda de: "${payload.query}". Inclua contexto histórico, filologia e aplicação teológica.`,
          config: {
            systemInstruction: "Você é um professor de teologia e arqueologia bíblica. Responda apenas com JSON puro, sem blocos de markdown ou explicações externas.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                verse: { type: Type.STRING },
                context: { type: Type.STRING },
                historicalAnalysis: { type: Type.STRING },
                theologicalInsights: { type: Type.STRING },
                originalLanguages: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      term: { type: Type.STRING },
                      transliteration: { type: Type.STRING },
                      meaning: { type: Type.STRING },
                    },
                    required: ["term", "transliteration", "meaning"],
                  }
                },
                imagePrompt: { type: Type.STRING },
              },
              required: ["verse", "context", "historicalAnalysis", "theologicalInsights", "originalLanguages", "imagePrompt"],
            }
          }
        });

        return {
          statusCode: 200,
          headers,
          body: exegesisResponse.text || JSON.stringify({ error: "Resposta vazia do modelo" }),
        };

      case 'generateImage':
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `Historical reconstruction in 4k, realistic: ${payload.prompt}` }] },
          config: { imageConfig: { aspectRatio: "16:9" } }
        });
        
        const part = imageResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (!part) throw new Error("Imagem não gerada pelo modelo.");

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ base64: part.inlineData?.data }),
        };

      case 'generateTTS':
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: payload.text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: payload.voice || 'Kore' },
              },
            },
          },
        });
        
        const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) throw new Error("Áudio não gerado pelo modelo.");

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ base64: audioData }),
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Ação desconhecida' }),
        };
    }
  } catch (err: any) {
    console.error("Erro na API:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Falha interna', details: err.message }),
    };
  }
};