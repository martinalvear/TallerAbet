const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn, checkRole } = require('../lib/auth');

// Función para registrar logs
const logAction = async (action, userCedula, target, description) => {
    const user = await pool.query('SELECT name, surname FROM users WHERE cedula = ?', [userCedula]);
    const userName = user.length > 0 ? `${user[0].name} ${user[0].surname}` : 'Desconocido';
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const fullDescription = `${description}`;
    await pool.query('INSERT INTO user_logs (action, user_id, target, description, timestamp) VALUES (?, ?, ?, ?, ?)', [action, userCedula, target, fullDescription, timestamp]);
};

// Ruta para listar usuarios (empleados)
router.get('/', isLoggedIn, checkRole([1, 2]), async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        const empresaFilter = req.query.empresa || '';
        const sedeFilter = req.query.sede || '';
        const roles = await pool.query('SELECT id, rol FROM roles');
        const sedes = await pool.query('SELECT code, name FROM sedes');
        const empresas = await pool.query('SELECT id, nombre FROM empresas');
        
        let query = `
            SELECT u.*, r.rol, s.name AS sede, e.nombre AS empresa
            FROM users u
            LEFT JOIN roles r ON u.idrol = r.id
            LEFT JOIN sedes s ON u.idsede = s.code 
            LEFT JOIN empresas e ON s.idempresa = e.id
        `;
        const params = [];

        if (searchQuery || empresaFilter || sedeFilter) {
            query += ' WHERE';
            if (searchQuery) {
                query += ' (u.name LIKE ? OR u.surname LIKE ? OR u.user LIKE ? OR u.email LIKE ?)';
                params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
            }
            if (searchQuery && (empresaFilter || sedeFilter)) {
                query += ' AND';
            }
            if (empresaFilter) {
                query += ' s.idempresa = ?';
                params.push(empresaFilter);
            }
            if (empresaFilter && sedeFilter) {
                query += ' AND';
            }
            if (sedeFilter) {
                query += ' u.idsede = ?';
                params.push(sedeFilter);
            }
        }

        const empleados = await pool.query(query, params);
        res.render('empleados/list', { empleados, searchQuery, empresaFilter, sedeFilter, sedes, empresas });
    } catch (err) {
        console.error('Error fetching empleados:', err);
        req.flash('message', 'Error al obtener la lista de empleados');
        res.redirect('/');
    }
});

// Ruta para eliminar un empleado
router.get('/delete/:id', isLoggedIn, checkRole([1, 2]), async (req, res) => {
    const { id } = req.params;
    try {
        const empleado = await pool.query('SELECT name, surname, cedula FROM users WHERE id = ?', [id]);
        if (empleado.length === 0) {
            req.flash('message', 'Empleado no encontrado');
            return res.redirect('/empleados');
        }

        // Verificar si el empleado tiene tickets asignados
        const tickets = await pool.query('SELECT * FROM tickets WHERE tecnico_id = ?', [empleado[0].cedula]);
        if (tickets.length > 0) {
            req.flash('message', 'No se puede eliminar un empleado con tickets asignados');
            return res.redirect('/empleados');
        }

        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        await logAction('delete', req.user.cedula, 'users', `Empleado ${empleado[0].name} ${empleado[0].surname} eliminado`);
        req.flash('success', 'Empleado eliminado correctamente');
        res.redirect('/empleados');
    } catch (err) {
        console.error('Error al eliminar el empleado:', err);
        req.flash('message', 'Error al eliminar el empleado');
        res.redirect('/empleados');
    }
});

// Ruta para mostrar el formulario de edición de empleado
router.get('/edit/:id', isLoggedIn, checkRole([1, 2]), async (req, res) => {
    const { id } = req.params;
    try {
        const empleados = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (empleados.length === 0) {
            req.flash('message', 'Empleado no encontrado');
            return res.redirect('/empleados');
        }
        const roles = await pool.query('SELECT id, rol FROM roles');
        const empresas = await pool.query('SELECT id, nombre FROM empresas');
        const sedes = await pool.query('SELECT code, name FROM sedes WHERE idempresa = ?', [empleados[0].idempresa]);
        res.render('empleados/edit', { empleado: empleados[0], roles, sedes, empresas });
    } catch (err) {
        console.error('Error al obtener los datos del empleado:', err);
        req.flash('message', 'Error al obtener los datos del empleado');
        res.redirect('/empleados');
    }
});

