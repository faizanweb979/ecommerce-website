const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const User = require('../models/User');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for blog image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../public/uploads/blogs');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'blog-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check if file is an image
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Get all blogs
router.get('/', async (req, res) => {
    try {
        let query = { isPublished: true };
        let pageTitle = 'All Blog Posts';
        
        // Filter by category if specified
        if (req.query.category) {
            query.category = req.query.category;
            pageTitle = `${req.query.category.charAt(0).toUpperCase() + req.query.category.slice(1)} Blogs`;
        }
        
        // Handle search query
        if (req.query.search) {
            const searchTerm = req.query.search.trim();
            const searchRegex = new RegExp(searchTerm, 'i');
            
            query.$or = [
                { title: searchRegex },
                { summary: searchRegex },
                { content: searchRegex },
                { tags: searchRegex }
            ];
            
            pageTitle = `Search Results: ${searchTerm}`;
        }
        
        // Get blogs with optional filtering
        const blogs = await Blog.find(query)
            .populate('author', 'name')
            .sort({ createdAt: -1 });
        
        // Get categories for the sidebar
        const categories = await Blog.distinct('category');
        
        // Get recent posts
        const recentPosts = await Blog.find({ isPublished: true })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title createdAt');
        
        res.render('blogs/index', {
            title: pageTitle,
            blogs,
            categories,
            recentPosts,
            currentCategory: req.query.category || 'all',
            searchQuery: req.query.search || ''
        });
    } catch (err) {
        console.error('Blogs error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Get blog details
router.get('/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id)
            .populate('author', 'name');
        
        if (!blog || !blog.isPublished) {
            return res.status(404).render('error', {
                title: 'Blog Not Found',
                message: 'The requested blog post could not be found'
            });
        }
        
        // Check if author exists
        if (!blog.author) {
            return res.status(500).render('error', {
                title: 'Error',
                message: 'Blog author information is missing'
            });
        }
        
        // Increment view count
        blog.views = (blog.views || 0) + 1;
        await blog.save();
        
        // Get categories for the sidebar
        const categories = await Blog.distinct('category');
        
        // Get recent posts
        const recentPosts = await Blog.find({ 
            isPublished: true,
            _id: { $ne: blog._id } 
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title createdAt');
        
        // Get related posts from the same category
        const relatedPosts = await Blog.find({
            category: blog.category,
            _id: { $ne: blog._id },
            isPublished: true
        })
            .sort({ createdAt: -1 })
            .limit(3)
            .populate('author', 'name');
        
        // Get current URL for sharing
        const currentUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        
        res.render('blogs/details', {
            title: blog.title,
            blog,
            categories,
            recentPosts,
            relatedPosts,
            currentUrl
        });
    } catch (err) {
        console.error('Blog details error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Admin routes for blog management - these could be moved to admin.js later
// Add blog form
router.get('/admin/add', isAuthenticated, isAdmin, (req, res) => {
    res.render('blogs/admin/add', {
        title: 'Add New Blog Post'
    });
});

// Create blog
router.post('/admin/add', isAuthenticated, isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { title, content, summary, category, tags } = req.body;
        
        // Check if image was uploaded
        if (!req.file) {
            return res.render('blogs/admin/add', {
                title: 'Add New Blog Post',
                formError: 'Please upload an image for the blog post'
            });
        }
        
        // Create image URL path
        const imageUrl = `/uploads/blogs/${req.file.filename}`;
        
        // Create new blog
        const newBlog = new Blog({
            title,
            content,
            summary,
            category,
            imageUrl,
            author: req.session.user.id,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : []
        });
        
        await newBlog.save();
        
        res.redirect('/blogs?message=Blog post created successfully');
    } catch (err) {
        console.error('Add blog error:', err);
        
        // Delete uploaded file if there was an error
        if (req.file) {
            const filePath = path.join(__dirname, '../public/uploads/blogs', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        res.render('blogs/admin/add', {
            title: 'Add New Blog Post',
            formError: 'Server error, please try again'
        });
    }
});

// Edit blog form
router.get('/admin/edit/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).render('error', {
                title: 'Blog Not Found',
                message: 'The requested blog post could not be found'
            });
        }
        
        res.render('blogs/admin/edit', {
            title: 'Edit Blog Post',
            blog
        });
    } catch (err) {
        console.error('Edit blog form error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Update blog
router.post('/admin/edit/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { title, content, summary, category, imageUrl, tags, isPublished } = req.body;
        
        const updateData = {
            title,
            content,
            summary,
            category,
            imageUrl,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            isPublished: isPublished === 'on',
            updatedAt: new Date()
        };
        
        const blog = await Blog.findByIdAndUpdate(req.params.id, updateData, { new: true });
        
        if (!blog) {
            return res.status(404).render('error', {
                title: 'Blog Not Found',
                message: 'The requested blog post could not be found'
            });
        }
        
        res.redirect('/admin/blogs?message=Blog post updated successfully');
    } catch (err) {
        console.error('Update blog error:', err);
        res.redirect(`/blogs/admin/edit/${req.params.id}?error=Server error, please try again`);
    }
});

// Toggle blog publish status
router.post('/admin/toggle-publish/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.redirect('/admin/blogs?error=Blog post not found');
        }
        
        blog.isPublished = !blog.isPublished;
        blog.updatedAt = new Date();
        await blog.save();
        
        const status = blog.isPublished ? 'published' : 'unpublished';
        res.redirect(`/admin/blogs?message=Blog post ${status} successfully`);
    } catch (err) {
        console.error('Toggle publish error:', err);
        res.redirect('/admin/blogs?error=Server error, please try again');
    }
});

// Delete blog
router.post('/admin/delete/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const blog = await Blog.findByIdAndDelete(req.params.id);
        
        if (!blog) {
            return res.redirect('/admin/blogs?error=Blog post not found');
        }
        
        res.redirect('/admin/blogs?message=Blog post deleted successfully');
    } catch (err) {
        console.error('Delete blog error:', err);
        res.redirect('/admin/blogs?error=Server error, please try again');
    }
});

