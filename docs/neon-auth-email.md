# Troubleshooting Neon Auth Email Delivery

If you are not receiving verification emails or OTP codes from Neon Auth, follow these steps to resolve the issue.

## 1. Verify Verification at Sign-up is Enabled
In the [Neon Console](https://console.neon.tech):
1. Navigate to your project's **Auth** settings.
2. Ensure **Sign-up with Email** is toggled ON.
3. Ensure **Verify at Sign-up** is toggled ON.
4. Confirm **Verification method** is set to **Verification code**.

## 2. Shared vs. Custom Email Providers

Neon Auth provides a **Shared Provider** out-of-the-box for convenient development. However, it has certain limitations:
- **Rate Limits**: Excessive requests might be temporarily blocked.
- **Spam Filtering**: Shared IPs might have a higher chance of being flagged by email providers.

### Switching to a Custom SMTP Provider (Recommended)
For production-ready and highly reliable email delivery, we recommend using your own email service (e.g., Postmark, SendGrid, Amazon SES, or Resend).

How to set it up:
1. Go to your Neon Auth settings.
2. Find the **Email Provider** or **SMTP settings** section.
3. Toggle from Shared to **Custom**.
4. Enter your provider's SMTP details (Host, Port, User, Password).

## 3. Check Spam and Filters
- Ensure the email hasn't landed in your **Spam** or **Junk** folder.
- Check if your email provider is blocking emails from `.neon.tech` domains.

## 4. Use the "Resend Code" Button
In our application's signup flow, we have added a **Resend Code** button. If the code still hasn't arrived after 2 minutes, try the resend action which explicitly triggers a new OTP delivery.
