const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { isAuthenticated, redirectBasedOnRole } = require('../middleware/auth');

// Setup nodemailer transporter
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Gmail SMTP
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    transporter.verify((error) => {
        if (error) {
            console.error('Nodemailer transporter verification failed:', error.message);
        } else {
            console.log('Nodemailer transporter is ready to send emails');
        }
    });
} else {
    // Fallback: log emails to console in development when credentials are missing
    transporter = nodemailer.createTransport({ jsonTransport: true });
    console.warn('EMAIL_USER/EMAIL_PASS not set. Emails will be output to console instead of being sent.');
}

// Display signup form
router.get('/signup', redirectBasedOnRole, (req, res) => {
    res.render('users/signup', {
        title: 'Create an Account',
        formError: req.query.error || null
    });
});

// Process signup form
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, confirmPassword, role } = req.body;
        
        // Validation
        if (!name || !email || !password || !confirmPassword) {
            return res.redirect('/users/signup?error=All fields are required');
        }
        
        if (password !== confirmPassword) {
            return res.redirect('/users/signup?error=Passwords do not match');
        }
        
        // SRS EFR-1: min 8 chars, alphanumeric + at least one special character
        const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.redirect('/users/signup?error=Password must be at least 8 characters and include letters, numbers, and a special character');
        }
        
        // Validate role (only allow user or seller through form)
        const validRole = role === 'seller' ? 'seller' : 'user';
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.redirect('/users/signup?error=Email already in use');
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create email verification token
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');

        // Create new user (unverified)
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: validRole,
            isEmailVerified: false,
            emailVerificationToken
        });
        
        await newUser.save();

        // Build verification URL using BASE_URL from env
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const verifyUrl = `${baseUrl}/verify-email?token=${emailVerificationToken}&email=${encodeURIComponent(email)}`;
        console.log('Email verification link:', verifyUrl);

        let emailSent = false;
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: email,
                subject: 'Verify your email address',
                html: `
                    <p>Hi ${name},</p>
                    <p>Thanks for signing up. Please verify your email address by clicking the link below:</p>
                    <p><a href="${verifyUrl}" style="color:blue; text-decoration:underline;">Verify Email</a></p>
                    <p>If you did not create an account, you can ignore this email.</p>
                `
            });
            emailSent = true;
        } catch (emailErr) {
            console.error('Verification email failed to send:', emailErr.message);
            console.log('Manual verification link for', email, ':', verifyUrl);
        }

        // Always redirect to login — user must verify email manually before logging in
        // In development, verification link is printed to console
        if (!emailSent) {
            console.log('=== VERIFY THIS ACCOUNT MANUALLY ===');
            console.log('Verification link:', verifyUrl);
            console.log('=====================================');
        }

        return res.redirect('/users/login?message=Account created! Please check your email and verify your account before logging in.');
        
    } catch (err) {
        console.error('Signup error:', err);
        res.redirect('/users/signup?error=Server error, please try again');
    }
});

// Display login form
router.get('/login', redirectBasedOnRole, (req, res) => {
    res.render('users/login', {
        title: 'Login to Your Account',
        formError: req.query.error || null
    });
});

// Process login form
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.redirect('/users/login?error=Email and password are required');
        }
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.redirect('/users/login?error=Invalid email or password');
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.redirect('/users/login?error=Invalid email or password');
        }
        
        // Fetch fresh user data from DB to ensure isEmailVerified is up to date
        const freshUser = await User.findById(user._id);

        // Create session — allow login even if email not verified
        req.session.user = {
            id: freshUser._id,
            name: freshUser.name,
            email: freshUser.email,
            role: freshUser.role,
            isEmailVerified: freshUser.isEmailVerified === true
        };

        // Show one-time warning after login if email not verified
        if (!req.session.user.isEmailVerified) {
            req.session.showEmailWarning = true;
        }
        
        // Redirect based on role
        switch (freshUser.role) {
            case 'admin':
                return res.redirect('/admin/dashboard');
            case 'seller':
                return res.redirect('/seller/dashboard');
            default:
                return res.redirect('/');
        }
        
    } catch (err) {
        console.error('Login error:', err);
        res.redirect('/users/login?error=Server error, please try again');
    }
});

// User Profile Page
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id).select('-password');
        
        if (!user) {
            req.session.destroy();
            return res.redirect('/users/login?error=User not found');
        }
        
        res.render('users/profile', {
            title: 'Your Profile',
            user: user,
            formError: req.query.error || null,
            formSuccess: req.query.success || null
        });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Server error, please try again later'
        });
    }
});

// Update Profile
router.post('/profile/update', isAuthenticated, async (req, res) => {
    try {
        const { name, email } = req.body;
        
        // Validation
        if (!name || !email) {
            return res.redirect('/users/profile?error=Name and email are required');
        }
        
        // Check if email is already in use (by another user)
        const existingUser = await User.findOne({ email, _id: { $ne: req.session.user.id } });
        if (existingUser) {
            return res.redirect('/users/profile?error=Email already in use');
        }
        
        // Update user
        const user = await User.findByIdAndUpdate(
            req.session.user.id,
            { name, email },
            { new: true }
        );
        
        // Update session
        req.session.user.name = user.name;
        req.session.user.email = user.email;
        
        res.redirect('/users/profile?success=Profile updated successfully');
    } catch (err) {
        console.error('Profile update error:', err);
        res.redirect('/users/profile?error=Server error, please try again');
    }
});

