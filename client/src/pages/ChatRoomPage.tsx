import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { type ChatRoom, type Message, getMessages, getRoom, sendMessage } from '../api/chat';
import { resolveImageUrl } from '../api/cars';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL_MS = 4000;

export default function ChatRoomPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const lastTimestampRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    getRoom(id).then(setRoom);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function poll() {
      const newMessages = await getMessages(id!, lastTimestampRef.current);
      if (cancelled || newMessages.length === 0) return;
      lastTimestampRef.current = newMessages[newMessages.length - 1].created_at;
      setMessages((prev) => [...prev, ...newMessages]);
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!id || !input.trim()) return;
    const message = await sendMessage(id, input.trim());
    setMessages((prev) => [...prev, message]);
    lastTimestampRef.current = message.created_at;
    setInput('');
  }

  function formatTime(createdAt: string) {
    return new Date(`${createdAt}Z`).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <Link to="/" className="nav-link" style={{ color: 'var(--text-soft)' }}>
          ←
        </Link>
        {room && (
          <>
            <div
              style={{
                width: 44,
                height: 36,
                borderRadius: 6,
                background: 'var(--muted-soft)',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {resolveImageUrl(room.car_image_url) && (
                <img
                  src={resolveImageUrl(room.car_image_url)!}
                  alt={room.car_title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{room.car_title}</div>
              <div style={{ color: 'var(--text-soft)', fontSize: 12 }}>
                판매자: {room.seller_nickname} · {(room.car_price / 10000).toLocaleString()}만원
              </div>
            </div>
            <Link to={`/cars/${room.car_id}`} style={{ fontSize: 13, fontWeight: 600 }}>
              매물보기
            </Link>
          </>
        )}
      </div>

      <div style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((message) => {
          const mine = message.sender_id === user?.id;
          return (
            <div key={message.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <div className={`bubble ${mine ? 'bubble-me' : 'bubble-them'}`}>{message.content}</div>
              <div className="time">{formatTime(message.created_at)}</div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleSend}
        style={{ display: 'flex', gap: 10, padding: '16px 32px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <input
          className="input"
          style={{ flex: 1, borderRadius: 999 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요"
        />
        <button
          type="submit"
          className="btn-primary"
          style={{ width: 44, height: 44, borderRadius: 999, padding: 0 }}
        >
          전송
        </button>
      </form>
    </div>
  );
}
