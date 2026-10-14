// Custom Handlebars helpers
module.exports = {
    // Equality comparison helper
    eq: function(a, b) {
        return a === b;
    },
    
    // Not equal comparison helper
    ne: function(a, b) {
        return a !== b;
    },
    
    // Greater than comparison helper
    gt: function(a, b) {
        return a > b;
    },
    
    // Less than comparison helper
    lt: function(a, b) {
        return a < b;
    },
    
    // Multiplication helper
    multiply: function(a, b) {
        return (a * b).toFixed(2);
    },
    
    // Format currency
    formatCurrency: function(num) {
        return 'PKR ' + parseFloat(num).toFixed(2);
    },
    
    // Format price (for order pages)
    formatPrice: function(price) {
        return parseFloat(price).toFixed(2);
    },
    
    // Truncate text
    truncate: function(str, len) {
        if (!str) return '';
        if (str.length > len) {
            return str.substring(0, len) + '...';
        }
        return str;
    },
    
    // Format date
    formatDate: function(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },
    
    // Conditional select
    select: function(selected, options) {
        return options.fn(this)
            .replace(new RegExp(' value=\"' + selected + '\"'), '$& selected="selected"');
    },
    
    // Convert category slug to display name
    categoryName: function(category) {
        switch (category) {
            case 'men-clothing':
                return "Men's Clothing";
            case 'women-clothing':
                return "Women's Clothing";
            case 'accessories':
                return "Accessories";
            case 'electronics':
                return "Electronics";
            default:
                return category;
        }
    },
    
    // Encode URI component
    encodeURIComponent: function(str) {
        return encodeURIComponent(str);
    },
    
    // Format date with time
    formatDateTime: function(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // OR logic helper
    or: function() {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    },
    
    // Check if a product is in a user's wishlist
    isInWishlist: function(productId, wishlist) {
        if (!wishlist) return false;
        
        // Convert productId to string for comparison
        const prodId = productId.toString();
        
        // Check if the wishlist contains the productId
        return wishlist.some(item => {
            // Handle both cases: when wishlist is populated with objects or just IDs
            if (typeof item === 'object' && item._id) {
                return item._id.toString() === prodId;
            }
            return item.toString() === prodId;
        });
    },
    
    // Join array elements with a separator
    join: function(array, separator) {
        if (!array || !Array.isArray(array)) return '';
        return array.join(separator || ', ');
    },

    // Add 1 to index (for serial numbers in tables)
    add: function(a, b) {
        return a + b;
    },

    // Render star icons for a given rating (1-5)
    stars: function(rating) {
        const Handlebars = require('handlebars');
        let html = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.floor(rating)) {
                html += '<i class="fas fa-star text-warning"></i>';
            } else if (i - rating < 1 && i - rating > 0) {
                html += '<i class="fas fa-star-half-alt text-warning"></i>';
            } else {
                html += '<i class="far fa-star text-warning"></i>';
            }
        }
        return new Handlebars.SafeString(html);
    }
}; 