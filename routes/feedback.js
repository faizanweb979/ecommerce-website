const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { isAuthenticated } = require('../middleware/auth');

// POST - Submit feedback for a product
router.post('/add', isAuthenticated, async (req, res) => {
    try {
        const { productId, comment, rating } = req.body;
        
        // Validate input
        if (!productId || !comment || comment.trim().length === 0) {
            return res.redirect(`/products/${productId}?error=Please provide a valid comment`);
        }

        const ratingNum = parseInt(rating);
        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.redirect(`/products/${productId}?error=Please select a rating between 1 and 5`);
        }
        
        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect('/products?error=Product not found');
        }

        // EFR-8: Only customers who purchased this product can review it
        const hasPurchased = await Order.findOne({
            user: req.session.user.id,
            'items.product': productId,
            status: { $in: ['delivered', 'shipped', 'processing'] }
        });

        if (!hasPurchased) {
            return res.redirect(`/products/${productId}?error=You can only review products you have purchased`);
        }

        // Prevent duplicate review
        const alreadyReviewed = await Feedback.findOne({
            user: req.session.user.id,
            product: productId
        });
        if (alreadyReviewed) {
            return res.redirect(`/products/${productId}?error=You have already reviewed this product`);
        }
        
        // Create new feedback
        const feedback = new Feedback({
            user: req.session.user.id,
            product: productId,
            rating: ratingNum,
            comment: comment.trim()
        });
        
        await feedback.save();
        
        res.redirect(`/products/${productId}?message=Feedback submitted successfully`);
        
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.redirect(`/products/${req.body.productId || ''}?error=Failed to submit feedback`);
    }
});

// GET - Get all feedback for a specific product (API endpoint)
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        
        const feedbacks = await Feedback.find({ product: productId })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
        
        res.json(feedbacks);
        
    } catch (error) {
        console.error('Error fetching feedbacks:', error);
        res.status(500).json({ error: 'Failed to fetch feedbacks' });
    }
});

module.exports = router;
