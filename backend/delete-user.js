import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "psavanthika03@gmail.com";

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    console.log("User not found");
    return;
  }

  console.log("Deleting:", user);

  await prisma.$transaction(async (tx) => {
    // Password reset OTPs
    await tx.passwordResetOtp.deleteMany({
      where: { userId: user.id },
    });

    // Notifications
    await tx.notification.deleteMany({
      where: { userId: user.id },
    });

    // App ratings
    await tx.appRating.deleteMany({
      where: { userId: user.id },
    });

    // Complaints authored by this user
    await tx.complaint.deleteMany({
      where: { authorId: user.id },
    });

    // Ratings given by this user
    await tx.rating.deleteMany({
      where: { raterId: user.id },
    });

    // Find the user's chat sessions
    const sessions = await tx.chatSession.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    const sessionIds = sessions.map((session) => session.id);

    // Delete chat messages before chat sessions
    if (sessionIds.length > 0) {
      await tx.chatMessage.deleteMany({
        where: {
          sessionId: {
            in: sessionIds,
          },
        },
      });
    }

    await tx.chatSession.deleteMany({
      where: { userId: user.id },
    });

    // Find service requests created by this user
const requests = await tx.serviceRequest.findMany({
  where: { userId: user.id },
  select: { id: true },
});

const requestIds = requests.map((request) => request.id);

// Payments reference ServiceRequest, so delete them first
if (requestIds.length > 0) {
  await tx.payment.deleteMany({
    where: {
      requestId: {
        in: requestIds,
      },
    },
  });
}

// Now delete the service requests
await tx.serviceRequest.deleteMany({
  where: { userId: user.id },
});

    // Worker profile, if one exists
    await tx.workerProfile.deleteMany({
      where: { userId: user.id },
    });

    // Finally delete the user
    await tx.user.delete({
      where: { id: user.id },
    });
  });

  console.log(`Deleted successfully: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });