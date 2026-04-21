import { PrismaClient } from "@prisma/client"

export async function autoArchiveCompletedAcademicPeriods(prisma: PrismaClient) {
  const now = new Date()

  const archived = await prisma.academicPeriod.updateMany({
    where: {
      isArchived: false,
      endDate: {
        lt: now,
      },
    },
    data: {
      isArchived: true,
      isActive: false,
      archivedAt: now,
    },
  })

  return archived.count
}

export async function getActiveAcademicPeriod(prisma: PrismaClient) {
  await autoArchiveCompletedAcademicPeriods(prisma)

  return prisma.academicPeriod.findFirst({
    where: {
      isActive: true,
      isArchived: false,
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  })
}

