#!/bin/bash

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Run the seed script
echo "🌱 Seeding database with initial data..."
npx tsx server/seedData.ts

echo "✅ Database seeding complete!"