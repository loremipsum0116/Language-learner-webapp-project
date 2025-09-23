const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function approveSuperUser() {
  try {
    // Find and update super@root.com user
    const user = await prisma.user.findUnique({
      where: { email: 'super@root.com' }
    });

    if (!user) {
      console.log('❌ User super@root.com not found!');
      return;
    }

    console.log('Current user status:', {
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
      approvedBy: user.approvedBy
    });

    // Update user to approved status
    const updatedUser = await prisma.user.update({
      where: { email: 'super@root.com' },
      data: {
        role: 'admin',
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: 'system'
      }
    });

    console.log('✅ User super@root.com has been approved!');
    console.log('Updated user status:', {
      email: updatedUser.email,
      role: updatedUser.role,
      isApproved: updatedUser.isApproved,
      approvedBy: updatedUser.approvedBy
    });

  } catch (error) {
    console.error('❌ Error approving user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

approveSuperUser();