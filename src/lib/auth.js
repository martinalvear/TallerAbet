module.exports = {
    // middleware para verificar que esté logeado
    isLoggedIn(req, res, next) {
        if (req.isAuthenticated()) {
            req.user.cedula = req.user.cedula || req.user.id; 
            return next();
        }
        return res.redirect('/signin');
    },

    // middleware para verificar múltiples roles
    checkRole(roles) {
        return function(req, res, next) {
            if (!req.isAuthenticated()) {
                return res.redirect('/signin');
            }
            if (roles.includes(req.user.idrol)) {
                return next();
            }
            res.status(403).send('Acceso denegado: no tienes los permisos necesarios.');
        };
    }
};
