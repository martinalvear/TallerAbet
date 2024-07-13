const express = require('express');
const router = express.Router();
const pool = require('../database');
const moment = require('moment');
const { isLoggedIn, checkRole } = require('../lib/auth');

// Formatear la fecha
const formatDate = (date) => {
    return date ? moment(date).format('DD/MM/YYYY HH:mm') : '';
};

// Ruta para obtener logs de usuarios
router.get('/user_logs', isLoggedIn, checkRole([1, 2]), async (req, res) => {
    const { user, startDate, endDate } = req.query;
    let query = `
        SELECT l.*, u.user 
        FROM user_logs l 
        JOIN users u ON l.user_id = u.cedula 
        WHERE 1=1
    `;
    const params = [];

    if (user) {
        query += ' AND l.user_id = ?';
        params.push(user);
    }
    if (startDate && moment(startDate, 'YYYY-MM-DD', true).isValid()) {
        const start = moment(startDate, 'YYYY-MM-DD').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        query += ' AND l.timestamp >= ?';
        params.push(start);
    }
    if (endDate && moment(endDate, 'YYYY-MM-DD', true).isValid()) {
        const end = moment(endDate, 'YYYY-MM-DD').endOf('day').format('YYYY-MM-DD HH:mm:ss');
        query += ' AND l.timestamp <= ?';
        params.push(end);
    }

    try {
        const logs = await pool.query(query, params);
        const users = await pool.query('SELECT cedula, user FROM users');

        // Formatear las fechas de los logs
        logs.forEach(log => {
            log.timestamp = formatDate(log.timestamp);
        });

        res.render('logs/user_logs', { logs, users, userFilter: user, startDate, endDate });
    } catch (err) {
        console.error('Error fetching user logs:', err);
        req.flash('message', 'Error al obtener los logs de usuario');
        res.redirect('/dashboard');
    }
});

// Ruta para obtener logs de materiales
router.get('/material_logs', isLoggedIn, checkRole([1]), async (req, res) => {
    const { user, startDate, endDate } = req.query;
    let query = `
        SELECT l.*, u.user 
        FROM material_logs l 
        JOIN users u ON l.user_id = u.cedula 
        WHERE 1=1
    `;
    const params = [];

    if (user) {
        query += ' AND l.user_id = ?';
        params.push(user);
    }
    if (startDate && moment(startDate, 'YYYY-MM-DD', true).isValid()) {
        const start = moment(startDate, 'YYYY-MM-DD').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        query += ' AND l.timestamp >= ?';
        params.push(start);
    }
    if (endDate && moment(endDate, 'YYYY-MM-DD', true).isValid()) {
        const end = moment(endDate, 'YYYY-MM-DD').endOf('day').format('YYYY-MM-DD HH:mm:ss');
        query += ' AND l.timestamp <= ?';
        params.push(end);
    }

    try {
        const logs = await pool.query(query, params);
        const users = await pool.query('SELECT cedula, user FROM users');

        // Formatear las fechas de los logs
        logs.forEach(log => {
            log.timestamp = formatDate(log.timestamp);
        });

        res.render('logs/material_logs', { logs, users, userFilter: user, startDate, endDate });
    } catch (err) {
        console.error('Error fetching material logs:', err);
        req.flash('message', 'Error al obtener los logs de materiales');
        res.redirect('/dashboard');
    }
});

// Ruta para obtener logs de tickets
router.get('/ticket_logs', isLoggedIn, checkRole([1]), async (req, res) => {
    const { user, startDate, endDate } = req.query;
    let query = `
        SELECT l.*, u.user 
        FROM ticket_logs l 
        JOIN users u ON l.user_id = u.cedula 
        WHERE 1=1
    `;
    const params = [];

    if (user) {
        query += ' AND l.user_id = ?';
        params.push(user);
    }
    if (startDate && moment(startDate, 'YYYY-MM-DD', true).isValid()) {
        const start = moment(startDate, 'YYYY-MM-DD').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        query += ' AND l.timestamp >= ?';
        params.push(start);
    }
    if (endDate && moment(endDate, 'YYYY-MM-DD', true).isValid()) {
        const end = moment(endDate, 'YYYY-MM-DD').endOf('day').format('YYYY-MM-DD HH:mm:ss');
        query += ' AND l.timestamp <= ?';
        params.push(end);
    }

    try {
        const logs = await pool.query(query, params);
        const users = await pool.query('SELECT cedula, user FROM users');

        // Formatear las fechas de los logs
        logs.forEach(log => {
            log.timestamp = formatDate(log.timestamp);
        });

        res.render('logs/ticket_logs', { logs, users, userFilter: user, startDate, endDate });
    } catch (err) {
        console.error('Error fetching ticket logs:', err);
        req.flash('message', 'Error al obtener los logs de tickets');
        res.redirect('/dashboard');
    }
});

module.exports = router;