// Change Password
router.post('/profile/password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.redirect('/users/profile?error=All password fields are required');
        }
        
        if (newPassword !== confirmPassword) {
            return res.redirect('/users/profile?error=New passwords do not match');
        }
        
        // SRS EFR-1: min 8 chars, alphanumeric + at least one special character
        const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.redirect('/users/profile?error=Password must be at least 8 characters and include letters, numbers, and a special character');
        }
        
        // Find user
        const user = await User.findById(req.session.user.id);
        
        // Check current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.redirect('/users/profile?error=Current password is incorrect');
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password
        user.password = hashedPassword;
        await user.save();
        
        res.redirect('/users/profile?success=Password changed successfully');
    } catch (err) {
        console.error('Password change error:', err);
        res.redirect('/users/profile?error=Server error, please try again');
    }
});

// Resend verification email
router.get('/resend-verification', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.redirect('/users/login?error=Email is required');

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.redirect('/users/login?error=No account found with that email');
        if (user.isEmailVerified) return res.redirect('/users/login?message=Email already verified. Please log in.');

        // Generate new token
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = emailVerificationToken;
        await user.save();

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const verifyUrl = `${baseUrl}/verify-email?token=${emailVerificationToken}&email=${encodeURIComponent(email)}`;
        console.log('Resend verification link:', verifyUrl);

        let emailSent = false;
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: email,
                subject: 'Verify your email address',
                html: `<p>Hi ${user.name},</p><p>Click below to verify your email:</p><p><a href="${verifyUrl}">Verify Email</a></p>`
            });
            emailSent = true;
        } catch (err) {
            console.error('Resend email failed:', err.message);
        }

        const isLocalhost = !process.env.BASE_URL || process.env.BASE_URL.includes('localhost') || process.env.BASE_URL.includes('127.0.0.1');
        if (!emailSent || isLocalhost) {
            return res.redirect(verifyUrl);
        }

        return res.redirect('/users/login?message=Verification email resent. Please check your inbox.');
    } catch (err) {
        console.error('Resend verification error:', err);
        res.redirect('/users/login?error=Server error, please try again');
    }
});

// ── Forgot Password ──────────────────────────────────────────────

// Show forgot password form
router.get('/forgot-password', (req, res) => {
    res.render('users/forgot-password', {
        title: 'Forgot Password',
        formError: req.query.error || null,
        formSuccess: req.query.success || null
    });
});

// Process forgot password — send reset email
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.render('users/forgot-password', {
                title: 'Forgot Password',
                formError: 'Email is required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        // Always show success to prevent email enumeration
        const successMsg = 'If an account with that email exists, a password reset link has been sent.';

        if (!user) {
            return res.render('users/forgot-password', { title: 'Forgot Password', formSuccess: successMsg });
        }

        // Generate secure token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
        await user.save();

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const resetUrl = `${baseUrl}/users/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
        console.log('Password reset link:', resetUrl);

        const { forgotPasswordEmail } = require('../mailer');
        const { subject, html } = forgotPasswordEmail(user.name, resetUrl);

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: user.email,
                subject,
                html
            });
        } catch (emailErr) {
            console.error('Reset email failed:', emailErr.message);
            console.log('=== MANUAL RESET LINK ===');
            console.log(resetUrl);
            console.log('=========================');
        }

        return res.render('users/forgot-password', { title: 'Forgot Password', formSuccess: successMsg });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.render('users/forgot-password', { title: 'Forgot Password', formError: 'Server error, please try again' });
    }
});

// Show reset password form
router.get('/reset-password', async (req, res) => {
    try {
        const { token, email } = req.query;
        if (!token || !email) {
            return res.redirect('/users/forgot-password?error=Invalid reset link');
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.redirect('/users/forgot-password?error=Reset link is invalid or has expired. Please request a new one.');
        }

        res.render('users/reset-password', {
            title: 'Reset Password',
            token,
            email,
            formError: req.query.error || null
        });
    } catch (err) {
        console.error('Reset password GET error:', err);
        res.redirect('/users/forgot-password?error=Server error, please try again');
    }
});

// Process new password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, email, password, confirmPassword } = req.body;

        if (!token || !email || !password || !confirmPassword) {
            return res.render('users/reset-password', {
                title: 'Reset Password', token, email,
                formError: 'All fields are required'
            });
        }

        if (password !== confirmPassword) {
            return res.render('users/reset-password', {
                title: 'Reset Password', token, email,
                formError: 'Passwords do not match'
            });
        }

        const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.render('users/reset-password', {
                title: 'Reset Password', token, email,
                formError: 'Password must be at least 8 characters and include letters, numbers, and a special character'
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.redirect('/users/forgot-password?error=Reset link is invalid or has expired. Please request a new one.');
        }

        // Hash and save new password, clear reset token
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        return res.redirect('/users/login?message=Password reset successful! You can now log in with your new password.');
    } catch (err) {
        console.error('Reset password POST error:', err);
        res.redirect('/users/forgot-password?error=Server error, please try again');
    }
});

// ── Logout ───────────────────────────────────────────────────────

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router; 