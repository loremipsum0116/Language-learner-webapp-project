#!/bin/bash
# Database migration script for production deployment

echo "Starting database migration..."

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Push database schema
echo "Pushing database schema..."
npx prisma db push --accept-data-loss

echo "Database migration completed!"