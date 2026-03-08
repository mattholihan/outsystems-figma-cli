#!/bin/bash
   echo "🚀 Starting OutSystems Figma CLI..."
   echo "📐 Launching Figma in debug mode..."
   killall Figma 2>/dev/null
   sleep 2
   open -a Figma --args --remote-debugging-port=9222
   echo "✅ Figma is ready. Connecting CLI..."
   node src/index.js connect
   echo ""
   echo "💡 You're all set! Open a Figma file and start designing."
   echo "   Run: node src/index.js --help  to see all commands"