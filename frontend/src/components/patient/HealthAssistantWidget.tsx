import { useState } from 'react';
import { Bot, Send, X } from 'lucide-react';

interface Message {
  id: number;
  sender: 'patient' | 'assistant';
  text: string;
}

export const HealthAssistantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      sender: 'assistant',
      text: 'Hi. I’m a demo assistant, not a medical professional. I can help you find your way around this portal.',
    },
  ]);

  const sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    const id = Date.now();
    setMessages((current) => [
      ...current,
      { id, sender: 'patient', text },
      {
        id: id + 1,
        sender: 'assistant',
        text: 'This assistant is a frontend demo and cannot answer medical questions. Please speak with your healthcare provider for health advice.',
      },
    ]);
    setPrompt('');
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {isOpen && (
        <section
          aria-label="Health Assistant demo chat"
          className="mb-3 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-border-subtle bg-white shadow-lg"
        >
          <header className="flex items-center justify-between bg-forest px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot size={17} className="text-citron" />
              <div>
                <h2 className="text-sm font-semibold text-white">Health Assistant</h2>
                <p className="text-[11px] text-white/65">Demo chat · Not medical advice</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-white/75 hover:bg-white/10 hover:text-white"
              aria-label="Close Health Assistant"
            >
              <X size={17} />
            </button>
          </header>
          <div className="max-h-72 space-y-3 overflow-y-auto bg-osco-bg p-3">
            {messages.map((message) => (
              <p
                key={message.id}
                className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-5 ${
                  message.sender === 'patient'
                    ? 'ml-auto bg-forest text-white'
                    : 'bg-white text-text-main border border-border-subtle'
                }`}
              >
                {message.text}
              </p>
            ))}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2 border-t border-border-subtle p-3">
            <input
              aria-label="Message the Health Assistant"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Write a message"
              className="min-w-0 flex-1 rounded-lg border border-border-subtle px-3 py-2 text-xs focus:outline-none focus:border-forest"
            />
            <button
              type="submit"
              disabled={!prompt.trim()}
              aria-label="Send message"
              className="rounded-lg bg-forest p-2 text-white disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close Health Assistant' : 'Open Health Assistant'}
        aria-expanded={isOpen}
        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-forest text-white shadow-md transition-colors hover:bg-forest-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        {isOpen ? <X size={20} /> : <Bot size={20} />}
      </button>
    </div>
  );
};
