import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'DukaAquSmart API', timestamp: new Date().toISOString() });
  });

  // Aqua Intelligence Decision Assistant
  app.post('/api/ai/aqua-intelligence', async (req, res) => {
    try {
      const { question, farmSnapshot, language = 'en' } = req.body as {
        question?: string;
        farmSnapshot?: unknown;
        language?: 'en' | 'sw';
      };

      if (!question || !question.trim()) {
        res.status(400).json({ error: 'Question is required.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured in Settings > Secrets. Please configure your Gemini API key to enable live Aqua Intelligence queries.',
        });
        return;
      }

      const systemInstruction = `You are Aqua Intelligence, the operational analytics assistant for DukaAquSmart, a Smart Aquaculture Management System in Tanzania.
Rules:
1. Answer strictly using the provided live JSON farm database snapshot. NEVER invent or fabricate missing measurements, dates, pond IDs, or financial numbers.
2. If a requested data point is missing from the snapshot, clearly state what is missing and which module should record it.
3. Show your calculations transparently (e.g., Biomass = liveFish * avgWeightKg, FCR = feedKg / biomassGainKg, Cost/kg = totalCost / biomassKg).
4. Format currency in Tanzanian Shillings (TZS) with comma separators.
5. Reference exact pond codes (e.g., POND-001), batch IDs (e.g., TIL-2026-001), employee names, and dates from the data.
6. Respond in ${language === 'sw' ? 'Kiswahili (clear, practical Tanzanian aquaculture terminology)' : 'concise, executive English'}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Live Farm Snapshot (JSON):\n${JSON.stringify(farmSnapshot)}\n\nUser Question: ${question}`,
        config: {
          systemInstruction,
        },
      });

      res.json({
        answer: response.text ?? 'No response generated.',
        model: 'gemini-4-hydrogen',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to query Aqua Intelligence';
      res.status(500).json({ error: message });
    }
  });

  // AI Fish Health Preliminary Inspection Advisor
  app.post('/api/ai/health-advisory', async (req, res) => {
    try {
      const { symptoms, species, pondCode, waterQuality, imageBase64, mimeType, language = 'en' } =
        req.body as {
          symptoms?: string;
          species?: string;
          pondCode?: string;
          waterQuality?: unknown;
          imageBase64?: string;
          mimeType?: string;
          language?: 'en' | 'sw';
        };

      if (!symptoms && !imageBase64) {
        res.status(400).json({ error: 'Provide observed symptoms or a fish photograph.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured in Settings > Secrets. Please configure your Gemini API key to run AI fish health inspection.',
        });
        return;
      }

      const promptText = `Analyze this aquaculture fish health report for Tanzania (${species || 'Nile Tilapia'}, ${pondCode || 'Pond'}).
Observed symptoms: ${symptoms || 'Visual inspection from uploaded photo'}.
Recent water quality: ${JSON.stringify(waterQuality || {})}.
Respond in ${language === 'sw' ? 'Kiswahili' : 'English'} with:
1. Possible stressors or conditions to check (never present as a definitive medical diagnosis).
2. Immediate biosecurity & water management actions for the keeper/technician.
3. Clear recommendation to involve an authorized aquaculture veterinarian / fisheries officer before administering medication and observe withdrawal periods under Tanzania Fisheries (Aquaculture) Regulations, 2024.`;

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (imageBase64 && mimeType) {
        parts.push({
          inlineData: {
            mimeType,
            data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
          },
        });
      }
      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
      });

      res.json({
        advisory: response.text ?? 'Unable to generate inspection notes.',
        disclaimer:
          'Preliminary decision support only — requires verification by an authorized Aquaculture Technician or Veterinary Officer.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Health advisory error';
      res.status(500).json({ error: message });
    }
  });

  // Swahili Voice / Text Feeding Report Parser
  app.post('/api/ai/parse-swahili-voice', async (req, res) => {
    try {
      const { transcript } = req.body as { transcript?: string };
      if (!transcript || !transcript.trim()) {
        res.status(400).json({ error: 'Transcript is required.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        // Deterministic Swahili fallback parser for offline/unconfigured environments
        const lower = transcript.toLowerCase();
        const wordNumbers: Record<string, number> = {
          moja: 1,
          mbili: 2,
          tatu: 3,
          nne: 4,
          tano: 5,
          sita: 6,
          saba: 7,
          nane: 8,
          tisa: 9,
          kumi: 10,
          ishirini: 20,
          thelathini: 30,
          kwanza: 1,
          pili: 2,
        };
        let qty = 10;
        const digitMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/);
        if (digitMatch) {
          qty = parseFloat(digitMatch[1]);
        } else {
          for (const [word, val] of Object.entries(wordNumbers)) {
            if (lower.includes(`kilo ${word}`) || lower.includes(`${word} kilo`)) {
              qty = val;
              break;
            }
          }
        }
        let pondCode = 'POND-001';
        if (lower.includes('pili') || lower.includes('2')) pondCode = 'POND-002';
        else if (lower.includes('tatu') || lower.includes('3')) pondCode = 'POND-003';
        else if (lower.includes('nne') || lower.includes('4')) pondCode = 'POND-004';
        else if (lower.includes('tano') || lower.includes('5')) pondCode = 'POND-005';

        res.json({
          pondCode,
          feedKg: qty,
          feedType: 'Grower Pellets 3mm',
          notes: transcript,
          source: 'offline-swahili-parser',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract structured aquaculture feeding data from this Swahili or English field report: "${transcript}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pondCode: {
                type: Type.STRING,
                description: 'Standardized pond code such as POND-001, POND-002, POND-003, POND-004, POND-005',
              },
              feedKg: {
                type: Type.NUMBER,
                description: 'Quantity of feed in kilograms',
              },
              feedType: {
                type: Type.STRING,
                description: 'Feed type or pellet size mentioned, or Grower Pellets 3mm if unspecified',
              },
              notes: {
                type: Type.STRING,
                description: 'Clean summary of the observation in English and Swahili',
              },
            },
            required: ['pondCode', 'feedKg', 'feedType', 'notes'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ ...parsed, source: 'gemini-4-hydrogen' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse Swahili voice report';
      res.status(500).json({ error: message });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DukaAquSmart server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
