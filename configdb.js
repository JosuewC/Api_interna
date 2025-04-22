const dotenv = require('dotenv');
dotenv.config();  // Cargar las variables de entorno desde .env

const mysql = require('mysql2');

let connection;

function connectDatabase() {
    connection = mysql.createConnection({
        host: process.env.BDHOST,
        user: process.env.BDUSER,
        password: process.env.BDPASS,
        database: process.env.BDNAME,
        port: process.env.BDPORT || 3306
        
    });

    // Intentar conectar a la base de datos
    connection.connect((err) => {
        if (err) {
            console.error(`Error al conectar con la base de datos ${process.env.BDNAME}:`, err);
            setTimeout(connectDatabase, 5000); // Intentar reconectar después de 5 segundos
            return;
        }
        console.log(`✅ Conectado a la base de datos: ${process.env.BDNAME}`);
    });

    // Manejo de errores de conexión
    connection.on('error', (err) => {
        console.error('⚠️ Error en la conexión:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('🔄 La conexión se perdió, intentando reconectar...');
            setTimeout(connectDatabase, 5000); // Intentar reconectar después de 5 segundos
        } else {
            console.error('🚨 Error crítico en la conexión:', err);
        }
    });
}

// Llamar a la función para conectar a la base de datos
connectDatabase();

module.exports = { connection };
