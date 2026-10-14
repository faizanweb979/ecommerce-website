const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Blog = require('../models/Blog');
const Order = require('../models/Order');
const Feedback = require('../models/Feedback');
const { isAdmin } = require('../middleware/auth');
const { sendMail, orderStatusEmail } = require('../mailer');

// Apply admin middleware to all routes in this router
router.use(isAdmin);

// Admin Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // Get counts for dashboard
        const userCount = await User.countDocuments();
        const productCount = await Product.countDocuments();
        const sellerCount = await User.countDocuments({ role: 'seller' });
        const blogCount = await Blog.countDocuments();
        const orderCount = await Order.countDocuments();
        const feedbackCount = await Feedback.countDocuments();
        const pendingReviewCount = await Feedback.countDocuments({ status: 'pending' });
        const pendingProductCount = await Product.countDocuments({ approvalStatus: 'pending' });
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            userCount,
            productCount,
            sellerCount,
            blogCount,
            orderCount,
            feedbackCount,
            pendingReviewCount,
            pendingProductCount
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Manage Orders
router.get('/orders', async (req, res) => {
    try {
        // Get all orders sorted by newest first
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .populate('user', 'name email');
        
        res.render('admin/orders', {
            title: 'Manage Orders',
            orders
        });
    } catch (err) {
        console.error('Admin orders error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// View Order Details
router.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email');
        
        if (!order) {
            return res.status(404).render('error', {
                title: 'Not Found',
                message: 'Order not found'
            });
        }
        
        res.render('admin/order-details', {
            title: `Order #${order.orderNumber}`,
            order
        });
    } catch (err) {
        console.error('Admin order details error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Update Order Status
router.post('/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        // Validate status
        if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
            return res.redirect(`/admin/orders/${req.params.id}?error=Invalid status`);
        }
        
        // Find the order first to check current status
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.redirect('/admin/orders?error=Order not found');
        }
        
        // Prevent updating status of cancelled orders (customer-initiated cancellations should be final)
        if (order.status === 'cancelled') {
            return res.redirect(`/admin/orders/${req.params.id}?error=Cannot update status of cancelled orders. Customer cancellations are final.`);
        }
        
        await Order.findByIdAndUpdate(req.params.id, { status });

        // Send status update email to customer (non-blocking)
        const updatedOrder = await Order.findById(req.params.id);
        if (updatedOrder && ['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
            const { subject, html } = orderStatusEmail(updatedOrder, status);
            sendMail({ to: updatedOrder.shippingDetails.email, subject, html });
        }

        // Log the status change for audit purposes
        console.log(`Admin updated order ${order.orderNumber} status from ${order.status} to ${status}`);
        
        res.redirect(`/admin/orders/${req.params.id}?success=Order status updated to ${status}`);
    } catch (err) {
        console.error('Update order status error:', err);
        res.redirect(`/admin/orders/${req.params.id}?error=Server error, please try again`);
    }
});

// Handle Payment Approval/Rejection
router.post('/orders/:id/payment-action', async (req, res) => {
    try {
        const { action, adminNotes } = req.body;
        const orderId = req.params.id;
        
        // Validate action
        if (!['approve', 'reject'].includes(action)) {
            return res.redirect(`/admin/orders/${orderId}?error=Invalid payment action`);
        }
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.redirect('/admin/orders?error=Order not found');
        }
        
        // Check if order has payment method that requires approval
        if (!['jazzcash', 'bank_transfer'].includes(order.paymentMethod)) {
            return res.redirect(`/admin/orders/${orderId}?error=This order does not require payment approval`);
        }
        
        // Update payment status
        const paymentStatus = action === 'approve' ? 'approved' : 'rejected';
        const updateData = {
            'paymentDetails.paymentStatus': paymentStatus
        };
        
        if (adminNotes) {
            updateData['paymentDetails.adminNotes'] = adminNotes;
        }
        
        // If payment is approved, also update order status to processing
        if (action === 'approve') {
            updateData.status = 'processing';
            updateData['paymentDetails.approvedBy'] = req.session.user.id;
            updateData['paymentDetails.approvedAt'] = new Date();
        }
        
        await Order.findByIdAndUpdate(orderId, updateData);

        // Send email on payment approval → order moves to processing
        if (action === 'approve') {
            const approvedOrder = await Order.findById(orderId);
            if (approvedOrder) {
                const { subject, html } = orderStatusEmail(approvedOrder, 'processing');
                sendMail({ to: approvedOrder.shippingDetails.email, subject, html });
            }
        }
        
        const successMessage = action === 'approve' 
            ? 'Payment approved successfully. Order status updated to Processing.'
            : 'Payment rejected successfully.';
            
        res.redirect(`/admin/orders/${orderId}?success=${successMessage}`);
    } catch (err) {
        console.error('Payment action error:', err);
        res.redirect(`/admin/orders/${req.params.id}?error=Server error, please try again`);
    }
});

// Manage Users
router.get('/users', async (req, res) => {
    try {
        const { filter } = req.query;
        let query = {};
        
        // Filter users but exclude admin users from being displayed
        if (filter === 'seller') {
            query.role = 'seller';
        } else if (filter === 'user') {
            query.role = 'user';
        } else {
            // Show all users except admins
            query.role = { $ne: 'admin' };
        }
        
        const users = await User.find(query).select('-password').sort({ createdAt: -1 });
        
        res.render('admin/users', {
            title: 'Manage Users',
            users,
            filter,
            formSuccess: req.query.success || null,
            formError: req.query.error || null
        });
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Change User Role
router.post('/users/role', async (req, res) => {
    try {
        const { userId, role } = req.body;
        
        // Validate role - admin role cannot be assigned through this interface
        if (!['user', 'seller'].includes(role)) {
            return res.redirect('/admin/users?error=Invalid role');
        }
        
        // Prevent changing admin users' roles
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/admin/users?error=User not found');
        }
        
        if (user.role === 'admin') {
            return res.redirect('/admin/users?error=Cannot modify admin user roles');
        }
        
        await User.findByIdAndUpdate(userId, { role });
        
        res.redirect('/admin/users?success=User role updated successfully');
    } catch (err) {
        console.error('Change role error:', err);
        res.redirect('/admin/users?error=Server error, please try again');
    }
});

// Manage Products
router.get('/products', async (req, res) => {
    try {
        const { filter, approval } = req.query;
        let query = {};
        
        if (filter && filter !== 'all') {
            query.category = filter;
        }
        if (approval && ['pending', 'approved', 'rejected'].includes(approval)) {
            query.approvalStatus = approval;
        }
        
        const products = await Product.find(query).populate('seller', 'name').sort({ createdAt: -1 });
        const pendingProductCount = await Product.countDocuments({ approvalStatus: 'pending' });
        
        res.render('admin/products', {
            title: 'Manage Products',
            products,
            filter,
            currentApproval: approval || 'all',
            pendingProductCount,
            formSuccess: req.query.success || null,
            formError: req.query.error || null
        });
    } catch (err) {
        console.error('Admin products error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Delete Product (Admin)
router.post('/products/delete/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        
        res.redirect('/admin/products?success=Product deleted successfully');
    } catch (err) {
        console.error('Delete product error:', err);
        res.redirect('/admin/products?error=Server error, please try again');
    }
});

// Approve Product
router.post('/products/:id/approve', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.redirect('/admin/products?error=Product not found');

        product.approvalStatus = 'approved';
        product.rejectionReason = null;
        product.approvedBy = req.session.user.id;
        product.approvedAt = new Date();
        await product.save();

        console.log(`Admin approved product: ${product.name} (${product._id})`);
        res.redirect('/admin/products?approval=pending&success=Product approved and is now live on storefront');
    } catch (err) {
        console.error('Approve product error:', err);
        res.redirect('/admin/products?error=Server error, please try again');
    }
});

// Reject Product
router.post('/products/:id/reject', async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) return res.redirect('/admin/products?error=Product not found');

        product.approvalStatus = 'rejected';
        product.rejectionReason = rejectionReason || null;
        await product.save();

        console.log(`Admin rejected product: ${product.name} (${product._id})`);
        res.redirect('/admin/products?approval=pending&success=Product rejected');
    } catch (err) {
        console.error('Reject product error:', err);
        res.redirect('/admin/products?error=Server error, please try again');
    }
});

