#!/bin/bash
# Deploy Energy Dashboard to Render

# Build the project
npm run build

# The dist folder is ready for static hosting
# For Render static site:
# - Build command: npm run build
# - Publish directory: dist

echo "Build complete! Deploy the 'dist' folder to Render."
echo "Render settings:"
echo "  Build Command: npm run build"
echo "  Publish Directory: dist"
echo "  Environment Variables:"
echo "    VITE_SUPABASE_URL=https://lfatskduuzwdqoomtphh.supabase.co"
echo "    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."