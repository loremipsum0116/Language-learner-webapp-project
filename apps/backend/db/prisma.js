//server/db/prisma.js
const { PrismaClient } = require('@prisma/client');
const prisma = global.__prisma || new PrismaClient({
    log: ['query', 'error', 'warn'], // 필요시 'query'까지
});
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;
module.exports = { prisma };