// Toggle Featured Status
router.post('/products/featured/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.redirect('/admin/products?error=Product not found');
        }
        
        product.featured = !product.featured;
        await product.save();
        
        res.redirect('/admin/products?success=Product featured status updated');
    } catch (err) {
        console.error('Toggle featured error:', err);
        res.redirect('/admin/products?error=Server error, please try again');
    }
});

// GET Edit Product Page
router.get('/products/edit/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send("Product not found");
        }
        res.render('admin/edit-product', { product });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Post Update Product Page
router.post('/products/edit/:id', async (req, res) => {
    try {
        const { name, description, price, category } = req.body;

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).render('error', {
                title: 'Not Found',
                message: 'Product not found'
            });
        }

        product.name = name;
        product.description = description;
        product.price = price;
        product.category = category;

        await product.save();

        res.redirect('/admin/products?success=Product updated successfully');
    } catch (err) {
        console.error('Product update error:', err);
        res.redirect(`/admin/products/edit/${req.params.id}?error=Server error`);
    }
});


// Manage Blogs
router.get('/blogs', async (req, res) => {
    try {
        const blogs = await Blog.find()
            .populate('author', 'name')
            .sort({ createdAt: -1 });
        
        res.render('admin/blogs', {
            title: 'Manage Blogs',
            blogs,
            formSuccess: req.query.success || null,
            formError: req.query.error || null
        });
    } catch (err) {
        console.error('Admin blogs error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Delete Blog
router.post('/blogs/delete/:id', async (req, res) => {
    try {
        await Blog.findByIdAndDelete(req.params.id);
        
        res.redirect('/admin/blogs?success=Blog post deleted successfully');
    } catch (err) {
        console.error('Delete blog error:', err);
        res.redirect('/admin/blogs?error=Server error, please try again');
    }
});

// Toggle Blog Publish Status
router.post('/blogs/toggle-publish/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.redirect('/admin/blogs?error=Blog not found');
        }
        
        blog.isPublished = !blog.isPublished;
        await blog.save();
        
        res.redirect('/admin/blogs?success=Blog publish status updated');
    } catch (err) {
        console.error('Toggle blog publish error:', err);
        res.redirect('/admin/blogs?error=Server error, please try again');
    }
});

// Script to create an admin user if it doesn't exist
const createAdminUser = async () => {
    try {
        // Check if admin exists
        const adminExists = await User.findOne({ role: 'admin' });
        
        if (!adminExists) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            const adminUser = new User({
                name: 'Admin User',
                email: 'admin@example.com',
                password: hashedPassword,
                role: 'admin',
                isEmailVerified: true
            });
            
            await adminUser.save();
            console.log('Admin user created successfully. Email: admin@example.com, Password: admin123');
        }
    } catch (err) {
        console.error('Create admin error:', err);
    }
};

