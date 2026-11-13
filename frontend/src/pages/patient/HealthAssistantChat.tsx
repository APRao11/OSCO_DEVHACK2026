import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  FileText,
  Info,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import type { ChatMessage, SourceReference } from '../../types/patient';
import { INITIAL_CHAT_MESSAGES } from '../../mock/patientMockData';

export interface HealthAssistantChatProps {
  onOpenDocumentByName?: (docName: string) => void;
}

const EXAMPLE_QUESTIONS = [
  'What medications were prescribed to me?',
  'When was my last blood test?',
  'What were my previous diagnoses?',
  'When was this medication discontinued?',
];

export const HealthAssistantChat: React.FC<HealthAssistantChatProps> = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const msgCounterRef = useRef(100);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt) return;

    msgCounterRef.current += 1;
    const userMsgId = `msg-${msgCounterRef.current}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: prompt,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsTyping(true);

    // Realistic deterministic responses based on medical records
    setTimeout(() => {
      let botResponse: string;
      let botSources: SourceReference[];

      const lower = prompt.toLowerCase();
      if (lower.includes('blood test') || lower.includes('hba1c') || lower.includes('lab')) {
        botResponse =
          'Your most recent laboratory investigation was on **October 24, 2026** at LabCorp Diagnostic Services.\n\n**Extracted Results:**\n- **Glycated Hemoglobin (HbA1c):** 6.8% (Target: <7.0%)\n- **Fasting Blood Glucose:** 124 mg/dL\n- **Estimated GFR:** 88 mL/min/1.73m² (Normal renal function)\n- **Serum Creatinine:** 0.92 mg/dL\n\nYour HbA1c shows consistent improvement from your previous reading of 7.4% documented in early 2026.';
        botSources = [
          {
            docName: 'Comprehensive_Metabolic_Panel_LabCorp.pdf',
            page: 2,
            date: '2026-10-24',
            excerpt:
              'HbA1c: 6.8%, Fasting Plasma Glucose: 124 mg/dL. eGFR calculated at 88 mL/min.',
          },
        ];
      } else if (
        lower.includes('diagnos') ||
        lower.includes('condition') ||
        lower.includes('previous')
      ) {
        botResponse =
          'According to your verified clinical records, the following formal diagnoses are documented in your history:\n\n1. **Type 2 Diabetes Mellitus (ICD-10 E11.9)** — Diagnosed on June 15, 2025 by Dr. Marcus Webb at Bay Health Primary Care following repeat fasting glucose evaluations.\n2. **Mild Diabetic Polyneuropathy** — Documented by specialist Dr. S. Kapoor on May 11, 2026, noting mild distal vibratory sensation changes.\n3. **Transient Post-Prandial Hyperglycemia** — Documented during an observational stay on October 24, 2026 at St. Jude Medical Center.';
        botSources = [
          {
            docName: 'Endocrinology_FollowUp_ProgressNote.pdf',
            page: 1,
            date: '2025-06-15',
            excerpt:
              'Diagnosis confirmed: Type 2 Diabetes Mellitus without acute complications (E11.9).',
          },
          {
            docName: 'Discharge_Summary_StJude_2026.pdf',
            page: 1,
            date: '2026-10-24',
            excerpt: 'Discharge diagnosis: Transient hyperglycemia secondary to dietary indiscretion.',
          },
        ];
      } else if (lower.includes('discontinued') || lower.includes('stopped') || lower.includes('glipizide')) {
        botResponse =
          '**Glipizide ER (5 mg daily)** was discontinued on **August 14, 2026** by Dr. Alistair Chen at Bay Health Endocrine Institute.\n\n**Reason for Discontinuation:**\nPatient clinical logs demonstrated 3 episodes of nocturnal mild hypoglycemia (54–62 mg/dL). Dr. Chen transitioned your therapy to Empagliflozin 10mg daily instead.\n\n*Reminder: Because this prescription is historical, you should no longer be taking Glipizide.*';
        botSources = [
          {
            docName: 'Endocrinology_FollowUp_ProgressNote.pdf',
            page: 4,
            date: '2026-08-14',
            excerpt:
              'Cease Glipizide ER 5mg oral daily immediately. Recurrent nocturnal hypoglycemia confirmed on patient glucometer readings.',
          },
        ];
      } else {
        botResponse =
          'Based on your verified medical records, your active medical management includes:\n\n- **Active Medications:** Metformin ER 1000mg BID and Empagliflozin 10mg once daily.\n- **Discontinued Medications:** Glipizide ER (stopped August 14, 2026).\n- **Recent Diagnostic:** CMP and HbA1c (6.8%) on October 24, 2026.\n\nEvery answer is cross-checked against your uploaded clinical documents with zero diagnostic inferences.';
        botSources = [
          {
            docName: 'Pharmacy_Rx_Ledger_Q1_2026.pdf',
            page: 1,
            date: '2026-03-10',
            excerpt: 'Active maintenance: Metformin ER 1000mg BID.',
          },
        ];
      }

      msgCounterRef.current += 1;
      const botMsg: ChatMessage = {
        id: `msg-${msgCounterRef.current}`,
        sender: 'assistant',
        text: botResponse,
        timestamp: 'Just now',
        sources: botSources,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <section className="border-b border-border-subtle pb-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase bg-forest text-white px-2 py-0.5 rounded font-semibold tracking-wider">
                RETRIEVAL ENGINE
              </span>
              <Badge variant="citron" size="sm" isMono dot>
                GROUNDED IN CLINICAL RECORDS ONLY
              </Badge>
            </div>
            <h1 className="text-3xl font-bold font-heading text-forest tracking-tight">
              Health Assistant
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary font-body leading-relaxed max-w-2xl">
              Retrieve factual information from your verified medical records, lab reports, and
              prescriptions.
            </p>
          </div>

          <div className="text-xs font-mono text-text-secondary bg-white px-3 py-1.5 rounded-md border border-border-subtle shrink-0">
            Model: OSCO-Med-Audit
          </div>
        </div>
      </section>

      {/* Mandatory Non-Diagnostic / Non-Prescribing Medical Disclaimer */}
      <div className="p-3.5 bg-osco-bg border border-border-subtle rounded-lg text-xs leading-relaxed text-text-main flex items-start gap-3 shadow-xs">
        <Info className="text-forest shrink-0 mt-0.5" size={17} />
        <div className="space-y-0.5">
          <span className="font-heading font-semibold text-forest">
            Information Retrieval Notice:
          </span>{' '}
          <span className="text-text-secondary">
            This assistant is strictly a factual retrieval tool for your stored medical history. It
            does <strong>not</strong> provide medical diagnoses, treatment advice, or drug
            prescriptions. Always consult your licensed healthcare provider for clinical decisions.
          </span>
        </div>
      </div>

      {/* Suggested Questions Strip */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-text-muted uppercase font-mono tracking-wider flex items-center gap-1.5">
          <Sparkles size={13} className="text-forest" />
          Suggested Record Lookups
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EXAMPLE_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-left p-2.5 bg-white border border-border-subtle hover:border-forest/50 hover:bg-[#FAFCFB] rounded-md text-xs text-text-main font-medium transition-all shadow-xs cursor-pointer truncate"
            >
              "{q}"
            </button>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <Card accent="forest">
        <CardHeader
          title="Medical Record Conversation"
          subtitle="Cryptographically verified responses with inline provenance footnotes"
          action={
            <Badge variant="verified" size="sm" isMono>
              ZERO HALLUCINATION PROTOCOL
            </Badge>
          }
        />

        <CardContent className="p-4 sm:p-6 space-y-5 min-h-[380px] max-h-[520px] overflow-y-auto bg-[#FAFCFB]">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded bg-forest text-citron border border-forest/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={16} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-lg p-4 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-forest text-white shadow-xs font-medium'
                      : 'bg-white border border-border-subtle text-text-main shadow-xs'
                  }`}
                >
                  {/* Message Text with basic markdown rendering */}
                  <div className="whitespace-pre-line space-y-2">
                    {msg.text.split('\n\n').map((para, pIdx) => (
                      <p key={pIdx}>
                        {para.split('**').map((chunk, cIdx) =>
                          cIdx % 2 === 1 ? (
                            <strong
                              key={cIdx}
                              className={isUser ? 'text-citron' : 'text-forest font-semibold'}
                            >
                              {chunk}
                            </strong>
                          ) : (
                            chunk
                          )
                        )}
                      </p>
                    ))}
                  </div>

                  {/* Supporting Source References */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
                      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider flex items-center gap-1">
                        <FileText size={11} className="text-forest" />
                        Provenance Grounding Citations:
                      </div>
                      <div className="space-y-1.5">
                        {msg.sources.map((src, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2 bg-osco-bg rounded border border-border-subtle text-xs space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-forest font-semibold">
                              <span>
                                {src.docName} (Page {src.page})
                              </span>
                              <span className="text-text-muted">{src.date}</span>
                            </div>
                            <p className="text-[11px] text-text-secondary italic">
                              "{src.excerpt}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`mt-2 text-[10px] font-mono ${
                      isUser ? 'text-white/60 text-right' : 'text-text-muted'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded bg-osco-bg text-forest border border-border-subtle flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs font-bold">
                    EV
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-forest text-citron border border-forest/20 flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-white border border-border-subtle rounded-lg px-4 py-2.5 text-xs text-text-muted flex items-center gap-2">
                <Sparkles size={13} className="text-forest animate-spin" />
                <span>Searching verified clinical ledger...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-border-subtle bg-white rounded-b-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask a question about your verified medications, tests, or visits..."
              className="flex-1 bg-osco-bg text-text-main text-xs sm:text-sm border border-border-subtle rounded-md px-3.5 py-2.5 focus:border-forest focus:ring-1 focus:ring-forest focus:outline-none transition-colors"
            />
            <Button
              type="submit"
              variant="citron"
              size="md"
              leftIcon={<Send size={14} />}
              disabled={!inputPrompt.trim()}
            >
              Ask
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
