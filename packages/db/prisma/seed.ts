import { PrismaClient } from '@prisma/client'
import { eventCoverPresets } from './seed-data/event-covers.ts'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding event cover presets...')

  for (const preset of eventCoverPresets) {
    await prisma.eventCoverPreset.upsert({
      where: { slug: preset.slug },
      update: {
        imageUrl: preset.imageUrl,
        occasionTags: preset.occasionTags,
        displayOrder: preset.displayOrder,
      },
      create: preset,
    })
  }

  console.log(`Seeded ${eventCoverPresets.length} event cover presets.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