// GET: Add New Product Page
router.get('/products/add', (req, res) => {
    res.render('admin/add-product', {
        title: 'Add New Product'
    });
});

// POST: Handle Add New Product
router.post('/products/add', async (req, res) => {
    try {
        const { name, description, price, category } = req.body;

        const newProduct = new Product({
            name,
            description,
            price,
            category,
            featured: false // by default
        });

        await newProduct.save();
        res.redirect('/admin/products?success=Product added successfully');
    } catch (err) {
        console.error('Add product error:', err);
        res.redirect('/admin/products?error=Server error while adding product');
    }
});

// GET: Add New User Page
router.get('/users/add', (req, res) => {
    res.render('admin/add-user', {
        title: 'Add New User',
        formSuccess: req.query.success || null,
        formError: req.query.error || null
    });
});

// POST: Handle Add New User
router.post('/users/add', async (req, res) => {
    try {
        const { name, email, password, confirmPassword, role, phone, address } = req.body;
        
        // Validate required fields
        if (!name || !email || !password || !role) {
            return res.redirect('/admin/users/add?error=Please fill in all required fields');
        }
        
        // Validate role - only allow user and seller roles
        if (!['user', 'seller'].includes(role)) {
            return res.redirect('/admin/users/add?error=Invalid role selected');
        }
        
        // Check password confirmation
        if (password !== confirmPassword) {
            return res.redirect('/admin/users/add?error=Passwords do not match');
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.redirect('/admin/users/add?error=User with this email already exists');
        }
        
        // Hash password
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
            phone: phone || undefined,
            address: address || undefined
        });
        
        await newUser.save();
        
        res.redirect('/admin/users?success=User added successfully');
    } catch (err) {
        console.error('Add user error:', err);
        res.redirect('/admin/users/add?error=Server error while adding user');
    }
});

