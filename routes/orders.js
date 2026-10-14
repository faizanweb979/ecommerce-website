const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { isAuthenticated } = require('../middleware/auth');

// Apply authentication middleware to all order routes
router.use(isAuthenticated);

// View all orders for the current user
router.get('/', async (req, res) => {
    try {
        // Add debugging
        console.log('User ID from session:', req.session.user.id);
        
        // Validate user ID
        if (!req.session.user || !req.session.user.id) {
            console.error('No user ID found in session');
            return res.redirect('/users/login?error=Please log in to view your orders');
        }
        
        const orders = await Order.find({ user: req.session.user.id })
            .sort({ createdAt: -1 });
            
        console.log('Found orders:', orders.length);
        
        res.render('orders/index', {
            title: 'My Orders',
            orders
        });
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to fetch your orders. Please try again later. Error: ' + err.message
        });
    }
});

// View order details
router.get('/:id', async (req, res) => {
    try {
        // Validate user ID
        if (!req.session.user || !req.session.user.id) {
            return res.redirect('/users/login?error=Please log in to view order details');
        }
        
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.session.user.id
        });
        
        if (!order) {
            return res.status(404).render('error', {
                title: 'Not Found',
                message: 'Order not found or you do not have permission to view it.'
            });
        }
        
        res.render('orders/details', {
            title: `Order #${order.orderNumber}`,
            order
        });
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to fetch order details. Please try again later. Error: ' + err.message
        });
    }
});

// Cancel order
router.post('/:id/cancel', async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.session.user.id
        });
        
        if (!order) {
            return res.status(404).render('error', {
                title: 'Not Found',
                message: 'Order not found or you do not have permission to cancel it.'
            });
        }
        
        // Only allow cancellation if order is still pending or processing
        if (order.status !== 'pending' && order.status !== 'processing') {
            return res.redirect(`/my-orders/${order._id}?error=This order cannot be cancelled because it has already been ${order.status}.`);
        }
        
        // Update order status to cancelled
        order.status = 'cancelled';
        await order.save();
        
        res.redirect(`/my-orders/${order._id}?message=Order has been successfully cancelled.`);
    } catch (err) {
        console.error('Error cancelling order:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to cancel order. Please try again later. Error: ' + err.message
        });
    }
});

module.exports = router; 