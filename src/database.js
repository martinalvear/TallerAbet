const mysql = require('mysql2');
const {promisify} = require('util');

const { database } = require('./keys');


const pool = mysql.createPool(database);
pool.getConnection((err, connection) => {
    if (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('Conexion perdida');
        }
        if (err.code === 'ER_CON_COUNT_ERROR') {
            console.error('Muchas conexiones a la bd');
        }
        if (err.code === 'ECONNREFUSED') {
            console.error('CONNECTION REFUSED');
        }
    }
    if(connection) connection.release();
    console.log('DB CONECTADA');
    return;
});

pool.query = promisify(pool.query);

module.exports = pool;