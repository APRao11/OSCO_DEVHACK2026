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

export interface DoctorAssistantChatProps {
  patientName: string;
  isDemoPatient: boolean;
  onOpenDocumentByName?: (docName: string) => void;
}

const DOCTOR_EXAMPLE_QUESTIONS = [
  'Summarize all antidiabetic dose modifications chronologically.',
  'What was the baseline renal clearance before Empagliflozin was started?',
  'Detail the exact clinical rationale for the Glipizide discontinuation.',
  'List all documented adverse drug reactions and allergy severities.',
];

const initialDoctorChat = (patientName: string, isDemoPatient: boolean): ChatMessage[] => [
  {
    id: 'doc-msg-1',
    sender: 'assistant',
    text: isDemoPatient
      ? `Fictional demo conversation for ${patientName}. Responses are predefined examples and do not analyze records or provide clinical guidance.`
      : 'This is a mock assistant. It does not analyze this patient’s records or provide clinical guidance.',
    timestamp: 'Just now',
  },
];

export const DoctorAssistantChat: React.FC<DoctorAssistantChatProps> = ({
  patientName,
  isDemoPatient,
  onOpenDocumentByName,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialDoctorChat(patientName, isDemoPatient),
  );
  const [inputPrompt, setInputPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(100);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt) return;

    counterRef.current += 1;
    const userMsg: ChatMessage = {
      id: `doc-msg-${counterRef.current}`,
      sender: 'user',
      text: prompt,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsTyping(true);

    setTimeout(() => {
      if (!isDemoPatient) {
        counterRef.current += 1;
        setMessages((prev) => [
          ...prev,
          {
            id: `doc-msg-${counterRef.current}`,
            sender: 'assistant',
            text: 'The mock assistant has no sample record for this patient and cannot answer from their data.',
            timestamp: 'Just now',
          },
        ]);
        setIsTyping(false);
        return;
      }

      let botResponse: string;
      let botSources: SourceReference[];

      const lower = prompt.toLowerCase();
      if (lower.includes('renal') || lower.includes('clearance') || lower.includes('egfr') || lower.includes('creatinine')) {
        botResponse =
          `**Renal Clearance Profile Prior to Empagliflozin Initiation:**\n\n- **Baseline eGFR (June 2025):** 91 mL/min/1.73m² (Normal renal baseline).\n- **Pre-Titration eGFR (August 2026):** 89 mL/min/1.73m², Serum Creatinine 0.90 mg/dL.\n- **Most Recent Post-Initiation eGFR (October 24, 2026):** 88 mL/min/1.73m², Serum Creatinine 0.92 mg/dL.\n\nRenal markers demonstrate stable glomerular filtration across 16 months without clinically significant degradation upon SGLT2 inhibitor addition.`;
        botSources = [
          {
            docName: 'Endocrinology_FollowUp_ProgressNote.pdf',
            page: 2,
            date: '2026-08-14',
            excerpt:
              'Renal function adequate for SGLT2i. eGFR 89 mL/min, creatinine 0.90 mg/dL within normal limits.',
          },
          {
            docName: 'Comprehensive_Metabolic_Panel_LabCorp.pdf',
            page: 2,
            date: '2026-10-24',
            excerpt: 'eGFR calculated at 88 mL/min. Stable cardiorenal threshold.',
          },
        ];
      } else if (lower.includes('glipizide') || lower.includes('discontinu') || lower.includes('stopped')) {
        botResponse =
          `**Glipizide Discontinuation Rationale:**\n\n- **Date of Cessation:** August 14, 2026\n- **Attending:** Dr. Alistair Chen, MD (Endocrinology)\n- **Documented Trigger:** Patient self-monitored blood glucose log revealed 3 episodes of nocturnal hypoglycemia (54, 58, and 62 mg/dL) over a 2-week period.\n- **Physician Decision:** Glipizide ER 5mg daily was permanently ceased to eliminate sulfonylurea-associated hypoglycemia risks and replaced with Empagliflozin 10mg daily.`;
        botSources = [
          {
            docName: 'Endocrinology_FollowUp_ProgressNote.pdf',
            page: 4,
            date: '2026-08-14',
            excerpt:
              'Discontinue Glipizide ER 5mg daily immediately. Recurrent nocturnal hypoglycemia (54-62 mg/dL). Transition to SGLT2i.',
          },
        ];
      } else if (lower.includes('allerg') || lower.includes('adverse') || lower.includes('reaction')) {
        botResponse =
          `**Documented Adverse Reactions & Allergies for ${patientName}:**\n\n1. **Penicillin Class (Moderate):** Urticarial rash and facial pruritus documented during 2021 outpatient encounter. Reconfirmed in Highland Hospital ER note (Nov 2025).\n2. **Sulfonamides (Contact Sensitivity):** Contact dermatitis reported with topical sulfadiazine (Patient self-declared).\n\n*Zero documented history of anaphylaxis, angioedema, or ACE-inhibitor-induced cough.*`;
        botSources = [
          {
            docName: 'Emergency_Admission_Record_2025.pdf',
            page: 1,
            date: '2025-11-28',
            excerpt: 'Allergies: Penicillin (hives/rash). No known food or latex allergies.',
          },
        ];
      } else {
        botResponse =
          `**Chronological Antidiabetic Pharmacotherapy Synthesis:**\n\n1. **June 15, 2025 (Diagnosis):** Metformin ER initiated at 500mg once daily by Dr. Marcus Webb.\n2. **October 2025 (Titration):** Metformin ER increased to 1000mg BID.\n3. **January 2026 (Add-on):** Glipizide ER 5mg daily added due to persistent HbA1c > 7.5%.\n4. **August 14, 2026 (Regimen Overhaul):** Glipizide discontinued due to nocturnal hypoglycemia; Empagliflozin 10mg daily initiated by Dr. Alistair Chen.\n5. **Current Active Status:** Metformin ER 1000mg BID + Empagliflozin 10mg daily. Latest HbA1c improved to 6.8%.`;
        botSources = [
          {
            docName: 'Endocrinology_FollowUp_ProgressNote.pdf',
            page: 3,
            date: '2026-08-14',
            excerpt:
              'Pharmacotherapy update: Continue Metformin ER 1000mg BID. Start Empagliflozin 10mg oral daily.',
          },
          {
            docName: 'Comprehensive_Metabolic_Panel_LabCorp.pdf',
            page: 2,
            date: '2026-10-24',
            excerpt: 'Current HbA1c: 6.8%.',
          },
        ];
      }

      counterRef.current += 1;
      const botMsg: ChatMessage = {
        id: `doc-msg-${counterRef.current}`,
        sender: 'assistant',
        text: botResponse,
        timestamp: 'Just now',
        sources: botSources,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <section className="border-b border-border-subtle pb-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase bg-forest text-white px-2 py-0.5 rounded font-semibold tracking-wider">
                MOCK ASSISTANT
              </span>
              <Badge variant="citron" size="sm" isMono>
                PREWRITTEN DEMO
              </Badge>
            </div>
            <h1 className="text-3xl font-bold font-heading text-forest tracking-tight">
              Doctor Health Assistant
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary font-body leading-relaxed max-w-2xl">
              {isDemoPatient
                ? `Prewritten responses for the fictional sample record, ${patientName}.`
                : 'Mock responses do not analyze this patient’s record.'}
            </p>
          </div>

          <div className="text-xs font-mono text-text-secondary bg-white px-3 py-1.5 rounded-md border border-border-subtle shrink-0">
            No record analysis
          </div>
        </div>
      </section>

      {/* Physician Non-Diagnostic Disclaimer */}
      <div className="p-3.5 bg-osco-bg border border-border-subtle rounded-lg text-xs leading-relaxed text-text-main flex items-start gap-3 shadow-xs">
        <Info className="text-forest shrink-0 mt-0.5" size={17} />
        <div className="space-y-0.5">
          <span className="font-heading font-semibold text-forest">
            Mock assistant notice:
          </span>{' '}
          <span className="text-text-secondary">
            Responses are fixed demo examples and do not analyze patient records or offer clinical guidance.
          </span>
        </div>
      </div>

      {isDemoPatient && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-text-muted uppercase font-mono tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} className="text-forest" />
            Sample questions
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DOCTOR_EXAMPLE_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => handleSend(question)}
                className="text-left p-2.5 bg-white border border-border-subtle hover:border-forest/50 hover:bg-[#FAFCFB] rounded-md text-xs text-text-main font-medium transition-colors cursor-pointer truncate"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Window */}
      <Card accent="forest">
        <CardHeader
          title="Demo conversation"
          subtitle="No patient data is processed by this mock assistant."
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
                  className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-4 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-forest text-white shadow-xs font-medium'
                      : 'bg-white border border-border-subtle text-text-main shadow-xs'
                  }`}
                >
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

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
                      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider flex items-center gap-1">
                        <FileText size={11} className="text-forest" />
                        Clinical Source Citations:
                      </div>
                      <div className="space-y-1.5">
                        {msg.sources.map((src, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2 bg-osco-bg rounded border border-border-subtle text-xs space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-forest font-semibold">
                              <button
                                type="button"
                                onClick={() => onOpenDocumentByName?.(src.docName)}
                                className="text-left hover:underline"
                              >
                                {src.docName} (Page {src.page})
                              </button>
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
                    MD
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
              <div className="bg-white border border-border-subtle rounded-lg px-4 py-2 text-xs text-text-muted flex items-center gap-2">
                <Sparkles size={13} className="text-forest animate-spin" />
                <span>Preparing demo response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

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
              placeholder={isDemoPatient ? 'Ask about the fictional sample history...' : 'Ask a question'}
              className="flex-1 bg-osco-bg text-text-main text-xs sm:text-sm border border-border-subtle rounded-md px-3.5 py-2.5 focus:border-forest focus:ring-1 focus:ring-forest focus:outline-none"
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
