#!/bin/bash

# Helper script to update DATABASE_URL in .env file

echo "🚀 Free4AllWeb Database Setup Helper"
echo "===================================="
echo ""
echo "📋 Copy your Neon connection string from the dashboard"
echo "It looks like: postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
echo ""
read -p "Paste your connection string here: " DB_URL

# Backup existing .env
cp .env .env.backup
echo "✅ Backed up .env to .env.backup"

# Update DATABASE_URL
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env
else
    # Linux
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env
fi

echo "✅ Updated DATABASE_URL in .env"
echo ""
echo "Next steps:"
echo "1. Run: npm run db:push"
echo "2. Run: npm run seed"
echo "3. Run: npm run dev"
echo ""
echo "🎉 Database setup complete!"