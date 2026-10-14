# TrendoTech E-commerce Website 🛍️

## Project Overview

**TrendoTech** is a complete online shopping website that I have developed using Node.js and modern web technologies. This is a full-stack e-commerce platform where customers can purchase products, sellers can sell their products, and administrators can manage everything.

## What This Website Does

### **For Customers**
- Create accounts and login securely
- Browse products in different categories (Men's, Women's, Electronics, Accessories)
- Add products to shopping cart
- Save favorite products in wishlist
- Place online orders and make payments
- Track their orders and view order history

### **For Sellers**
- Upload their products to the website
- Manage inventory and stock levels
- View sales reports and analytics

### **For Administrators**
- Control all products, users, and orders
- Add new products or edit existing ones
- Approve or reject orders
- Write and publish blog posts
- Complete website management

## 🛠️ Technical Details

### **Main Technologies**
- **Node.js** - Backend server development
- **Express.js** - Web application framework
- **MongoDB** - Database for data storage
- **Handlebars** - Dynamic web page templating
- **Bootstrap** - Beautiful and responsive design

### **Security Features**
- Password encryption (bcrypt)
- User session management
- Protected admin routes
- Email verification system

## 📁 Project Structure

```
Trendotech-ecomerce/
├── 📁 models/              # Database models (User, Product, Order, etc.)
├── 📁 routes/              # Route handlers (admin, cart, products, etc.)
├── 📁 views/               # HTML templates (what users see)
├── 📁 public/              # CSS, images, and JavaScript files
├── app.js                  # Main application file
├── package.json            # Project dependencies
└── .env                    # Database and email configuration
```

**Directory Explanation:**
- **models/** - Database schemas and data structure definitions
- **routes/** - URL endpoints and their corresponding functionality
- **views/** - HTML templates and user interface
- **public/** - Static assets (images, CSS, JavaScript)
- **app.js** - Application entry point and server configuration

## 🗄️ Database Information

**Main Data Collections:**

### **Users**
- Name, email, password
- Role: Customer, Seller, or Admin
- Shopping cart and wishlist information

### **Products**
- Product name, description, price
- Category (Men's, Women's, Electronics, Accessories)
- Images and stock information
- Seller information

### **Orders**
- Customer details and ordered items
- Shipping address
- Payment method (JazzCash, Bank Transfer, Cash on Delivery)
- Order status (pending, processing, shipped, delivered)

### **Blogs**
- Title, content, category
- Author information
- Published status

## 🚀 How to Run This Project

### **Prerequisites**
- Node.js installed on computer
- MongoDB database
- Basic terminal/command prompt knowledge

### **Step-by-Step Setup:**

**Step 1:** Navigate to project directory
```bash
cd Trendotech-ecomerce
```

**Step 2:** Install required packages
```bash
npm install
```

**Step 3:** Setup environment file
Create `.env` file with:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
MONGODB_URI=mongodb://127.0.0.1:27017/ecommerce
PORT=8080
```

**Step 4:** Add sample data to database
```bash
npm run seed
```

**Step 5:** Start the application
```bash
npm start
```

**Website will run on:** `http://localhost:8080` 🎉

### **Test Accounts**
- **Admin:** admin@example.com / password123
- **Customer:** user@example.com / password123
- **Seller:** seller@example.com / password123

## 💳 Payment System

**3 Payment Options Available:**
1. **JazzCash** - Mobile wallet payment
2. **Bank Transfer** - Direct bank account transfer with screenshot upload
3. **Cash on Delivery (COD)** - Pay when product is delivered

**Bank Transfer Process:**
- Customer enters their bank details
- Uploads transaction screenshot
- Admin reviews and approves payment
- Order status changes from pending to processing

## 🌟 Key Features Implemented

### **Shopping Experience**
- Product browsing with categories
- Shopping cart with quantity management
- Wishlist functionality
- Order tracking system
- Email notifications

### **Admin Panel**
- Complete product management (add, edit, delete)
- User management (customers and sellers)
- Order management with status updates
- Blog management system
- Category-based filtering
- Payment approval system for bank transfers

### **Security & Authentication**
- Secure password hashing
- Role-based access control (Customer, Seller, Admin)
- Protected admin routes
- Email verification system
- Session management

### **Responsive Design**
- Mobile-friendly interface
- Bootstrap 5 framework
- Modern and clean UI
- Cross-device compatibility

## 📝 Main Website Pages

- **Home Page** (`/`) - Main landing page with featured products
- **Products** (`/products`) - All products with category filtering
- **Shopping Cart** (`/cart`) - Items added for purchase
- **Checkout** (`/cart/checkout`) - Payment and shipping details
- **User Dashboard** (`/users/dashboard`) - User profile and order history
- **Admin Panel** (`/admin`) - Complete website management
- **Seller Dashboard** (`/seller`) - Seller product management
- **Blog Section** (`/blogs`) - Articles and posts
- **Wishlist** (`/wishlist`) - Saved favorite products

## 🎯 Project Achievements

✅ **Complete E-commerce Functionality** - Full online shopping experience
✅ **Multi-user System** - Customers, Sellers, and Admin roles
✅ **Secure Payment System** - Multiple payment options with admin approval
✅ **Responsive Design** - Works on all devices
✅ **Blog Management** - Content management system
✅ **Order Tracking** - Complete order lifecycle management
✅ **Email Integration** - Automated notifications
✅ **Security Implementation** - Protected routes and data encryption

## 🔧 Commands to Run

```bash
npm start          # Start the website
npm run dev        # Development mode with auto-restart
npm run seed       # Add sample data to database
```

## 📞 Contact Information

**Developer:** Zain Ali  
**Email:** zain.here.63@gmail.com  
**Project:** TrendoTech E-commerce Platform

---

**TrendoTech** - Your Complete Online Shopping Solution! 🛍️✨

## 📋 For Examiner

**This project demonstrates:**
- Full-stack web development skills
- Database design and management
- User authentication and authorization
- Payment system integration
- Responsive web design
- Security best practices
- Code organization and structure

**To test the project:**
1. Run `npm install` to install dependencies
2. Setup `.env` file with database and email settings
3. Run `npm run seed` to add sample data
4. Run `npm start` to start the application
5. Visit `http://localhost:3000` to see the website
6. Use test accounts provided above to explore different user roles 