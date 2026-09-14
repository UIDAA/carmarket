const express = require('express');
const { requireAuth } = require('../middleware/auth');

function chatRouter(db) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/rooms', (req, res) => {
    const rooms = db
      .prepare(
        `SELECT chat_rooms.*, cars.title AS car_title, cars.price AS car_price, cars.image_url AS car_image_url,
                sellers.nickname AS seller_nickname,
                (SELECT content FROM messages WHERE messages.room_id = chat_rooms.id
                 ORDER BY messages.created_at DESC LIMIT 1) AS last_message,
                (SELECT created_at FROM messages WHERE messages.room_id = chat_rooms.id
                 ORDER BY messages.created_at DESC LIMIT 1) AS last_message_at
         FROM chat_rooms
         JOIN cars ON cars.id = chat_rooms.car_id
         JOIN users AS sellers ON sellers.id = chat_rooms.seller_id
         WHERE chat_rooms.buyer_id = ? OR chat_rooms.seller_id = ?
         ORDER BY chat_rooms.created_at DESC`
      )
      .all(req.userId, req.userId);
    res.json(rooms);
  });

  router.post('/rooms', (req, res) => {
    const { carId } = req.body;
    if (!carId) return res.status(400).json({ error: 'carId는 필수입니다.' });

    const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(carId);
    if (!car) return res.status(404).json({ error: '매물을 찾을 수 없습니다.' });
    if (car.seller_id === req.userId) {
      return res.status(400).json({ error: '본인 매물에는 문의할 수 없습니다.' });
    }

    let room = db.prepare('SELECT * FROM chat_rooms WHERE car_id = ? AND buyer_id = ?').get(carId, req.userId);

    if (!room) {
      const result = db
        .prepare('INSERT INTO chat_rooms (car_id, buyer_id, seller_id) VALUES (?, ?, ?)')
        .run(carId, req.userId, car.seller_id);
      room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(result.lastInsertRowid);
    }

    res.status(201).json(room);
  });

  router.get('/rooms/:id', (req, res) => {
    const room = db
      .prepare(
        `SELECT chat_rooms.*, cars.title AS car_title, cars.price AS car_price, cars.image_url AS car_image_url,
                sellers.nickname AS seller_nickname
         FROM chat_rooms
         JOIN cars ON cars.id = chat_rooms.car_id
         JOIN users AS sellers ON sellers.id = chat_rooms.seller_id
         WHERE chat_rooms.id = ?`
      )
      .get(req.params.id);
    if (!room) return res.status(404).json({ error: '채팅방을 찾을 수 없습니다.' });
    if (room.buyer_id !== req.userId && room.seller_id !== req.userId) {
      return res.status(403).json({ error: '채팅방에 접근할 수 없습니다.' });
    }
    res.json(room);
  });

  function assertRoomAccess(req, res) {
    const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(req.params.id);
    if (!room) {
      res.status(404).json({ error: '채팅방을 찾을 수 없습니다.' });
      return null;
    }
    if (room.buyer_id !== req.userId && room.seller_id !== req.userId) {
      res.status(403).json({ error: '채팅방에 접근할 수 없습니다.' });
      return null;
    }
    return room;
  }

  router.get('/rooms/:id/messages', (req, res) => {
    const room = assertRoomAccess(req, res);
    if (!room) return;

    const since = req.query.since;
    const messages = since
      ? db.prepare('SELECT * FROM messages WHERE room_id = ? AND created_at > ? ORDER BY created_at ASC').all(req.params.id, since)
      : db.prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY created_at ASC').all(req.params.id);

    res.json(messages);
  });

  router.post('/rooms/:id/messages', (req, res) => {
    const room = assertRoomAccess(req, res);
    if (!room) return;

    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'content는 필수입니다.' });

    const result = db
      .prepare('INSERT INTO messages (room_id, sender_id, content) VALUES (?, ?, ?)')
      .run(req.params.id, req.userId, content);

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(message);
  });

  return router;
}

module.exports = { chatRouter };
