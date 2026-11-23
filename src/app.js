require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { errorMiddleware } = require('./middleware/errorMiddleware');
const batchRoutes = require('./routes/batchRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reconcileRoutes = require('./routes/reconcileRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Perishable Stock API is running',
  });
});

// API routes
app.use('/batches', batchRoutes);
app.use('/orders', orderRoutes);
app.use('/reconcile', reconcileRoutes);

// Centralised error handler
app.use(errorMiddleware);

module.exports = app;
