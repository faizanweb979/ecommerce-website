const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Order = require('../models/Order');

// Get all products
router.get('/', async (req, res) => {
    try {
        let query = {};
        let pageTitle = 'All Products';
        
        // Filter by category if specified
        if (req.query.category) {
            query.category = req.query.category === 'gadgets' ? 'electronics' : req.query.category;
            pageTitle = req.query.category === 'men-clothing' ? "Men's Clothing" :
                        req.query.category === 'women-clothing' ? "Women's Clothing" :
                        req.query.category === 'accessories' ? "Accessories" :
                        req.query.category === 'gadgets' ? "Gadgets" :
                        req.query.category === 'shoes' ? "Shoes" :
                        req.query.category === 'watches' ? "Watches" : "Products";
        }
        
        // Handle search query
        if (req.query.search) {
            const searchTerm = req.query.search.trim();
            const searchRegex = new RegExp(searchTerm, 'i');
            
            // Special case for "men" or "women" search to match their respective categories
            if (searchTerm.toLowerCase() === 'men') {
                query.category = 'men-clothing';
            } else if (searchTerm.toLowerCase() === 'women') {
                query.category = 'women-clothing';
            } else if (searchTerm.toLowerCase() === 'shoes' || searchTerm.toLowerCase() === 'shoe') {
                query.category = 'shoes';
            } else if (searchTerm.toLowerCase() === 'watches' || searchTerm.toLowerCase() === 'watch') {
                query.category = 'watches';
            } else if (searchTerm.toLowerCase() === 'gadgets' || searchTerm.toLowerCase() === 'gadget') {
                query.category = 'electronics';
            } else if (searchTerm.toLowerCase() === 'accessories' || searchTerm.toLowerCase() === 'accessory') {
                query.category = 'accessories';
            } else {
                // Standard search across multiple fields
                query.$or = [
                    { name: searchRegex },
                    { description: searchRegex }
                ];
                
                // Also check if the search term is part of a category name
                if (searchTerm.toLowerCase().includes('men')) {
                    query.$or.push({ category: 'men-clothing' });
                }
                if (searchTerm.toLowerCase().includes('women')) {
                    query.$or.push({ category: 'women-clothing' });
                }
                if (searchTerm.toLowerCase().includes('shoe')) {
                    query.$or.push({ category: 'shoes' });
                }
                if (searchTerm.toLowerCase().includes('watch')) {
                    query.$or.push({ category: 'watches' });
                }
                if (searchTerm.toLowerCase().includes('gadget')) {
                    query.$or.push({ category: 'electronics' });
                }
                if (searchTerm.toLowerCase().includes('accessor')) {
                    query.$or.push({ category: 'accessories' });
                }
            }
            
            pageTitle = `Search Results: ${searchTerm}`;
        }
        
        // Handle featured products filter
        if (req.query.featured === 'true') {
            query.featured = true;
            pageTitle = 'Featured Products';
        }
        
        // Get products with optional filtering — only approved products on storefront
        const products = await Product.find({ ...query, approvalStatus: 'approved' }).sort({ createdAt: -1 });
        
        // Get user's wishlist if logged in
        let userWishlist = [];
        if (req.session && req.session.user) {
            const user = await User.findById(req.session.user.id);
            if (user && user.wishlist) {
                userWishlist = user.wishlist.map(id => id.toString());
            }
        }
        
        res.render('products/index', {
            title: pageTitle,
            products,
            currentCategory: req.query.category === 'gadgets' ? 'gadgets' : (req.query.category || 'all'),
            searchQuery: req.query.search || '',
            userWishlist
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Get product details
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, approvalStatus: 'approved' }).populate('seller', 'name');
        
        if (!product) {
            return res.status(404).render('error', {
                title: 'Product Not Found',
                message: 'The requested product could not be found'
            });
        }
        
        // Get related products from same category
        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: product._id }
        }).limit(4);
        
        // Check if product is in user's wishlist
        let isInWishlist = false;
        let hasPurchased = false;
        let alreadyReviewed = false;

        if (req.session && req.session.user) {
            const user = await User.findById(req.session.user.id);
            if (user && user.wishlist) {
                isInWishlist = user.wishlist.some(id => id.toString() === req.params.id);
            }

            // Check if user purchased this product
            const purchaseOrder = await Order.findOne({
                user: req.session.user.id,
                'items.product': req.params.id,
                status: { $in: ['delivered', 'shipped', 'processing'] }
            });
            hasPurchased = !!purchaseOrder;

            // Check if already reviewed
            if (hasPurchased) {
                const existing = await Feedback.findOne({
                    user: req.session.user.id,
                    product: req.params.id
                });
                alreadyReviewed = !!existing;
            }
        }
        
        // Get only approved feedbacks for this product
        const feedbacks = await Feedback.find({ product: req.params.id, status: 'approved' })
            .populate('user', 'name')
            .sort({ createdAt: -1 });

        // Calculate average rating
        let avgRating = 0;
        if (feedbacks.length > 0) {
            avgRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;
            avgRating = Math.round(avgRating * 10) / 10; // round to 1 decimal
        }
        
        res.render('products/details', {
            title: product.name,
            product,
            relatedProducts,
            isInWishlist,
            feedbacks,
            avgRating,
            reviewCount: feedbacks.length,
            hasPurchased,
            alreadyReviewed
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

module.exports = router; 