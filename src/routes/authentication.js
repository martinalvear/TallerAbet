const express = require('express');
const router = express.Router();
const passport = require('passport');
const pool = require('../database');
const helpers = require('../lib/helpers');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const { isLoggedIn, checkRole } = require('../lib/auth');

// Configurar multer para la carga de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + '.csv');
    }
});
const upload = multer({ storage: storage });

// Función para registrar logs
const logAction = async (userId, action, target, description) => {
    await pool.query('INSERT INTO user_logs (user_id, action, target, description) VALUES (?, ?, ?, ?)', [userId, action, target, description]);
};

// Ruta para la vista de registro
router.get('/signup', isLoggedIn, async (req, res) => {
    try {
        const roles = await pool.query('SELECT id, rol FROM roles');
        res.render('auth/signup', { roles });
    } catch (err) {
        console.error('Error fetching roles:', err);
        req.flash('message', 'Error al obtener los roles');
        res.redirect('/signup');
    }
});

// Procesar el registro de usuario
router.post('/signup', isLoggedIn, passport.authenticate('local.signup', {
    successRedirect: '/dashboard',
    failureRedirect: '/signup',
    failureFlash: true
}));

// Ruta para la vista de registro de empleados
router.get('/signup/empleado', isLoggedIn, checkRole([1, 2]), async (req, res) => {
    try {
        const roles = await pool.query('SELECT id, rol FROM roles');
        const empresas = await pool.query('SELECT id, nombre FROM empresas'); 
        res.render('auth/signupEmployee', { roles, empresas });
    } catch (err) {
        console.error('Error fetching roles or empresas:', err);
        req.flash('message', 'Error al obtener los roles o empresas');
        res.redirect('/signup/empleado');
    }
});

// Procesar el registro de empleado sin iniciar sesión automáticamente
router.post('/signup/empleado', isLoggedIn, checkRole([1, 2]), async (req, res) => {
    const { user, password, name, surname, email, phone, address, cedula, idrol, idsede, idempresa } = req.body;
    const newUser = {
        user,
        password: await helpers.encryptPassword(password),
        name,
        surname,
        email,
        phone,
        address,
        cedula,
        idrol,
        idsede,
        idempresa
    };
    try {
        // Verificar si el usuario o la cédula ya existen
        const existingUser = await pool.query('SELECT * FROM users WHERE user = ? OR cedula = ?', [user, cedula]);
        if (existingUser.length > 0) {
            req.flash('message', 'El usuario o la cédula ya están registrados');
            return res.redirect('/signup/empleado');
        }

        const result = await pool.query('INSERT INTO users SET ?', [newUser]);
        await logAction(req.user.cedula, 'insert', 'user', `Empleado ${user} registrado`);
        req.flash('success', 'Empleado registrado correctamente');
        res.redirect('/empleados');
    } catch (err) {
        console.error('Error during signup', err);
        req.flash('message', 'Error al registrar el empleado');
        res.redirect('/signup/empleado');
    }
});

