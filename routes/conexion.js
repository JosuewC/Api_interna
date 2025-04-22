const express = require('express');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const mysql = require('mysql2');
const crypto = require('crypto');
dotenv.config();

// Crear pool de conexiones para evitar errores de conexión
const pool = mysql.createPool({
    host: process.env.BDHOST,
    user: process.env.BDUSER,
    password: process.env.BDPASS,
    database: process.env.BDNAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const hashValue = (value) => {
    return crypto.createHash('sha256').update(value).digest('hex');
};

const router = express.Router();

router.post('/register-mascota', (req, res) => {
    const { NombreDueño, id_dueno, Correo, nombre_mascota, Peso, Edad, Raza } = req.body;
    if (!NombreDueño || !id_dueno || !Correo || !nombre_mascota || !Peso || !Edad || !Raza) {
        return res.status(400).json({ success: false, message: 'Por favor, complete todos los campos.' });
    }
    const insertMascotaQuery = `INSERT INTO mascotas (NombreDueño, id_dueno, correo, nombre_mascota, peso, edad, raza) 
                                VALUES (?, ?, ?, ?, ?, ?, ?)`;
    pool.query(insertMascotaQuery, [NombreDueño, id_dueno, Correo, nombre_mascota, Peso, Edad, Raza], (err) => {
        if (err) {
            console.error('Error inserting mascota:', err);
            return res.status(500).json({ success: false, message: 'Error al registrar la mascota.' });
        }
        res.status(200).json({ success: true, message: 'Mascota registrada con éxito.' });
    });
});

router.post('/reserva', (req, res) => {
    const { nombre, id_dueno, telefono, correo, servicio, precio, fecha } = req.body;
    if (!nombre || !id_dueno || !telefono || !correo || !servicio || !precio || !fecha) {
        return res.status(400).json({ success: false, message: 'Por favor, complete todos los campos.' });
    }
    const insertReservaQuery = `INSERT INTO reservas (nombre, id_dueno, telefono, correo, servicio, precio, fecha) 
                                VALUES (?, ?, ?, ?, ?, ?, ?)`;
    pool.query(insertReservaQuery, [nombre, id_dueno, telefono, correo, servicio, precio, fecha], (err) => {
        if (err) {
            console.error('Error al registrar la reserva:', err);
            return res.status(500).json({ success: false, message: 'Error al registrar la reserva.' });
        }
        res.status(200).json({ success: true, message: 'Reserva registrada con éxito.' });
    });
});

router.post('/register', (req, res) => {
    const { nombre, identificacion, celular, correo, usuario, contrasena, mascota, cantante, materia } = req.body;
    if (!nombre || !identificacion || !celular || !correo || !usuario || !contrasena || !mascota || !cantante || !materia) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
    }
    const hashedPassword = hashValue(contrasena);
    const hashedMascota = hashValue(mascota);
    const hashedCantante = hashValue(cantante);
    const hashedMateria = hashValue(materia);
    const token = uuidv4();

    pool.query('SELECT id FROM clientes WHERE identificacion = ?', [identificacion], (err, results) => {
        if (err) {
            console.error('Error al verificar cliente:', err);
            return res.status(500).json({ success: false, message: 'Error al verificar el cliente.' });
        }
        if (results.length > 0) {
            return res.status(400).json({ success: false, message: 'Cliente ya registrado.' });
        }

        const insertCliente = `INSERT INTO clientes (nombre, identificacion, celular, correo, usuario, contrasena) VALUES (?, ?, ?, ?, ?, ?)`;
        pool.query(insertCliente, [nombre, identificacion, celular, correo, usuario, hashedPassword], (err) => {
            if (err) {
                console.error('Error al insertar cliente:', err);
                return res.status(500).json({ success: false, message: 'Error al registrar cliente.' });
            }

            const insertValidacion = `INSERT INTO validacion (identificacion, mascota, cantante, materia) VALUES (?, ?, ?, ?)`;
            pool.query(insertValidacion, [identificacion, hashedMascota, hashedCantante, hashedMateria], (err) => {
                if (err) {
                    console.error('Error al insertar validación:', err);
                    return res.status(500).json({ success: false, message: 'Error al guardar validación.' });
                }

                const insertToken = `INSERT INTO tokens_verificacion (correo, token, fecha_creacion) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE token = ?, fecha_creacion = NOW()`;
                pool.query(insertToken, [correo, token, token], (err) => {
                    if (err) {
                        console.error('Error al insertar token:', err);
                        return res.status(500).json({ success: false, message: 'Error al generar token de verificación.' });
                    }

                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });

                    const verificationLink = `https://api-interna.onrender.com/verify-email?token=${token}&correo=${correo}`;
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: correo,
                        subject: 'Verificación de correo',
                        html: `<p>Haz clic aquí para verificar tu correo: <a href="${verificationLink}">Verificar correo</a></p>`
                    };

                    transporter.sendMail(mailOptions, (err) => {
                        if (err) {
                            console.error('Error al enviar correo:', err);
                            return res.status(500).json({ success: false, message: 'Error al enviar el correo de verificación.' });
                        }

                        return res.status(200).json({
                            success: true,
                            message: 'Cliente registrado con éxito. Verificación enviada al correo.'
                        });
                    });
                });
            });
        });
    });
});

router.post('/register-tarjeta', (req, res) => {
    const { nombre, identificacion, numero_tarjeta, cvv, monto } = req.body;
    if (!nombre || !identificacion || !numero_tarjeta || !cvv || !monto) {
        return res.status(400).json({ success: false, message: 'Por favor, complete todos los campos.' });
    }
    const insertTarjetaQuery = `INSERT INTO tarjetas (nombre, identificacion, numero_tarjeta, cvv, monto) VALUES (?, ?, ?, ?, ?)`;
    pool.query(insertTarjetaQuery, [nombre, identificacion, numero_tarjeta, cvv, monto], (err) => {
        if (err) {
            console.error('Error inserting tarjeta:', err);
            return res.status(500).json({ success: false, message: 'Error al registrar la tarjeta.' });
        }
        res.status(200).json({ success: true, message: 'Tarjeta registrada con éxito.' });
    });
});

module.exports = router;