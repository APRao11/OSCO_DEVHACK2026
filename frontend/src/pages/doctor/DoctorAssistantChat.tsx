import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  Info,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { ChatAnswerDetails } from '../../components/records/ChatAnswerDetails';
import { LazySourceViewer } from '../../components/records/LazySourceViewer';
import { askDoctorAssistant } from '../../api/doctorApi.js';
import { MAX_QUESTION_LENGTH, useRecordsChat } from '../../records/useRecordsChat';
import type { ChatMessage } from '../../types/patient';
import type { SourceTarget } from '../../types/records';

export interface DoctorAssistantChatProps {
  patientName: string;
  /** The patient's public OSCO ID. The server checks this doctor's consent for it on every question. */
  patientPublicId: string;
}

const DOCTOR_EXAMPLE_QUESTIONS = [
  'List all documented medications with doses and dates.',
  'What laboratory results are recorded, with reference ranges?',
  'What diagnoses are documented, and when?',
  'List all documented allergies and adverse reactions.',
];

const initialDoctorChat = (patientName: string): ChatMessage[] => [
  {
    id: 'doc-msg-1',
    sender: 'assistant',
    text: `Ask about ${patientName}’s records. Answers come only from findings the patient has confirmed and from clinical records, each with the document and page it came from. This tool does not diagnose or recommend treatment.`,
    timestamp: '',
  },
];

export const DoctorAssistantChat: React.FC<DoctorAssistantChatProps> = ({ patientName, patientPublicId }) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [sourceTarget, setSourceTarget] = useState<SourceTarget | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const welcome = useMemo(() => initialDoctorChat(patientName), [patientName]);
  const ask = useCallback(
    (question: string, signal: AbortSignal) => askDoctorAssistant(patientPublicId, question, signal),
    [patientPublicId],
  );
  // A 401 also signs the doctor out (doctorRequest), which returns them to the login screen.
  const { messages, isTyping, send } = useRecordsChat(ask, welcome, {
    sessionExpiredText: 'Your doctor session has expired. Please sign in again.',
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isTyping) return;
    setInputPrompt('');
    void send(prompt);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <section className="border-b border-border-subtle pb-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase bg-forest text-white px-2 py-0.5 rounded font-semibold tracking-wider">
                RECORDS ASSISTANT
              </span>
              <Badge variant="citron" size="sm" isMono>
                CONSENTED ACCESS ONLY
              </Badge>
            </div>
            <h1 className="text-3xl font-bold font-heading text-forest tracking-tight">
              Doctor Health Assistant
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary font-body leading-relaxed max-w-2xl">
              {`Evidence-grounded answers from ${patientName}’s confirmed records.`}
            </p>
          </div>

          <div className="text-xs font-mono text-text-secondary bg-white px-3 py-1.5 rounded-md border border-border-subtle shrink-0">
            Answers cite source pages
          </div>
        </div>
      </section>

      {/* Physician Non-Diagnostic Disclaimer */}
      <div className="p-3.5 bg-osco-bg border border-border-subtle rounded-lg text-xs leading-relaxed text-text-main flex items-start gap-3 shadow-xs">
        <Info className="text-forest shrink-0 mt-0.5" size={17} />
        <div className="space-y-0.5">
          <span className="font-heading font-semibold text-forest">
            Information retrieval notice:
          </span>{' '}
          <span className="text-text-secondary">
            Answers summarize what the records document, with citations. They are not diagnoses or treatment recommendations; verify against the source before clinical use.
          </span>
        </div>
      </div>

      {(
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
              disabled={isTyping}
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
          title="Record conversation"
          subtitle="Every question is checked against your active consent for this patient"
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

                  <ChatAnswerDetails
                    message={msg}
                    title="Clinical source citations"
                    onOpenSource={setSourceTarget}
                    onRetry={(q) => void send(q)}
                    retryDisabled={isTyping}
                  />

                  {msg.timestamp && (<div
                    className={`mt-2 text-[10px] font-mono ${
                      isUser ? 'text-white/60 text-right' : 'text-text-muted'
                    }`}
                  >
                    {msg.timestamp}
                  </div>)}
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
                <span>Searching the patient’s records...</span>
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
              maxLength={MAX_QUESTION_LENGTH}
              disabled={isTyping}
              aria-label="Your question"
              placeholder="Ask about documented medications, results, diagnoses or visits..."
              className="flex-1 bg-osco-bg text-text-main text-xs sm:text-sm border border-border-subtle rounded-md px-3.5 py-2.5 focus:border-forest focus:ring-1 focus:ring-forest focus:outline-none"
            />
            <Button
              type="submit"
              variant="citron"
              size="md"
              leftIcon={<Send size={14} />}
              disabled={!inputPrompt.trim() || isTyping}
            >
              Ask
            </Button>
          </form>
        </div>
      </Card>

      <LazySourceViewer target={sourceTarget} onClose={() => setSourceTarget(null)} />
    </div>
  );
};
