const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const Message = require('../models/Message');
const { isSeller } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendMail, orderStatusEmail } = require('../mailer');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        // Determine the destination folder based on the product category
        const getDestination = (req) => {
            const category = req.body.category;
            let destinationPath = 'public/images/products/';
            
            // Create folders if they don't exist
            if (!fs.existsSync(destinationPath)) {
                fs.mkdirSync(destinationPath, { recursive: true });
            }
            
            // Create category-specific subfolder if needed
            if (category) {
                const categoryPath = path.join(destinationPath, category);
                if (!fs.existsSync(categoryPath)) {
                    fs.mkdirSync(categoryPath, { recursive: true });
                }
                return categoryPath;
            }
            
            return destinationPath;
        };
        
        cb(null, getDestination(req));
    },
    filename: function(req, file, cb) {
        // Generate unique filename with timestamp and original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload only images.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
});

// Apply seller middleware to all routes in this router
router.use(isSeller);

// Seller Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const sellerId = req.session.user.id;

        // Get seller's products
        const products = await Product.find({ seller: sellerId }).sort({ createdAt: -1 });
        const productIds = products.map(p => p._id);

        // Find orders that contain at least one of this seller's products
        const orders = await Order.find({
            'items.product': { $in: productIds }
        }).populate('user', 'name email').sort({ createdAt: -1 });

        // Calculate real revenue — only count items belonging to this seller
        let totalRevenue = 0;
        orders.forEach(order => {
            order.items.forEach(item => {
                if (productIds.some(id => id.toString() === item.product.toString())) {
                    totalRevenue += item.price * item.quantity;
                }
            });
        });

        res.render('seller/dashboard', {
            title: 'Seller Dashboard',
            products,
            productCount: products.length,
            orderCount: orders.length,
            totalRevenue: totalRevenue.toFixed(2),
            recentOrders: orders.slice(0, 5),
            unreadMessages: await Message.countDocuments({ seller: sellerId, isRead: false }),
            formSuccess: req.query.success || null,
            formError: req.query.error || null
        });
    } catch (err) {
        console.error('Seller dashboard error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Seller Orders List
router.get('/orders', async (req, res) => {
    try {
        const sellerId = req.session.user.id;
        const productIds = (await Product.find({ seller: sellerId }, '_id')).map(p => p._id);

        const orders = await Order.find({
            'items.product': { $in: productIds }
        }).populate('user', 'name email').sort({ createdAt: -1 });

        res.render('seller/orders', {
            title: 'My Orders',
            orders,
            productIds: productIds.map(id => id.toString())
        });
    } catch (err) {
        console.error('Seller orders error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Server error' });
    }
});

// Seller Order Detail
router.get('/orders/:id', async (req, res) => {
    try {
        const sellerId = req.session.user.id;
        const productIds = (await Product.find({ seller: sellerId }, '_id')).map(p => p._id.toString());

        const order = await Order.findById(req.params.id).populate('user', 'name email');
        if (!order) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Order not found' });
        }

        // Verify this order contains at least one of seller's products
        const hasSellerItem = order.items.some(item => productIds.includes(item.product.toString()));
        if (!hasSellerItem) {
            return res.status(403).render('error', { title: 'Access Denied', message: 'You do not have permission to view this order' });
        }

        // Filter only seller's items for display
        const sellerItems = order.items.filter(item => productIds.includes(item.product.toString()));
        const sellerTotal = sellerItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        res.render('seller/order-details', {
            title: `Order #${order.orderNumber}`,
            order,
            sellerItems,
            sellerTotal: sellerTotal.toFixed(2),
            formSuccess: req.query.success || null,
            formError: req.query.error || null
        });
    } catch (err) {
        console.error('Seller order detail error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Server error' });
    }
});

// Seller Update Order Status (processing → shipped only)
router.post('/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const sellerId = req.session.user.id;
        const productIds = (await Product.find({ seller: sellerId }, '_id')).map(p => p._id.toString());

        const order = await Order.findById(req.params.id);
        if (!order) return res.redirect('/seller/orders?error=Order not found');

        const hasSellerItem = order.items.some(item => productIds.includes(item.product.toString()));
        if (!hasSellerItem) return res.redirect('/seller/orders?error=Access denied');

        // Seller can only mark as shipped (from processing)
        if (status !== 'shipped') {
            return res.redirect(`/seller/orders/${req.params.id}?error=Sellers can only update status to Shipped`);
        }
        if (order.status !== 'processing') {
            return res.redirect(`/seller/orders/${req.params.id}?error=Order must be in Processing status to mark as Shipped`);
        }

        order.status = 'shipped';
        await order.save();

        // Notify customer via email
        const { subject, html } = orderStatusEmail(order, 'shipped');
        sendMail({ to: order.shippingDetails.email, subject, html });

        res.redirect(`/seller/orders/${req.params.id}?success=Order marked as Shipped`);
    } catch (err) {
        console.error('Seller update order status error:', err);
        res.redirect(`/seller/orders/${req.params.id}?error=Server error`);
    }
});

