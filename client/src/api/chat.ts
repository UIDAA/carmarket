import { apiFetch } from './client';

export interface ChatRoom {
  id: number;
  car_id: number;
  buyer_id: number;
  seller_id: number;
  car_title: string;
  car_price: number;
  car_image_url: string | null;
  seller_nickname: string;
  last_message?: string | null;
  last_message_at?: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  room_id: number;
  sender_id: number;
  content: string;
  created_at: string;
}

export function listChatRooms() {
  return apiFetch<ChatRoom[]>('/api/chat/rooms');
}

export function createOrGetRoom(carId: number | string) {
  return apiFetch<ChatRoom>('/api/chat/rooms', { method: 'POST', body: JSON.stringify({ carId }) });
}

export function getRoom(roomId: number | string) {
  return apiFetch<ChatRoom>(`/api/chat/rooms/${roomId}`);
}

export function getMessages(roomId: number | string, since?: string) {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiFetch<Message[]>(`/api/chat/rooms/${roomId}/messages${query}`);
}

export function sendMessage(roomId: number | string, content: string) {
  return apiFetch<Message>(`/api/chat/rooms/${roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}
