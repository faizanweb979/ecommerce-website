// Authentication Middleware

// Check if user is logged in
exports.isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    return res.redirect('/users/login?error=Please log in to access this page');
};

// Check if user is a seller
exports.isSeller = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'seller' || req.session.user.role === 'admin')) {
        return next();
    }
    return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page. Seller access required.'
    });
};

// Check if user is an admin
exports.isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this page. Admin access required.'
    });
};

// Redirect based on user role
exports.redirectBasedOnRole = (req, res, next) => {
    if (!req.session.user) {
        return next();
    }
    
    switch (req.session.user.role) {
        case 'admin':
            return res.redirect('/admin/dashboard');
        case 'seller':
            return res.redirect('/seller/dashboard');
        default:
            return res.redirect('/users/profile');
    }
}; 