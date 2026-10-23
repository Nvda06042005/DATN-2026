import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import * as chatbotApi from '@/api/chatbotApi';
import * as studentApi from '@/api/studentApi';
import { Mascot } from '@/components/customs/Mascot';
import { GBtn } from '@/components/ui/button';
import { RichText } from '@/components/ui/rich-text';
import { Spinner } from '@/components/ui/spinner';
import { useGame } from '@/hooks/use-game';
import { shortName } from '@/utils/format';

interface AdvisorMessage {
  id: number;
  from: 'me' | 'advisor';
  text: string;
  source?: string | null;
}

const ADVISOR_QUICK = ['Vì sao gọi là “vườn không nhà trống”?', 'Trận Bạch Đằng 1288 diễn ra thế nào?', 'Trần Khánh Dư đã làm gì ở Vân Đồn?', 'Nguyên nhân thắng lợi của ba lần kháng chiến?'];

export const AdvisorChat: React.FC<{ pending: string | null; onConsumed: () => void }> = ({ pending, onConsumed }) => {
  const { user, request, bumpDaily } = useGame();
  const [messages, setMessages] = useState<AdvisorMessage[]>(() => [
    {
      id: 0,
      from: 'advisor',
      text: `Chào ${shortName(user.full_name)}! Ta là Quân Sư của Đông A. Em muốn hỏi gì về ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      setMessages((m) => [...m, { id: idRef.current++, from: 'me', text: q }]);
      setInput('');
      setLoading(true);
      bumpDaily('ask');
      request(studentApi.countAiQuestion).catch(() => undefined);
      try {
        const data = await chatbotApi.askAdvisor(q, `student_${user.id}`, `student_${user.id}`);
        const src = data.grounding_sources?.[0];
        setMessages((m) => [...m, { id: idRef.current++, from: 'advisor', text: data.answer, source: src?.curriculum_match ?? src?.doc_name ?? null }]);
      } catch {
        setMessages((m) => [
          ...m,
          { id: idRef.current++, from: 'advisor', text: 'Quân Sư đang bận một chút. Em đọc thẻ Sử Ký liên quan hoặc thử hỏi lại sau ít phút nhé.' },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [request, user.id, bumpDaily]
  );

  useEffect(() => {
    if (pending) {
      send(pending);
      onConsumed();
    }
  }, [pending, send, onConsumed]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="g-card flex flex-col h-[min(70dvh,640px)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-vien">
        <Mascot size={44} mood="happy" accessory="scholar" />
        <div>
          <p className="font-display font-extrabold leading-tight">Quân Sư Đông A</p>
          <p className="text-xs text-muc-2">Trả lời dựa trên kho tri thức Lịch sử 7 (RAG)</p>
        </div>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.from === 'me' ? 'bg-son text-white rounded-br-md' : 'bg-the border-2 border-vien rounded-bl-md'}`}>
              {m.from === 'me' ? <p>{m.text}</p> : <RichText text={m.text} />}
              {m.source && <p className="mt-1 text-xs font-semibold text-muc-2">Nguồn: {m.source}</p>}
            </div>
          </div>
        ))}
        {loading && <Spinner label="Quân Sư đang suy nghĩ…" />}
      </div>
      <div className="border-t-2 border-vien p-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ADVISOR_QUICK.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} className="g-chip !min-h-[36px] !px-3 bg-giay-2 text-muc whitespace-nowrap border-2 border-vien" disabled={loading}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label htmlFor="advisor-input" className="sr-only">
            Câu hỏi cho Quân Sư
          </label>
          <input id="advisor-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Hỏi Quân Sư về lịch sử…" className="input-duo flex-1" maxLength={300} />
          <GBtn type="submit" variant="ngoc" iconOnly disabled={loading || !input.trim()} aria-label="Gửi câu hỏi">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> : <Send className="w-5 h-5" aria-hidden={true} />}
          </GBtn>
        </form>
      </div>
    </div>
  );
};