// Script to create sample blog posts if none exist
const createSampleBlogs = async () => {
    try {
        // Check if any blogs exist
        const blogCount = await Blog.countDocuments();
        
        if (blogCount === 0) {
            console.log('No blogs found, creating sample blog posts...');
            
            // Find admin user
            const adminUser = await User.findOne({ role: 'admin' });
            
            if (!adminUser) {
                console.log('No admin user found. Sample blogs will not be created.');
                return;
            }
            
            // Sample blog data
            const sampleBlogs = [
                {
                    title: 'Summer Fashion Trends 2023',
                    summary: 'Discover the hottest fashion trends for Summer 2023. From bold colors to lightweight fabrics, we cover everything you need to stay stylish this season.',
                    content: `
                        <h2>Summer Fashion Trends 2023</h2>
                        <p>Summer is here, and it's time to refresh your wardrobe with the latest trends! This season is all about bold colors, comfortable fabrics, and statement accessories.</p>
                        
                        <h3>Vibrant Colors</h3>
                        <p>This summer is all about embracing vibrant colors. Think electric blues, hot pinks, and sunny yellows. Don't be afraid to mix and match different colors for a playful look.</p>
                        
                        <h3>Lightweight Fabrics</h3>
                        <p>With rising temperatures, lightweight fabrics like linen and cotton are essential. Look for breathable materials that will keep you cool even on the hottest days.</p>
                        
                        <h3>Statement Accessories</h3>
                        <p>Complete your summer look with oversized hats, colorful sunglasses, and woven bags. These accessories not only add style but also provide practical protection from the sun.</p>
                        
                        <h3>Sustainable Fashion</h3>
                        <p>Sustainability continues to be a major trend. Look for brands that use eco-friendly materials and ethical production methods. Thrifting and upcycling are also great ways to stay fashionable while being kind to the planet.</p>
                    `,
                    imageUrl: 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03',
                    category: 'fashion',
                    tags: ['summer', 'fashion', 'trends', '2023'],
                    author: adminUser._id
                },
                {
                    title: 'Ultimate Guide to Smart Home Technology',
                    summary: 'Explore the latest smart home technologies that can make your life easier and more convenient. From voice assistants to automated lighting systems.',
                    content: `
                        <h2>Transform Your Home with Smart Technology</h2>
                        <p>Smart home technology has come a long way in recent years, making it more accessible and user-friendly than ever before. Here's your comprehensive guide to getting started.</p>
                        
                        <h3>Voice Assistants</h3>
                        <p>Voice assistants like Amazon Alexa, Google Assistant, and Apple HomeKit serve as the central hub for your smart home. They can control other devices, answer questions, and even help you shop online.</p>
                        
                        <h3>Smart Lighting</h3>
                        <p>Smart lighting systems allow you to control your lights remotely, set schedules, and even change colors. Some popular options include Philips Hue, LIFX, and Wyze.</p>
                        
                        <h3>Security Systems</h3>
                        <p>Keep your home safe with smart security cameras, doorbell cameras, and alarm systems. Many of these devices offer features like motion detection, two-way audio, and cloud storage for footage.</p>
                        
                        <h3>Climate Control</h3>
                        <p>Smart thermostats learn your preferences and adjust the temperature accordingly, helping you save energy and money. Look for models that integrate with your voice assistant for seamless control.</p>
                    `,
                    imageUrl: 'https://www.pexels.com/photo/black-and-white-laptop-computer-on-brown-wooden-desk-356056/',
                    category: 'technology',
                    tags: ['smart home', 'technology', 'gadgets', 'automation'],
                    author: adminUser._id
                },
                {
                    title: 'Beginner\'s Guide to Digital Marketing for Small Businesses',
                    summary: 'Learn the fundamentals of digital marketing that can help your small business grow. Covers strategies for social media, email marketing, and SEO.',
                    content: `
                        <h2>Digital Marketing 101 for Small Businesses</h2>
                        <p>In today's digital age, having a strong online presence is essential for small businesses. This guide will walk you through the basics of digital marketing to help your business thrive.</p>
                        
                        <h3>Social Media Marketing</h3>
                        <p>Choose the right platforms for your business and create a consistent posting schedule. Focus on creating valuable content that engages your audience rather than just promotional material.</p>
                        
                        <h3>Email Marketing</h3>
                        <p>Build an email list and send regular newsletters to keep your customers informed about new products, promotions, and company news. Personalize your emails whenever possible for better engagement.</p>
                        
                        <h3>Search Engine Optimization (SEO)</h3>
                        <p>Optimize your website to rank higher in search engine results. Focus on creating quality content, using relevant keywords, and building backlinks from reputable sites.</p>
                        
                        <h3>Content Marketing</h3>
                        <p>Create valuable content like blog posts, videos, and infographics that solve problems for your target audience. This establishes your business as an authority in your industry and drives organic traffic to your site.</p>
                    `,
                    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
                    category: 'business',
                    tags: ['marketing', 'digital marketing', 'small business', 'SEO'],
                    author: adminUser._id
                },
                {
                    title: 'Mindfulness Practices for Busy Professionals',
                    summary: 'Discover simple mindfulness techniques that can be incorporated into your busy schedule to reduce stress and improve focus.',
                    content: `
                        <h2>Finding Peace in a Busy World</h2>
                        <p>In our fast-paced world, finding moments of peace and mindfulness can be challenging, especially for busy professionals. Here are some simple practices that can help you stay grounded throughout your day.</p>
                        
                        <h3>Morning Meditation</h3>
                        <p>Start your day with just 5-10 minutes of meditation. Sit comfortably, focus on your breath, and let thoughts come and go without judgment. This sets a calm tone for the rest of your day.</p>
                        
                        <h3>Mindful Breathing</h3>
                        <p>Throughout the day, take short breaks to focus on your breath. Inhale deeply for a count of four, hold for a count of four, and exhale for a count of four. This can be done anywhere, even during meetings or commutes.</p>
                        
                        <h3>Gratitude Practice</h3>
                        <p>End your day by reflecting on three things you're grateful for. This shifts your focus from what went wrong to what went right, promoting a positive mindset.</p>
                        
                        <h3>Digital Detox</h3>
                        <p>Set aside time each day to disconnect from digital devices. Whether it's during meals, before bed, or first thing in the morning, this break from constant stimulation allows your mind to rest and reset.</p>
                    `,
                    imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773',
                    category: 'lifestyle',
                    tags: ['mindfulness', 'stress relief', 'wellness', 'mental health'],
                    author: adminUser._id
                },
                {
                    title: 'The Art of Sustainable Living: Simple Changes for a Greener Future',
                    summary: 'Learn practical ways to reduce your environmental footprint with simple lifestyle changes that make a real difference.',
                    content: `
                        <h2>Making a Difference, One Step at a Time</h2>
                        <p>Sustainable living doesn't require drastic changes to your lifestyle. Small, consistent actions can create a significant positive impact on our environment. Here's how you can start your journey toward a more sustainable future.</p>
                        
                        <h3>Reduce, Reuse, Recycle</h3>
                        <p>The classic three R's remain the foundation of sustainable living. Focus on reducing consumption, finding creative ways to reuse items, and properly recycling materials. Consider buying only what you need and choosing quality items that last longer.</p>
                        
                        <h3>Energy Efficiency at Home</h3>
                        <p>Simple changes like switching to LED bulbs, unplugging electronics when not in use, and using programmable thermostats can significantly reduce your energy consumption. Consider investing in energy-efficient appliances when it's time to replace old ones.</p>
                        
                        <h3>Sustainable Transportation</h3>
                        <p>Walk, bike, or use public transportation when possible. If you need a car, consider carpooling or investing in a hybrid or electric vehicle. Even combining errands into one trip can reduce your carbon footprint.</p>
                        
                        <h3>Conscious Consumption</h3>
                        <p>Support businesses that prioritize sustainability. Choose locally-sourced products, buy from companies with ethical practices, and consider the lifecycle of products before purchasing. Quality over quantity is key.</p>
                    `,
                    imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                    category: 'lifestyle',
                    tags: ['sustainability', 'environment', 'green living', 'eco-friendly'],
                    author: adminUser._id
                },
                {
                    title: 'Mastering Remote Work: Productivity Tips for the Digital Age',
                    summary: 'Discover proven strategies to stay productive, maintain work-life balance, and excel in remote work environments.',
                    content: `
                        <h2>Thriving in the Remote Work Revolution</h2>
                        <p>Remote work has become the new normal for millions of professionals worldwide. While it offers flexibility and freedom, it also presents unique challenges. Here are essential strategies to help you master remote work and boost your productivity.</p>
                        
                        <h3>Create a Dedicated Workspace</h3>
                        <p>Establish a specific area in your home exclusively for work. This helps create a mental boundary between work and personal life. Invest in ergonomic furniture and ensure good lighting to maintain comfort and focus throughout the day.</p>
                        
                        <h3>Establish Clear Boundaries</h3>
                        <p>Set specific work hours and communicate them to your family and colleagues. Use different devices or accounts for work and personal activities when possible. Learn to "leave the office" even when your office is at home.</p>
                        
                        <h3>Master Digital Communication</h3>
                        <p>Become proficient with video conferencing tools, project management software, and instant messaging platforms. Over-communicate rather than under-communicate, and always confirm important decisions in writing.</p>
                        
                        <h3>Maintain Social Connections</h3>
                        <p>Combat isolation by scheduling regular video calls with colleagues, participating in virtual team activities, and maintaining professional relationships. Consider working from cafes or co-working spaces occasionally for a change of environment.</p>
                        
                        <h3>Focus on Results, Not Hours</h3>
                        <p>Shift your mindset from time-based to outcome-based work. Set clear daily and weekly goals, track your progress, and celebrate achievements. This approach leads to better productivity and job satisfaction.</p>
                    `,
                    imageUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                    category: 'business',
                    tags: ['remote work', 'productivity', 'work from home', 'digital workplace'],
                    author: adminUser._id
                }
            ];
            
            // Insert sample blogs
            await Blog.insertMany(sampleBlogs);
            
            console.log('Sample blog posts created successfully!');
        }
    } catch (err) {
        console.error('Error creating sample blogs:', err);
    }
};

// Run the seed script
createSampleBlogs();

module.exports = router; 