const { PrismaClient } = require("@prisma/client");

// Single shared Prisma client (connection pool) for the whole process.
const prisma = new PrismaClient();

module.exports = prisma;
