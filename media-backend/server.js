const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const userRoutes = require('./routes/userRoutes');
const trackRoutes = require('./routes/trackRoutes');
const mixRoutes = require("./routes/mixRoutes");



const app = express();
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));


mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Ligado ao MongoDB'))
  .catch((err) => console.error('Erro na ligação ao MongoDB:', err));

app.use('/api/users', userRoutes);
app.use('/api/tracks', trackRoutes);
app.use("/api/mix", mixRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));
