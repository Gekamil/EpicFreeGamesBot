@echo off
title Instalador - Epic Games Bot
color 0A
echo ===============================================
echo   INSTALANDO DEPENDENCIAS (Ten paciencia...)
echo ===============================================
npm init -y
npm install patchright ghost-cursor-playwright-port node-telegram-bot-api
npm install --save-dev typescript ts-node @types/node
npx tsc --init
echo ===============================================
echo   DESCARGANDO NAVEGADOR INVISIBLE...
echo ===============================================
npx patchright install
echo.
echo ✅ INSTALACION COMPLETADA. Ya puedes cerrar esto.
pause