const Config = {
  MONGO_URI: process.env.MONGO_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
  NODE_ENV: process.env.NODE_ENV,
  SMTP_HOST: process.env.STTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.STTP_USER,
  SMTP_PASSWORD: process.env.STTP_PASS,
  SMTP_FROM: process.env.STTP_USER,
};

export default Config;
