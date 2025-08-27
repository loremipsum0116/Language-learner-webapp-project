// server/test-public-route.js
// Public 라우터 테스트

const express = require('express');
const app = express();

app.use(express.json());

// 테스트 라우터 - 인증 불필요
app.get('/test-public', (req, res) => {
    res.json({ message: 'Public route works!', ok: true });
});

const PORT = 4001;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    
    // 자동 테스트
    setTimeout(async () => {
        try {
            const response = await fetch(`http://localhost:${PORT}/test-public`);
            const data = await response.json();
            console.log('Test result:', data);
            process.exit(0);
        } catch (error) {
            console.error('Test failed:', error);
            process.exit(1);
        }
    }, 1000);
});