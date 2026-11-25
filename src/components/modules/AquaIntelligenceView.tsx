import React, { useState } from 'react';
import { Bot, Send, Loader2, ShieldCheck } from 'lucide-react';
import { AquacultureState, Language } from '../../types/aquaculture';

interface AquaIntelligenceViewProps {
  state: AquacultureState;
  language: Language;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  'How many fish are currently alive across all ponds?',
  'Which pond has the highest mortality rate and what action was taken?',
  'Are there unexplained differences between feed issued and feed recorded as used?',
  'What is the estimated cost of producing one kilogram of tilapia?',
  'Which ponds are approaching their planned harvest dates?',
  'Nionyeshe hali ya ubora wa maji na tahadhari za leo kwa Kiswahili.',
];

export const AquaIntelligenceView: React.FC<AquaIntelligenceViewProps> = ({ state, language }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text:
        language === 'sw'
          ? 'Karibu kwenye Aqua Intelligence. Uliza swali lolote kuhusu samaki hai, vifo, tofauti za chakula, ubora wa maji, au faida kwa TZS — ninatumia rekodi halisi za shamba lako pekee.'
          : 'Welcome to Aqua Intelligence. Ask any operational or financial question about live fish counts, mortality, feed variances, water quality, or TZS unit economics — answers are grounded strictly in your live farm records.',
      timestamp: 'Now',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const askAssistant = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const farmSnapshot = {
        activeUser: { name: state.activeUser.name, role: state.activeUser.roleLabel },
        ponds: state.ponds.map((p) => ({
          code: p.code,
          species: p.species,
          currentFish: p.currentFish,
          maxCapacity: p.maxCapacity,
          status: p.status,
          readinessPct: p.readinessPct,
        })),
        batches: state.batches.map((b) => ({
          batchCode: b.batchCode,
          pondCode: b.pondCode,
          species: b.species,
          initialStocking: b.initialStocking,
          currentEstimatedFish: b.currentEstimatedFish,
          currentAvgWeightG: b.currentAvgWeightG,
          feedConsumedKg: b.feedConsumedKg,
          totalMortality: b.totalMortality,
          stockingDate: b.stockingDate,
          plannedHarvestDate: b.plannedHarvestDate,
          status: b.status,
        })),
        feedIssuances: state.feedIssuances,
        waterReadings: state.waterReadings,
        healthIncidents: state.healthIncidents,
        inventory: state.inventory,
        harvests: state.harvests,
        finances: state.finances,
        employees: state.employees.map((e) => ({
          name: e.name,
          role: e.roleLabel,
          reportsSubmittedToday: e.reportsSubmittedToday,
        })),
      };

      const res = await fetch('/api/ai/aqua-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, farmSnapshot, language }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `Error: ${data.error || 'Unable to reach Aqua Intelligence service.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: data.answer,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Network error communicating with /api/ai/aqua-intelligence.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Aqua Intelligence — Executive Decision Assistant</h2>
            <p className="text-xs text-slate-500">
              Queries live ponds, batches, feed reconciliation, mortality logs & TZS financials without fabricating missing data.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> Grounded in Live Farm Records
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-4">
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            Executive Quick Queries
          </h3>
          <div className="space-y-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askAssistant(q)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="flex h-[520px] flex-col rounded-xl border border-slate-200 bg-white lg:col-span-8">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  <div>{m.text}</div>
                  <div
                    className={`mt-1 text-[10px] ${
                      m.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Analyzing live farm database & calculating indicators...
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              askAssistant(input);
            }}
            className="flex items-center gap-2 border-t border-slate-100 p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Aqua Intelligence (English or Kiswahili)..."
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Ask
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
