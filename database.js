const mongoose = require('mongoose');
require("dotenv").config()

// URL de conexión proporcionada por MongoDB Atlas
const uri = process.env.DATABASE_URI;


// Opciones de conexión
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

// Conexión a la base de datos
mongoose.connect(uri, options)
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch(err => {
    console.error('Database connected error:', err);
  });