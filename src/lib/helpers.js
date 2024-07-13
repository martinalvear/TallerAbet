const bcrypt = require('bcryptjs');
const moment = require('moment');

const helpers = {};

helpers.encryptPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
};

helpers.matchPassword = async (password, savedPassword) => {
    try {
        return await bcrypt.compare(password, savedPassword);
    } catch (e) {
        console.log(e);
    }
};

// Formatear la fecha
helpers.formatDate = (date) => {
    return date ? moment(date).format('DD/MM/YYYY HH:mm') : '';
};

module.exports = helpers;
