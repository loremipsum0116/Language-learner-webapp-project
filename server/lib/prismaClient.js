//server/lib/prismaClient.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = { prisma };
