CREATE TABLE IF NOT EXISTS reading_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  questionId VARCHAR(255) NOT NULL,
  level VARCHAR(255) NOT NULL,
  isCorrect BOOLEAN NOT NULL,
  userAnswer TEXT NOT NULL,
  correctAnswer TEXT NOT NULL,
  solvedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_question_level (userId, questionId, level),
  INDEX idx_user_level (userId, level),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS listening_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  questionId VARCHAR(255) NOT NULL,
  level VARCHAR(255) NOT NULL,
  isCorrect BOOLEAN NOT NULL,
  userAnswer TEXT NOT NULL,
  correctAnswer TEXT NOT NULL,
  solvedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_question_level_listening (userId, questionId, level),
  INDEX idx_user_level_listening (userId, level),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);