const express = require('express');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const mysql = require('mysql2');
const crypto = require('crypto'); // Para hacer el hashing
dotenv.config(); // Cargar las variables de entorno

// Crear la conexión a la base de datos utilizando las variables de entorno
let connection = mysql.createConnection({
    host: process.env.BDHOST,
    user: process.env.BDUSER,
    password: process.env.BDPASS,
    database: process.env.BDNAME
});

// Función de hashing (SHA-256)
const hashValue = (value) => {
    return crypto.createHash('sha256').update(value).digest('hex');
};

// Intentar conectar a la base de datos
connection.connect((err) => {
    if (err) {
        console.error(`Error al conectar con la base de datos ${process.env.BDNAME}:`, err);
        return;
    }
    console.log(`Conectado a la base de datos: ${process.env.BDNAME}`);
});

// Configurar una reconexión automática en caso de que se pierda la conexión
connection.on('error', (err) => {
    console.error('Error en la conexión:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('La conexión se perdió, intentando reconectar...');
        connection = mysql.createConnection({
            host: process.env.BDHOST,
            user: process.env.BDUSER,
            password: process.env.BDPASS,
            database: process.env.BDNAME
        });
    } else {
        console.error('Error crítico en la conexión:', err);
    }
});

// Rutas
const router = express.Router();

// Registrar mascota
router.post('/register-mascota', (req, res) => {
    const { NombreDueño, id_dueno, Correo, nombre_mascota, Peso, Edad, Raza } = req.body;

    // Validación de campos
    if (!NombreDueño || !id_dueno || !Correo || !nombre_mascota || !Peso || !Edad || !Raza) {
        return res.status(400).json({ success: false, message: 'Por favor, complete todos los campos.' });
    }

    // Query para insertar la mascota
    const insertMascotaQuery = `INSERT INTO mascotas (NombreDueño, id_dueno, correo, nombre_mascota, peso, edad, raza) 
                                VALUES (?, ?, ?, ?, ?, ?, ?)`;

    connection.query(insertMascotaQuery, [NombreDueño, id_dueno, Correo, nombre_mascota, Peso, Edad, Raza], (err) => {
        if (err) {
            console.error('Error inserting mascota:', err);
            return res.status(500).json({ success: false, message: 'Error al registrar la mascota.' });
        }

        res.status(200).json({ success: true, message: 'Mascota registrada con éxito.' });
    });
});

// Registrar reserva
router.post('/reserva', (req, res) => {
    const { nombre, id_dueno, telefono, correo, servicio, precio, fecha } = req.body;

    // Validación de campos
    if (!nombre || !id_dueno || !telefono || !correo || !servicio || !precio || !fecha) {
        return res.status(400).json({ success: false, message: 'Por favor, complete todos los campos.' });
    }

    // Insertar la reserva con el precio proporcionado por el usuario
    const insertReservaQuery = `INSERT INTO reservas (nombre, id_dueno, telefono, correo, servicio, precio, fecha) 
                                VALUES (?, ?, ?, ?, ?, ?, ?)`;

    connection.query(insertReservaQuery, [nombre, id_dueno, telefono, correo, servicio, precio, fecha], (err) => {
        if (err) {
            console.error('Error al registrar la reserva:', err);
            return res.status(500).json({ success: false, message: 'Error al registrar la reserva.' });
        }

        res.status(200).json({ success: true, message: 'Reserva registrada con éxito.' });
    });
});


