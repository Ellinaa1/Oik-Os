const buildVerificationEmail = ({ verificationUrl }) => {
  const subject = 'Verify your Oikos account';
  const text = [
    'Welcome to Oikos!',
    '',
    'Please verify your email by opening this link:',
    verificationUrl,
    '',
    'This link expires in 24 hours.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
      <h2>Welcome to Oikos</h2>
      <p>Please verify your email by clicking the button below.</p>
      <p>
        <a href="${verificationUrl}" style="background:#111;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;display:inline-block;">
          Verify Email
        </a>
      </p>
      <p>If the button does not work, open this URL:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    </div>
  `;

  return { subject, text, html };
};

module.exports = { buildVerificationEmail };