// Procesar la carga masiva de empleados desde un archivo CSV
router.post('/signup/empleado/upload', isLoggedIn, checkRole([1, 2]), upload.single('file'), async (req, res) => {
    if (req.file) {
        try {
            const results = [];
            fs.createReadStream(req.file.path)
                .pipe(csvParser())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                    let errores = [];
                    let actualizaciones = [];
                    let inserciones = [];
                    for (const row of results) {
                        const { user, password, name, surname, email, phone, address, cedula, idrol, idsede, idempresa } = row;

                        // Validar campos requeridos
                        if (!user || !password || !name || !surname || !email || !phone || !address || !cedula || !idrol || !idsede || !idempresa) {
                            errores.push(`Error en la fila con usuario ${user}: campos faltantes.`);
                            continue;
                        }

                        const sedeExistente = await pool.query('SELECT * FROM sedes WHERE code = ?', [idsede]);
                        if (sedeExistente.length === 0) {
                            errores.push(`Error en la fila con usuario ${user}: la sede con código ${idsede} no existe.`);
                            continue;
                        }

                        const newUser = {
                            user,
                            password: await helpers.encryptPassword(password),
                            name,
                            surname,
                            email,
                            phone,
                            address,
                            cedula,
                            idrol,
                            idsede,
                            idempresa
                        };

                        try {
                            const existingUser = await pool.query('SELECT * FROM users WHERE user = ? OR cedula = ?', [user, cedula]);
                            if (existingUser.length > 0) {
                                // Verificar si se necesitan actualizaciones campo por campo
                                let updateNeeded = false;
                                let updateFields = {};

                                for (let key in newUser) {
                                    if (key === 'password') {
                                        // Comparar las contraseñas encriptadas
                                        const isMatch = await helpers.matchPassword(password, existingUser[0][key]);
                                        if (!isMatch) {
                                            updateFields[key] = newUser[key];
                                            updateNeeded = true;
                                        }
                                    } else if (newUser[key] !== existingUser[0][key]) {
                                        updateFields[key] = newUser[key];
                                        updateNeeded = true;
                                    }
                                }

                                // Si se necesita una actualización
                                if (updateNeeded) {
                                    await pool.query('UPDATE users SET ? WHERE id = ?', [updateFields, existingUser[0].id]);
                                    actualizaciones.push(`Usuario ${user} actualizado correctamente.`);
                                    await logAction(req.user.cedula, 'update', 'user', `Empleado ${user} actualizado`);
                                }
                            } else {
                                const result = await pool.query('INSERT INTO users SET ?', [newUser]);
                                inserciones.push(`Usuario ${user} insertado correctamente.`);
                                await logAction(req.user.cedula , 'insert', 'user', `Empleado ${user} registrado`);
                            }
                        } catch (dbError) {
                            errores.push(`Error en la fila con usuario ${user}: ${dbError.sqlMessage}`);
                        }
                    }

                    // Procesar los mensajes después de leer y validar todas las filas
                    if (inserciones.length > 0) {
                        req.flash('success', `Inserciones realizadas: ${inserciones.join(', ')}`);
                    }

                    if (actualizaciones.length > 0) {
                        req.flash('success', `Actualizaciones realizadas: ${actualizaciones.join(', ')}`);
                    }

                    if (errores.length > 0) {
                        req.flash('message', `Se encontraron errores durante la carga del archivo CSV: ${errores.join(', ')}`);
                    }

                    if (actualizaciones.length === 0 && inserciones.length === 0 && errores.length === 0) {
                        req.flash('message', 'No se realizaron cambios.');
                    }

                    res.redirect('/empleados');
                });
        } catch (err) {
            console.error('Error uploading CSV:', err);
            req.flash('message', 'Error al cargar el archivo CSV');
            res.redirect('/empleados');
        }
    }
});

// Ruta para la vista de inicio de sesión
router.get('/signin', (req, res) => {
    res.render('auth/signin');
});

// Procesar el inicio de sesión
router.post('/signin', (req, res, next) => {
    passport.authenticate('local.signin', {
        successRedirect: '/empleados',
        failureRedirect: '/signin',
        failureFlash: true
    })(req, res, next);
});

// Ruta para el dashboard
router.get('/dashboard', isLoggedIn, (req, res) => {
    res.render('dashboard');
});

// Procesar el cierre de sesión
router.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        res.redirect('/signin');
    });
});

// Ruta para obtener sedes según la empresa seleccionada
router.post('/signup/empleado/sedes', isLoggedIn, async (req, res) => {
    const { idempresa } = req.body;
    try {
        const sedes = await pool.query('SELECT id, name, code FROM sedes WHERE idempresa = ?', [idempresa]);
        res.json(sedes);
    } catch (err) {
        console.error('Error fetching sedes:', err);
        res.status(500).json({ error: 'Error al obtener las sedes' });
    }
});

module.exports = router;
