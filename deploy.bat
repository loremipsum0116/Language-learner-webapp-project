@echo off
echo 🚀 Language Learner 배포 시작...

echo.
echo 📦 의존성 설치 중...
cd web
call pnpm install

echo.
echo 🏗️ Backend 빌드 중...
cd apps\backend
call npm run build

echo.
echo 🎨 Frontend 빌드 중...
cd ..\frontend
call npm run build

echo.
echo ✅ 로컬 빌드 완료!
echo.
echo 다음 단계:
echo 1. Railway에서 Backend 배포
echo 2. Vercel에서 Frontend 배포
echo 3. 환경변수 설정
echo.
echo 자세한 내용은 internet.txt 파일을 참고하세요.

pause