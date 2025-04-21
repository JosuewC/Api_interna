const express = require('express');
const dotenv = require('dotenv');
dotenv.config();  // Cargar las variables de entorno

const app = express();

// Middleware para analizar las solicitudes con JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cargar las rutas de conexión
const conexionRoutes = require('./routes/conexion');
app.use(conexionRoutes);

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

module.exports = app;
