
import { GoogleGenAI, Type, Modality } from "@google/genai";

export const config = {
  maxDuration: 60, 
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave API não configurada', details: 'Acesse o painel da Vercel e adicione a variável API_KEY.' });
  }

  const { action, payload } = req.body;
  
  // Criamos uma nova instância a cada request para garantir o uso da chave mais recente do ambiente
  const ai = new GoogleGenAI({ apiKey });

  try {
    switch (action) {
      case 'getExegesis':
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Atue como um Professor Doutor em Exegese Bíblica. Analise a seguinte consulta: "${payload.query}".
          
          Forneça uma resposta técnica e devocional profunda incluindo:
          1. Versículo principal relacionado.
          2. Contexto da época (político, social, religioso).
          3. Análise gramatical e histórica detalhada.
          4. Insights teológicos para os dias de hoje.
          5. Termos originais (Grego/Hebraico).
          6. Um prompt visual para gerar uma imagem histórica desta cena.

          Retorne EXCLUSIVAMENTE um JSON.`,
          config: {
            thinkingConfig: { thinkingBudget: 1000 }, // Reduzido ligeiramente para evitar timeout da Vercel
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
                      meaning: { type: Type.STRING }
                    }
                  }
                },
                imagePrompt: { type: Type.STRING }
              },
              required: ["verse", "context", "historicalAnalysis", "theologicalInsights", "originalLanguages", "imagePrompt"]
            }
          }
        });

        if (!response.text) {
          throw new Error("A IA não gerou conteúdo.");
        }

        return res.status(200).json(JSON.parse(response.text));

      case 'generateImage':
        const imageRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: `Biblical archaeological reconstruction, cinematic light, historical accuracy: ${payload.prompt}` }]
          },
          config: {
            imageConfig: { aspectRatio: "16:9" }
          }
        });

        const imagePart = imageRes.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return res.status(200).json({ base64: imagePart?.inlineData?.data || null });

      case 'generateTTS':
        const ttsRes = await ai.models.generateContent({
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

        const audioData = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return res.status(200).json({ base64: audioData || null });

      default:
        return res.status(400).json({ error: 'Ação desconhecida' });
    }
  } catch (err: any) {
    console.error("Erro na API Exegesis:", err);
    return res.status(500).json({ 
      error: 'Falha na comunicação com a IA', 
      details: err.message || 'Verifique sua chave de API e cota de uso no Google AI Studio.' 
    });
  }
}
