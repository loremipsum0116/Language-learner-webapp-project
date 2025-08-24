// src/data/mockGrammar.js

export const grammarTopics = [
    {
        id: "a1-present-tense",
        level: "A1",
        title: "현재 시제 (Present Tense)",
        description: "가장 기본적인 동사 'be', 'have', 'go'의 현재 시제 변화를 학습합니다.",
        // ★★★★★ 요청하신 대로 3페이지로 재구성 ★★★★★
        detailedExplanation: [
            [ // 페이지 1
                {
                    type: 'heading',
                    content: '현재 시제 (Present Tense)'
                },
                {
                    type: 'paragraph',
                    content: "영어에서는 문장의 주어가 누구냐에 따라 동사의 형태가 조금씩 바뀌어요. 이걸 '동사 변화'라고 부른답니다. A1 레벨에서는 가장 기본이 되는 동사들의 변화 모습을 꼭 알아둬야 해요! 😊"
                }
            ],
            [ // 페이지 2
                {
                    type: 'heading',
                    content: "기본 규칙 📝"
                },
                {
                    type: 'list',
                    items: [
                        "I (나) → 동사원형 (예: I go)",
                        "You (너/당신) → 동사원형 (예: You go)",
                        "He/She/It (그/그녀/그것) → 동사원형 + -s (예: He goes)",
                        "We (우리) / They (그들) → 동사원형 그대로! (예: We go)"
                    ]
                }
            ],
            [ // 페이지 3
                {
                    type: 'paragraph',
                    content: "하지만 'be' 동사는 특별한 변화를 하는 불규칙 동사이니, 아래처럼 통째로 외워두는 게 좋아요!"
                },
                {
                    type: 'example',
                    items: [
                        { de: "I am a student.", ko: "저는 학생입니다." },
                        { de: "You have a car.", ko: "너는 차를 가지고 있구나." }
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "I ___ from Korea.",
                options: ["am", "is", "are"],
                answer: "am",
                explanation: "'be' 동사는 1인칭 단수 'I'와 함께 쓰일 때 'am'으로 변화합니다."
            },
            {
                stem: "He ___ a dog.",
                options: ["have", "has", "had"],
                answer: "has",
                explanation: "'have' 동사는 3인칭 단수 'He'와 함께 쓰일 때 'has'로 변화합니다."
            },
            {
                stem: "We ___ to school.",
                options: ["go", "goes", "going"],
                answer: "go",
                explanation: "'go' 동사는 복수 주어 'We'와 함께 쓰일 때 동사 원형인 'go'를 사용합니다."
            }
        ]
    },
    {
        id: "a1-articles",
        level: "A1",
        title: "관사 (Articles)",
        description: "기본적인 관사 a, an, the의 사용법을 배웁니다.",
        // ★ 가독성을 위해 2페이지로 재구성
        detailedExplanation: [
            [ // 페이지 1
                {
                    type: 'paragraph',
                    content: "영어에는 명사 앞에 붙이는 작은 단어들이 있어요! 바로 관사(Articles)랍니다. 이 작은 단어들이 명사를 더 정확하게 설명해줘요. 🎯"
                },
                {
                    type: 'heading',
                    content: "관사의 세 가지 종류 📝"
                },
                {
                    type: 'list',
                    items: [
                        "a → 자음으로 시작하는 명사 앞 (예: a book)",
                        "an → 모음으로 시작하는 명사 앞 (예: an apple)",
                        "the → 특정한 것을 가리킬 때 (예: the book)"
                    ]
                }
            ],
            [ // 페이지 2
                {
                    type: 'paragraph',
                    content: "a/an은 '하나의, 어떤'이라는 뜻이고, the는 '그'라는 뜻이에요. 처음 말하는 것은 a/an, 이미 말한 것이나 특별한 것은 the를 써요!"
                }
            ]
        ],
        questions: [
            {
                stem: "I have ___ book.",
                options: ["a", "an", "the"],
                answer: "a",
                explanation: "'book'은 자음 'b'로 시작하므로 부정관사 'a'를 사용합니다."
            },
            {
                stem: "She eats ___ apple.",
                options: ["a", "an", "the"],
                answer: "an",
                explanation: "'apple'은 모음 'a'로 시작하므로 부정관사 'an'을 사용합니다."
            },
            {
                stem: "Where is ___ book I gave you?",
                options: ["a", "an", "the"],
                answer: "the",
                explanation: "특정한 책(내가 준 그 책)을 가리키므로 정관사 'the'를 사용합니다."
            }
        ]
    },
    {
        id: "a1-possessive-adjectives",
        level: "A1",
        title: "소유형용사 (Possessive Adjectives)",
        description: "나의, 너의, 그의 등 소유를 나타내는 표현을 학습합니다.",
        // ★ 가독성을 위해 2페이지로 재구성
        detailedExplanation: [
            [ // 페이지 1
                {
                    type: 'paragraph',
                    content: "'이건 내 거야!', '저건 네 책이야!' 처럼, 무언가가 누구의 것인지 말할 때 쓰는 표현을 배워볼 거예요. 이걸 '소유형용사'라고 한답니다. 🔑"
                },
                {
                    type: 'heading',
                    content: "주인에 따라 달라지는 소유형용사"
                },
                {
                    type: 'list',
                    items: [
                        "I (나) → my (나의)",
                        "you (너) → your (너의)",
                        "he (그) → his (그의)",
                        "she (그녀) → her (그녀의)"
                    ]
                }
            ],
            [ // 페이지 2
                {
                    type: 'example',
                    items: [
                        { de: "This is my car.", ko: "이것은 나의 차야." },
                        { de: "Where is your book?", ko: "네 책은 어디에 있니?" }
                    ]
                },
                {
                    type: 'paragraph',
                    content: "영어의 소유형용사는 뒤에 오는 명사가 단수든 복수든 형태가 바뀌지 않아서 배우기 쉬워요! 😉"
                }
            ]
        ],
        questions: [
            {
                stem: "This is ___ car.",
                options: ["my", "your", "his"],
                answer: "my",
                explanation: "'나(I)의' 소유를 나타낼 때는 'my'를 사용합니다."
            },
            {
                stem: "Where is ___ book?",
                options: ["my", "your", "his"],
                answer: "your",
                explanation: "'너(you)의' 소유를 나타낼 때는 'your'을 사용합니다."
            },
            {
                stem: "___ name is Tom.",
                options: ["My", "Your", "His"],
                answer: "His",
                explanation: "'그(he)의' 소유를 나타낼 때는 'his'를 사용합니다. 문장의 시작이므로 대문자로 씁니다."
            }
        ]
    },

    // ================ A1 레벨 추가 주제들 ================
    {
        id: "a1-plural-nouns",
        level: "A1",
        title: "복수형 명사 (Plural Nouns)",
        description: "명사의 단수형과 복수형 변화 규칙을 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'heading',
                    content: '복수형 명사 (Plural Nouns)'
                },
                {
                    type: 'paragraph',
                    content: "영어에서는 물건이 하나가 아니라 여러 개일 때, 명사의 형태를 바꿔줘야 해요! 이걸 '복수형'이라고 한답니다. 대부분 간단하게 -s만 붙이면 돼요! 📚"
                }
            ],
            [
                {
                    type: 'heading',
                    content: "기본 규칙들 ✨"
                },
                {
                    type: 'list',
                    items: [
                        "대부분의 명사: -s 붙이기 (book → books)",
                        "-s, -x, -ch, -sh로 끝나는 경우: -es 붙이기 (box → boxes)",
                        "자음+y로 끝나는 경우: y를 i로 바꾸고 -es (baby → babies)",
                        "불규칙 변화도 있어요! (child → children, mouse → mice)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "I have two ___.",
                options: ["cat", "cats", "cates"],
                answer: "cats",
                explanation: "일반적인 명사의 복수형은 -s를 붙입니다."
            },
            {
                stem: "There are three ___ on the table.",
                options: ["box", "boxs", "boxes"],
                answer: "boxes",
                explanation: "-x로 끝나는 명사의 복수형은 -es를 붙입니다."
            },
            {
                stem: "She has many ___.",
                options: ["babys", "babies", "baby"],
                answer: "babies",
                explanation: "자음+y로 끝나는 명사는 y를 i로 바꾸고 -es를 붙입니다."
            }
        ]
    },

    {
        id: "a1-simple-questions",
        level: "A1",
        title: "간단한 의문문 (Simple Questions)",
        description: "Yes/No 질문과 기본적인 의문사 질문을 만드는 방법을 배웁니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "궁금한 게 있을 때 어떻게 물어볼까요? 영어에는 두 가지 주요한 질문 방법이 있어요! 🤔"
                },
                {
                    type: 'heading',
                    content: "Yes/No 질문"
                },
                {
                    type: 'list',
                    items: [
                        "be 동사: Are you happy? (너는 행복해?)",
                        "일반동사: Do you like pizza? (너는 피자를 좋아해?)",
                        "3인칭 단수: Does she speak English? (그녀는 영어를 해?)"
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "의문사 질문 (Wh-Questions)"
                },
                {
                    type: 'list',
                    items: [
                        "What - 무엇 (What is your name?)",
                        "Where - 어디 (Where do you live?)",
                        "When - 언제 (When is your birthday?)",
                        "Who - 누구 (Who is your teacher?)",
                        "How - 어떻게 (How are you?)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "___ you a student?",
                options: ["Is", "Are", "Do"],
                answer: "Are",
                explanation: "You와 함께 쓰이는 be 동사는 'Are'입니다."
            },
            {
                stem: "___ is your name?",
                options: ["What", "Where", "When"],
                answer: "What",
                explanation: "이름을 묻는 의문사는 'What'입니다."
            },
            {
                stem: "___ she like music?",
                options: ["Do", "Does", "Is"],
                answer: "Does",
                explanation: "3인칭 단수 주어의 일반동사 의문문은 'Does'를 사용합니다."
            }
        ]
    },

    {
        id: "a1-present-simple",
        level: "A1",
        title: "현재 단순시제 (Present Simple)",
        description: "일상적인 행동과 습관을 나타내는 현재 단순시제를 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "매일 하는 일들, 변하지 않는 사실들을 말할 때 쓰는 시제예요! 아주 자주 사용하니까 꼭 알아두세요! 🌟"
                },
                {
                    type: 'heading',
                    content: "동사 변화 규칙"
                },
                {
                    type: 'list',
                    items: [
                        "I, You, We, They → 동사 원형 (I work, They play)",
                        "He, She, It → 동사원형 + s (He works, She plays)",
                        "-s, -x, -ch, -sh로 끝나면 -es (goes, watches)",
                        "자음+y로 끝나면 y→i+es (study → studies)"
                    ]
                }
            ],
            [
                {
                    type: 'example',
                    items: [
                        { de: "I go to school every day.", ko: "나는 매일 학교에 가요." },
                        { de: "She likes chocolate.", ko: "그녀는 초콜릿을 좋아해요." },
                        { de: "We don't watch TV.", ko: "우리는 TV를 보지 않아요." }
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "He ___ to work by bus.",
                options: ["go", "goes", "going"],
                answer: "goes",
                explanation: "3인칭 단수 주어와 함께 쓸 때는 동사에 -s를 붙입니다."
            },
            {
                stem: "I ___ English every day.",
                options: ["study", "studies", "studying"],
                answer: "study",
                explanation: "I와 함께 쓸 때는 동사 원형을 사용합니다."
            },
            {
                stem: "She ___ TV in the evening.",
                options: ["watch", "watches", "watching"],
                answer: "watches",
                explanation: "-ch로 끝나는 동사는 3인칭 단수에서 -es를 붙입니다."
            }
        ]
    },

    {
        id: "a1-negative-sentences",
        level: "A1",
        title: "부정문 (Negative Sentences)",
        description: "'~하지 않다'를 나타내는 부정문 만드는 방법을 배웁니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "'~하지 않는다', '~가 아니다'를 영어로 어떻게 말할까요? 부정문 만드는 방법을 배워봅시다! ❌"
                },
                {
                    type: 'heading',
                    content: "be 동사 부정문"
                },
                {
                    type: 'list',
                    items: [
                        "I am not (I'm not) happy.",
                        "You are not (You aren't) busy.",
                        "She is not (She isn't) at home."
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "일반동사 부정문"
                },
                {
                    type: 'list',
                    items: [
                        "I do not (don't) like coffee.",
                        "You do not (don't) speak French.",
                        "She does not (doesn't) eat meat.",
                        "They do not (don't) live here."
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "I ___ not hungry.",
                options: ["am", "do", "does"],
                answer: "am",
                explanation: "be 동사의 부정문은 'be + not'으로 만듭니다."
            },
            {
                stem: "She ___ like vegetables.",
                options: ["don't", "doesn't", "isn't"],
                answer: "doesn't",
                explanation: "3인칭 단수의 일반동사 부정문은 'doesn't + 동사원형'입니다."
            },
            {
                stem: "We ___ speak Spanish.",
                options: ["don't", "doesn't", "aren't"],
                answer: "don't",
                explanation: "복수 주어의 일반동사 부정문은 'don't + 동사원형'입니다."
            }
        ]
    },

    // ================ A2 레벨 주제들 ================
    {
        id: "a2-present-continuous",
        level: "A2",
        title: "현재진행시제 (Present Continuous)",
        description: "지금 진행 중인 행동을 나타내는 현재진행시제를 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "바로 지금 일어나고 있는 일을 말할 때 쓰는 시제예요! '~하고 있다'라는 뜻이죠. 🏃‍♂️"
                },
                {
                    type: 'heading',
                    content: "현재진행시제 만드는 방법"
                },
                {
                    type: 'list',
                    items: [
                        "be 동사 + 동사-ing",
                        "I am working (나는 일하고 있어요)",
                        "She is reading (그녀는 읽고 있어요)",
                        "They are playing (그들은 놀고 있어요)"
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "-ing 만드는 규칙"
                },
                {
                    type: 'list',
                    items: [
                        "대부분: 그냥 -ing (work → working)",
                        "-e로 끝나면: e를 빼고 -ing (make → making)",
                        "단모음+자음: 자음을 두 번 쓰고 -ing (run → running)",
                        "-ie로 끝나면: ie를 y로 바꾸고 -ing (lie → lying)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "I ___ watching TV right now.",
                options: ["am", "is", "are"],
                answer: "am",
                explanation: "I와 함께 쓰이는 be 동사는 'am'입니다."
            },
            {
                stem: "She is ___ her homework.",
                options: ["do", "doing", "does"],
                answer: "doing",
                explanation: "현재진행시제는 'be + 동사-ing' 형태입니다."
            },
            {
                stem: "They are ___ in the park.",
                options: ["run", "running", "runing"],
                answer: "running",
                explanation: "'run'은 자음을 두 번 쓰고 -ing를 붙입니다."
            }
        ]
    },

    {
        id: "a2-past-simple",
        level: "A2",
        title: "과거시제 (Past Simple)",
        description: "과거에 일어난 일을 나타내는 과거시제를 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "어제, 작년, 옛날에 일어난 일들을 말할 때 쓰는 시제예요! 과거의 이야기를 해봅시다! 🕰️"
                },
                {
                    type: 'heading',
                    content: "규칙동사 과거형"
                },
                {
                    type: 'list',
                    items: [
                        "대부분: -ed 붙이기 (work → worked)",
                        "-e로 끝나면: -d만 붙이기 (live → lived)",
                        "자음+y: y를 i로 바꾸고 -ed (study → studied)",
                        "단모음+자음: 자음 두 번 + ed (stop → stopped)"
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "불규칙동사 (외워야 해요!)"
                },
                {
                    type: 'list',
                    items: [
                        "go → went (가다)",
                        "see → saw (보다)",
                        "eat → ate (먹다)",
                        "come → came (오다)",
                        "buy → bought (사다)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "I ___ to the park yesterday.",
                options: ["go", "went", "going"],
                answer: "went",
                explanation: "'go'의 과거형은 불규칙동사 'went'입니다."
            },
            {
                stem: "She ___ her homework last night.",
                options: ["finish", "finished", "finishing"],
                answer: "finished",
                explanation: "규칙동사 'finish'의 과거형은 '-ed'를 붙여서 'finished'입니다."
            },
            {
                stem: "We ___ pizza for dinner.",
                options: ["eat", "eated", "ate"],
                answer: "ate",
                explanation: "'eat'의 과거형은 불규칙동사 'ate'입니다."
            }
        ]
    },

    {
        id: "a2-future-tense",
        level: "A2",
        title: "미래시제 (Future Tense)",
        description: "미래에 일어날 일을 나타내는 will과 going to를 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "내일, 다음 주, 미래에 일어날 일들을 말하는 방법을 배워봅시다! 두 가지 방법이 있어요! 🚀"
                },
                {
                    type: 'heading',
                    content: "Will + 동사원형"
                },
                {
                    type: 'list',
                    items: [
                        "즉석 결정: I will help you! (내가 도와줄게!)",
                        "예측: It will rain tomorrow. (내일 비가 올 거야)",
                        "약속: I will call you later. (나중에 전화할게)"
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "Be going to + 동사원형"
                },
                {
                    type: 'list',
                    items: [
                        "계획: I'm going to study English. (영어 공부할 거야)",
                        "확실한 예측: Look at the clouds! It's going to rain. (구름 봐! 비 올 것 같아)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "I ___ help you with your homework.",
                options: ["will", "going to", "am going"],
                answer: "will",
                explanation: "즉석 결정을 나타낼 때는 'will'을 사용합니다."
            },
            {
                stem: "She ___ going to visit her grandmother.",
                options: ["will", "is", "are"],
                answer: "is",
                explanation: "'be going to' 구문에서 she와 함께 쓸 때는 'is'를 사용합니다."
            },
            {
                stem: "They ___ travel to Japan next month.",
                options: ["will", "going to", "are going to"],
                answer: "are going to",
                explanation: "미리 계획된 일을 나타낼 때는 'be going to'를 사용합니다."
            }
        ]
    },

    {
        id: "a2-comparatives",
        level: "A2",
        title: "비교급 (Comparatives)",
        description: "두 개를 비교할 때 사용하는 비교급을 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "'이것이 저것보다 더 크다', '그녀가 나보다 더 예쁘다' 같이 비교할 때 쓰는 표현을 배워봅시다! ⚖️"
                },
                {
                    type: 'heading',
                    content: "짧은 형용사 (1-2음절)"
                },
                {
                    type: 'list',
                    items: [
                        "형용사 + er + than",
                        "tall → taller (He is taller than me.)",
                        "big → bigger (This bag is bigger than that one.)",
                        "happy → happier (She is happier than before.)"
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "긴 형용사 (3음절 이상)"
                },
                {
                    type: 'list',
                    items: [
                        "more + 형용사 + than",
                        "beautiful → more beautiful",
                        "interesting → more interesting",
                        "expensive → more expensive"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "This book is ___ than that one.",
                options: ["interesting", "more interesting", "most interesting"],
                answer: "more interesting",
                explanation: "긴 형용사의 비교급은 'more + 형용사' 형태입니다."
            },
            {
                stem: "He is ___ than his brother.",
                options: ["tall", "taller", "tallest"],
                answer: "taller",
                explanation: "짧은 형용사의 비교급은 '-er'을 붙입니다."
            },
            {
                stem: "Today is ___ than yesterday.",
                options: ["hot", "hotter", "more hot"],
                answer: "hotter",
                explanation: "자음을 두 번 쓰고 '-er'을 붙입니다."
            }
        ]
    },

    // ================ B1 레벨 주제들 ================
    {
        id: "b1-present-perfect",
        level: "B1",
        title: "현재완료시제 (Present Perfect)",
        description: "과거에 시작되어 현재까지 영향을 미치는 현재완료시제를 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "과거에 일어났지만 현재와 연결되는 일들을 말할 때 쓰는 시제예요! 경험, 완료, 계속 등을 나타냅니다! 🔗"
                },
                {
                    type: 'heading',
                    content: "현재완료 만드는 방법"
                },
                {
                    type: 'list',
                    items: [
                        "have/has + 과거분사(p.p.)",
                        "I have lived here for 5 years. (5년 동안 여기 살고 있어요)",
                        "She has visited Paris twice. (그녀는 파리에 두 번 가봤어요)",
                        "We have finished our work. (우리는 일을 끝냈어요)"
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "현재완료의 용법"
                },
                {
                    type: 'list',
                    items: [
                        "경험: I have been to London. (런던에 가본 적 있어요)",
                        "완료: I have done my homework. (숙제를 끝냈어요)",
                        "계속: I have lived here since 2010. (2010년부터 여기 살고 있어요)",
                        "결과: I have lost my key. (열쇠를 잃어버렸어요 - 지금도 없음)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "I ___ never been to Japan.",
                options: ["have", "has", "had"],
                answer: "have",
                explanation: "I와 함께 쓰이는 현재완료는 'have + 과거분사'입니다."
            },
            {
                stem: "She has ___ her keys.",
                options: ["lose", "lost", "losing"],
                answer: "lost",
                explanation: "현재완료는 'have/has + 과거분사' 형태입니다."
            },
            {
                stem: "How long ___ you lived here?",
                options: ["have", "has", "do"],
                answer: "have",
                explanation: "기간을 묻는 현재완료 의문문은 'How long have'로 시작합니다."
            }
        ]
    },

    {
        id: "b1-modal-verbs",
        level: "B1",
        title: "조동사 (Modal Verbs)",
        description: "can, could, should, must 등의 조동사 사용법을 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "가능성, 의무, 조언 등을 나타내는 특별한 동사들을 배워봅시다! 이들은 뒤에 동사 원형이 와요! 💪"
                },
                {
                    type: 'heading',
                    content: "능력과 가능성"
                },
                {
                    type: 'list',
                    items: [
                        "can: 현재 능력 (I can swim.)",
                        "could: 과거 능력, 정중한 요청 (I could swim when I was young.)",
                        "may/might: 가능성 (It may rain tomorrow.)"
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "의무와 조언"
                },
                {
                    type: 'list',
                    items: [
                        "must: 강한 의무 (You must wear a seatbelt.)",
                        "have to: 의무 (I have to work tomorrow.)",
                        "should: 조언 (You should study harder.)",
                        "would: 정중한 요청 (Would you help me?)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "You ___ wear a helmet when riding a bike.",
                options: ["should", "can", "may"],
                answer: "should",
                explanation: "안전에 대한 조언을 할 때는 'should'를 사용합니다."
            },
            {
                stem: "___ you speak French?",
                options: ["Can", "Must", "Should"],
                answer: "Can",
                explanation: "능력을 묻는 질문에는 'Can'을 사용합니다."
            },
            {
                stem: "It ___ rain tomorrow.",
                options: ["must", "might", "should"],
                answer: "might",
                explanation: "불확실한 가능성을 나타낼 때는 'might'를 사용합니다."
            }
        ]
    },

    {
        id: "b1-conditionals",
        level: "B1",
        title: "조건문 (Conditionals)",
        description: "가정과 결과를 나타내는 1조건문과 2조건문을 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "'만약 ~라면 ~할 것이다'라는 가정을 표현하는 방법을 배워봅시다! 실현 가능한 것과 가상적인 것을 구분해요! 🤔"
                },
                {
                    type: 'heading',
                    content: "1조건문 (실현 가능한 가정)"
                },
                {
                    type: 'list',
                    items: [
                        "If + 현재시제, will + 동사원형",
                        "If it rains, I will stay home. (비가 오면 집에 있을 거야)",
                        "If you study hard, you will pass. (열심히 공부하면 합격할 거야)"
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "2조건문 (가상적인 가정)"
                },
                {
                    type: 'list',
                    items: [
                        "If + 과거시제, would + 동사원형",
                        "If I were rich, I would travel. (내가 부자라면 여행을 할 텐데)",
                        "If she came, we would be happy. (그녀가 온다면 우리는 행복할 텐데)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "If it rains, I ___ stay home.",
                options: ["will", "would", "am"],
                answer: "will",
                explanation: "1조건문의 결과절은 'will + 동사원형'을 사용합니다."
            },
            {
                stem: "If I ___ rich, I would buy a car.",
                options: ["am", "were", "will be"],
                answer: "were",
                explanation: "2조건문의 조건절에서는 과거시제를 사용합니다."
            },
            {
                stem: "If she studies hard, she ___ pass the exam.",
                options: ["will", "would", "can"],
                answer: "will",
                explanation: "1조건문에서 미래의 결과를 나타낼 때는 'will'을 사용합니다."
            }
        ]
    },

    // ================ B2 레벨 주제들 ================
    {
        id: "b2-passive-voice",
        level: "B2",
        title: "수동태 (Passive Voice)",
        description: "행동의 대상에 초점을 맞춘 수동태 표현을 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "'누가 했는지'보다 '무엇이 되었는지'에 초점을 맞출 때 사용하는 표현이에요! 뉴스나 공식 문서에서 자주 써요! 📰"
                },
                {
                    type: 'heading',
                    content: "수동태 만드는 방법"
                },
                {
                    type: 'list',
                    items: [
                        "be 동사 + 과거분사(p.p.)",
                        "능동태: John writes a letter. → 수동태: A letter is written by John.",
                        "능동태: They built this house. → 수동태: This house was built by them."
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "시제별 수동태"
                },
                {
                    type: 'list',
                    items: [
                        "현재: is/are + p.p. (The book is read.)",
                        "과거: was/were + p.p. (The book was read.)",
                        "현재완료: has/have been + p.p. (The book has been read.)",
                        "미래: will be + p.p. (The book will be read.)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "This book ___ by millions of people.",
                options: ["reads", "is read", "is reading"],
                answer: "is read",
                explanation: "현재시제 수동태는 'is/are + 과거분사' 형태입니다."
            },
            {
                stem: "The house ___ built in 1990.",
                options: ["is", "was", "has been"],
                answer: "was",
                explanation: "과거시제 수동태는 'was/were + 과거분사' 형태입니다."
            },
            {
                stem: "A new school ___ built next year.",
                options: ["will", "will be", "is being"],
                answer: "will be",
                explanation: "미래시제 수동태는 'will be + 과거분사' 형태입니다."
            }
        ]
    },

    // ================ C1 레벨 주제들 ================
    {
        id: "c1-subjunctive",
        level: "C1",
        title: "가정법 (Subjunctive)",
        description: "가상적이거나 반사실적 상황을 나타내는 가정법을 학습합니다.",
        detailedExplanation: [
            [
                {
                    type: 'paragraph',
                    content: "현실과 다른 가상의 상황이나 소망, 후회 등을 표현할 때 사용하는 고급 문법입니다! 문학적이고 격식있는 표현에서 자주 사용돼요! 📚"
                },
                {
                    type: 'heading',
                    content: "가정법 과거 (현재 사실과 반대)"
                },
                {
                    type: 'list',
                    items: [
                        "If I were you, I would study harder. (내가 너라면 더 열심히 공부할 텐데)",
                        "If she had more money, she would travel. (그녀가 돈이 더 있다면 여행을 할 텐데)",
                        "I wish I were taller. (키가 더 컸으면 좋겠어)"
                    ]
                }
            ],
            [
                {
                    type: 'heading',
                    content: "가정법 과거완료 (과거 사실과 반대)"
                },
                {
                    type: 'list',
                    items: [
                        "If I had studied harder, I would have passed. (더 열심히 공부했다면 합격했을 텐데)",
                        "If she had left earlier, she wouldn't have been late. (더 일찍 떠났다면 늦지 않았을 텐데)",
                        "I wish I had gone to college. (대학에 갔더라면 좋았을 텐데)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "If I ___ rich, I would help the poor.",
                options: ["am", "were", "will be"],
                answer: "were",
                explanation: "가정법 과거에서는 현실과 반대되는 가정을 나타내기 위해 'were'를 사용합니다."
            },
            {
                stem: "I wish I ___ studied harder.",
                options: ["have", "had", "would have"],
                answer: "had",
                explanation: "과거에 대한 후회를 나타낼 때는 'wish + had + 과거분사'를 사용합니다."
            },
            {
                stem: "If she had left earlier, she ___ been late.",
                options: ["wouldn't have", "won't have", "hasn't"],
                answer: "wouldn't have",
                explanation: "가정법 과거완료의 결과절은 'would have + 과거분사'입니다."
            }
        ]
    }
];