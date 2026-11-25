import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Bot, Send, ShieldCheck } from 'lucide-react';
import { AquacultureState, Language } from '../../types/aquaculture';
import {
  Badge,
  Button,
  Card,
  CardListSkeleton,
  DURATIONS,
  EASE_OUT,
  INPUT_CLASS,
  usePreferences,
} from '../../ui';

interface AquaIntelligenceViewProps {
  state: AquacultureState;
  language: Language;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  streamReveal?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'How many fish are currently alive across all ponds?',
  'Which pond has the highest mortality rate and what action was taken?',
  'Are there unexplained differences between feed issued and feed recorded as used?',
  'What is the estimated cost of producing one kilogram of tilapia?',
  'Which ponds are approaching their planned harvest dates?',
  'Nionyeshe hali ya ubora wa maji na tahadhari za leo kwa Kiswahili.',
];

const StreamingAssistantText: React.FC<{ text: string; animateReveal?: boolean }> = ({
  text,
  animateReveal,
}) => {
  const { effectiveReducedMotion } = usePreferences();
  const [shownLen, setShownLen] = useState<number>(() =>
    animateReveal && !effectiveReducedMotion ? Math.min(text.length, 18) : text.length
  );

  useEffect(() => {
    if (!animateReveal || effectiveReducedMotion) {
      setShownLen(text.length);
      return;
    }
    let current = Math.min(text.length, 18);
    setShownLen(current);
    const step = Math.max(4, Math.ceil(text.length / 40));
    const timer = window.setInterval(() => {
      current = Math.min(text.length, current + step);
      setShownLen(current);
      if (current >= text.length) {
        window.clearInterval(timer);
      }
    }, 18);
    return () => window.clearInterval(timer);
  }, [text, animateReveal, effectiveReducedMotion]);

  return <div>{text.slice(0, shownLen)}</div>;
};

export const AquaIntelligenceView: React.FC<AquaIntelligenceViewProps> = ({ state, language }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        language === 'sw'
          ? 'Karibu kwenye Aqua Intelligence. Uliza swali lolote kuhusu samaki hai, vifo, tofauti za chakula, ubora wa maji, au faida kwa TZS — ninatumia rekodi halisi za shamba lako pekee.'
          : 'Welcome to Aqua Intelligence. Ask any operational or financial question about live fish counts, mortality, feed variances, water quality, or TZS unit economics — answers are grounded strictly in your live farm records.',
      timestamp: 'Now',
      streamReveal: false,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  const askAssistant = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
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
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `Error: ${data.error || 'Unable to reach Aqua Intelligence service.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            streamReveal: true,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: data.answer,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            streamReveal: true,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: 'Network error communicating with /api/ai/aqua-intelligence.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          streamReveal: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Aqua Intelligence — Executive Decision Assistant
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Queries live ponds, batches, feed reconciliation, mortality logs & TZS financials without fabricating missing data.
            </p>
          </div>
        </div>
        <Badge variant="success">
          <ShieldCheck className="h-3.5 w-3.5" /> Grounded in Live Farm Records
        </Badge>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Executive Quick Queries
          </h3>
          <div className="space-y-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askAssistant(q)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-sky-500/60 dark:hover:bg-slate-800"
              >
                {q}
              </button>
            ))}
          </div>
        </Card>

        <Card padded={false} className="flex h-[520px] flex-col lg:col-span-8">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <StreamingAssistantText text={m.text} animateReveal={m.streamReveal} />
                  ) : (
                    <div>{m.text}</div>
                  )}
                  <div
                    className={`mt-1 text-[10px] ${
                      m.role === 'user'
                        ? 'text-blue-100'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-sky-400">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-sky-400" />
                  </span>
                  Thinking & analyzing live farm database...
                </div>
                <CardListSkeleton rows={2} />
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              askAssistant(input);
            }}
            className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Aqua Intelligence (English or Kiswahili)..."
              className={`${INPUT_CLASS} min-h-[42px] flex-1`}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !input.trim()}
            >
              <Send className="h-3.5 w-3.5" /> Ask
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
