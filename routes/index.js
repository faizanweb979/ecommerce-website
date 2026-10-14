const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const Contact = require('../models/Contact');
const User = require('../models/User');


// Home page route
router.get('/', async (req, res) => {
    try {
        // Get featured products for the homepage
        const featuredProducts = await Product.find({ featured: true, approvalStatus: 'approved' }).limit(8);
        
        // Get some products by category for homepage sections
        const menClothing = await Product.find({ category: 'men-clothing', approvalStatus: 'approved' }).limit(4);
        const womenClothing = await Product.find({ category: 'women-clothing', approvalStatus: 'approved' }).limit(4);
        const accessories = await Product.find({ category: 'accessories', approvalStatus: 'approved' }).limit(4);
        const gadgets = await Product.find({ category: 'electronics', approvalStatus: 'approved' }).limit(4);
        
        res.render('home', {
            title: 'ShopNow - Home',
            featuredProducts,
            menClothing,
            womenClothing,
            accessories,
            gadgets
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Email verification route
router.get('/verify-email', async (req, res) => {
    try {
        const { token, email } = req.query;
        if (!token || !email) {
            return res.redirect('/users/login?error=Invalid verification link');
        }

        const user = await User.findOne({ email: email.toLowerCase(), emailVerificationToken: token });
        if (!user) {
            return res.redirect('/users/login?error=Invalid or expired verification link');
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = null;
        await user.save();

        // Update session if user is already logged in
        if (req.session.user && req.session.user.id === user._id.toString()) {
            req.session.user.isEmailVerified = true;
        }

        return res.redirect('/users/login?message=Email verified successfully. You can now log in.');
    } catch (err) {
        console.error('Verify email error:', err);
        return res.redirect('/users/login?error=Server error verifying email');
    }
});
       // Contact Us 
// GET route
router.get('/contact-us', (req, res) => {
    res.render('contact-us');
});

// POST route
router.post('/contact-us', async (req, res) => {
    const { name, email, subject, message } = req.body;

    try {
        const newContact = new Contact({ name, email, subject, message });
        await newContact.save();

        res.render('contact-us', {
            successMessage: 'Your message has been sent successfully!'
        });
    } catch (err) {
        console.error('Error saving contact message:', err);
        res.render('contact-us', {
            errorMessage: 'There was an error submitting your message.'
        });
    }
});



// About page
router.get('/about-us', (req, res) => {
  res.render('about-us', {
    title: 'About Us'
  });
});


// Contact page
router.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact Us' });
});

// Order tracking page
router.get('/order-tracking', (req, res) => {
    res.render('order-tracking', { 
        title: 'Track Your Order',
        orderFound: false
    });
});

// Process order tracking request
router.post('/order-tracking', async (req, res) => {
    try {
        const { orderNumber, email } = req.body;
        
        // Validate input
        if (!orderNumber || !email) {
            return res.render('order-tracking', { 
                title: 'Track Your Order',
                orderFound: false,
                error: 'Please enter both order number and email'
            });
        }
        
        // Find the order
        const order = await Order.findOne({ 
            orderNumber: orderNumber, 
            'shippingDetails.email': email 
        });
        
        if (!order) {
            return res.render('order-tracking', { 
                title: 'Track Your Order',
                orderFound: false,
                error: 'Order not found. Please check your order number and email'
            });
        }
        
        // Order found, render the page with order details
        res.render('order-tracking', { 
            title: 'Track Your Order',
            orderFound: true,
            order
        });
    } catch (err) {
        console.error('Order tracking error:', err);
        res.render('order-tracking', { 
            title: 'Track Your Order',
            orderFound: false,
            error: 'Error tracking order. Please try again later.'
        });
    }
});

// Privacy Policy page
router.get('/privacy-policy', (req, res) => {
    res.render('privacy-policy', { 
        title: 'Privacy Policy' 
    });
});
//Terms & Conditions 
router.get('/terms-conditions', (req, res) => {
    res.render('terms-conditions', { title: 'Terms & Conditions' });
});
//Refund Policy
router.get('/refund-policy', (req, res) => {
    res.render('refund-policy', { title: 'Refund Policy' });
});
router.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact Us' });
});
// Contact Us
router.get('/contact-us', (req, res) => {
    res.render('contact-us', { title: 'Contact Us' });
});

module.exports = router; 