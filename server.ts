import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildGeoJsonFeatureCollection,
  measureAndValidatePolygon,
} from './src/utils/gisGeometry.ts';
import type { Farm, FarmInfrastructureMarker, Pond } from './src/types/aquaculture.ts';

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

interface ConfirmedSaleRecord {
  confirmationId: string;
  idempotencyKey: string;
  confirmedAt: string;
  customerId: string;
  totals: {
    subtotalTzs: number;
    discountTzs: number;
    taxRatePct: number;
    taxTzs: number;
    totalTzs: number;
    paidTzs: number;
    balanceTzs: number;
  };
}

const ALLOWED_PAYMENT_METHODS = new Set([
  'Cash',
  'M-Pesa',
  'Tigo Pesa',
  'Airtel Money',
  'Halopesa',
  'Bank Transfer',
  'Cheque',
]);

const ALLOWED_DELIVERY_STATUSES = new Set([
  'Pending Dispatch',
  'In Transit',
  'Delivered',
]);

const ALLOWED_GRADES = new Set(['Large', 'Medium', 'Small']);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const inFlightSaleKeys = new Set<string>();
  const confirmedSalesByKey = new Map<string, ConfirmedSaleRecord>();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'DukaAquSmart API', timestamp: new Date().toISOString() });
  });

  // GIS Map Provider Capability Info (never exposes raw secret)
  app.get('/api/gis/config', (_req, res) => {
    const hasMapTiler = Boolean(
      (process.env.VITE_MAPTILER_API_KEY || process.env.MAPTILER_API_KEY)?.trim()
    );
    res.json({
      provider: hasMapTiler ? 'maptiler' : 'esri-osm-fallback',
      mapTilerConfigured: hasMapTiler,
      supportedModes: ['satellite', 'hybrid', 'street', 'terrain', 'infrastructure'],
    });
  });

  // Forward Geocoding: Search village, ward, landmark or farm (MapTiler -> Nominatim fallback)
  app.get('/api/gis/geocode', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) {
      res.json({ results: [], provider: 'none' });
      return;
    }

    const mapTilerKey = (process.env.VITE_MAPTILER_API_KEY || process.env.MAPTILER_API_KEY)?.trim();
    try {
      if (mapTilerKey) {
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
          q
        )}.json?key=${encodeURIComponent(mapTilerKey)}&country=tz&limit=6&language=en`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = (await resp.json()) as {
            features?: Array<{
              id?: string;
              place_name?: string;
              text?: string;
              center?: [number, number];
            }>;
          };
          const results = (data.features || [])
            .filter((f) => Array.isArray(f.center) && f.center.length >= 2)
            .map((f, idx) => ({
              id: f.id || `mt-${idx}`,
              title: f.text || f.place_name || q,
              placeName: f.place_name || f.text || q,
              lat: Number(f.center![1]),
              lng: Number(f.center![0]),
              source: 'maptiler',
            }));
          res.json({ results, provider: 'maptiler' });
          return;
        }
      }

      const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=tz&limit=6&q=${encodeURIComponent(
        q
      )}`;
      const nomResp = await fetch(nomUrl, {
        headers: {
          'User-Agent': 'DukaAquSmart-Tanzania/1.0 (aquaculture-gis)',
          'Accept-Language': 'en,sw',
        },
      });
      if (!nomResp.ok) {
        res.status(502).json({ results: [], error: 'Geocoding lookup failed.' });
        return;
      }
      const rows = (await nomResp.json()) as Array<{
        place_id?: number;
        display_name?: string;
        name?: string;
        lat?: string;
        lon?: string;
      }>;
      const results = rows
        .map((r, idx) => ({
          id: String(r.place_id || idx),
          title: r.name || (r.display_name || '').split(',')[0] || q,
          placeName: r.display_name || q,
          lat: Number(r.lat),
          lng: Number(r.lon),
          source: 'nominatim',
        }))
        .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));

      res.json({ results, provider: 'nominatim' });
    } catch {
      res.status(500).json({ results: [], error: 'Unable to reach geocoding service.' });
    }
  });

  // Reverse Geocoding: Convert GPS lat/lng to nearest Tanzanian ward/village/place name
  app.get('/api/gis/reverse-geocode', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
      return;
    }

    const mapTilerKey = (process.env.VITE_MAPTILER_API_KEY || process.env.MAPTILER_API_KEY)?.trim();
    try {
      if (mapTilerKey) {
        const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${encodeURIComponent(
          mapTilerKey
        )}&limit=1`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = (await resp.json()) as {
            features?: Array<{ place_name?: string; text?: string }>;
          };
          const feat = data.features?.[0];
          if (feat?.place_name) {
            res.json({
              placeName: feat.place_name,
              shortName: feat.text || feat.place_name.split(',')[0],
              provider: 'maptiler',
            });
            return;
          }
        }
      }

      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&zoom=15`;
      const nomResp = await fetch(nomUrl, {
        headers: {
          'User-Agent': 'DukaAquSmart-Tanzania/1.0 (aquaculture-gis)',
          'Accept-Language': 'en,sw',
        },
      });
      if (nomResp.ok) {
        const data = (await nomResp.json()) as {
          display_name?: string;
          address?: {
            suburb?: string;
            village?: string;
            town?: string;
            city_district?: string;
            city?: string;
            state?: string;
          };
        };
        const addr = data.address || {};
        const shortName =
          addr.village || addr.suburb || addr.town || addr.city_district || addr.city || addr.state;
        res.json({
          placeName: data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          shortName: shortName || 'Tanzania Site',
          provider: 'nominatim',
        });
        return;
      }
      res.json({
        placeName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        shortName: 'GPS Location',
        provider: 'coordinates',
      });
    } catch {
      res.json({
        placeName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        shortName: 'GPS Location',
        provider: 'coordinates',
      });
    }
  });

  // Server-Side Geospatial Polygon Validation & Authoritative Measurement
  app.post('/api/gis/validate-geometry', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawPoly = Array.isArray(body.polygonLatLng) ? body.polygonLatLng : [];
    const polygonLatLng: [number, number][] = [];

    for (const pt of rawPoly) {
      if (Array.isArray(pt) && pt.length >= 2) {
        const lat = Number(pt[0]);
        const lng = Number(pt[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          polygonLatLng.push([lat, lng]);
        }
      }
    }

    const rawFarmGps = Array.isArray(body.farmGps) ? body.farmGps : null;
    const farmGps: [number, number] | undefined =
      rawFarmGps && rawFarmGps.length >= 2 && Number.isFinite(Number(rawFarmGps[0])) && Number.isFinite(Number(rawFarmGps[1]))
        ? [Number(rawFarmGps[0]), Number(rawFarmGps[1])]
        : undefined;

    const unitType =
      typeof body.unitType === 'string'
        ? (body.unitType as Pond['unitType'])
        : undefined;
    const gpsAccuracyM =
      typeof body.gpsAccuracyM === 'number' && Number.isFinite(body.gpsAccuracyM)
        ? body.gpsAccuracyM
        : undefined;
    const maxRadiusM =
      typeof body.maxRadiusM === 'number' && Number.isFinite(body.maxRadiusM)
        ? body.maxRadiusM
        : 15000;

    const result = measureAndValidatePolygon({
      polygonLatLng,
      unitType,
      farmGps,
      maxRadiusM,
      gpsAccuracyM,
    });

    if (!result.valid) {
      res.status(400).json({
        ok: false,
        ...result,
      });
      return;
    }

    res.json({
      ok: true,
      serverValidated: true,
      verifiedAt: new Date().toISOString(),
      ...result,
    });
  });

  // Server-Side RFC 7946 GeoJSON Export
  app.post('/api/gis/export-geojson', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const ponds = Array.isArray(body.ponds) ? (body.ponds as Pond[]) : [];
    const farms = Array.isArray(body.farms) ? (body.farms as Farm[]) : [];
    const infrastructureMarkers = Array.isArray(body.infrastructureMarkers)
      ? (body.infrastructureMarkers as FarmInfrastructureMarker[])
      : [];

    const collection = buildGeoJsonFeatureCollection({
      ponds,
      farms,
      infrastructureMarkers,
    });
    res.json(collection);
  });

  // Transaction-Safe Quick Sale Confirmation (Idempotent & Duplicate-Submission Protected)
  app.post('/api/sales/confirm', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';

    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      res.status(400).json({
        ok: false,
        error: 'Valid idempotencyKey is required to confirm sale safely.',
      });
      return;
    }

    if (inFlightSaleKeys.has(idempotencyKey)) {
      res.status(409).json({
        ok: false,
        duplicate: true,
        error: 'Duplicate submission blocked: this sale is already being processed.',
      });
      return;
    }

    const existing = confirmedSalesByKey.get(idempotencyKey);
    if (existing) {
      res.status(409).json({
        ok: false,
        duplicate: true,
        error: 'This sale has already been confirmed. Stock was not deducted twice.',
        previousConfirmation: existing,
      });
      return;
    }

    inFlightSaleKeys.add(idempotencyKey);
    try {
      const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';
      const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
      const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : '';
      const deliveryStatus = typeof body.deliveryStatus === 'string' ? body.deliveryStatus : '';
      const deliveryAddress =
        typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';
      const discountReason =
        typeof body.discountReason === 'string' ? body.discountReason.trim() : '';
      const applyTax = body.applyTax !== false;
      const pinRequired = body.pinRequired === true;
      const hasPin = typeof body.pin === 'string' && /^\d{4}$/.test(body.pin.trim());
      const rawLines = Array.isArray(body.lines) ? body.lines : [];

      if (!customerId) {
        res.status(400).json({ ok: false, error: 'Customer is required.' });
        return;
      }
      if (!/^255\d{9}$/.test(customerPhone)) {
        res.status(400).json({
          ok: false,
          error: 'Customer phone must be a valid 255XXXXXXXXX number.',
        });
        return;
      }
      if (rawLines.length === 0 || rawLines.length > 50) {
        res.status(400).json({
          ok: false,
          error: 'Sale must contain between 1 and 50 weighing lines.',
        });
        return;
      }
      if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
        res.status(400).json({ ok: false, error: 'Invalid payment method.' });
        return;
      }
      if (!ALLOWED_DELIVERY_STATUSES.has(deliveryStatus)) {
        res.status(400).json({ ok: false, error: 'Invalid delivery status.' });
        return;
      }
      if (deliveryStatus !== 'Delivered' && !deliveryAddress) {
        res.status(400).json({
          ok: false,
          error: 'Delivery address is required for Pending Dispatch or In Transit orders.',
        });
        return;
      }

      let subtotalTzs = 0;
      for (const item of rawLines) {
        if (!item || typeof item !== 'object') {
          res.status(400).json({ ok: false, error: 'Invalid line item payload.' });
          return;
        }
        const ln = item as Record<string, unknown>;
        const sourceType = ln.sourceType;
        const grade = typeof ln.grade === 'string' ? ln.grade : '';
        const kg = typeof ln.kg === 'number' ? Math.round(ln.kg * 100) / 100 : NaN;
        const count = typeof ln.count === 'number' ? Math.round(ln.count) : 0;
        const pricePerKgTzs =
          typeof ln.pricePerKgTzs === 'number' ? Math.round(ln.pricePerKgTzs) : NaN;

        if (sourceType !== 'lot' && sourceType !== 'pond') {
          res.status(400).json({ ok: false, error: 'Line sourceType must be lot or pond.' });
          return;
        }
        if (sourceType === 'lot' && (typeof ln.lotId !== 'string' || !ln.lotId.trim())) {
          res.status(400).json({ ok: false, error: 'Harvest lot ID is required for In Stock lines.' });
          return;
        }
        if (typeof ln.pondCode !== 'string' || !ln.pondCode.trim()) {
          res.status(400).json({ ok: false, error: 'Pond code is required on every line.' });
          return;
        }
        if (!ALLOWED_GRADES.has(grade)) {
          res.status(400).json({ ok: false, error: 'Invalid fish grade.' });
          return;
        }
        if (!Number.isFinite(kg) || kg <= 0 || kg > 100000) {
          res.status(400).json({ ok: false, error: 'Weight (kg) must be greater than 0.' });
          return;
        }
        if (!Number.isFinite(count) || count < 0 || count > 500000) {
          res.status(400).json({ ok: false, error: 'Fish count must be 0 or greater.' });
          return;
        }
        if (!Number.isFinite(pricePerKgTzs) || pricePerKgTzs <= 0 || pricePerKgTzs > 10000000) {
          res.status(400).json({ ok: false, error: 'Price/kg must be greater than 0.' });
          return;
        }
        subtotalTzs += Math.round(kg * pricePerKgTzs);
      }

      const discountTzs =
        typeof body.discountTzs === 'number' && Number.isFinite(body.discountTzs)
          ? Math.max(0, Math.round(body.discountTzs))
          : 0;
      if (discountTzs > subtotalTzs) {
        res.status(400).json({ ok: false, error: 'Discount cannot exceed subtotal.' });
        return;
      }
      if (discountTzs > 0 && !discountReason) {
        res.status(400).json({ ok: false, error: 'Discount reason is required.' });
        return;
      }

      const taxableBase = Math.max(0, subtotalTzs - discountTzs);
      const taxRatePct = applyTax ? 18 : 0;
      const taxTzs = applyTax ? Math.round(taxableBase * 0.18) : 0;
      const totalTzs = taxableBase + taxTzs;

      const paidTzs =
        typeof body.paidTzs === 'number' && Number.isFinite(body.paidTzs)
          ? Math.round(body.paidTzs)
          : NaN;
      if (!Number.isFinite(paidTzs) || paidTzs < 0 || paidTzs > totalTzs) {
        res.status(400).json({
          ok: false,
          error: `Paid amount must be between TZS 0 and TZS ${totalTzs.toLocaleString()}.`,
        });
        return;
      }
      const balanceTzs = Math.max(0, totalTzs - paidTzs);

      if (pinRequired && !hasPin) {
        res.status(400).json({
          ok: false,
          error: 'Valid 4-digit PIN approval is required for this sale.',
        });
        return;
      }

      const confirmation: ConfirmedSaleRecord = {
        confirmationId: `CONF-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        idempotencyKey,
        confirmedAt: new Date().toISOString(),
        customerId,
        totals: {
          subtotalTzs,
          discountTzs,
          taxRatePct,
          taxTzs,
          totalTzs,
          paidTzs,
          balanceTzs,
        },
      };

      // Keep bounded idempotency cache (max 500 entries FIFO)
      if (confirmedSalesByKey.size >= 500) {
        const oldestKey = confirmedSalesByKey.keys().next().value;
        if (oldestKey) confirmedSalesByKey.delete(oldestKey);
      }
      confirmedSalesByKey.set(idempotencyKey, confirmation);

      res.json({
        ok: true,
        ...confirmation,
      });
    } finally {
      inFlightSaleKeys.delete(idempotencyKey);
    }
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
          kwanza: 1,
          mbili: 2,
          pili: 2,
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
          arobaini: 40,
          hamsini: 50,
          sitini: 60,
          sabini: 70,
          themanini: 80,
          tisini: 90,
          mia: 100,
        };

        let qty = 10;
        const digitWeightMatch =
          lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilogram)\b/) ||
          lower.match(/\b(?:kg|kilo|kilogram)\s*(\d+(?:\.\d+)?)\b/);
        if (digitWeightMatch) {
          qty = parseFloat(digitWeightMatch[1]);
        } else {
          const wordPattern = Object.keys(wordNumbers).join('|');
          const wordWeightMatch =
            lower.match(new RegExp(`\\b(?:kilo|kg)\\s+(?:za\\s+)?(${wordPattern})\\b`)) ||
            lower.match(new RegExp(`\\b(${wordPattern})\\s+(?:kilo|kg)\\b`));
          if (wordWeightMatch) {
            qty = wordNumbers[wordWeightMatch[1]] ?? 10;
          }
        }

        let pondCode = 'POND-001';
        const pondNumPattern = Object.keys(wordNumbers).join('|');
        const swPondMatch = lower.match(
          new RegExp(`\\bbwawa\\s+(?:la\\s+|namba\\s+|no\\.?\\s*)?(${pondNumPattern}|\\d+)\\b`)
        );
        const enPondMatch = lower.match(/\bpond[-\s#]*0*(\d+)\b/);

        if (swPondMatch) {
          const token = swPondMatch[1];
          const num = /^\d+$/.test(token) ? parseInt(token, 10) : (wordNumbers[token] ?? 1);
          if (num >= 1 && num <= 999) {
            pondCode = `POND-${String(num).padStart(3, '0')}`;
          }
        } else if (enPondMatch) {
          const num = parseInt(enPondMatch[1], 10);
          if (num >= 1 && num <= 999) {
            pondCode = `POND-${String(num).padStart(3, '0')}`;
          }
        }

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
