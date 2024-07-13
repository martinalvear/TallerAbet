require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const { engine } = require('express-handlebars');
const path = require('path');
const flash = require('connect-flash');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const passport = require('passport');
const { database } = require('./keys');

// Inicialización
const app = express();
require('./lib/passport');

// Configuraciones
app.set('port', process.env.PORT || 4000);
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(app.get('views'), 'layouts'),
    partialsDir: path.join(app.get('views'), 'partials'),
    helpers: require('./lib/handlebars')
}));
app.set('view engine', '.hbs');

// Middlewares
app.use(session({
    secret: 'uwu123',
    resave: false,
    saveUninitialized: false,
    store: new MySQLStore(database)
}));
app.use(flash());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());

// Variables globales
app.use((req, res, next) => {
    app.locals.success = req.flash('success');
    app.locals.message = req.flash('message');
    app.locals.user = req.user;
    next();
});

// Rutas
app.use(require('./routes/authentication'));
app.use('/empleados', require('./routes/empleados'));
app.use('/logs', require('./routes/user_logs'));

// Ruta para redirigir a la vista del dashboard
app.get('/', (req, res) => {
    res.redirect('/empleados');
});

// Public
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para service-worker.js
app.get('/service-worker.js', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public/service-worker.js'));
});

// Ruta para manifest.json
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public/manifest.json'));
});

// Iniciando el servidor
app.listen(app.get('port'), () => {
    console.log('Servidor en el puerto', app.get('port'));
});
