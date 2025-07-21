#!/bin/bash

echo "🚀 Free4AllWeb Database Setup Assistant"
echo "======================================"
echo ""
echo "This script will help you update your .env file with a real Neon database."
echo ""
echo "📋 STEP 1: Get your Neon connection string"
echo "1. Go to: https://console.neon.tech/"
echo "2. Sign up for free (no credit card needed)"
echo "3. Create a new project"
echo "4. Copy your connection string"
echo ""
echo "It should look like:"
echo "postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
echo ""

read -p "📝 Paste your Neon connection string here: " DB_URL

if [ -z "$DB_URL" ]; then
    echo "❌ No connection string provided. Exiting."
    exit 1
fi

# Validate the connection string format
if [[ $DB_URL != postgresql://* ]]; then
    echo "⚠️  Warning: Connection string doesn't start with 'postgresql://'"
    echo "Make sure you copied the full connection string from Neon."
    read -p "Continue anyway? (y/n): " confirm
    if [[ $confirm != "y" ]]; then
        exit 1
    fi
fi

echo ""
echo "📄 STEP 2: Updating .env file"

# Backup existing .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backed up current .env file"

# Update DATABASE_URL
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env
else
    # Linux
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env
fi

echo "✅ Updated DATABASE_URL in .env file"
echo ""

# Show updated .env (without sensitive data)
echo "📋 Updated .env configuration:"
echo "DATABASE_URL=postgresql://[HIDDEN]@[NEON_HOST]/[DATABASE]"
echo "EMAIL_FROM=$(grep EMAIL_FROM .env | cut -d'=' -f2)"
echo "NODE_ENV=$(grep NODE_ENV .env | cut -d'=' -f2)"
echo ""

echo "🏗️  STEP 3: Creating database tables"
echo "Running: npm run db:push"
npm run db:push

if [ $? -eq 0 ]; then
    echo "✅ Database tables created successfully!"
    echo ""
    echo "🌱 STEP 4: Adding initial data"
    echo "Running: npm run seed"
    npm run seed
    
    if [ $? -eq 0 ]; then
        echo "✅ Initial data seeded successfully!"
        echo ""
        echo "🎉 DATABASE SETUP COMPLETE!"
        echo ""
        echo "Next steps:"
        echo "1. Run: npm run dev"
        echo "2. Open: http://localhost:3000"
        echo "3. Test: Go to /admin and try 'Deal Discovery'"
        echo ""
        echo "🎯 Real-world testing is now ready with:"
        echo "✅ Live MLB API integration"
        echo "✅ Real restaurant website crawling"
        echo "✅ Persistent database storage"
        echo "✅ User account management"
    else
        echo "❌ Seeding failed. You can try manually later with: npm run seed"
    fi
else
    echo "❌ Database table creation failed."
    echo "Check your connection string and try again."
fi