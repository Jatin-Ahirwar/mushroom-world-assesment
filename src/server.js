const app = require('./app');
const connectDB = require('./config/database');
const { startExpirationWorker } = require('./services/reservationService');

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  startExpirationWorker();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
