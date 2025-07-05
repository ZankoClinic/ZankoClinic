#!/bin/bash
# Database setup script for Zanko Clinic Management System

echo "🦷 Zanko Clinic Database Setup"
echo "=============================="

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL is not installed or not in PATH"
    echo "Please install MySQL first:"
    echo "  - Windows: Download from https://dev.mysql.com/downloads/mysql/"
    echo "  - macOS: brew install mysql"
    echo "  - Ubuntu: sudo apt install mysql-server"
    exit 1
fi

echo "✅ MySQL found"

# Prompt for MySQL root password
read -s -p "Enter MySQL root password: " MYSQL_PASSWORD
echo

# Create database
echo "📊 Creating database..."
mysql -u root -p$MYSQL_PASSWORD -e "CREATE DATABASE IF NOT EXISTS zanko_clinic;"

if [ $? -eq 0 ]; then
    echo "✅ Database 'zanko_clinic' created successfully"
else
    echo "❌ Failed to create database"
    exit 1
fi

# Run schema
echo "🏗️  Creating tables..."
mysql -u root -p$MYSQL_PASSWORD zanko_clinic < database/schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Tables created successfully"
else
    echo "❌ Failed to create tables"
    exit 1
fi

echo "🎉 Database setup completed!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with your MySQL password"
echo "2. Run 'npm install' to install dependencies"
echo "3. Run 'npm start' to start the application"
