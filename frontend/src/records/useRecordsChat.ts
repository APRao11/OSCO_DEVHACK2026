import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantAnswer, AssistantCitation } from '../api/queries.js';
import type { ChatMessage, SourceReference } from '../types/patient';

/** Sends one question to the server; the caller decides which endpoint and login to use. */
export type AskAssistant = (question: string, signal: AbortSignal) => Promise<{ data: AssistantAnswer }>;

export const MAX_QUESTION_LENGTH = 500;
const TIMEOUT_MS = 60_000;

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const toSource = (c: AssistantCitation): SourceReference => ({
  docName: c.documentName,
  page: c.page ?? 0,
  date: c.documentDate ?? '',
  excerpt: c.quote.replace(/\s+/g, ' ').trim(),
  target: c.source,
});

/** A clear message for every way a question can fail. Nothing is invented in its place. */
const failureText = (error: unknown, timedOut: boolean, sessionExpiredText: string): string => {
  if (timedOut) return 'The assistant took too long to answer, so the request was stopped. Please try again.';
  const status = (error as { status?: number })?.status;
  const message = (error as { message?: string })?.message;
  if (status === 401) return sessionExpiredText;
  if (status === 403) return message || 'You no longer have access to these records.';
  if (error instanceof TypeError) return 'Could not reach the OSCO server. Check your connection and that the backend is running, then try again.';
  return message || 'Something went wrong while answering. Please try again.';
};

/**
 * Conversation state for the records assistant: sends questions, turns the
 * server's validated citations into source cards, and shows an explicit
 * error (with a retry) instead of an answer whenever a request fails.
 */
export const useRecordsChat = (
  ask: AskAssistant,
  initialMessages: ChatMessage[],
  { sessionExpiredText = 'Your session has expired. Please sign in again to use the assistant.' } = {},
) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const counter = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

  // Leaving the page cancels an unanswered question.
  useEffect(() => () => inFlight.current?.abort(), []);

  const push = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    counter.current += 1;
    const id = `chat-${Date.now()}-${counter.current}`;
    setMessages((prev) => [...prev, { ...message, id, timestamp: now() }]);
  };

  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      const question = raw.replace(/\s+/g, ' ').trim();
      if (!question || inFlight.current) return false;
      if (question.length < 3) {
        push({ sender: 'assistant', status: 'error', text: 'That question is too short. Ask about your medicines, tests, diagnoses or visits.' });
        return false;
      }
      if (question.length > MAX_QUESTION_LENGTH) {
        push({ sender: 'assistant', status: 'error', text: `Questions can be up to ${MAX_QUESTION_LENGTH} characters.` });
        return false;
      }

      push({ sender: 'user', text: question });
      setIsTyping(true);
      const controller = new AbortController();
      inFlight.current = controller;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, TIMEOUT_MS);

      try {
        const { data } = await ask(question, controller.signal);
        if (!data || typeof data.answer !== 'string') throw new Error('The server sent an answer that could not be read. Please try again.');
        push({ sender: 'assistant', text: data.answer, status: data.status, sources: (data.citations ?? []).map(toSource) });
      } catch (error) {
        // Unmounted: nobody is looking at this conversation any more.
        if (controller.signal.aborted && !timedOut) return false;
        push({ sender: 'assistant', status: 'error', text: failureText(error, timedOut, sessionExpiredText), retryQuestion: question });
      } finally {
        clearTimeout(timer);
        if (inFlight.current === controller) inFlight.current = null;
        setIsTyping(false);
      }
      return true;
    },
    [ask, sessionExpiredText],
  );

  return { messages, isTyping, send };
};

/** Labels and colours for the answer's relationship to the records. */
export const ANSWER_STATUS: Record<NonNullable<ChatMessage['status']>, { label: string; className: string }> = {
  documented: { label: 'Documented in records', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  documented_absent: { label: 'Documented as absent', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  not_documented: { label: 'Not documented', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  refused: { label: 'Outside what I can answer', className: 'bg-slate-50 text-slate-700 border-slate-200' },
  error: { label: 'Not answered', className: 'bg-red-50 text-red-800 border-red-200' },
};
