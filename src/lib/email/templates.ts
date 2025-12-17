/**
 * Email templates for verification and password reset
 * Provides HTML and plain text versions of emails
 */

export interface EmailTemplateOptions {
  token: string
  baseUrl: string
  email: string
}

/**
 * Get email verification email HTML template
 */
export function getVerificationEmailHtml(options: EmailTemplateOptions): string {
  const { token, baseUrl, email } = options
  const verifyUrl = `${baseUrl}/verify-email/${token}`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">KOauth</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #111827; margin-top: 0; font-size: 24px;">Verify your email address</h2>
    
    <p style="color: #6b7280; font-size: 16px;">
      Thanks for signing up! Please verify your email address by clicking the button below:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Verify Email Address
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      Or copy and paste this link into your browser:
    </p>
    <p style="color: #667eea; font-size: 14px; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 4px;">
      ${verifyUrl}
    </p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        <strong>Security notice:</strong> This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
    <p>This email was sent to ${email}</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Get email verification email plain text template
 */
export function getVerificationEmailText(options: EmailTemplateOptions): string {
  const { token, baseUrl } = options
  const verifyUrl = `${baseUrl}/verify-email/${token}`

  return `
Verify your email address

Thanks for signing up! Please verify your email address by visiting this link:

${verifyUrl}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
  `.trim()
}

/**
 * Get password reset email HTML template
 */
export function getPasswordResetEmailHtml(options: EmailTemplateOptions): string {
  const { token, baseUrl, email } = options
  const resetUrl = `${baseUrl}/reset-password/${token}`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">KOauth</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #111827; margin-top: 0; font-size: 24px;">Reset your password</h2>
    
    <p style="color: #6b7280; font-size: 16px;">
      We received a request to reset your password. Click the button below to create a new password:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Reset Password
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      Or copy and paste this link into your browser:
    </p>
    <p style="color: #667eea; font-size: 14px; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 4px;">
      ${resetUrl}
    </p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        <strong>Security notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
    <p>This email was sent to ${email}</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Get password reset email plain text template
 */
export function getPasswordResetEmailText(options: EmailTemplateOptions): string {
  const { token, baseUrl } = options
  const resetUrl = `${baseUrl}/reset-password/${token}`

  return `
Reset your password

We received a request to reset your password. Visit this link to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
  `.trim()
}