// Ruta para procesar el formulario de edición de empleado
router.post('/edit/:id', isLoggedIn, checkRole([1, 2]), async (req, res) => {
    const { id } = req.params;
    const { name, surname, user, email, phone, address, cedula, idrol, idsede, idempresa } = req.body;
    const updatedEmpleado = {
        name,
        surname,
        user,
        email,
        phone,
        address,
        cedula,
        idrol,
        idsede,
        idempresa
    };

    try {
        // Verificar si el nuevo nombre de usuario o cédula ya están en uso por otro empleado
        const existingEmpleado = await pool.query('SELECT * FROM users WHERE (user = ? OR cedula = ?) AND id != ?', [user, cedula, id]);
        if (existingEmpleado.length > 0) {
            req.flash('error', 'El usuario o la cédula ya están en uso por otro empleado');
            return res.redirect(`/empleados/edit/${id}`);
        }

        const oldEmpleado = await pool.query('SELECT * FROM users WHERE id = ?', [id]);

        // Verificar si la cédula está siendo referenciada antes de actualizar
        if (oldEmpleado[0].cedula !== cedula) {
            const isReferenced = await pool.query('SELECT * FROM cliente_logs WHERE user_id = ?', [oldEmpleado[0].cedula]);
            if (isReferenced.length > 0) {
                req.flash('error', 'No se puede cambiar la cédula porque está siendo referenciada en otros registros');
                return res.redirect(`/empleados/edit/${id}`);
            }
        }

        await pool.query('UPDATE users SET ? WHERE id = ?', [updatedEmpleado, id]);

        // Verificar cambios en las columnas y registrar en el log
        const changedColumns = [];
        for (const key in updatedEmpleado) {
            if (updatedEmpleado[key] !== oldEmpleado[0][key]) {
                changedColumns.push(`${key}: de "${oldEmpleado[0][key]}" a "${updatedEmpleado[key]}"`);
            }
        }
        const fullDescription = `Empleado ${name} ${surname} actualizado. Cambios: ${changedColumns.length > 0 ? changedColumns.join(', ') : 'Ninguno'}. Detalles completos: ${JSON.stringify(updatedEmpleado)}`;
        await logAction('update', req.user.cedula, 'users', fullDescription);

        req.flash('success', 'Empleado editado correctamente');
        res.redirect('/empleados');
    } catch (err) {
        console.error('Error al editar el empleado:', err);
        req.flash('message', 'Error al editar el empleado');
        res.redirect(`/empleados/edit/${id}`);
    }
});

// Ruta para obtener sedes según la empresa seleccionada
router.post('/edit/sedes', isLoggedIn, async (req, res) => {
    const { idempresa } = req.body;
    try {
        const sedes = await pool.query('SELECT id, name, code FROM sedes WHERE idempresa = ?', [idempresa]);
        res.json(sedes);
    } catch (err) {
        console.error('Error al obtener las sedes:', err);
        res.status(500).json({ error: 'Error al obtener las sedes' });
    }
});

// Ruta para obtener los detalles de un empleado
router.get('/:id', isLoggedIn, checkRole([1, 2]), async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT u.*, r.rol, e.nombre AS empresa, s.name AS sede 
            FROM users u
            LEFT JOIN roles r ON u.idrol = r.id
            LEFT JOIN empresas e ON u.idempresa = e.id
            LEFT JOIN sedes s ON u.idsede = s.code
            WHERE u.id = ?
        `;
        const empleados = await pool.query(query, [id]);
        if (empleados.length === 0) {
            return res.status(404).json({ error: 'Empleado no encontrado' });
        }
        res.json(empleados[0]);
    } catch (err) {
        console.error('Error al obtener los detalles del empleado:', err);
        res.status(500).json({ error: 'Error al obtener los detalles del empleado' });
    }
});

module.exports = router;
