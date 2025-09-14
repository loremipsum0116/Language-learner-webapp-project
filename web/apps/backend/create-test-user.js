// Create test user with proper password hash
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function createTestUser() {
    try {
        console.log('🚀 Creating test user...');

        const email = 'test@example.com';
        const password = 'password123';

        // Generate proper password hash
        const passwordHash = await bcrypt.hash(password, 10);

        // Create or update test user
        const testUser = await prisma.user.upsert({
            where: { email },
            update: { passwordHash }, // Update with correct hash if user exists
            create: {
                email,
                passwordHash,
                role: 'USER'
            }
        });

        console.log('✅ Test user created/updated successfully!');
        console.log('   📧 Email:', email);
        console.log('   🔑 Password:', password);
        console.log('   👤 User ID:', testUser.id);

    } catch (error) {
        console.error('❌ Error creating test user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    createTestUser();
}

module.exports = { createTestUser };