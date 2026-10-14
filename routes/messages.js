const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Product = require('../models/Product');
const { isAuthenticated } = require('../middleware/auth');
const { sendMail } = require('../mailer');

// POST — Customer sends message to seller from product page
router.post('/send', isAuthenticated, async (req, res) => {
    try {
        const { productId, message } = req.body;

        if (!productId || !message || message.trim().length === 0) {
            return res.redirect(`/products/${productId}?error=Please enter a message`);
        }

        const product = await Product.findById(productId).populate('seller', 'name email');
        if (!product) {
            return res.redirect('/products?error=Product not found');
        }

        if (!product.seller) {
            return res.redirect(`/products/${productId}?error=This product has no seller to contact`);
        }

        // Prevent seller from messaging themselves
        if (product.seller._id.toString() === req.session.user.id) {
            return res.redirect(`/products/${productId}?error=You cannot message yourself`);
        }

        const newMessage = new Message({
            sender: req.session.user.id,
            seller: product.seller._id,
            product: productId,
            message: message.trim()
        });

        await newMessage.save();

        // Notify seller via email (non-blocking)
        sendMail({
            to: product.seller.email,
            subject: `New message about your product: ${product.name}`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
                    <h2 style="background:#198754;color:#fff;padding:16px;margin:0;">New Customer Message</h2>
                    <div style="padding:20px;">
                        <p><strong>Product:</strong> ${product.name}</p>
                        <p><strong>From:</strong> ${req.session.user.name} (${req.session.user.email})</p>
                        <p><strong>Message:</strong></p>
                        <div style="background:#f8f9fa;padding:12px;border-radius:6px;">
                            ${message.trim()}
                        </div>
                        <p style="margin-top:16px;color:#6c757d;font-size:0.9em;">
                            Login to your seller dashboard to view and reply to this message.
                        </p>
                    </div>
                </div>`
        });

        res.redirect(`/products/${productId}?message=Your message has been sent to the seller`);

    } catch (err) {
        console.error('Send message error:', err);
        res.redirect(`/products/${req.body.productId || ''}?error=Failed to send message`);
    }
});

module.exports = router;
