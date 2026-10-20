@echo off
:: 1️⃣ Start Python's simple HTTP server on port 8000 (background)
python -m http.server 8000 >NUL 2>&1 &

:: 2️⃣ Wait 2 seconds for the server to initialise
timeout /t 2 >NUL

:: 3️⃣ Open the admin page in the default browser (no /admin)
start "" http://localhost:8000