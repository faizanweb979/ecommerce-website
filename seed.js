const mongoose = require('mongoose');
const Product = require('./models/Product');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ecommerce', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected for seeding'))
.catch(err => {
    console.log('MongoDB Connection Error:', err);
    process.exit(1);
});

// Dummy products data
const products = [
    // Men's Clothing
    {
        name: "Classic Fit Dress Shirt",
        description: "A timeless classic fit dress shirt with a comfortable feel. Perfect for formal occasions or office wear.",
        price: 4900,
        category: "men-clothing",
        imageUrl: "/images/men shirts/pexels-blitzboy-1040945.jpg",
        inStock: true,
        featured: true
    },
    {
        name: "Slim Fit Jeans",
        description: "Stylish slim fit jeans made from premium denim. Modern look with excellent comfort.",
        price: 5900,
        category: "men-clothing",
        imageUrl: "/images/men pents/pexels-alfaiz-virasat-633888-31039548.jpg",
        inStock: true,
        featured: false
    },
    {
        name: "Casual Cotton T-Shirt",
        description: "Soft and comfortable 100% cotton t-shirt. Perfect for everyday casual wear.",
        price: 2499,
        category: "men-clothing",
        imageUrl: "/images/men shirts/pexels-yogendras31-1760900.jpg",
        inStock: true,
        featured: false
    },
    {
        name: "Wool Blend Blazer",
        description: "Elegant wool blend blazer ideal for professional settings or formal events.",
        price: 1299,
        category: "men-clothing",
        imageUrl: "/images/men shirts/pexels-sumit-chahar-805247-3731202.jpg",
        inStock: true,
        featured: true
    },
    {
        name: "Winter Parka Jacket",
        description: "Warm and durable winter parka with waterproof exterior and cozy insulation.",
        price: 1999,
        category: "men-clothing",
        imageUrl: "/images/men shirts/pexels-yogendras31-1726710.jpg",
        inStock: true,
        featured: false
    },

    // Women's Clothing
    {
        name: "Floral Print Dress",
        description: "Beautiful floral print dress perfect for spring and summer occasions.",
        price: 799,
        category: "women-clothing",
        imageUrl: "/images/women dress/pexels-dhanno-19292779.jpg",
        inStock: true,
        featured: true
    },
    {
        name: "High-Waist Skinny Jeans",
        description: "Flattering high-waist skinny jeans that provide comfort and style.",
        price: 699,
        category: "women-clothing",
        imageUrl: "/images/women dress/pexels-dhanno-20420559.jpg",
        inStock: true,
        featured: false
    },
    {
        name: "Cashmere Sweater",
        description: "Luxuriously soft cashmere sweater that provides warmth without bulk.",
        price: 1299,
        category: "women-clothing",
        imageUrl: "/images/women dress/pexels-dhanno-25184944.jpg",
        inStock: true,
        featured: false
    },
    {
        name: "Business Blazer",
        description: "Professional-looking blazer perfect for the office or business meetings.",
        price: 999,
        category: "women-clothing",
        imageUrl: "/images/women dress/pexels-dhanno-27603235.jpg",
        inStock: true,
        featured: true
    },
    {
        name: "Summer Maxi Dress",
        description: "Lightweight and flowy maxi dress perfect for hot summer days.",
        price: 899,
        category: "women-clothing",
        imageUrl: "/images/women dress/pexels-dhanno-29413650.jpg",
        inStock: true,
        featured: false
    },

    // Accessories
    {
        name: "Leather Wallet",
        description: "Genuine leather wallet with multiple card slots and compartments.",
        price: 399,
        category: "accessories",
        imageUrl: "/images/women bags/pexels-ezz7-925402.jpg",
        inStock: true,
        featured: false
    },
    {
        name: "Aviator Sunglasses",
        description: "Classic aviator sunglasses with UV protection and metal frame.",
        price: 899,
        category: "accessories",
        imageUrl: "/images/men glasses/pexels-gonzalogfg-8570581.jpg",
        inStock: true,
        featured: true
    },
    {
        name: "Silk Scarf",
        description: "Elegant silk scarf with a beautiful print, perfect to accessorize any outfit.",
        price: 499,
        category: "accessories",
        imageUrl: "/images/women glases/portrait-stylish-beautiful-young-woman-with-sunglasses.jpg",
        inStock: true,
        featured: false
    },
    {
        name: "Leather Belt",
        description: "High-quality leather belt with a classic buckle design.",
        price: 349,
        category: "accessories",
        imageUrl: "/images/men watches/pexels-valon2000-2463012.jpg",
        inStock: true,
        featured: false
    },

    // Electronics
    {
        name: "Wireless Headphones",
        description: "High-quality wireless headphones with noise cancellation and long battery life.",
        price: 1999,
        category: "electronics",
        imageUrl: "/images/electronics/headphone 1.jpg",
        inStock: true,
        featured: true
    },
    {
        name: "Smartphone",
        description: "Latest smartphone with advanced camera, fast processor, and stunning display.",
        price: 799,
        category: "electronics",
        imageUrl: "/images/electronics/daniel-romero-COvwQWG2XMc-unsplash.jpg",
        inStock: true,
        featured: true
    },
    {
        name: "Smart Watch",
        description: "Feature-rich smart watch with health tracking, notifications, and customizable watch faces.",
        price: 2999,
        category: "electronics",
        imageUrl: "/images/electronics/smart watch 1.jpg",
        inStock: true,
        featured: false
    },
    {
        name: "Bluetooth Speaker",
        description: "Portable Bluetooth speaker with impressive sound quality and water resistance.",
        price: 1299,
        category: "electronics",
        imageUrl: "/images/electronics/speaker 1.jpg",
        inStock: true,
        featured: false
    },
    {
        name: "Laptop",
        description: "Powerful laptop with high-performance specs perfect for work and entertainment.",
        price: 1299,
        category: "electronics",
        imageUrl: "/images/electronics/camera 1.jpg",
        inStock: true,
        featured: true
    }
];

// Seed the database
const seedDB = async () => {
    try {
        // Delete all existing products
        await Product.deleteMany({});
        console.log('Products deleted');

        // Insert new products with approved status
        const approvedProducts = products.map(p => ({ ...p, approvalStatus: 'approved' }));
        await Product.insertMany(approvedProducts);
        console.log('Products seeded successfully');

        // Close connection
        mongoose.connection.close();
    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
};

// Run the seed function
seedDB(); 