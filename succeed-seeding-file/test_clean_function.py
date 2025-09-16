import re

def normalize_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def clean_ko_gloss_strict(text: str) -> str:
    """한국어 뜻 전처리 - 괄호 및 괄호 내용 완전 제거"""
    if not text:
        return ""
    s = normalize_spaces(text)

    # 물결 표시(~)를 '무엇무엇'으로 치환
    s = s.replace("~", "무엇무엇")

    # 품사 약어 제거 (먼저 처리)
    s = re.sub(r"\b(?:exp|pron|n|v|adj|adv|prep|conj|int|interj|aux|det|num)\.\s*", "", s, flags=re.I)
    s = re.sub(r"\b(?:명사|동사|형용사|부사|감탄사|대명사|전치사|접속사|조동사|관사|수사)\.\s*", "", s)

    # 괄호 및 괄호 안의 내용 완전히 제거 (모든 종류의 괄호)
    s = re.sub(r"[（(【\[]([^）)】\]]*)[）)】\]]", "", s)

    # 추가적인 괄호 형태 제거
    s = re.sub(r"[（(][^）)]*[）)]", "", s)
    s = re.sub(r"【[^】]*】", "", s)
    s = re.sub(r"\[[^\]]*\]", "", s)

    # 특수문자 제거
    s = re.sub(r"[/\\|<>\"']", " ", s)

    # 연속된 공백을 하나로 정리하고 앞뒤 공백 제거
    s = normalize_spaces(s).strip(" ;,·")
    return s

# 테스트
test_cases = [
    "exp. 어서 오십시오",
    "v. 있다 (사물)",
    "adv. 그다지, 별로 (부정문과 함께 사용)",
    "pron. 나, 저",
    "n. 지금"
]

print("=== 한국어 뜻 정리 테스트 ===")
for i, text in enumerate(test_cases, 1):
    cleaned = clean_ko_gloss_strict(text)
    print(f"{i}. 원본: '{text}'")
    print(f"   정리: '{cleaned}'")
    print()