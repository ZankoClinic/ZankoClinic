@echo off
REM Database setup script for Zanko Clinic Management System (Windows)

echo 🦷 Zanko Clinic Database Setup
echo ==============================

REM Check if MySQL is available
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ MySQL is not installed or not in PATH
    echo Please install MySQL first from: https://dev.mysql.com/downloads/mysql/
    pause
    exit /b 1
)

echo ✅ MySQL found

REM Prompt for MySQL root password
set /p MYSQL_PASSWORD="Enter MySQL root password: "

REM Create database
echo 📊 Creating database...
mysql -u root -p%MYSQL_PASSWORD% -e "CREATE DATABASE IF NOT EXISTS zanko_clinic;"

if %errorlevel% neq 0 (
    echo ❌ Failed to create database
    pause
    exit /b 1
)

echo ✅ Database 'zanko_clinic' created successfully

REM Run schema
echo 🏗️  Creating tables...
mysql -u root -p%MYSQL_PASSWORD% zanko_clinic < database\schema.sql

if %errorlevel% neq 0 (
    echo ❌ Failed to create tables
    pause
    exit /b 1
)

echo ✅ Tables created successfully
echo 🎉 Database setup completed!
echo.
echo Next steps:
echo 1. Update your .env file with your MySQL password
echo 2. Run 'npm install' to install dependencies
echo 3. Run 'npm start' to start the application
pause
