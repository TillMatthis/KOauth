/**
 * Email service using Resend.com
 * Handles sending verification and password reset emails
 */

import { Resend } from 'resend'
import type { FastifyInstance } from 'fastify'
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
  getPasswordResetEmailHtml,
  getPasswordResetEmailText
} from './templates'

let resendClient: Resend | null = null

/**
 * Initialize email service
 */
export function initEmailService(app: FastifyInstance): void {
  const apiKey = app.config.RESEND_API_KEY
  const emailFrom = app.config.EMAIL_FROM

  if (!apiKey || apiKey === '') {
    app.log.warn('RESEND_API_KEY not configured - emails will be logged instead of sent')
    return
  }

  if (!emailFrom || emailFrom === '') {
    app.log.warn('EMAIL_FROM not configured - emails will be logged instead of sent')
    return
  }

  try {
    resendClient = new Resend(apiKey)
    app.log.info('Email service initialized with Resend.com')
  } catch (error) {
    app.log.error({ error }, 'Failed to initialize email service')
  }
}

/**
 * Send email verification email
 */
export async function sendEmailVerification(
  app: FastifyInstance,
  email: string,
  token: string
): Promise<boolean> {
  const logger = app.log.child({ service: 'email', action: 'verification' })
  const emailFrom = app.config.EMAIL_FROM
  const baseUrl = app.config.JWT_ISSUER || 'http://localhost:3000'

  const html = getVerificationEmailHtml({ token, baseUrl, email })
  const text = getVerificationEmailText({ token, baseUrl, email })

  // In development without API key, just log the email
  if (!resendClient || !emailFrom || emailFrom === 'noreply@koauth.local') {
    logger.info({ email, token, verifyUrl: `${baseUrl}/verify-email/${token}` }, 'Email verification (not sent - dev mode)')
    return true
  }

  try {
    const result = await resendClient.emails.send({
      from: emailFrom,
      to: email,
      subject: 'Verify your email address',
      html,
      text
    })

    if (result.error) {
      logger.error({ error: result.error, email }, 'Failed to send verification email')
      return false
    }

    logger.info({ email, emailId: result.data?.id }, 'Verification email sent successfully')
    return true
  } catch (error) {
    logger.error({ error, email }, 'Error sending verification email')
    return false
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(
  app: FastifyInstance,
  email: string,
  token: string
): Promise<boolean> {
  const logger = app.log.child({ service: 'email', action: 'password_reset' })
  const emailFrom = app.config.EMAIL_FROM
  const baseUrl = app.config.JWT_ISSUER || 'http://localhost:3000'

  const html = getPasswordResetEmailHtml({ token, baseUrl, email })
  const text = getPasswordResetEmailText({ token, baseUrl, email })

  // In development without API key, just log the email
  if (!resendClient || !emailFrom || emailFrom === 'noreply@koauth.local') {
    logger.info({ email, token, resetUrl: `${baseUrl}/reset-password/${token}` }, 'Password reset email (not sent - dev mode)')
    return true
  }

  try {
    const result = await resendClient.emails.send({
      from: emailFrom,
      to: email,
      subject: 'Reset your password',
      html,
      text
    })

    if (result.error) {
      logger.error({ error: result.error, email }, 'Failed to send password reset email')
      return false
    }

    logger.info({ email, emailId: result.data?.id }, 'Password reset email sent successfully')
    return true
  } catch (error) {
    logger.error({ error, email }, 'Error sending password reset email')
    return false
  }
}