// Add Product Form
router.get('/products/add', (req, res) => {
    const formError = req.query.error || null;
    res.render('seller/add-product', {
        title: 'Add New Product',
        formError
    });
});

// Create Product
router.post('/products', upload.single('productImage'), async (req, res) => {
    try {
        const { name, description, price, category } = req.body;
        
        // Validation
        if (!name || !description || !price || !category) {
            return res.redirect('/seller/products/add?error=All fields are required');
        }
        
        if (!req.file) {
            return res.redirect('/seller/products/add?error=Product image is required');
        }
        
        // Create relative path to the uploaded image
        const imageUrl = '/images/products/' + 
            (category ? category + '/' : '') + 
            req.file.filename;
        
        // Create product
        const newProduct = new Product({
            name,
            description,
            price,
            category,
            imageUrl,
            stockQuantity: parseInt(req.body.stockQuantity) || 0,
            inStock: (parseInt(req.body.stockQuantity) || 0) > 0,
            seller: req.session.user.id
        });
        
        await newProduct.save();
        
        res.redirect('/seller/dashboard?success=Product added successfully');
    } catch (err) {
        console.error('Add product error:', err);
        res.redirect('/seller/products/add?error=' + encodeURIComponent(err.message || 'Server error, please try again'));
    }
});

// Edit Product Form
router.get('/products/edit/:id', async (req, res) => {
    try {
        const product = await Product.findOne({ 
            _id: req.params.id,
            seller: req.session.user.id
        });
        
        if (!product) {
            return res.status(404).render('error', {
                title: 'Product Not Found',
                message: 'The requested product could not be found or you do not have permission to edit it'
            });
        }
        
        res.render('seller/edit-product', {
            title: 'Edit Product',
            product
        });
    } catch (err) {
        console.error('Edit product form error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Update Product
router.post('/products/:id', upload.single('productImage'), async (req, res) => {
    try {
        const { name, description, price, category, inStock } = req.body;
        
        // Validation
        if (!name || !description || !price || !category) {
            return res.redirect(`/seller/products/edit/${req.params.id}?error=All fields are required`);
        }
        
        // Find product and verify seller
        const product = await Product.findOne({
            _id: req.params.id,
            seller: req.session.user.id
        });
        
        if (!product) {
            return res.status(404).render('error', {
                title: 'Product Not Found',
                message: 'The requested product could not be found or you do not have permission to edit it'
            });
        }
        
        // Update product
        product.name = name;
        product.description = description;
        product.price = price;
        product.category = category;
        
        // Update image if a new one was uploaded
        if (req.file) {
            product.imageUrl = '/images/products/' + 
                (category ? category + '/' : '') + 
                req.file.filename;
        }
        
        const qty = parseInt(req.body.stockQuantity) || 0;
        product.stockQuantity = qty;
        product.inStock = qty > 0;

        // Re-submit for admin approval on every update
        product.approvalStatus = 'pending';
        product.approvedBy = null;
        product.approvedAt = null;
        
        await product.save();
        
        res.redirect('/seller/dashboard?success=Product updated and submitted for admin approval');
    } catch (err) {
        console.error('Update product error:', err);
        res.redirect(`/seller/products/edit/${req.params.id}?error=` + encodeURIComponent(err.message || 'Server error, please try again'));
    }
});

// Delete Product
router.post('/products/delete/:id', async (req, res) => {
    try {
        // Find product and verify seller
        const product = await Product.findOne({
            _id: req.params.id,
            seller: req.session.user.id
        });
        
        if (!product) {
            return res.status(404).render('error', {
                title: 'Product Not Found',
                message: 'The requested product could not be found or you do not have permission to delete it'
            });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        
        res.redirect('/seller/dashboard?success=Product deleted successfully');
    } catch (err) {
        console.error('Delete product error:', err);
        res.redirect('/seller/dashboard?error=Server error, please try again');
    }
});

// Seller Sales Report
router.get('/sales-report', async (req, res) => {
    try {
        const sellerId = req.session.user.id;
        const products = await Product.find({ seller: sellerId }, '_id name');
        const productIds = products.map(p => p._id);

        // Date range filter
        const { from, to, period } = req.query;
        let startDate, endDate;
        const now = new Date();

        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
        } else if (period === 'week') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            endDate = now;
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = now;
        } else {
            // Default: current month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        }

        const dateQuery = { createdAt: { $gte: startDate, $lte: endDate } };

        const orders = await Order.find({
            'items.product': { $in: productIds },
            ...dateQuery
        }).populate('user', 'name email').sort({ createdAt: -1 });

        // Aggregate stats
        let totalRevenue = 0, totalOrders = 0, totalItemsSold = 0;
        const productSalesMap = {};
        const dailySalesMap = {};
        const statusCount = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };

        orders.forEach(order => {
            let orderHasSellerItem = false;
            order.items.forEach(item => {
                if (productIds.some(id => id.toString() === item.product.toString())) {
                    const revenue = item.price * item.quantity;
                    totalRevenue += revenue;
                    totalItemsSold += item.quantity;
                    orderHasSellerItem = true;

                    // Per-product stats
                    const pid = item.product.toString();
                    if (!productSalesMap[pid]) {
                        productSalesMap[pid] = { name: item.name, qty: 0, revenue: 0 };
                    }
                    productSalesMap[pid].qty += item.quantity;
                    productSalesMap[pid].revenue += revenue;
                }
            });
            if (orderHasSellerItem) {
                totalOrders++;
                statusCount[order.status] = (statusCount[order.status] || 0) + 1;

                // Daily sales for chart
                const day = new Date(order.createdAt).toISOString().split('T')[0];
                if (!dailySalesMap[day]) dailySalesMap[day] = { orders: 0, revenue: 0 };
                dailySalesMap[day].orders++;
            }
        });

        // Top products sorted by revenue
        const topProducts = Object.values(productSalesMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        // Chart data — last 30 days or selected range
        const chartLabels = [];
        const chartRevenue = [];
        const chartOrders = [];
        const dayCount = Math.min(Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1, 30);
        for (let i = dayCount - 1; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            chartLabels.push(key);
            chartRevenue.push(dailySalesMap[key] ? parseFloat(dailySalesMap[key].revenue.toFixed(2)) : 0);
            chartOrders.push(dailySalesMap[key] ? dailySalesMap[key].orders : 0);
        }

        res.render('seller/sales-report', {
            title: 'Sales Report',
            totalRevenue: totalRevenue.toFixed(2),
            totalOrders,
            totalItemsSold,
            avgOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00',
            topProducts,
            statusCount,
            orders: orders.slice(0, 20),
            chartLabels: JSON.stringify(chartLabels),
            chartRevenue: JSON.stringify(chartRevenue),
            chartOrders: JSON.stringify(chartOrders),
            fromDate: startDate.toISOString().split('T')[0],
            toDate: endDate.toISOString().split('T')[0],
            activePeriod: period || (from ? 'custom' : 'month'),
            unreadMessages: await Message.countDocuments({ seller: sellerId, isRead: false })
        });
    } catch (err) {
        console.error('Seller sales report error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Server error' });
    }
});

// Seller Messages — Inbox
router.get('/messages', async (req, res) => {
    try {
        const messages = await Message.find({ seller: req.session.user.id })
            .populate('sender', 'name email')
            .populate('product', 'name _id')
            .sort({ createdAt: -1 });

        const unreadCount = messages.filter(m => !m.isRead).length;

        res.render('seller/messages', {
            title: 'Customer Messages',
            messages,
            unreadCount,
            successMessage: req.query.success || null,
            errorMessage: req.query.error || null
        });
    } catch (err) {
        console.error('Seller messages error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Server error' });
    }
});

// Mark message as read
router.post('/messages/:id/read', async (req, res) => {
    try {
        await Message.findOneAndUpdate(
            { _id: req.params.id, seller: req.session.user.id },
            { isRead: true }
        );
        res.redirect('/seller/messages');
    } catch (err) {
        console.error('Mark read error:', err);
        res.redirect('/seller/messages?error=Server error');
    }
});

// Seller reply to customer message
router.post('/messages/:id/reply', async (req, res) => {
    try {
        const { reply } = req.body;

        if (!reply || reply.trim().length === 0) {
            return res.redirect('/seller/messages?error=Reply cannot be empty');
        }

        const message = await Message.findOne({
            _id: req.params.id,
            seller: req.session.user.id
        }).populate('sender', 'name email').populate('product', 'name');

        if (!message) {
            return res.redirect('/seller/messages?error=Message not found');
        }

        // Add reply
        message.replies.push({
            sender: req.session.user.id,
            message: reply.trim()
        });
        message.isRead = true;
        await message.save();

        // Email the customer
        sendMail({
            to: message.sender.email,
            subject: `Reply from seller about: ${message.product.name}`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
                    <h2 style="background:#198754;color:#fff;padding:16px;margin:0;">Seller Reply</h2>
                    <div style="padding:20px;">
                        <p>Hi <strong>${message.sender.name}</strong>,</p>
                        <p>The seller has replied to your inquiry about <strong>${message.product.name}</strong>:</p>
                        <div style="background:#f8f9fa;padding:12px;border-radius:6px;margin:12px 0;">
                            ${reply.trim()}
                        </div>
                        <p>Your original message:</p>
                        <div style="background:#e9ecef;padding:12px;border-radius:6px;font-style:italic;">
                            ${message.message}
                        </div>
                        <p style="margin-top:16px;color:#6c757d;font-size:0.9em;">
                            Visit our website to view the product or place an order.
                        </p>
                    </div>
                </div>`
        });

        res.redirect('/seller/messages?success=Reply sent successfully');
    } catch (err) {
        console.error('Reply error:', err);
        res.redirect('/seller/messages?error=Server error');
    }
});

module.exports = router; 