const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const pool = require('../database');
const helpers = require('../lib/helpers');

// Estrategia de inicio de sesión
passport.use('local.signin', new LocalStrategy({
    usernameField: 'user',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, user, password, done) => {
    try {
        const rows = await pool.query('SELECT * FROM users WHERE user = ?', [user]);
        if (rows.length > 0) {
            const userFound = rows[0];
            const validPassword = await helpers.matchPassword(password, userFound.password);
            if (validPassword) {
                return done(null, userFound, req.flash('success', 'Bienvenido ' + userFound.user));
            } else {
                return done(null, false, req.flash('message', 'Contraseña incorrecta'));
            }
        } else {
            return done(null, false, req.flash('message', 'Usuario no registrado'));
        }
    } catch (error) {
        console.error('Error during signin', error);
        return done(error);
    }
}));

// Estrategia de registro para usuarios
passport.use('local.signup', new LocalStrategy({
    usernameField: 'user',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, user, password, done) => {
    const { name, surname, idrol } = req.body;
    const newUser = {
        user,
        password,
        name,
        surname,
        idrol
    };

    try {
        newUser.password = await helpers.encryptPassword(password);
        const result = await pool.query('INSERT INTO users SET ?', [newUser]);
        newUser.id = result.insertId;
        return done(null, newUser);
    } catch (error) {
        console.error('Error during signup', error);
        return done(error);
    }
}));

// Estrategia de registro para empleados
passport.use('local.signup2', new LocalStrategy({
    usernameField: 'user',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, user, password, done) => {
    const { name, surname, idrol } = req.body;
    const newUser = {
        user,
        password,
        name,
        surname,
        idrol
    };

    try {
        newUser.password = await helpers.encryptPassword(password);
        const result = await pool.query('INSERT INTO users SET ?', [newUser]);
        newUser.id = result.insertId;
        return done(null, newUser);
    } catch (error) {
        console.error('Error during signup2', error);
        return done(error);
    }
}));

// Serialización del usuario
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialización del usuario
passport.deserializeUser(async (id, done) => {
    try {
        const results = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        const user = results[0];
        if (user) {
            done(null, user);
        } else {
            done(null, false, { message: 'User no longer exists' });
        }
    } catch (err) {
        console.error('Error fetching user during deserialization', err);
        done(err);
    }
});

module.exports = passport;
