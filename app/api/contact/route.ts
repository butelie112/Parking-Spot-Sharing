import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, message } = await request.json();

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create transporter using cPanel SMTP settings
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // e.g., mail.yourdomain.com
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER, // Your cPanel email address
        pass: process.env.SMTP_PASSWORD, // Your cPanel email password
      },
    });

    // Email content to send to you
    const mailOptions = {
      from: process.env.SMTP_USER, // Sender address (your cPanel email)
      to: process.env.CONTACT_EMAIL || process.env.SMTP_USER, // Your email where you want to receive messages
      subject: `Contact Form: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #00C48C 0%, #007BFF 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">New Contact Form Submission</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Contact Details</h2>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 10px 0;"><strong style="color: #00C48C;">Name:</strong> ${name}</p>
              <p style="margin: 10px 0;"><strong style="color: #00C48C;">Email:</strong> <a href="mailto:${email}" style="color: #007BFF;">${email}</a></p>
              <p style="margin: 10px 0;"><strong style="color: #00C48C;">Subject:</strong> ${subject}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px;">
              <h3 style="color: #333; margin-top: 0;">Message:</h3>
              <p style="color: #555; line-height: 1.6; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center;">
            <p style="color: #999; margin: 0; font-size: 12px;">
              This email was sent from the Parkezz contact form
            </p>
          </div>
        </div>
      `,
      text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
This email was sent from the Parkezz contact form
      `,
      replyTo: email, // This allows you to reply directly to the user
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Optional: Send confirmation email to the user
    if (process.env.SEND_CONFIRMATION_EMAIL === 'true') {
      const confirmationMailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'We received your message - Parkezz',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #00C48C 0%, #007BFF 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Thank You for Contacting Us!</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0;">
              <p style="color: #333; font-size: 16px;">Hi ${name},</p>
              
              <p style="color: #555; line-height: 1.6;">
                Thank you for reaching out to Parkezz! We've received your message and will get back to you as soon as possible, typically within 24 hours.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Your Message:</h3>
                <p style="margin: 10px 0;"><strong>Subject:</strong> ${subject}</p>
                <p style="color: #555; line-height: 1.6; white-space: pre-wrap;">${message}</p>
              </div>
              
              <p style="color: #555; line-height: 1.6;">
                If you have any urgent concerns, please don't hesitate to reach out to us directly.
              </p>
              
              <p style="color: #333; margin-top: 30px;">
                Best regards,<br>
                <strong>The Parkezz Team</strong>
              </p>
            </div>
            
            <div style="background: #333; padding: 20px; text-align: center;">
              <p style="color: #999; margin: 0; font-size: 12px;">
                © 2025 Parkezz. All rights reserved.
              </p>
            </div>
          </div>
        `,
        text: `
Hi ${name},

Thank you for reaching out to Parkezz! We've received your message and will get back to you as soon as possible, typically within 24 hours.

Your Message:
Subject: ${subject}
${message}

If you have any urgent concerns, please don't hesitate to reach out to us directly.

Best regards,
The Parkezz Team

---
© 2025 Parkezz. All rights reserved.
        `,
      };

      await transporter.sendMail(confirmationMailOptions);
    }

    return NextResponse.json(
      { success: true, message: 'Email sent successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email. Please try again later.' },
      { status: 500 }
    );
  }
}