// Registrar cliente
router.post('/register', (req, res) => {
    const { nombre, identificacion, celular, correo, usuario, contrasena, mascota, cantante, materia } = req.body;

    if (!nombre || !identificacion || !celular || !correo || !usuario || !contrasena || !mascota || !cantante || !materia) {
        return res.status(400).json({ success: false, message: 'Por favor, complete todos los campos.' });
    }

    const token = uuidv4(); // Genera un token único para la verificación

    // Hash de la contraseña y respuestas a las preguntas
    const hashedPassword = hashValue(contrasena);
    const hashedMascota = hashValue(mascota);  // Hash de la respuesta de la mascota
    const hashedCantante = hashValue(cantante);  // Hash de la respuesta del cantante
    const hashedMateria = hashValue(materia);  // Hash de la respuesta de la materia

    // Verificar si la identificación ya existe
    const checkClienteQuery = 'SELECT id FROM clientes WHERE identificacion = ?';
    connection.query(checkClienteQuery, [identificacion], (err, result) => {
        if (err) {
            console.error('Error checking client:', err);
            return res.status(500).json({ success: false, message: 'Error checking client.' });
        }

        if (result.length > 0) {
            // La identificación ya existe
            return res.status(400).json({ success: false, message: 'La identificación ya está registrada.' });
        }

        // Si no existe, registrar al cliente
        const insertClienteQuery = `INSERT INTO clientes (nombre, identificacion, celular, correo, usuario, contrasena) 
                                    VALUES (?, ?, ?, ?, ?, ?)`;
        connection.query(insertClienteQuery, [nombre, identificacion, celular, correo, usuario, hashedPassword], (err) => {
            if (err) {
                console.error('Error inserting client:', err);
                return res.status(500).json({ success: false, message: 'Error al registrar el cliente.' });
            }

            // Insertar las respuestas de validación (encriptadas)
            const insertValidacionQuery = `INSERT INTO validacion (identificacion, mascota, cantante, materia) 
                                           VALUES (?, ?, ?, ?)`;
            connection.query(insertValidacionQuery, [identificacion, hashedMascota, hashedCantante, hashedMateria], (err) => {
                if (err) {
                    console.error('Error inserting validation answers:', err);
                    return res.status(500).json({ success: false, message: 'Error al registrar las respuestas de validación.' });
                }

                // Insertar el token de verificación
                const insertTokenQuery = `INSERT INTO tokens_verificacion (correo, token, fecha_creacion) 
                                          VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE token = ?, fecha_creacion = NOW()`;
                connection.query(insertTokenQuery, [correo, token, token], (err) => {
                    if (err) {
                        console.error('Error inserting token:', err);
                        return res.status(500).json({ success: false, message: 'Error al generar el token de verificación.' });
                    }

                    // Enviar correo de verificación
                    const verificationLink = `https://api-interna.onrender.com/verify-email?token=${token}&correo=${correo}`;
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });

                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: correo,
                        subject: 'Verificación de correo',
                        html: `<p>Para verificar tu correo, haz clic en el siguiente enlace: <a href="${verificationLink}">Verificar correo</a></p>`
                    };

                    transporter.sendMail(mailOptions, (err) => {
                        if (err) {
                            console.error('Error sending email:', err);
                            return res.status(500).json({ success: false, message: 'Error al enviar el correo de verificación.' });
                        }

                        res.status(200).json({ success: true, message: 'Cliente registrado con éxito. Correo de verificación enviado.' });
                    });
                });
            });
        });
    });
});


// Registrar tarjeta
router.post('/register-tarjeta', (req, res) => {
    const { nombre, identificacion, numero_tarjeta, cvv, monto } = req.body;

    // Validación de campos
    if (!nombre || !identificacion || !numero_tarjeta || !cvv || !monto) {
        return res.status(400).json({ success: false, message: 'Por favor, complete todos los campos.' });
    }

    // Query para insertar la tarjeta
    const insertTarjetaQuery = `INSERT INTO tarjetas (nombre, identificacion, numero_tarjeta, cvv, monto) 
                                VALUES (?, ?, ?, ?, ?)`;

    connection.query(insertTarjetaQuery, [nombre, identificacion, numero_tarjeta, cvv, monto], (err) => {
        if (err) {
            console.error('Error inserting tarjeta:', err);
            return res.status(500).json({ success: false, message: 'Error al registrar la tarjeta.' });
        }

        res.status(200).json({ success: true, message: 'Tarjeta registrada con éxito.' });
    });
});

module.exports = router;  // Exportar el router
