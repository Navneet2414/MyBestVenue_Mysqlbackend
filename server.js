const express = require('express');
const path = require('path');
const app = express();
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const cors = require('cors');
const db = require('./config/db');
const venueRoutes = require('./routes/venue_routes');
const adminRoutes = require('./routes/admin_routes');

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.use('/api/venues', venueRoutes);
app.use('/api/admin', adminRoutes);

async function start() {
  await db.init();

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

start();
