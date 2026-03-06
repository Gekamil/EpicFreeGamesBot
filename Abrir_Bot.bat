@echo off
title Epic Games Bot - Panel de Control
color 07

echo ==================================================
echo   LIMPIANDO MEMORIA DE PROCESOS FANTASMAS...
echo ==================================================
taskkill /F /IM node.exe >nul 2>&1

echo.
echo [ OK ] Sistema limpio. Arrancando el Bot...
echo.

cd /d "%~dp0"
npx ts-node src/index.ts

pause