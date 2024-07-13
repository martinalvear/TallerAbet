const { format } = require('timeago.js');
const Handlebars = require('handlebars');
const moment = require('moment');

const helpers = {};

helpers.timeago = (timestamp) => {
    return format(timestamp);
};

helpers.formatDate = (date) => {
    return moment(date).format('DD/MM/YYYY HH:mm');
};

Handlebars.registerHelper('formatDate', function(date) {
    return date ? moment(date).format('DD/MM/YYYY HH:mm') : '-';
});

helpers.json = (context) => {
    return JSON.stringify(context);
};

helpers.statusColor = (status) => {
    switch(status) {
        case 'abierto': return 'badge-danger';
        case 'en progreso': return 'badge-primary';
        case 'cerrado': return 'badge-secondary';
        default: return '';
    }
};

helpers.isSelected = (value, selectedValue) => {
    return value === selectedValue ? 'selected' : '';
};

Handlebars.registerHelper('notEquals', function (arg1, arg2, options) {
    return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('ifNotEquals', function(arg1, arg2, options) {
    return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('default', function(value, defaultValue) {
    return value == null || value === '' ? defaultValue : value;
});

Handlebars.registerHelper('json', helpers.json);
Handlebars.registerHelper('formatDate', helpers.formatDate);
Handlebars.registerHelper('statusColor', helpers.statusColor);
Handlebars.registerHelper('isSelected', helpers.isSelected);

module.exports = helpers;