// Manage Feedbacks
router.get('/feedbacks', async (req, res) => {
    try {
        const { filter } = req.query;
        let query = {};
        if (filter && ['pending', 'approved', 'rejected'].includes(filter)) {
            query.status = filter;
        }

        const feedbacks = await Feedback.find(query)
            .populate('user', 'name email')
            .populate('product', 'name')
            .sort({ createdAt: -1 });

        const pendingCount = await Feedback.countDocuments({ status: 'pending' });

        res.render('admin/feedbacks', {
            title: 'Manage Feedbacks',
            feedbacks,
            pendingCount,
            currentFilter: filter || 'all',
            successMessage: req.query.success || null,
            errorMessage: req.query.error || null
        });
    } catch (err) {
        console.error('Admin feedbacks error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Delete Feedback
router.delete('/feedbacks/:id', async (req, res) => {
    try {
        const feedbackId = req.params.id;
        
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }
        
        await Feedback.findByIdAndDelete(feedbackId);
        
        res.json({ success: true, message: 'Feedback deleted successfully' });
    } catch (err) {
        console.error('Delete feedback error:', err);
        res.status(500).json({ success: false, message: 'Server error while deleting feedback' });
    }
});

// Approve Feedback
router.post('/feedbacks/:id/approve', async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) {
            return res.redirect('/admin/feedbacks?error=Feedback not found');
        }
        feedback.status = 'approved';
        feedback.rejectionReason = null;
        await feedback.save();
        res.redirect('/admin/feedbacks?success=Review approved and is now live');
    } catch (err) {
        console.error('Approve feedback error:', err);
        res.redirect('/admin/feedbacks?error=Server error, please try again');
    }
});

// Reject Feedback
router.post('/feedbacks/:id/reject', async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) {
            return res.redirect('/admin/feedbacks?error=Feedback not found');
        }
        feedback.status = 'rejected';
        feedback.rejectionReason = rejectionReason || null;
        await feedback.save();
        res.redirect('/admin/feedbacks?success=Review rejected successfully');
    } catch (err) {
        console.error('Reject feedback error:', err);
        res.redirect('/admin/feedbacks?error=Server error, please try again');
    }
});

