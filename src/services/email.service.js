import MailTranspoter from "@/config/mail";

export async function sendPasswordResetOtp(email, otp) {
  await MailTranspoter.sendMail({
    from: Config.SMTP_FROM || Config.SMTP_USER,
    to: email,
    subject: "Your CAT Prep Tracker password reset code",
    text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif;">
        <p>Your password reset code is:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:6px;">
          ${otp}
        </p>
        <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}
