const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const { isAuthenticated } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendMail, orderConfirmationEmail } = require('../mailer');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../public/uploads/screenshots');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'jazzcash-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check if file is an image
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Define a simple cart that uses session storage
// In a real app, you would use a database to store cart items

// View cart
router.get('/', (req, res) => {
    // Initialize cart if it doesn't exist in session
    if (!req.session.cart) req.session.cart = [];
    
    // Calculate cart total
    let cartTotal = 0;
    if (req.session.cart && req.session.cart.length > 0) {
        cartTotal = req.session.cart.reduce((total, item) => {
            return total + (item.product.price * item.quantity);
        }, 0);
    }
    
    res.render('cart/index', {
        title: 'Your Shopping Cart',
        cartItems: req.session.cart || [],
        cartTotal: cartTotal.toFixed(2)
    });
});

// Add item to cart
router.post('/add', async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        console.log('Adding to cart:', productId, quantity);
        
        // Initialize session if needed
        if (!req.session.cart) req.session.cart = [];
        
        // Get product details
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        // Check if the product is already in the cart
        const existingItemIndex = req.session.cart.findIndex(item => 
            item.product._id.toString() === productId.toString()
        );
        
        if (existingItemIndex > -1) {
            // Update quantity if product already in cart
            req.session.cart[existingItemIndex].quantity += parseInt(quantity);
            console.log('Updated quantity in cart');
        } else {
            // Add new product to cart
            req.session.cart.push({
                product,
                quantity: parseInt(quantity)
            });
            console.log('Added new product to cart');
        }
        
        // Calculate new cart total
        let cartTotal = 0;
        if (req.session.cart.length > 0) {
            cartTotal = req.session.cart.reduce((total, item) => {
                return total + (item.product.price * item.quantity);
            }, 0);
        }
        
        res.json({ 
            success: true, 
            cartCount: req.session.cart.length,
            cartTotal: cartTotal.toFixed(2)
        });
    } catch (err) {
        console.error('Cart add error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Remove item from cart
router.post('/remove', (req, res) => {
    const { productId } = req.body;
    console.log('Removing from cart:', productId);
    
    if (req.session && req.session.cart) {
        req.session.cart = req.session.cart.filter(item => 
            item.product._id.toString() !== productId.toString()
        );
        
        // Calculate new cart total
        let cartTotal = 0;
        if (req.session.cart.length > 0) {
            cartTotal = req.session.cart.reduce((total, item) => {
                return total + (item.product.price * item.quantity);
            }, 0);
        }
        
        res.json({ 
            success: true, 
            cartCount: req.session.cart.length,
            cartTotal: cartTotal.toFixed(2)
        });
    } else {
        res.json({ success: true, cartCount: 0, cartTotal: "0.00" });
    }
});

// Clear cart
router.post('/clear', (req, res) => {
    console.log('Clearing cart');
    if (req.session) {
        req.session.cart = [];
    }
    
    res.json({ success: true, cartTotal: "0.00" });
});

// Update quantity
router.post('/update-quantity', (req, res) => {
    try {
        const { productId, quantity } = req.body;
        console.log('Updating quantity:', productId, quantity);
        
        if (!req.session || !req.session.cart) {
            return res.json({ success: false, message: 'Cart not initialized' });
        }
        
        const cartItem = req.session.cart.find(item => 
            item.product._id.toString() === productId.toString()
        );
        
        if (cartItem) {
            cartItem.quantity = parseInt(quantity);
            
            // Calculate new cart total
            let cartTotal = 0;
            if (req.session.cart.length > 0) {
                cartTotal = req.session.cart.reduce((total, item) => {
                    return total + (item.product.price * item.quantity);
                }, 0);
            }
            
            res.json({ 
                success: true, 
                itemTotal: (cartItem.product.price * cartItem.quantity).toFixed(2),
                cartTotal: cartTotal.toFixed(2)
            });
        } else {
            res.json({ success: false, message: 'Item not found in cart' });
        }
    } catch (err) {
        console.error('Update quantity error:', err);
        res.json({ success: false, message: 'Error updating quantity' });
    }
});

// Checkout page (authenticated users only)
router.get('/checkout', isAuthenticated, (req, res) => {
    // Check if cart has items
    if (!req.session.cart || req.session.cart.length === 0) {
        return res.redirect('/cart?error=Your cart is empty');
    }
    
    // Calculate cart totals
    const cartItems = req.session.cart;
    const subtotal = cartItems.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
    }, 0);
    
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;
    
    res.render('cart/checkout', {
        title: 'Checkout',
        cartItems: cartItems,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        user: req.session.user
    });
});