// Admin Sales Report
router.get('/sales-report', async (req, res) => {
    try {
        const { from, to, period } = req.query;
        let startDate, endDate;
        const now = new Date();

        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
        } else if (period === 'week') {
            startDate = new Date(now); startDate.setDate(now.getDate() - 7); endDate = now;
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1); endDate = now;
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = now;
        }

        const dateQuery = { createdAt: { $gte: startDate, $lte: endDate } };
        const orders = await Order.find(dateQuery).populate('user', 'name email').sort({ createdAt: -1 });

        let totalRevenue = 0, totalItemsSold = 0;
        const productSalesMap = {};
        const categorySalesMap = {};
        const sellerSalesMap = {};
        const dailySalesMap = {};
        const statusCount = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
        const paymentMethodCount = { jazzcash: 0, bank_transfer: 0, cash_on_delivery: 0 };

        // Populate seller info for products
        const allProducts = await Product.find({}, '_id seller name').populate('seller', 'name');
        const productSellerMap = {};
        allProducts.forEach(p => {
            productSellerMap[p._id.toString()] = p.seller ? p.seller.name : 'Unknown';
        });

        orders.forEach(order => {
            totalRevenue += order.total;
            statusCount[order.status] = (statusCount[order.status] || 0) + 1;
            paymentMethodCount[order.paymentMethod] = (paymentMethodCount[order.paymentMethod] || 0) + 1;

            const day = new Date(order.createdAt).toISOString().split('T')[0];
            if (!dailySalesMap[day]) dailySalesMap[day] = { orders: 0, revenue: 0 };
            dailySalesMap[day].orders++;
            dailySalesMap[day].revenue += order.total;

            order.items.forEach(item => {
                totalItemsSold += item.quantity;
                const pid = item.product.toString();

                if (!productSalesMap[pid]) productSalesMap[pid] = { name: item.name, qty: 0, revenue: 0 };
                productSalesMap[pid].qty += item.quantity;
                productSalesMap[pid].revenue += item.price * item.quantity;

                if (!categorySalesMap[item.category]) categorySalesMap[item.category] = { qty: 0, revenue: 0 };
                categorySalesMap[item.category].qty += item.quantity;
                categorySalesMap[item.category].revenue += item.price * item.quantity;

                const sellerName = productSellerMap[pid] || 'Unknown';
                if (!sellerSalesMap[sellerName]) sellerSalesMap[sellerName] = { orders: 0, revenue: 0 };
                sellerSalesMap[sellerName].revenue += item.price * item.quantity;
            });
            const sellerSet = new Set(order.items.map(i => productSellerMap[i.product.toString()] || 'Unknown'));
            sellerSet.forEach(s => { if (sellerSalesMap[s]) sellerSalesMap[s].orders++; });
        });

        const topProducts = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        const topSellers = Object.entries(sellerSalesMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        const categoryBreakdown = Object.entries(categorySalesMap).map(([cat, d]) => ({ cat, ...d }));

        const dayCount = Math.min(Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1, 30);
        const chartLabels = [], chartRevenue = [], chartOrders = [];
        for (let i = dayCount - 1; i >= 0; i--) {
            const d = new Date(endDate); d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            chartLabels.push(key);
            chartRevenue.push(dailySalesMap[key] ? parseFloat(dailySalesMap[key].revenue.toFixed(2)) : 0);
            chartOrders.push(dailySalesMap[key] ? dailySalesMap[key].orders : 0);
        }

        res.render('admin/sales-report', {
            title: 'Sales Report',
            totalRevenue: totalRevenue.toFixed(2),
            totalOrders: orders.length,
            totalItemsSold,
            avgOrderValue: orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0.00',
            topProducts,
            topSellers,
            categoryBreakdown,
            statusCount,
            paymentMethodCount,
            orders: orders.slice(0, 20),
            chartLabels: JSON.stringify(chartLabels),
            chartRevenue: JSON.stringify(chartRevenue),
            chartOrders: JSON.stringify(chartOrders),
            fromDate: startDate.toISOString().split('T')[0],
            toDate: endDate.toISOString().split('T')[0],
            activePeriod: period || (from ? 'custom' : 'month')
        });
    } catch (err) {
        console.error('Admin sales report error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Server error' });
    }
});

// Expose the creator to be run after DB connects
router.createAdminUser = createAdminUser;

module.exports = router;