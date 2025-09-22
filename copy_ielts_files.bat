@echo off
echo Copying IELTS dictionary files from backend to frontend...

for %%l in (A1 A2 B1 B2 C1) do (
  for /L %%i in (1,1,9) do (
    if exist "C:\Users\sst70\OneDrive\바탕 화면\Language-learner\web\apps\backend\%%l\%%l_%%i" (
      echo Copying %%l_%%i...
      robocopy "C:\Users\sst70\OneDrive\바탕 화면\Language-learner\web\apps\backend\%%l\%%l_%%i" "C:\Users\sst70\OneDrive\바탕 화면\Language-learner\web\apps\frontend\public\%%l\%%l_%%i" ielts_*.json /NFL /NDL /NJH /NJS
    )
  )
)

echo Done!
pause