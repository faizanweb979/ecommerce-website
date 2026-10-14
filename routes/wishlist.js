const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const { isAuthenticated } = require('../middleware/auth');

// Apply authentication middleware to all wishlist routes
router.use(isAuthenticated);

// Get Wishlist page
router.get('/', async (req, res) => {
    try {
        // Find user and populate wishlist with product information
        const user = await User.findById(req.session.user.id)
            .populate('wishlist');

        res.render('wishlist/index', {
            title: 'My Wishlist',
            wishlistItems: user.wishlist || []
        });
    } catch (err) {
        console.error('Wishlist error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Add item to wishlist (AJAX)
router.post('/add/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.session.user.id;

        // Find user
        const user = await User.findById(userId);
        
        // Check if product is already in wishlist
        if (user.wishlist.includes(productId)) {
            return res.json({
                success: true,
                message: 'Product is already in your wishlist',
                inWishlist: true
            });
        }
        
        // Add product to wishlist
        user.wishlist.push(productId);
        await user.save();
        
        // Update wishlist count in session
        req.session.wishlistCount = user.wishlist.length;
        
        res.json({
            success: true,
            message: 'Product added to your wishlist',
            wishlistCount: user.wishlist.length,
            inWishlist: true
        });
    } catch (err) {
        console.error('Add to wishlist error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error, please try again later'
        });
    }
});

// Remove item from wishlist (AJAX)
router.delete('/remove/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.session.user.id;
        
        // Remove product from wishlist
        await User.findByIdAndUpdate(userId, {
            $pull: { wishlist: productId }
        });
        
        // Get updated wishlist count
        const user = await User.findById(userId);
        req.session.wishlistCount = user.wishlist.length;
        
        res.json({
            success: true,
            message: 'Product removed from your wishlist',
            wishlistCount: user.wishlist.length,
            inWishlist: false
        });
    } catch (err) {
        console.error('Remove from wishlist error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error, please try again later'
        });
    }
});

// Remove item from wishlist (Form submission)
router.post('/remove/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.session.user.id;
        
        // Remove product from wishlist
        await User.findByIdAndUpdate(userId, {
            $pull: { wishlist: productId }
        });
        
        res.redirect('/wishlist?message=Item removed from wishlist');
    } catch (err) {
        console.error('Remove from wishlist error:', err);
        res.redirect('/wishlist?error=Server error, please try again');
    }
});

module.exports = router; 