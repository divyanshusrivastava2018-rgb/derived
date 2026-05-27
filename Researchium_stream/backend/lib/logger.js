import winston from 'winston';

export const log = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => `${timestamp} [studio-backend] ${level}: ${message}`)
  ),
  transports: [new winston.transports.Console()],
});
