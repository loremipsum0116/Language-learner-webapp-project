-- 시험 카테고리 테이블 생성
CREATE TABLE exam_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  displayName VARCHAR(100) NOT NULL,
  description TEXT,
  totalWords INT DEFAULT 0,
  createdAt DATETIME DEFAULT NOW(),
  updatedAt DATETIME DEFAULT NOW() ON UPDATE NOW()
);

-- 단어-시험 카테고리 관계 테이블 (Many-to-Many)
CREATE TABLE vocab_exam_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vocabId INT NOT NULL,
  examCategoryId INT NOT NULL,
  priority INT DEFAULT 0,
  addedAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (vocabId) REFERENCES vocab(id) ON DELETE CASCADE,
  FOREIGN KEY (examCategoryId) REFERENCES exam_categories(id) ON DELETE CASCADE,
  UNIQUE KEY unique_vocab_exam (vocabId, examCategoryId),
  INDEX idx_vocab_id (vocabId),
  INDEX idx_exam_category_id (examCategoryId),
  INDEX idx_priority (priority)
);

-- 7개 시험 카테고리 기본 데이터 삽입
INSERT INTO exam_categories (name, displayName, description) VALUES
('TOEIC', '토익', 'TOEIC (Test of English for International Communication) 시험 필수 단어'),
('TOEIC_SPEAKING', '토익 스피킹', 'TOEIC Speaking 시험 필수 단어'),
('TOEFL', '토플', 'TOEFL (Test of English as a Foreign Language) 시험 필수 단어'),
('IELTS_GENERAL', '아이엘츠 - 제너럴', 'IELTS General Training 모듈 필수 단어'),
('IELTS_ACADEMIC', '아이엘츠 - 아카데믹', 'IELTS Academic 모듈 필수 단어'),
('OPIC', 'Opic', 'OPIc (Oral Proficiency Interview-computer) 시험 필수 단어'),
('GONGMUWON', '공무원 영어시험', '공무원 영어시험 필수 단어');