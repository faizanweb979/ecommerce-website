const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectionReason: {
        type: String,
        trim: true,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
feedbackSchema.index({ product: 1, createdAt: -1 });
feedbackSchema.index({ user: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
