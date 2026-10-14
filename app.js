const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helpers = require('./helpers');
require('dotenv').config();
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 8080;

// Set up handlebars
app.engine('hbs', exphbs.engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: helpers,
    // Allow prototype property access to fix Handlebars warnings
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    }
}));
app.set('view engine', 'hbs');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
    secret: 'shopnow-ecommerce-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));
app.use(express.static(path.join(__dirname, 'public')));

// Add global template variables
app.use(async (req, res, next) => {
    // Initialize cart if needed
    if (!req.session.cart) req.session.cart = [];
    
    // Calculate cart count and total
    const cartCount = req.session.cart.length;
    let cartTotal = 0;
    
    if (cartCount > 0) {
        cartTotal = req.session.cart.reduce((total, item) => {
            return total + (item.product.price * item.quantity);
        }, 0);
    }
    
    // Get wishlist count if user is logged in
    let wishlistCount = 0;
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user.id);
            wishlistCount = user.wishlist ? user.wishlist.length : 0;
            req.session.wishlistCount = wishlistCount;
        } catch (err) {
            console.error('Error getting wishlist count:', err);
        }
    }
    
    // Add to locals for use in templates
    res.locals.cartCount = cartCount;
    res.locals.cartTotal = cartTotal.toFixed(2);
    res.locals.wishlistCount = wishlistCount;
    
    // Add user info to all templates
    res.locals.user = req.session.user || null;
    res.locals.isEmailVerified = req.session.user ? req.session.user.isEmailVerified : true;

    // One-time email verification warning (shown only right after login)
    if (req.session.showEmailWarning) {
        res.locals.showEmailWarning = true;
        delete req.session.showEmailWarning; // consume — won't show again
    } else {
        res.locals.showEmailWarning = false;
    }
    
    // Pass success/error messages
    res.locals.successMessage = req.query.message || null;
    res.locals.errorMessage = req.query.error || null;

    // WhatsApp number for floating button
    res.locals.whatsappNumber = process.env.WHATSAPP_NUMBER || '923209020941';
    
    next();
});

// MongoDB Connection
const adminRoutes = require('./routes/admin');
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce';
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('MongoDB Connected');
    // Run post-connect initializers
    if (typeof adminRoutes.createAdminUser === 'function') {
        adminRoutes.createAdminUser().catch(err => console.error('Create admin error:', err));
    }
    // Start server only after successful DB connection
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
})
.catch(err => {
    console.log('MongoDB Connection Error:', err);
});

// Routes
const indexRoutes = require('./routes/index');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const userRoutes = require('./routes/users');
//const adminRoutes = require('./routes/admin');
const sellerRoutes = require('./routes/seller');
const blogRoutes = require('./routes/blogs');
const wishlistRoutes = require('./routes/wishlist');
const orderRoutes = require('./routes/orders');
const feedbackRoutes = require('./routes/feedback');
const messageRoutes = require('./routes/messages');

app.use('/', indexRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);
app.use('/seller', sellerRoutes);
app.use('/blogs', blogRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/my-orders', orderRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/messages', messageRoutes);

// Note: server is started after successful DB connection above