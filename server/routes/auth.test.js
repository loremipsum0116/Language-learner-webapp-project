// server/routes/auth.test.js

const { prisma } = require('../lib/prismaClient'); // Prisma 클라이언트
const bcrypt = require('bcryptjs'); // 비밀번호 검증용

// 테스트할 함수 (실제로는 라우트 핸들러를 모듈화하여 가져옵니다)
// 예시를 위해 registerUser 함수가 있다고 가정합니다.
async function registerUser(email, password) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('User with this email already exists');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: { email, passwordHash, role: 'USER' }
    });
    const { passwordHash: _, ...userSafe } = user;
    return userSafe;
}

// 테스트 스위트(Test Suite) 시작
describe('Auth DAO/Service', () => {

    // 각 테스트가 실행되기 전에 User 테이블을 초기화합니다.
    // 이를 통해 각 테스트는 독립성을 보장받습니다.
    beforeEach(async () => {
        await prisma.user.deleteMany({});
    });

    // 모든 테스트가 끝난 후 Prisma 연결을 종료합니다.
    afterAll(async () => {
        await prisma.$disconnect();
    });

    // 테스트 케이스 1: 정상적으로 새 사용자를 생성해야 함
    test('should create a new user successfully', async () => {
        // Arrange (준비): 테스트에 필요한 데이터 정의
        const email = 'test@example.com';
        const password = 'password123';

        // Act (실행): 테스트할 함수(DAO 메서드 포함) 호출
        const newUser = await registerUser(email, password);

        // Assert (검증): 결과가 기대와 일치하는지 확인
        expect(newUser).toBeDefined(); // 반환된 객체가 있는지 확인
        expect(newUser.email).toBe(email); // 이메일이 일치하는지 확인
        expect(newUser.role).toBe('USER'); // 기본 역할이 'USER'인지 확인 [cite: 246]

        // 데이터베이스에 실제로 저장되었는지 추가 검증
        const dbUser = await prisma.user.findUnique({ where: { email } });
        expect(dbUser).toBeDefined();
        expect(dbUser.id).toBe(newUser.id);
        
        // 비밀번호가 해싱되었는지 검증
        const isPasswordCorrect = await bcrypt.compare(password, dbUser.passwordHash);
        expect(isPasswordCorrect).toBe(true);
    });

    // 테스트 케이스 2: 중복된 이메일로 가입 시 에러를 발생시켜야 함
    test('should throw an error for duplicate email', async () => {
        // Arrange (준비): 먼저 사용자를 하나 생성
        const email = 'duplicate@example.com';
        const password = 'password123';
        await registerUser(email, password);

        // Act & Assert (실행 및 검증)
        // 동일한 이메일로 다시 가입을 시도하면 에러가 발생해야 함
        await expect(registerUser(email, password))
            .rejects
            .toThrow('User with this email already exists');
    });
});