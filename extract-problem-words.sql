-- 오디오 경로 매핑 문제가 있는 모든 일본어 단어 추출

-- 1. 점(・) 포함 단어들 (5개)
SELECT
    '점_포함_단어' as problem_type,
    v.lemma,
    v.levelJLPT,
    JSON_EXTRACT(d.audioLocal, '$.word') as actual_path,
    CONCAT('jlpt/', LOWER(v.levelJLPT), '/',
           REPLACE(REPLACE(REPLACE(LOWER(v.lemma), '・', '_'), ' ', '_'), '/', '_'),
           '/word.mp3') as expected_frontend_path
FROM vocab v
LEFT JOIN dictentry d ON v.id = d.vocabId
WHERE v.source = 'jlpt_total'
  AND v.lemma LIKE '%・%'
  AND d.audioLocal IS NOT NULL

UNION ALL

-- 2. N5 대문자 레벨 단어들 (46개)
SELECT
    'N5_대문자_레벨' as problem_type,
    v.lemma,
    v.levelJLPT,
    JSON_EXTRACT(d.audioLocal, '$.word') as actual_path,
    CONCAT('jlpt/', LOWER(v.levelJLPT), '/',
           REPLACE(REPLACE(LOWER(v.lemma), ' ', '_'), '/', '_'),
           '/word.mp3') as expected_frontend_path
FROM vocab v
LEFT JOIN dictentry d ON v.id = d.vocabId
WHERE v.source = 'jlpt_total'
  AND JSON_EXTRACT(d.audioLocal, '$.word') LIKE '%jlpt/N5/%'
  AND d.audioLocal IS NOT NULL

UNION ALL

-- 3. 기타 매핑 불일치 패턴 검사 (예: 특수문자, 공백 등)
SELECT
    '기타_매핑_불일치' as problem_type,
    v.lemma,
    v.levelJLPT,
    JSON_EXTRACT(d.audioLocal, '$.word') as actual_path,
    CONCAT('jlpt/', LOWER(v.levelJLPT), '/',
           REPLACE(REPLACE(LOWER(v.lemma), ' ', '_'), '/', '_'),
           '/word.mp3') as expected_frontend_path
FROM vocab v
LEFT JOIN dictentry d ON v.id = d.vocabId
WHERE v.source = 'jlpt_total'
  AND d.audioLocal IS NOT NULL
  AND (
    v.lemma LIKE '% %'  -- 공백 포함
    OR v.lemma LIKE '%/%'  -- 슬래시 포함
    OR v.lemma LIKE '%(%'  -- 괄호 포함
    OR v.lemma LIKE '%)%'
  )

ORDER BY problem_type, lemma;