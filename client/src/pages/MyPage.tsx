import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { type Car, deleteCar, getMyCars, resolveImageUrl } from '../api/cars';
import { listFavorites, removeFavorite } from '../api/favorites';
import { type ChatRoom, listChatRooms } from '../api/chat';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';

type Tab = 'listings' | 'favorites' | 'chats';

function CarThumb({ car }: { car: Car }) {
  const imageUrl = resolveImageUrl(car.image_url);
  return (
    <div
      style={{
        width: 72,
        height: 56,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--muted-soft)',
        flexShrink: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={car.display_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
          <path
            d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
      )}
    </div>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  listings: '내 매물',
  favorites: '찜 목록',
  chats: '채팅 목록',
};

export default function MyPage() {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'listings';
  const [tab, setTab] = useState<Tab>(initialTab in TAB_LABELS ? initialTab : 'listings');
  const [myCars, setMyCars] = useState<Car[]>([]);
  const [favorites, setFavorites] = useState<Car[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);

  useEffect(() => {
    if (tab === 'listings') getMyCars().then(setMyCars);
    if (tab === 'favorites') listFavorites().then(setFavorites);
    if (tab === 'chats') listChatRooms().then(setRooms);
  }, [tab]);

  async function handleDelete(id: number) {
    await deleteCar(id);
    setMyCars((prev) => prev.filter((car) => car.id !== id));
  }

  async function handleUnfavorite(id: number) {
    await removeFavorite(id);
    setFavorites((prev) => prev.filter((car) => car.id !== id));
  }

  if (!user)
    return (
      <div>
        <Header />
        <p className="page" style={{ marginTop: 24 }}>
          로그인이 필요합니다.
        </p>
      </div>
    );

  return (
    <div>
      <Header />
      <div className="page" style={{ display: 'flex', gap: 32, paddingTop: 32, alignItems: 'flex-start' }}>
        <aside style={{ width: 220, flexShrink: 0 }}>
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 20, marginBottom: 16 }}>
            {user.nickname.slice(0, 1)}
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{user.nickname}</div>
          <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 2 }}>{user.email}</div>
          <button className="icon-btn" style={{ marginTop: 20, width: '100%' }} onClick={logout}>
            로그아웃
          </button>
        </aside>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {tab === 'listings' && (
            <ul>
              {myCars.map((car) => (
                <li key={car.id} className="list-card">
                  <CarThumb car={car} />
                  <div style={{ flex: 1 }}>
                    <Link to={`/cars/${car.id}`} style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                      {car.display_title}
                    </Link>
                    <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 2 }}>
                      {(car.price / 10000).toLocaleString()}만원 · {car.status}
                    </div>
                  </div>
                  <Link to={`/cars/${car.id}/edit`} className="icon-btn">
                    수정
                  </Link>
                  <button className="icon-btn" onClick={() => handleDelete(car.id)}>
                    삭제
                  </button>
                </li>
              ))}
              {myCars.length === 0 && <p style={{ color: 'var(--text-soft)' }}>등록한 매물이 없습니다.</p>}
            </ul>
          )}

          {tab === 'favorites' && (
            <ul>
              {favorites.map((car) => (
                <li key={car.id} className="list-card">
                  <CarThumb car={car} />
                  <div style={{ flex: 1 }}>
                    <Link to={`/cars/${car.id}`} style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                      {car.display_title}
                    </Link>
                    <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 2 }}>
                      {(car.price / 10000).toLocaleString()}만원
                    </div>
                  </div>
                  <button className="icon-btn" onClick={() => handleUnfavorite(car.id)}>
                    찜 취소
                  </button>
                </li>
              ))}
              {favorites.length === 0 && <p style={{ color: 'var(--text-soft)' }}>찜한 매물이 없습니다.</p>}
            </ul>
          )}

          {tab === 'chats' && (
            <ul>
              {rooms.map((room) => (
                <li key={room.id} className="list-card">
                  <div
                    className="avatar"
                    style={{ width: 44, height: 44, flexShrink: 0, background: 'var(--muted-soft)' }}
                  >
                    💬
                  </div>
                  <Link to={`/chat/${room.id}`} style={{ flex: 1, color: 'var(--text)' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {room.car_title} — {(room.car_price / 10000).toLocaleString()}만원
                    </div>
                    {room.last_message && (
                      <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 2 }}>{room.last_message}</div>
                    )}
                  </Link>
                </li>
              ))}
              {rooms.length === 0 && <p style={{ color: 'var(--text-soft)' }}>채팅 내역이 없습니다.</p>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
