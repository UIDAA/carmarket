const express = require('express');
const cors = require('cors');
const path = require('path');
const { authRouter } = require('./routes/auth');
const { carsRouter } = require('./routes/cars');
const { favoritesRouter } = require('./routes/favorites');
const { chatRouter } = require('./routes/chat');
const { catalogRouter } = require('./routes/catalog');
const { errorHandler } = require('./middleware/errorHandler');

function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter(db));
  app.use('/api/cars', carsRouter(db));
  app.use('/api/favorites', favoritesRouter(db));
  app.use('/api/chat', chatRouter(db));
  app.use('/api/catalog', catalogRouter(db));

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
