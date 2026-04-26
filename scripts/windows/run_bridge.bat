@echo off
echo Starting Thai ID Card Bridge...
python bridge.py
if %ERRORLEVEL% NEQ 0 (
    echo Error: Python not found or dependency missing.
    echo Please install Python and run "pip install pyscard pyserial".
    pause
)