// Process checkout (place order)
router.post('/place-order', isAuthenticated, upload.single('transactionScreenshot'), async (req, res) => {
    try {
        // Block unverified users from placing orders
        if (!req.session.user || req.session.user.isEmailVerified !== true) {
            return res.redirect('/cart/checkout?error=Please verify your email address before placing an order. Check your inbox for the verification link.');
        }
        const { 
            fullName, 
            email, 
            address, 
            city, 
            state, 
            zipCode, 
            country, 
            paymentMethod,
            jazzcashNumber,
            accountTitle,
            accountNumber,
            bankName,
            transactionId
        } = req.body;
        
        // Validate required fields
        if (!fullName || !email || !address || !city || !state || !zipCode || !country || !paymentMethod) {
            return res.redirect('/cart/checkout?error=Please fill in all required fields');
        }
        
        // Additional validation for JazzCash payment
        if (paymentMethod === 'jazzcash') {
            if (!jazzcashNumber) {
                return res.redirect('/cart/checkout?error=JazzCash number is required for JazzCash payment');
            }
            if (!req.file) {
                return res.redirect('/cart/checkout?error=Transaction screenshot is required for JazzCash payment');
            }
        }
        
        // Additional validation for Bank Transfer payment
        if (paymentMethod === 'bank_transfer') {
            if (!accountTitle || !accountNumber || !bankName || !transactionId) {
                return res.redirect('/cart/checkout?error=All bank transfer details are required');
            }
            if (!req.file) {
                return res.redirect('/cart/checkout?error=Transaction screenshot is required for bank transfer payment');
            }
        }
        
        // Check if cart has items
        if (!req.session.cart || req.session.cart.length === 0) {
            return res.redirect('/cart?error=Your cart is empty');
        }
        
        // Calculate totals
        const cartItems = req.session.cart;
        const subtotal = cartItems.reduce((total, item) => {
            return total + (item.product.price * item.quantity);
        }, 0);
        
        const tax = subtotal * 0.1;
        const total = subtotal + tax;
        
        // Create order items from cart
        const orderItems = cartItems.map(item => ({
            product: item.product._id,
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
            imageUrl: item.product.imageUrl,
            category: item.product.category
        }));
        
        // Generate unique order number
        const orderNumber = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        
        // Prepare payment details
        let paymentDetails = {};
        if (paymentMethod === 'jazzcash') {
            paymentDetails = {
                jazzcashNumber,
                transactionScreenshot: req.file ? `/uploads/screenshots/${req.file.filename}` : null,
                paymentStatus: 'pending'
            };
        } else if (paymentMethod === 'bank_transfer') {
            paymentDetails = {
                bankTransferDetails: {
                    accountTitle,
                    accountNumber,
                    bankName,
                    transactionId
                },
                transactionScreenshot: req.file ? `/uploads/screenshots/${req.file.filename}` : null,
                paymentStatus: 'pending'
            };
        }
        
        // Create the order in database
        const newOrder = new Order({
            user: req.session.user.id,
            items: orderItems,
            shippingDetails: {
                fullName,
                email,
                address,
                city,
                state,
                zipCode,
                country
            },
            paymentMethod,
            paymentDetails,
            subtotal,
            tax,
            total,
            orderNumber,
            status: 'pending'
        });
        
        await newOrder.save();

        // Deduct stock quantity for each ordered item
        for (const item of orderItems) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { stockQuantity: -item.quantity },
            });
            // Auto mark out of stock if quantity hits 0
            const updated = await Product.findById(item.product);
            if (updated && updated.stockQuantity <= 0) {
                updated.stockQuantity = 0;
                updated.inStock = false;
                await updated.save();
            }
        }

        // Send order confirmation email (non-blocking)
        const { subject, html } = orderConfirmationEmail(newOrder);
        sendMail({ to: newOrder.shippingDetails.email, subject, html });

        // Clear the cart
        req.session.cart = [];
        
        // Redirect to order confirmation
        res.redirect('/cart/order-confirmation?orderId=' + newOrder._id);
    } catch (err) {
        console.error('Place order error:', err);
        res.redirect('/cart/checkout?error=An error occurred while processing your order: ' + err.message);
    }
});

// Order confirmation page
router.get('/order-confirmation', isAuthenticated, async (req, res) => {
    try {
        const orderId = req.query.orderId;
        
        if (!orderId) {
            return res.redirect('/my-orders');
        }
        
        // Fetch the order details
        const order = await Order.findOne({
            _id: orderId,
            user: req.session.user.id
        });
        
        if (!order) {
            return res.redirect('/my-orders');
        }
        
        res.render('cart/order-confirmation', {
            title: 'Order Confirmation',
            orderId: order.orderNumber,
            orderTotal: order.total.toFixed(2),
            order
        });
    } catch (err) {
        console.error('Order confirmation error:', err);
        res.redirect('/my-orders');
    }
});

module.exports = router; 