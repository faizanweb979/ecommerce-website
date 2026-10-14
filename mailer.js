const nodemailer = require('nodemailer');

// Create transporter once
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
} else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
}

/**
 * Send an email — never throws, logs errors silently
 */
async function sendMail({ to, subject, html }) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@trendotech.com',
            to,
            subject,
            html
        });
        console.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
        console.error(`Email failed to ${to}:`, err.message);
    }
}

// ── Email Templates ──────────────────────────────────────────────

function orderConfirmationEmail(order) {
    const itemRows = order.items.map(item =>
        `<tr>
            <td style="padding:6px 10px;">${item.name}</td>
            <td style="padding:6px 10px;text-align:center;">${item.quantity}</td>
            <td style="padding:6px 10px;text-align:right;">Rs. ${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`
    ).join('');

    return {
        subject: `Order Confirmed — #${order.orderNumber}`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
            <h2 style="background:#0d6efd;color:#fff;padding:16px;margin:0;">Order Confirmed</h2>
            <div style="padding:20px;">
                <p>Hi <strong>${order.shippingDetails.fullName}</strong>,</p>
                <p>Thank you for your order! We've received it and it's being processed.</p>
                <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod.replace('_', ' ').toUpperCase()}</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th style="padding:8px 10px;text-align:left;">Product</th>
                            <th style="padding:8px 10px;text-align:center;">Qty</th>
                            <th style="padding:8px 10px;text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                    <tfoot>
                        <tr style="border-top:2px solid #dee2e6;">
                            <td colspan="2" style="padding:8px 10px;text-align:right;font-weight:bold;">Total:</td>
                            <td style="padding:8px 10px;text-align:right;font-weight:bold;">Rs. ${order.total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                <p><strong>Shipping to:</strong> ${order.shippingDetails.address}, ${order.shippingDetails.city}, ${order.shippingDetails.country}</p>
                <p style="color:#6c757d;font-size:0.9em;">You can track your order at any time using your order number.</p>
            </div>
        </div>`
    };
}

function orderStatusEmail(order, newStatus) {
    const statusMessages = {
        processing: { label: 'Processing', color: '#0dcaf0', msg: 'Your payment has been verified and your order is now being processed.' },
        shipped:    { label: 'Shipped',    color: '#0d6efd', msg: 'Great news! Your order has been shipped and is on its way to you.' },
        delivered:  { label: 'Delivered',  color: '#198754', msg: 'Your order has been delivered. We hope you enjoy your purchase!' },
        cancelled:  { label: 'Cancelled',  color: '#dc3545', msg: 'Your order has been cancelled. If you have questions, please contact support.' }
    };

    const info = statusMessages[newStatus] || { label: newStatus, color: '#6c757d', msg: 'Your order status has been updated.' };

    return {
        subject: `Order ${info.label} — #${order.orderNumber}`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
            <h2 style="background:${info.color};color:#fff;padding:16px;margin:0;">Order ${info.label}</h2>
            <div style="padding:20px;">
                <p>Hi <strong>${order.shippingDetails.fullName}</strong>,</p>
                <p>${info.msg}</p>
                <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                <p><strong>Status:</strong> <span style="color:${info.color};font-weight:bold;">${info.label}</span></p>
                <p style="color:#6c757d;font-size:0.9em;">Track your order using your order number and email on our website.</p>
            </div>
        </div>`
    };
}

function forgotPasswordEmail(name, resetUrl) {
    return {
        subject: 'Password Reset Request',
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
            <h2 style="background:#0d6efd;color:#fff;padding:16px;margin:0;">Reset Your Password</h2>
            <div style="padding:20px;">
                <p>Hi <strong>${name}</strong>,</p>
                <p>We received a request to reset your password. Click the button below to set a new password:</p>
                <div style="text-align:center;margin:30px 0;">
                    <a href="${resetUrl}" style="background:#0d6efd;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;font-size:16px;">Reset Password</a>
                </div>
                <p>This link will expire in <strong>1 hour</strong>.</p>
                <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
                <hr style="border:none;border-top:1px solid #dee2e6;margin:20px 0;">
                <p style="color:#6c757d;font-size:0.85em;">If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color:#0d6efd;">${resetUrl}</a></p>
            </div>
        </div>`
    };
}

module.exports = { sendMail, orderConfirmationEmail, orderStatusEmail, forgotPasswordEmail };
