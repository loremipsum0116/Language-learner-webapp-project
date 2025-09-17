// src/data/koreanFriendlyMockGrammar.js

export const japaneseGrammarTopics = [
    // ================ N5 레벨 주제들 ================
    {
        id: "n5-desu-da",
        level: "N5",
        title: "です/だ (명사문의 기초)",
        description: "일본어 첫 걸음! '~입니다'를 표현하는 です/だ로 자기소개부터 시작해요.",
        detailedExplanation: [
            [ // 페이지 1 - 개념 소개
                {
                    type: 'heading',
                    content: '🌸 です/だ - 일본어 문장의 시작!'
                },
                {
                    type: 'paragraph',
                    content: "안녕하세요! 'です'는 일본어에서 가장 먼저 배우는 마법의 단어예요. 이것만 알아도 '저는 학생입니다', '이것은 펜입니다' 같은 문장을 만들 수 있답니다! 한국어의 '~입니다/이다'와 같은 역할을 해요."
                },
                {
                    type: 'paragraph',
                    content: "🎯 잠깐! です와 だ의 차이가 뭐냐고요? 간단해요! です는 정중한 말(처음 보는 사람, 손님), だ는 반말(친구, 가족)이에요. 상황에 맞춰서 골라 쓰면 됩니다!"
                }
            ],
            [ // 페이지 2 - 활용법
                {
                    type: 'heading',
                    content: '📝 です/だ 완전 정복 가이드'
                },
                {
                    type: 'list',
                    items: [
                        "📹 정중체 (です) - 처음 만난 사람, 직장, 가게에서",
                        "   현재: です (입니다) → 私は韓国人です (저는 한국인입니다)",
                        "   과거: でした (였습니다) → 昨日は休みでした (어제는 쉬는 날이었습니다)",
                        "   부정: ではありません/じゃありません (아닙니다)",
                        "📹 보통체 (だ) - 친구, 가족, 혼잣말할 때",
                        "   현재: だ (이다/이야) → これは本だ (이것은 책이야)",
                        "   과거: だった (였다/였어) → 昨日は休みだった (어제는 쉬는 날이었어)",
                        "   부정: じゃない (아니야) → 学生じゃない (학생이 아니야)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "💡 꿀팁! ではありません은 딱딱한 느낌이라, 실제 회화에서는 じゃありません을 훨씬 많이 써요!"
                }
            ],
            [ // 페이지 3 - 실전 예문
                {
                    type: 'heading',
                    content: '🎌 실전! 이럴 때 이렇게 쓰세요'
                },
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>私<rt>わたし</rt></ruby>は<ruby>山田<rt>やまだ</rt></ruby>です。", ko: "저는 야마다입니다. (자기소개)" },
                        { de: "これは<ruby>私<rt>わたし</rt></ruby>のスマホです。", ko: "이것은 제 스마트폰입니다." },
                        { de: "<ruby>明日<rt>あした</rt></ruby>は<ruby>月曜日<rt>げつようび</rt></ruby>だ。", ko: "내일은 월요일이야. (혼잣말)" },
                        { de: "<ruby>彼<rt>かれ</rt></ruby>は<ruby>医者<rt>いしゃ</rt></ruby>じゃない。", ko: "그는 의사가 아니야." },
                        { de: "<ruby>昨日<rt>きのう</rt></ruby>のパーティーは<ruby>楽<rt>たの</rt></ruby>しかったです。", ko: "어제 파티는 즐거웠습니다." }
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🚨 주의! '良い(いい)'나 'きれい' 같은 형용사 뒤에 です를 붙이는 방법은 조금 달라요. 다음 시간에 배울 거예요!"
                }
            ]
        ],
        questions: [
            {
                stem: "<ruby>初<rt>はじ</rt></ruby>めまして、<ruby>私<rt>わたし</rt></ruby>は<ruby>田中<rt>たなか</rt></ruby>___。",
                options: ["です", "だ", "ます"],
                answer: "です",
                explanation: "처음 만나는 사람에게 자기소개할 때는 정중한 'です'를 사용해요! 'だ'를 쓰면 무례해 보일 수 있어요."
            },
            {
                stem: "これは<ruby>私<rt>わたし</rt></ruby>の<ruby>本<rt>ほん</rt></ruby>___。(친구에게)",
                options: ["じゃない", "ではありません", "くない"],
                answer: "じゃない",
                explanation: "친구에게 말할 때 '~이 아니야'는 'じゃない'를 써요. 'ではありません'은 너무 격식적이에요!"
            },
            {
                stem: "<ruby>昨日<rt>きのう</rt></ruby>は<ruby>日曜日<rt>にちようび</rt></ruby>___。(일기에)",
                options: ["です", "でした", "だった"],
                answer: "だった",
                explanation: "일기나 혼잣말에서 과거형은 'だった'를 써요. 자신에게는 정중할 필요 없죠!"
            },
            {
                stem: "あの<ruby>人<rt>ひと</rt></ruby>は<ruby>先生<rt>せんせい</rt></ruby>___。",
                options: ["ではありません", "じゃありません", "둘 다 가능"],
                answer: "둘 다 가능",
                explanation: "둘 다 '선생님이 아닙니다'라는 뜻! じゃありません이 더 자연스럽고 자주 쓰여요."
            }
        ]
    },
    {
        id: "n5-particles-basic",
        level: "N5",
        title: "조사 마스터 1탄 (は、が、を)",
        description: "일본어 문장의 뼈대! 주어, 목적어를 나타내는 핵심 조사 3총사를 공략해 봐요.",
        detailedExplanation: [
            [ // 페이지 1 - は vs が
                {
                    type: 'heading',
                    content: '🎯 は vs が - 영원한 라이벌!'
                },
                {
                    type: 'paragraph',
                    content: "일본어 학습자가 가장 헷갈려하는 は와 が! 사실 간단한 차이가 있어요. は는 '대화의 주제'를 소개할 때, が는 '새로운 정보'나 '강조'하고 싶을 때 써요. 문장의 스포트라이트를 어디에 비추는지의 차이랍니다!💡"
                },
                {
                    type: 'list',
                    items: [
                        "🔸 は (wa로 발음!) - 주제 마커 '~은/는'",
                        "   <ruby>私<rt>わたし</rt></ruby>は<ruby>学生<rt>がくせい</rt></ruby>です (저는 [주제로 말하자면] 학생입니다)",
                        "   <ruby>今日<rt>きょう</rt></ruby>は<ruby>暑<rt>あつ</rt></ruby>いです (오늘은 [주제로 말하자면] 덥네요)",
                        "🔸 が (ga) - 주격 조사 '~이/가'",
                        "   <ruby>誰<rt>だれ</rt></ruby>が<ruby>来<rt>き</rt></ruby>ましたか？(누가 왔어요? - 새로운 정보)",
                        "   <ruby>私<rt>わたし</rt></ruby>が<ruby>田中<rt>たなか</rt></ruby>です (제가 [바로] 다나카입니다 - 강조)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "💡 꿀팁! 자기소개할 때 '<ruby>私<rt>わたし</rt></ruby>は<ruby>田中<rt>たなか</rt></ruby>です'는 '저는 다나카예요'(일반 소개), '<ruby>私<rt>わたし</rt></ruby>が<ruby>田中<rt>たなか</rt></ruby>です'는 '제가 바로 그 다나카예요!'(강조)의 느낌!"
                }
            ],
            [ // 페이지 2 - を 목적어 조사
                {
                    type: 'heading',
                    content: '🎬 を (o로 발음) - 동작의 대상을 나타내요!'
                },
                {
                    type: 'paragraph',
                    content: "を는 한국어의 '~을/를'에 해당해요. 동사의 직접적인 대상(목적어)을 나타내죠. 발음은 'wo'보다는 'o'에 가깝게 해요!"
                },
                {
                    type: 'list',
                    items: [
                        "🍜 ラーメンを<ruby>食<rt>た</rt></ruby>べます (라면을 먹습니다)",
                        "📺 テレビを<ruby>見<rt>み</rt></ruby>ます (TV를 봅니다)",
                        "🎵 <ruby>音楽<rt>おんがく</rt></ruby>を<ruby>聞<rt>き</rt></ruby>きます (음악을 듣습니다)",
                        "📚 <ruby>日本語<rt>にほんご</rt></ruby>を<ruby>勉強<rt>べんきょう</rt></ruby>します (일본어를 공부합니다)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "⚠️ 주의! 좋아하다(<ruby>好<rt>す</rt></ruby>き), 싫어하다(<ruby>嫌<rt>きら</rt></ruby>い), 알다(<ruby>分<rt>わ</rt></ruby>かる) 같은 단어 앞에는 を가 아니라 が를 써요! N4에서 자세히 배울 거예요."
                }
            ],
            [ // 페이지 3 - 실전 연습
                {
                    type: 'heading',
                    content: '🏆 실전 문장으로 마스터!'
                },
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>私<rt>わたし</rt></ruby>は<ruby>毎日<rt>まいにち</rt></ruby>コーヒーを<ruby>飲<rt>の</rt></ruby>みます。", ko: "저는 매일 커피를 마십니다." },
                        { de: "<ruby>誰<rt>だれ</rt></ruby>がこれを<ruby>作<rt>つく</rt></ruby>りましたか？", ko: "누가 이것을 만들었어요?" },
                        { de: "<ruby>猫<rt>ねこ</rt></ruby>がいます。", ko: "(어!) 고양이가 있어요. (새로운 발견)" },
                        { de: "<ruby>私<rt>わたし</rt></ruby>は<ruby>猫<rt>ねこ</rt></ruby>が<ruby>好<rt>す</rt></ruby>きです。", ko: "저는 고양이를 좋아해요. (が 주의!)" }
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🎮 게임 팁! 문장을 만들 때 '는/은'으로 번역되면 は, '이/가'로 번역되면 が, '을/를'이면 を를 쓰면 대부분 맞아요!"
                }
            ]
        ],
        questions: [
            {
                stem: "<ruby>私<rt>わたし</rt></ruby>___<ruby>韓国人<rt>かんこくじん</rt></ruby>です。",
                options: ["は", "が", "を"],
                answer: "は",
                explanation: "자기소개에서 '저는'이라고 주제를 제시할 때는 は를 써요!"
            },
            {
                stem: "<ruby>誰<rt>だれ</rt></ruby>___<ruby>来<rt>き</rt></ruby>ましたか？",
                options: ["は", "が", "を"],
                answer: "が",
                explanation: "'누가'라고 새로운 정보를 물을 때는 が를 사용해요. は를 쓰면 어색해요!"
            },
            {
                stem: "パン___<ruby>食<rt>た</rt></ruby>べます。",
                options: ["は", "が", "を"],
                answer: "を",
                explanation: "'빵을 먹다'에서 '빵'은 먹는 대상(목적어)이므로 を를 써요!"
            },
            {
                stem: "<ruby>今日<rt>きょう</rt></ruby>___<ruby>月曜日<rt>げつようび</rt></ruby>です。",
                options: ["は", "が", "を"],
                answer: "は",
                explanation: "'오늘은'이라고 주제를 제시하므로 は를 사용합니다."
            },
            {
                stem: "ケーキ___<ruby>好<rt>す</rt></ruby>きです。",
                options: ["を", "が", "は"],
                answer: "が",
                explanation: "좋아하다(<ruby>好<rt>す</rt></ruby>き)는 특별히 が를 쓰는 단어예요! を를 쓰면 틀려요!"
            }
        ]
    },
    {
        id: "n5-particles-location",
        level: "N5",
        title: "조사 마스터 2탄 (に、で、へ、から、まで)",
        description: "장소와 시간, 방향을 나타내는 조사들! 일본 여행 갈 때 필수예요!",
        detailedExplanation: [
            [ // 페이지 1 - に vs で
                {
                    type: 'heading',
                    content: '📍 に vs で - 장소 조사 대결!'
                },
                {
                    type: 'paragraph',
                    content: "に와 で, 둘 다 '~에/에서'로 번역되지만 쓰임이 달라요! に는 '존재/도착점', で는 '행동하는 장소'를 나타내요. 쉽게 말해서, に는 '가만히 있는 곳', で는 '뭔가 하는 곳'이에요!"
                },
                {
                    type: 'list',
                    items: [
                        "🏠 に - 존재, 도착점 (있다/가다)",
                        "   <ruby>学校<rt>がっこう</rt></ruby>に<ruby>行<rt>い</rt></ruby>きます (학교에 갑니다 - 도착점)",
                        "   <ruby>部屋<rt>へや</rt></ruby>に<ruby>猫<rt>ねこ</rt></ruby>がいます (방에 고양이가 있어요)",
                        "   7<ruby>時<rt>じ</rt></ruby>に<ruby>起<rt>お</rt></ruby>きます (7시에 일어나요 - 특정 시간)",
                        "🎪 で - 행동 장소, 수단 (하다)",
                        "   <ruby>図書館<rt>としょかん</rt></ruby>で<ruby>勉強<rt>べんきょう</rt></ruby>します (도서관에서 공부해요)",
                        "   <ruby>箸<rt>はし</rt></ruby>で<ruby>食<rt>た</rt></ruby>べます (젓가락으로 먹어요 - 수단)",
                        "   バスで<ruby>行<rt>い</rt></ruby>きます (버스로 가요 - 교통수단)"
                    ]
                }
            ],
            [ // 페이지 2 - へ、から、まで
                {
                    type: 'heading',
                    content: '🚀 へ、から、まで - 방향과 범위!'
                },
                {
                    type: 'list',
                    items: [
                        "➡️ へ (e로 발음!) - 방향 '~으로'",
                        "   <ruby>日本<rt>にほん</rt></ruby>へ<ruby>行<rt>い</rt></ruby>きます (일본으로 갑니다)",
                        "   * に와 비슷하지만 へ는 방향성을 더 강조!",
                        "🔙 から - 시작점 '~부터/에서'",
                        "   9<ruby>時<rt>じ</rt></ruby>から<ruby>始<rt>はじ</rt></ruby>まります (9시부터 시작해요)",
                        "   <ruby>韓国<rt>かんこく</rt></ruby>から<ruby>来<rt>き</rt></ruby>ました (한국에서 왔어요)",
                        "🏁 まで - 끝나는 점 '~까지'",
                        "   5<ruby>時<rt>じ</rt></ruby>まで<ruby>働<rt>はたら</rt></ruby>きます (5시까지 일해요)",
                        "   <ruby>駅<rt>えき</rt></ruby>まで<ruby>歩<rt>ある</rt></ruby>きます (역까지 걸어요)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "💡 콤보 기술! 'から~まで'는 세트로 자주 써요: 9<ruby>時<rt>じ</rt></ruby>から5<ruby>時<rt>じ</rt></ruby>まで (9시부터 5시까지)"
                }
            ],
            [ // 페이지 3 - 실전과 팁
                {
                    type: 'heading',
                    content: '🗾 실전! 일본 여행 필수 문장'
                },
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>東京駅<rt>とうきょうえき</rt></ruby>まで、お<ruby>願<rt>ねが</rt></ruby>いします。", ko: "도쿄역까지 부탁해요. (택시에서)" },
                        { de: "ここからどのくらいですか？", ko: "여기서 얼마나 걸려요?" },
                        { de: "<ruby>電車<rt>でんしゃ</rt></ruby>で<ruby>行<rt>い</rt></ruby>きます。", ko: "전철로 갑니다." },
                        { de: "コンビニに<ruby>行<rt>い</rt></ruby>きます。", ko: "편의점에 갑니다." },
                        { de: "カフェで<ruby>友達<rt>ともだち</rt></ruby>に<ruby>会<rt>あ</rt></ruby>います。", ko: "카페에서 친구를 만나요." }
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🎯 암기 팁! '에 있다/간다' = に, '에서 한다' = で, '부터~까지' = から~まで"
                }
            ]
        ],
        questions: [
            {
                stem: "<ruby>学校<rt>がっこう</rt></ruby>___<ruby>勉強<rt>べんきょう</rt></ruby>します。",
                options: ["に", "で", "へ"],
                answer: "で",
                explanation: "'학교에서 공부한다'처럼 행동하는 장소는 で를 써요! に는 '있다/간다'에만!"
            },
            {
                stem: "7<ruby>時<rt>じ</rt></ruby>___<ruby>起<rt>お</rt></ruby>きます。",
                options: ["に", "で", "から"],
                answer: "に",
                explanation: "시간을 나타낼 때는 に를 사용해요! '7시에 일어나요'"
            },
            {
                stem: "<ruby>韓国<rt>かんこく</rt></ruby>___<ruby>日本<rt>にほん</rt></ruby>へ<ruby>行<rt>い</rt></ruby>きます。",
                options: ["に", "から", "まで"],
                answer: "から",
                explanation: "'한국에서(부터) 일본으로'처럼 출발점은 から를 써요!"
            },
            {
                stem: "バス___<ruby>学校<rt>がっこう</rt></ruby>に<ruby>行<rt>い</rt></ruby>きます。",
                options: ["に", "で", "を"],
                answer: "で",
                explanation: "교통수단은 で를 사용해요! '버스로 학교에 가요'"
            },
            {
                stem: "9<ruby>時<rt>じ</rt></ruby>___5<ruby>時<rt>じ</rt></ruby>___<ruby>働<rt>はたら</rt></ruby>きます。",
                options: ["から/まで", "に/に", "で/で"],
                answer: "から/まで",
                explanation: "'9시부터 5시까지'는 から~まで 콤보를 사용해요!"
            }
        ]
    },
    {
        id: "n5-i-adjectives",
        level: "N5",
        title: "い형용사 - 감정과 상태를 표현하기",
        description: "寒い, 暑い, おいしい! 일본어로 감정과 상태를 생생하게 표현해 봐요.",
        detailedExplanation: [
            [ // 페이지 1 - い형용사 소개
                {
                    type: 'heading',
                    content: '🎨 い형용사란? 스스로 변신하는 형용사!'
                },
                {
                    type: 'paragraph',
                    content: "い형용사는 이름 그대로 'い'로 끝나는 형용사예요! 특별한 점은 동사처럼 스스로 과거, 부정 형태로 변신한다는 것! '大きい→大きかった', 'おいしい→おいしくなかった' 처럼요. 한국어와 비슷해서 이해하기 쉬워요!"
                },
                {
                    type: 'list',
                    items: [
                        "🌡️ 날씨/온도: <ruby>暑<rt>あつ</rt></ruby>い(덥다), <ruby>寒<rt>さむ</rt></ruby>い(춥다), <ruby>暖<rt>あたた</rt></ruby>かい(따뜻하다)",
                        "😋 맛: おいしい(맛있다), まずい(맛없다), <ruby>辛<rt>から</rt></ruby>い(맵다)",
                        "📏 크기: <ruby>大<rt>おお</rt></ruby>きい(크다), <ruby>小<rt>ちい</rt></ruby>さい(작다), <ruby>長<rt>なが</rt></ruby>い(길다), <ruby>短<rt>みじか</rt></ruby>い(짧다)",
                        "💰 가격: <ruby>高<rt>たか</rt></ruby>い(비싸다/높다), <ruby>安<rt>やす</rt></ruby>い(싸다)",
                        "😊 감정: <ruby>楽<rt>たの</rt></ruby>しい(즐겁다), うれしい(기쁘다), <ruby>悲<rt>かな</rt></ruby>しい(슬프다)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🎯 포인트! い형용사는 です 없이도 문장을 끝낼 수 있어요. '大きい(크다)' 자체로 완전한 문장!"
                }
            ],
            [ // 페이지 2 - 활용법
                {
                    type: 'heading',
                    content: '🔄 い형용사 4단 변신!'
                },
                {
                    type: 'list',
                    items: [
                        "✅ 현재 긍정: ~い",
                        "   おいしい (맛있다)",
                        "   <ruby>今日<rt>きょう</rt></ruby>は<ruby>暑<rt>あつ</rt></ruby>い (오늘은 덥다)",
                        "❌ 현재 부정: ~くない",
                        "   おいしくない (맛없다)",
                        "   <ruby>今日<rt>きょう</rt></ruby>は<ruby>暑<rt>あつ</rt></ruby>くない (오늘은 덥지 않다)",
                        "⏮️ 과거 긍정: ~かった",
                        "   おいしかった (맛있었다)",
                        "   <ruby>昨日<rt>きのう</rt></ruby>は<ruby>暑<rt>あつ</rt></ruby>かった (어제는 더웠다)",
                        "⏮️❌ 과거 부정: ~くなかった",
                        "   おいしくなかった (맛없었다)",
                        "   <ruby>昨日<rt>きのう</rt></ruby>は<ruby>暑<rt>あつ</rt></ruby>くなかった (어제는 덥지 않았다)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "💡 암기법! 마지막 い를 떼고 → 부정은 くない, 과거는 かった를 붙여요!"
                }
            ],
            [ // 페이지 3 - 특별한 い형용사와 실전
                {
                    type: 'heading',
                    content: '⚠️ 주의! 특별한 い형용사'
                },
                {
                    type: 'list',
                    items: [
                        "🌟 いい/<ruby>良<rt>よ</rt></ruby>い(좋다) - 불규칙 변화!",
                        "   부정: いくない (X) → よくない (O)",
                        "   과거: いかった (X) → よかった (O)",
                        "😎 かっこいい(멋있다) = かっこ + いい",
                        "   かっこよくない (멋없다)",
                        "   かっこよかった (멋있었다)"
                    ]
                },
                {
                    type: 'example',
                    items: [
                        { de: "ラーメンはおいしいです。", ko: "라면은 맛있습니다. (정중체)" },
                        { de: "<ruby>昨日<rt>きのう</rt></ruby>の<ruby>映画<rt>えいが</rt></ruby>は<ruby>面白<rt>おもしろ</rt></ruby>かった。", ko: "어제 영화는 재미있었어." },
                        { de: "この<ruby>服<rt>ふく</rt></ruby>は<ruby>高<rt>たか</rt></ruby>くない。", ko: "이 옷은 비싸지 않아." },
                        { de: "<ruby>天気<rt>てんき</rt></ruby>がよくなかった。", ko: "날씨가 좋지 않았어." },
                        { de: "<ruby>部屋<rt>へや</rt></ruby>が<ruby>狭<rt>せま</rt></ruby>くて<ruby>暗<rt>くら</rt></ruby>い。", ko: "방이 좁고 어두워. (て형 연결)" }
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🍜 일본 여행 팁! 식당에서 음식을 먹고 'おいしかったです！'라고 하면 주방장님이 정말 기뻐해요!"
                }
            ]
        ],
        questions: [
            {
                stem: "この<ruby>料理<rt>りょうり</rt></ruby>は___。(맛있다)",
                options: ["おいしい", "おいしいです", "둘 다 가능"],
                answer: "둘 다 가능",
                explanation: "い형용사는 그 자체로 문장을 끝낼 수 있어요! です를 붙이면 더 정중해져요."
            },
            {
                stem: "<ruby>昨日<rt>きのう</rt></ruby>は___。(추웠다)",
                options: ["<ruby>寒<rt>さむ</rt></ruby>い", "<ruby>寒<rt>さむ</rt></ruby>かった", "<ruby>寒<rt>さむ</rt></ruby>いでした"],
                answer: "<ruby>寒<rt>さむ</rt></ruby>かった",
                explanation: "い형용사 과거형은 い를 かった로 바꿔요! '<ruby>寒<rt>さむ</rt></ruby>いでした'는 틀린 표현이에요!"
            },
            {
                stem: "この<ruby>本<rt>ほん</rt></ruby>は___。(재미없다)",
                options: ["<ruby>面白<rt>おもしろ</rt></ruby>い", "<ruby>面白<rt>おもしろ</rt></ruby>くない", "<ruby>面白<rt>おもしろ</rt></ruby>いない"],
                answer: "<ruby>面白<rt>おもしろ</rt></ruby>くない",
                explanation: "い형용사 부정형은 い를 くない로 바꿔요! '<ruby>面白<rt>おもしろ</rt></ruby>いない'는 없는 표현!"
            },
            {
                stem: "<ruby>天気<rt>てんき</rt></ruby>が___。(좋지 않았다)",
                options: ["いくなかった", "よくなかった", "いいくなかった"],
                answer: "よくなかった",
                explanation: "いい(좋다)는 특별해요! よくない(부정), よかった(과거)로 불규칙하게 변해요!"
            },
            {
                stem: "<ruby>服<rt>ふく</rt></ruby>が___きれいだ。(새롭고)",
                options: ["<ruby>新<rt>あたら</rt></ruby>しい", "<ruby>新<rt>あたら</rt></ruby>しくて", "<ruby>新<rt>あたら</rt></ruby>しく"],
                answer: "<ruby>新<rt>あたら</rt></ruby>しくて",
                explanation: "두 형용사를 연결할 때는 て형을 써요! い를 떼고 'くて'를 붙입니다."
            }
        ]
    },
    {
        id: "n5-na-adjectives",
        level: "N5",
        title: "な형용사 - 상태와 성질을 표현하기",
        description: "静か, 便利, 有名! 명사 같은 형용사, な형용사를 마스터해 봐요.",
        detailedExplanation: [
            [ // 페이지 1 - な형용사 소개
                {
                    type: 'heading',
                    content: '🌟 な형용사란? 명사 같은 형용사!'
                },
                {
                    type: 'paragraph',
                    content: "な형용사는 명사를 꾸며줄 때 'な'를 붙이는 특별한 형용사예요! 활용 방법이 명사와 거의 같아서 '형용동사'라고도 불리죠. 대부분 한자어나 외래어로 된 단어들이 여기에 속해요."
                },
                {
                    type: 'list',
                    items: [
                        "🤫 <ruby>静<rt>しず</rt></ruby>か - 조용함/조용하다",
                        "🎉 <ruby>賑<rt>にぎ</rt></ruby>やか - 번화함/번화하다",
                        "✨ きれい - 예쁨/예쁘다/깨끗하다",
                        "🏢 <ruby>便利<rt>べんり</rt></ruby> - 편리함/편리하다",
                        "⭐ <ruby>有名<rt>ゆうめい</rt></ruby> - 유명함/유명하다",
                        "😊 <ruby>元気<rt>げんき</rt></ruby> - 건강함/건강하다",
                        "❤️ <ruby>好<rt>す</rt></ruby>き - 좋아함/좋아하다",
                        "😔 <ruby>嫌<rt>きら</rt></ruby>い - 싫어함/싫어하다"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "💡 구별법! 대부분 い로 끝나지 않아요. きれい, 嫌い는 い로 끝나지만 예외적인 な형용사!"
                }
            ],
            [ // 페이지 2 - 활용법
                {
                    type: 'heading',
                    content: '📝 な형용사는 명사처럼 활용해요!'
                },
                {
                    type: 'list',
                    items: [
                        "🔸 명사 수식: な형용사 + な + 명사",
                        "   <ruby>静<rt>しず</rt></ruby>かな<ruby>部屋<rt>へや</rt></ruby> (조용한 방)",
                        "   <ruby>便利<rt>べんり</rt></ruby>な<ruby>場所<rt>ばしょ</rt></ruby> (편리한 장소)",
                        "🔸 현재 긍정: だ/です",
                        "   <ruby>部屋<rt>へや</rt></ruby>は<ruby>静<rt>しず</rt></ruby>かだ/<ruby>静<rt>しず</rt></ruby>かです (방은 조용하다/합니다)",
                        "🔸 현재 부정: じゃない/ではありません",
                        "   <ruby>部屋<rt>へや</rt></ruby>は<ruby>静<rt>しず</rt></ruby>かじゃない (방은 조용하지 않다)",
                        "🔸 과거 긍정: だった/でした",
                        "   <ruby>部屋<rt>へや</rt></ruby>は<ruby>静<rt>しず</rt></ruby>かだった (방은 조용했다)",
                        "🔸 과거 부정: じゃなかった/ではありませんでした",
                        "   <ruby>部屋<rt>へや</rt></ruby>は<ruby>静<rt>しず</rt></ruby>かじゃなかった (방은 조용하지 않았다)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "⚠️ 주의! 문장을 끝낼 때는 '<ruby>静<rt>しず</rt></ruby>かです'(O), '<ruby>静<rt>しず</rt></ruby>かなです'(X)! な는 명사를 꾸며줄 때만!"
                }
            ],
            [ // 페이지 3 - 실전과 비교
                {
                    type: 'heading',
                    content: '🆚 い형용사 vs な형용사 구별하기!'
                },
                {
                    type: 'list',
                    items: [
                        "い형용사: <ruby>大<rt>おお</rt></ruby>きい<ruby>犬<rt>いぬ</rt></ruby> (큰 개) - い 그대로!",
                        "な형용사: <ruby>静<rt>しず</rt></ruby>かな<ruby>犬<rt>いぬ</rt></ruby> (조용한 개) - な 추가!",
                        "헷갈리는 단어들:",
                        "   きれい(예쁜) → きれいな<ruby>人<rt>ひと</rt></ruby> (な형용사!)",
                        "   <ruby>嫌<rt>きら</rt></ruby>い(싫은) → <ruby>嫌<rt>きら</rt></ruby>いな<ruby>食<rt>た</rt></ruby>べ<ruby>物<rt>もの</rt></ruby> (な형용사!)",
                        "   <ruby>有名<rt>ゆうめい</rt></ruby>(유명한) → <ruby>有名<rt>ゆうめい</rt></ruby>な<ruby>歌手<rt>かしゅ</rt></ruby> (な형용사!)"
                    ]
                },
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>彼女<rt>かのじょ</rt></ruby>はきれいです。", ko: "그녀는 예쁩니다." },
                        { de: "きれいな<ruby>花<rt>はな</rt></ruby>を<ruby>買<rt>か</rt></ruby>いました。", ko: "예쁜 꽃을 샀습니다." },
                        { de: "この<ruby>町<rt>まち</rt></ruby>は<ruby>静<rt>しず</rt></ruby>かじゃない。", ko: "이 마을은 조용하지 않아." },
                        { de: "<ruby>昨日<rt>きのう</rt></ruby>は<ruby>元気<rt>げんき</rt></ruby>でした。", ko: "어제는 기운이 넘쳤습니다." },
                        { de: "<ruby>有名<rt>ゆうめい</rt></ruby>な<ruby>人<rt>ひと</rt></ruby>に<ruby>会<rt>あ</rt></ruby>った。", ko: "유명한 사람을 만났어." }
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🎯 꿀팁! '좋아하다(<ruby>好<rt>す</rt></ruby>き)'와 '싫어하다(<ruby>嫌<rt>きら</rt></ruby>い)'는 な형용사! 그래서 'ケーキが<ruby>好<rt>す</rt></ruby>きです'(케이크를 좋아해요)처럼 조사는 が를 써요!"
                }
            ]
        ],
        questions: [
            {
                stem: "___<ruby>部屋<rt>へや</rt></ruby>です。(조용한)",
                options: ["<ruby>静<rt>しず</rt></ruby>か", "<ruby>静<rt>しず</rt></ruby>かな", "<ruby>静<rt>しず</rt></ruby>かい"],
                answer: "<ruby>静<rt>しず</rt></ruby>かな",
                explanation: "な형용사가 명사를 수식할 때는 반드시 'な'를 붙여요!"
            },
            {
                stem: "この<ruby>場所<rt>ばしょ</rt></ruby>は___です。(편리하다)",
                options: ["<ruby>便利<rt>べんり</rt></ruby>", "<ruby>便利<rt>べんり</rt></ruby>な", "<ruby>便利<rt>べんり</rt></ruby>だ"],
                answer: "<ruby>便利<rt>べんり</rt></ruby>",
                explanation: "な형용사가 です 앞에 올 때는 그대로! 'な'를 붙이면 틀려요!"
            },
            {
                stem: "<ruby>彼女<rt>かのじょ</rt></ruby>は___。(예뻤다)",
                options: ["きれいだった", "きれかった", "きれいでした"],
                answer: "きれいだった",
                explanation: "きれい는 な형용사! 과거형은 명사처럼 'だった'(반말) 또는 'でした'(존댓말)를 써요!"
            },
            {
                stem: "<ruby>野菜<rt>やさい</rt></ruby>が___。(싫지 않다)",
                options: ["<ruby>嫌<rt>きら</rt></ruby>いない", "<ruby>嫌<rt>きら</rt></ruby>くない", "<ruby>嫌<rt>きら</rt></ruby>いじゃない"],
                answer: "<ruby>嫌<rt>きら</rt></ruby>いじゃない",
                explanation: "<ruby>嫌<rt>きら</rt></ruby>い는 な형용사! 부정형은 'じゃない'를 사용해요!"
            },
            {
                stem: "___<ruby>歌手<rt>かしゅ</rt></ruby>を<ruby>知<rt>し</rt></ruby>っていますか。(유명한)",
                options: ["<ruby>有名<rt>ゆうめい</rt></ruby>", "<ruby>有名<rt>ゆうめい</rt></ruby>な", "<ruby>有名<rt>ゆうめい</rt></ruby>の"],
                answer: "<ruby>有名<rt>ゆうめい</rt></ruby>な",
                explanation: "な형용사가 명사(<ruby>歌手<rt>かしゅ</rt></ruby>)를 꾸밀 때는 'な'를 붙여요! 'の'는 명사와 명사 사이에!"
            }
        ]
    },
    {
        id: "n5-basic-verbs",
        level: "N5",
        title: "동사 기초 - ます형 완벽 마스터",
        description: "일본어 동사의 정중한 표현! 일상 회화의 80%는 이걸로 해결!",
        detailedExplanation: [
            [ // 페이지 1 - ます형 소개
                {
                    type: 'heading',
                    content: '🎌 ます형 - 정중한 일본어의 시작!'
                },
                {
                    type: 'paragraph',
                    content: "ます형은 일본어 동사의 정중한 형태예요! 처음 만난 사람, 가게, 직장에서는 반드시 ます형을 써야 해요. 좋은 소식은 활용법이 아주 규칙적이라 외우기 쉽다는 것! 한번 익혀두면 평생 쓸 수 있어요!"
                },
                {
                    type: 'list',
                    items: [
                        "🍽️ <ruby>食<rt>た</rt></ruby>べます (먹습니다)",
                        "🥤 <ruby>飲<rt>の</rt></ruby>みます (마십니다)",
                        "👀 <ruby>見<rt>み</rt></ruby>ます (봅니다)",
                        "🎧 <ruby>聞<rt>き</rt></ruby>きます (듣습니다)",
                        "📖 <ruby>読<rt>よ</rt></ruby>みます (읽습니다)",
                        "✏️ <ruby>書<rt>か</rt></ruby>きます (씁니다)",
                        "🗣️ <ruby>話<rt>はな</rt></ruby>します (말합니다)",
                        "🚶 <ruby>行<rt>い</rt></ruby>きます (갑니다)",
                        "🏠 <ruby>帰<rt>かえ</rt></ruby>ります (돌아갑니다)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "💡 발견! 모든 ます형 동사는 'ます'로 끝나요! 앞부분만 바뀌죠?"
                }
            ],
            [ // 페이지 2 - 시제 활용
                {
                    type: 'heading',
                    content: '⏰ ます형 4가지 시제 변화!'
                },
                {
                    type: 'list',
                    items: [
                        "✅ 현재/미래 긍정: ~ます",
                        "   <ruby>毎日<rt>まいにち</rt></ruby><ruby>勉強<rt>べんきょう</rt></ruby>します (매일 공부합니다)",
                        "   <ruby>明日<rt>あした</rt></ruby><ruby>行<rt>い</rt></ruby>きます (내일 갑니다)",
                        "❌ 현재/미래 부정: ~ません",
                        "   テレビを<ruby>見<rt>み</rt></ruby>ません (TV를 보지 않습니다)",
                        "   <ruby>明日<rt>あした</rt></ruby><ruby>行<rt>い</rt></ruby>きません (내일 가지 않습니다)",
                        "⏮️ 과거 긍정: ~ました",
                        "   <ruby>昨日<rt>きのう</rt></ruby><ruby>勉強<rt>べんきょう</rt></ruby>しました (어제 공부했습니다)",
                        "   <ruby>朝<rt>あさ</rt></ruby>ご<ruby>飯<rt>はん</rt></ruby>を<ruby>食<rt>た</rt></ruby>べました (아침을 먹었습니다)",
                        "⏮️❌ 과거 부정: ~ませんでした",
                        "   <ruby>昨日<rt>きのう</rt></ruby><ruby>勉強<rt>べんきょう</rt></ruby>しませんでした (어제 공부하지 않았습니다)",
                        "   <ruby>朝<rt>あさ</rt></ruby>ご<ruby>飯<rt>はん</rt></ruby>を<ruby>食<rt>た</rt></ruby>べませんでした (아침을 먹지 않았습니다)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🎯 암기 꿀팁! ます→ません(부정), ました(과거), ませんでした(과거부정)! 정말 규칙적이죠?"
                }
            ],
            [ // 페이지 3 - 실전 대화
                {
                    type: 'heading',
                    content: '💬 실전! 일본 여행 필수 회화'
                },
                {
                    type: 'example',
                    items: [
                        { de: "すみません、<ruby>英語<rt>えいご</rt></ruby>を<ruby>話<rt>はな</rt></ruby>しますか？", ko: "실례합니다, 영어 할 수 있으세요?" },
                        { de: "メニューを<ruby>見<rt>み</rt></ruby>せてください。", ko: "메뉴를 보여주세요." },
                        { de: "クレジットカードは<ruby>使<rt>つか</rt></ruby>えますか？", ko: "신용카드 사용할 수 있나요?" },
                        { de: "<ruby>駅<rt>えき</rt></ruby>まで<ruby>歩<rt>ある</rt></ruby>きます。", ko: "역까지 걸어갑니다." },
                        { de: "<ruby>明日<rt>あした</rt></ruby>また<ruby>来<rt>き</rt></ruby>ます。", ko: "내일 다시 오겠습니다." }
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🌸 문화 팁! 일본에서는 점원, 처음 만난 사람에게는 반드시 ます형을 써요. 반말(동사 원형)을 쓰면 무례하게 보일 수 있어요!"
                }
            ]
        ],
        questions: [
            {
                stem: "<ruby>私<rt>わたし</rt></ruby>は<ruby>毎朝<rt>まいあさ</rt></ruby>コーヒーを___。(마십니다)",
                options: ["<ruby>飲<rt>の</rt></ruby>みます", "<ruby>飲<rt>の</rt></ruby>みません", "<ruby>飲<rt>の</rt></ruby>みました"],
                answer: "<ruby>飲<rt>の</rt></ruby>みます",
                explanation: "현재의 습관은 'ます'형! '매일 아침 커피를 마십니다'"
            },
            {
                stem: "<ruby>昨日<rt>きのう</rt></ruby>、<ruby>映画<rt>えいが</rt></ruby>を___。(봤습니다)",
                options: ["<ruby>見<rt>み</rt></ruby>ます", "<ruby>見<rt>み</rt></ruby>ました", "<ruby>見<rt>み</rt></ruby>ません"],
                answer: "<ruby>見<rt>み</rt></ruby>ました",
                explanation: "과거의 일은 'ました'! '어제 영화를 봤습니다'"
            },
            {
                stem: "<ruby>朝<rt>あさ</rt></ruby>ご<ruby>飯<rt>はん</rt></ruby>を___。(먹지 않았습니다)",
                options: ["<ruby>食<rt>た</rt></ruby>べません", "<ruby>食<rt>た</rt></ruby>べませんでした", "<ruby>食<rt>た</rt></ruby>べました"],
                answer: "<ruby>食<rt>た</rt></ruby>べませんでした",
                explanation: "과거 부정은 'ませんでした'! '아침을 먹지 않았습니다'"
            },
            {
                stem: "<ruby>明日<rt>あした</rt></ruby><ruby>学校<rt>がっこう</rt></ruby>に___。(가지 않습니다)",
                options: ["<ruby>行<rt>い</rt></ruby>きません", "<ruby>行<rt>い</rt></ruby>きませんでした", "<ruby>行<rt>い</rt></ruby>きました"],
                answer: "<ruby>行<rt>い</rt></ruby>きません",
                explanation: "미래의 부정은 'ません'! '내일 학교에 가지 않습니다'"
            },
            {
                stem: "<ruby>日本語<rt>にほんご</rt></ruby>を___か？(공부합니까?)",
                options: ["<ruby>勉強<rt>べんきょう</rt></ruby>します", "<ruby>勉強<rt>べんきょう</rt></ruby>しました", "<ruby>勉強<rt>べんきょう</rt></ruby>"],
                answer: "<ruby>勉強<rt>べんきょう</rt></ruby>します",
                explanation: "의문문도 'ます'형 그대로! 끝에 'か'만 붙여요!"
            }
        ]
    },

    // ================ N4 레벨 주제들 ================
    {
        id: "n4-te-form",
        level: "N4",
        title: "て형 - 일본어의 만능 연결고리",
        description: "부탁, 진행, 허락, 금지! 일본어에서 가장 많이 쓰는 て형을 공략해요!",
        detailedExplanation: [
            [ // 페이지 1 - て형 소개와 만들기
                {
                    type: 'heading',
                    content: '🔗 て형 - 일본어 문장을 잇는 마법!'
                },
                {
                    type: 'paragraph',
                    content: "て형은 일본어에서 정말! 정말! 중요해요! 부탁할 때(~してください), 진행형(~ている), 허락(~てもいい), 금지(~てはいけない) 등 수많은 표현의 기초가 되거든요. て형만 제대로 익혀도 일본어 실력이 확 늘 거예요!"
                },
                {
                    type: 'heading',
                    content: '📝 て형 만드는 규칙 (5가지만 외우면 OK!)'
                },
                {
                    type: 'list',
                    items: [
                        "🎯 1그룹 동사 (う단 동사)",
                        "   う・つ・る → って: <ruby>買<rt>か</rt></ruby>う→<ruby>買<rt>か</rt></ruby>って, <ruby>待<rt>ま</rt></ruby>つ→<ruby>待<rt>ま</rt></ruby>って",
                        "   む・ぶ・ぬ → んで: <ruby>読<rt>よ</rt></ruby>む→<ruby>読<rt>よ</rt></ruby>んで, <ruby>呼<rt>よ</rt></ruby>ぶ→<ruby>呼<rt>よ</rt></ruby>んで",
                        "   く → いて: <ruby>書<rt>か</rt></ruby>く→<ruby>書<rt>か</rt></ruby>いて (⚠️예외: <ruby>行<rt>い</rt></ruby>く→<ruby>行<rt>い</rt></ruby>って)",
                        "   ぐ → いで: <ruby>泳<rt>およ</rt></ruby>ぐ→<ruby>泳<rt>およ</rt></ruby>いで",
                        "   す → して: <ruby>話<rt>はな</rt></ruby>す→<ruby>話<rt>はな</rt></ruby>して",
                        "🎯 2그룹 동사 (る 동사): る 떼고 → て",
                        "   <ruby>食<rt>た</rt></ruby>べる→<ruby>食<rt>た</rt></ruby>べて, <ruby>見<rt>み</rt></ruby>る→<ruby>見<rt>み</rt></ruby>て",
                        "🎯 3그룹 (불규칙): する→して, <ruby>来<rt>く</rt></ruby>る→<ruby>来<rt>き</rt></ruby>て"
                    ]
                }
            ],
            [ // 페이지 2 - て형의 다양한 용법
                {
                    type: 'heading',
                    content: '💫 て형의 놀라운 변신술!'
                },
                {
                    type: 'list',
                    items: [
                        "🙏 ~てください (부탁/지시)",
                        "   ちょっと<ruby>待<rt>ま</rt></ruby>ってください (잠깐 기다려 주세요)",
                        "🏃 ~ている (진행/상태)",
                        "   <ruby>今<rt>いま</rt></ruby><ruby>勉強<rt>べんきょう</rt></ruby>している (지금 공부하고 있어)",
                        "✅ ~てもいい (허락)",
                        "   <ruby>入<rt>はい</rt></ruby>ってもいいですか (들어가도 되나요?)",
                        "❌ ~てはいけない (금지)",
                        "   ここで<ruby>写真<rt>しゃしん</rt></ruby>を<ruby>撮<rt>と</rt></ruby>ってはいけません (여기서 사진 찍으면 안 됩니다)",
                        "🎁 ~てあげる/くれる/もらう (주고받기)",
                        "   <ruby>手伝<rt>てつだ</rt></ruby>ってあげる (도와줄게)",
                        "➕ 동작 연결 (그리고/~하고 나서)",
                        "   <ruby>朝<rt>あさ</rt></ruby><ruby>起<rt>お</rt></ruby>きて、シャワーを<ruby>浴<rt>あ</rt></ruby>びて、<ruby>朝<rt>あさ</rt></ruby>ご<ruby>飯<rt>はん</rt></ruby>を<ruby>食<rt>た</rt></ruby>べます"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "💡 꿀팁! て형은 '~하고'의 의미로 문장을 자연스럽게 이어줘요!"
                }
            ],
            [ // 페이지 3 - 실전 연습
                {
                    type: 'heading',
                    content: '🗾 실전! 일본 여행 필수 て형 표현'
                },
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>写真<rt>しゃしん</rt></ruby>を<ruby>撮<rt>と</rt></ruby>ってもいいですか？", ko: "사진 찍어도 되나요?" },
                        { de: "もう<ruby>一度<rt>いちど</rt></ruby><ruby>言<rt>い</rt></ruby>ってください。", ko: "다시 한번 말해주세요." },
                        { de: "ここで<ruby>待<rt>ま</rt></ruby>っています。", ko: "여기서 기다리고 있을게요." },
                        { de: "<ruby>触<rt>さわ</rt></ruby>ってはいけません。", ko: "만지면 안 됩니다." },
                        { de: "<ruby>道<rt>みち</rt></ruby>を<ruby>教<rt>おし</rt></ruby>えてください。", ko: "길을 가르쳐 주세요." }
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🌸 문화 팁! '~てください'는 정중한 부탁이지만, 너무 자주 쓰면 명령처럼 들릴 수 있어요. 더 정중하게는 '~ていただけませんか'라고 해요."
                }
            ]
        ],
        questions: [
            {
                stem: "ちょっと___ください。(기다리다)",
                options: ["<ruby>待<rt>ま</rt></ruby>て", "<ruby>待<rt>ま</rt></ruby>って", "<ruby>待<rt>ま</rt></ruby>ちて"],
                answer: "<ruby>待<rt>ま</rt></ruby>って",
                explanation: "<ruby>待<rt>ま</rt></ruby>つ는 つ로 끝나므로 って로 변해요! '기다려 주세요'"
            },
            {
                stem: "<ruby>今<rt>いま</rt></ruby>、<ruby>本<rt>ほん</rt></ruby>を___います。(읽다)",
                options: ["<ruby>読<rt>よ</rt></ruby>んで", "<ruby>読<rt>よ</rt></ruby>って", "<ruby>読<rt>よ</rt></ruby>いて"],
                answer: "<ruby>読<rt>よ</rt></ruby>んで",
                explanation: "<ruby>読<rt>よ</rt></ruby>む는 む로 끝나므로 んで로 변해요! '읽고 있습니다'"
            },
            {
                stem: "<ruby>写真<rt>しゃしん</rt></ruby>を___もいいですか。(찍다)",
                options: ["<ruby>撮<rt>と</rt></ruby>って", "<ruby>撮<rt>と</rt></ruby>いて", "<ruby>撮<rt>と</rt></ruby>んで"],
                answer: "<ruby>撮<rt>と</rt></ruby>って",
                explanation: "<ruby>撮<rt>と</rt></ruby>る는 る로 끝나는 1그룹 동사! って로 변해요!"
            },
            {
                stem: "<ruby>静<rt>しず</rt></ruby>かに___ください。(하다)",
                options: ["して", "すって", "しって"],
                answer: "して",
                explanation: "する의 て형은 して! '조용히 해주세요'"
            },
            {
                stem: "ここに___はいけません。(들어가다)",
                options: ["<ruby>入<rt>はい</rt></ruby>て", "<ruby>入<rt>はい</rt></ruby>って", "<ruby>入<rt>はい</rt></ruby>いて"],
                answer: "<ruby>入<rt>はい</rt></ruby>って",
                explanation: "<ruby>入<rt>はい</rt></ruby>る는 る로 끝나지만 예외적인 1그룹! って로 변해요! '들어가면 안 됩니다'"
            }
        ]
    },
    {
        id: "n4-plain-form",
        level: "N4",
        title: "보통형(기본형) - 일본어의 진짜 모습",
        description: "친구와 자연스럽게! 일기나 독백에 쓰는 동사의 기본형을 배워봐요.",
        detailedExplanation: [
            [ // 페이지 1 - 보통형 소개
                {
                    type: 'heading',
                    content: '🎭 보통형 - 일본어의 민낯!'
                },
                {
                    type: 'paragraph',
                    content: "지금까지 배운 'ます형'은 정중한 마스크를 쓴 일본어였어요. 이제 그 마스크를 벗은 '진짜' 일본어를 만날 시간! 친구와의 대화, 일기, 혼잣말, 각종 문법 표현에서는 이 보통형을 사용해요!"
                },
                {
                    type: 'list',
                    items: [
                        "📚 사전형 (기본형/원형) - 사전에 나오는 형태",
                        "   <ruby>食<rt>た</rt></ruby>べる (먹다), <ruby>飲<rt>の</rt></ruby>む (마시다), <ruby>行<rt>い</rt></ruby>く (가다)",
                        "🗣️ 언제 사용할까?",
                        "   • 친한 친구와의 대화",
                        "   • 일기나 소설을 쓸 때",
                        "   • 생각이나 의견을 말할 때 (~と<ruby>思<rt>おも</rt></ruby>う)",
                        "   • 이유를 설명할 때 (~から)",
                        "   • 가능/불가능을 말할 때 (~ことができる)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "💡 발견! 일본 드라마나 애니메이션에서 듣는 대사의 대부분이 바로 이 보통형이에요!"
                }
            ],
            [ // 페이지 2 - 보통형 활용
                {
                    type: 'heading',
                    content: '🔄 보통형 4단 활용표'
                },
                {
                    type: 'list',
                    items: [
                        "🔘 1그룹 동사 (う단 동사)",
                        "   현재: <ruby>飲<rt>の</rt></ruby>む (마신다)",
                        "   부정: <ruby>飲<rt>の</rt></ruby>まない (안 마신다)",
                        "   과거: <ruby>飲<rt>の</rt></ruby>んだ (마셨다)",
                        "   과거부정: <ruby>飲<rt>の</rt></ruby>まなかった (안 마셨다)",
                        "🔗 2그룹 동사 (る 동사)",
                        "   현재: <ruby>食<rt>た</rt></ruby>べる (먹는다)",
                        "   부정: <ruby>食<rt>た</rt></ruby>べない (안 먹는다)",
                        "   과거: <ruby>食<rt>た</rt></ruby>べた (먹었다)",
                        "   과거부정: <ruby>食<rt>た</rt></ruby>べなかった (안 먹었다)",
                        "🔥 3그룹 (불규칙)",
                        "   する→する/しない/した/しなかった",
                        "   <ruby>来<rt>く</rt></ruby>る→<ruby>来<rt>く</rt></ruby>る/<ruby>来<rt>こ</rt></ruby>ない/<ruby>来<rt>き</rt></ruby>た/<ruby>来<rt>こ</rt></ruby>なかった"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "⚠️ 꿀팁! 과거형 만들기는 て형과 비슷해요! て→た, で→だ로만 바꾸면 끝!"
                }
            ],
            [ // 페이지 3 - 실전 활용
                {
                    type: 'heading',
                    content: '💬 보통형으로 자연스러운 일본어!'
                },
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>明日<rt>あした</rt></ruby><ruby>行<rt>い</rt></ruby>くと<ruby>思<rt>おも</rt></ruby>う。", ko: "내일 갈 것 같아. (생각)" },
                        { de: "<ruby>宿題<rt>しゅくだい</rt></ruby>をしたから、<ruby>遊<rt>あそ</rt></ruby>べる。", ko: "숙제를 했으니까 놀 수 있어. (이유)" },
                        { de: "<ruby>日本語<rt>にほんご</rt></ruby>を<ruby>話<rt>はな</rt></ruby>すことができる。", ko: "일본어를 말할 수 있다. (가능)" },
                        { de: "<ruby>昨日<rt>きのう</rt></ruby><ruby>見<rt>み</rt></ruby>た<ruby>映画<rt>えいが</rt></ruby>は<ruby>面白<rt>おもしろ</rt></ruby>かった。", ko: "어제 본 영화는 재미있었어. (수식)" },
                        { de: "<ruby>今日<rt>きょう</rt></ruby>は<ruby>行<rt>い</rt></ruby>かない。", ko: "오늘은 안 가. (친구에게)" }
                    ]
                },
                {
                    type: 'list',
                    items: [
                        "🎬 드라마/애니 실전 대사",
                        "   <ruby>行<rt>い</rt></ruby>くぞ！(가자!)",
                        "   <ruby>食<rt>た</rt></ruby>べる？(먹을래?)",
                        "   <ruby>分<rt>わ</rt></ruby>かった。(알았어.)",
                        "   できない。(못 해.)",
                        "   <ruby>帰<rt>かえ</rt></ruby>る。(집에 갈래.)"
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "<ruby>明日<rt>あした</rt></ruby>___と<ruby>思<rt>おも</rt></ruby>う。(간다)",
                options: ["<ruby>行<rt>い</rt></ruby>きます", "<ruby>行<rt>い</rt></ruby>く", "<ruby>行<rt>い</rt></ruby>って"],
                answer: "<ruby>行<rt>い</rt></ruby>く",
                explanation: "と<ruby>思<rt>おも</rt></ruby>う 앞에는 보통형! '내일 갈 거라고 생각해'"
            },
            {
                stem: "<ruby>昨日<rt>きのう</rt></ruby>___。(먹었다 - 친구에게)",
                options: ["<ruby>食<rt>た</rt></ruby>べた", "<ruby>食<rt>た</rt></ruby>べました", "<ruby>食<rt>た</rt></ruby>べる"],
                answer: "<ruby>食<rt>た</rt></ruby>べた",
                explanation: "친구에게는 보통형 과거! <ruby>食<rt>た</rt></ruby>べる→<ruby>食<rt>た</rt></ruby>べた"
            },
            {
                stem: "<ruby>宿題<rt>しゅくだい</rt></ruby>を___から、<ruby>遊<rt>あそ</rt></ruby>ぼう。(했다)",
                options: ["しました", "した", "する"],
                answer: "した",
                explanation: "から(이유) 앞에는 보통형! '숙제 했으니까 놀자'"
            },
            {
                stem: "<ruby>日本語<rt>にほんご</rt></ruby>が___。(못 한다 - 혼잣말)",
                options: ["できない", "できません", "できなかった"],
                answer: "できない",
                explanation: "혼잣말이나 친구에게는 보통형! '일본어 못 해'"
            },
            {
                stem: "<ruby>昨日<rt>きのう</rt></ruby>は___。(가지 않았다)",
                options: ["<ruby>行<rt>い</rt></ruby>かない", "<ruby>行<rt>い</rt></ruby>かなかった", "<ruby>行<rt>い</rt></ruby>きませんでした"],
                answer: "<ruby>行<rt>い</rt></ruby>かなかった",
                explanation: "보통형 과거부정! '어제는 가지 않았어'"
            }
        ]
    },

    // ================ N3 레벨 주제들 ================
    {
        id: "n3-passive",
        level: "N3",
        title: "수동형 (られる/れる) - 당하는 표현",
        description: "칭찬받고, 혼나고, 사랑받고! 수동 표현으로 더 풍부한 일본어를 구사해봐요.",
        detailedExplanation: [
            [ // 페이지 1
                {
                    type: 'heading',
                    content: '🎭 수동형 - 주어가 동작을 당하는 입장!'
                },
                {
                    type: 'paragraph',
                    content: "한국어의 '~되다, ~받다, ~당하다'에 해당하는 표현이에요. 일본어는 수동형을 정말 자주 사용해요! 특히 피해를 봤거나 감정을 표현할 때 많이 쓴답니다."
                },
                {
                    type: 'list',
                    items: [
                        "📌 수동형 만드는 법",
                        "1그룹: 어미 u단 → a단 + れる",
                        "   <ruby>読<rt>よ</rt></ruby>む→<ruby>読<rt>よ</rt></ruby>まれる (읽히다)",
                        "   <ruby>言<rt>い</rt></ruby>う→<ruby>言<rt>い</rt></ruby>われる ((그런) 말을 듣다)",
                        "2그룹: る → られる",
                        "   <ruby>食<rt>た</rt></ruby>べる→<ruby>食<rt>た</rt></ruby>べられる (먹히다)",
                        "   <ruby>見<rt>み</rt></ruby>る→<ruby>見<rt>み</rt></ruby>られる (보여지다)",
                        "3그룹: する→される, <ruby>来<rt>く</rt></ruby>る→<ruby>来<rt>こ</rt></ruby>られる"
                    ]
                }
            ],
            [ // 페이지 2
                {
                    type: 'heading',
                    content: '💭 일본어다운 수동 표현'
                },
                {
                    type: 'list',
                    items: [
                        "😊 칭찬/평가: <ruby>先生<rt>せんせい</rt></ruby>に<ruby>褒<rt>ほ</rt></ruby>められる (선생님께 칭찬받다)",
                        "😢 피해: <ruby>雨<rt>あめ</rt></ruby>に<ruby>降<rt>ふ</rt></ruby>られる (비를 맞다 - 비 때문에 피해를 본 뉘앙스)",
                        "😤 민폐: <ruby>隣<rt>となり</rt></ruby>の<ruby>人<rt>ひと</rt></ruby>に<ruby>騒<rt>さわ</rt></ruby>がれる (옆 사람이 시끄럽게 해서 괴롭다)",
                        "❤️ 감정: みんなに<ruby>愛<rt>あい</rt></ruby>される (모두에게 사랑받다)",
                        "📱 행동: <ruby>名前<rt>なまえ</rt></ruby>を<ruby>呼<rt>よ</rt></ruby>ばれる (이름이 불리다)"
                    ]
                },
                {
                    type: 'paragraph',
                    content: "🌸 문화 팁! 일본어는 직접적인 표현보다 수동형을 선호해요. '<ruby>先生<rt>せんせい</rt></ruby>が<ruby>私<rt>わたし</rt></ruby>を<ruby>褒<rt>ほ</rt></ruby>めた'보다 '<ruby>私<rt>わたし</rt></ruby>は<ruby>先生<rt>せんせい</rt></ruby>に<ruby>褒<rt>ほ</rt></ruby>められた'가 훨씬 자연스러워요!"
                }
            ],
            [ // 페이지 3
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>先生<rt>せんせい</rt></ruby>に<ruby>褒<rt>ほ</rt></ruby>められた。", ko: "선생님께 칭찬받았다." },
                        { de: "<ruby>友達<rt>ともだち</rt></ruby>に<ruby>笑<rt>わら</rt></ruby>われた。", ko: "친구가 나를 보고 웃었다. (놀림당했다는 뉘앙스)" },
                        { de: "<ruby>雨<rt>あめ</rt></ruby>に<ruby>降<rt>ふ</rt></ruby>られて<ruby>濡<rt>ぬ</rt></ruby>れてしまった。", ko: "비를 맞아서 젖어버렸다." },
                        { de: "この<ruby>歌<rt>うた</rt></ruby>は<ruby>世界中<rt>せかいじゅう</rt></ruby>で<ruby>愛<rt>あい</rt></ruby>されている。", ko: "이 노래는 전 세계에서 사랑받고 있다." },
                        { de: "<ruby>財布<rt>さいふ</rt></ruby>を<ruby>盗<rt>ぬす</rt></ruby>まれた。", ko: "지갑을 도둑맞았다." }
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "<ruby>先生<rt>せんせい</rt></ruby>に___。(혼났다)",
                options: ["<ruby>叱<rt>しか</rt></ruby>る", "<ruby>叱<rt>しか</rt></ruby>られた", "<ruby>叱<rt>しか</rt></ruby>った"],
                answer: "<ruby>叱<rt>しか</rt></ruby>られた",
                explanation: "<ruby>叱<rt>しか</rt></ruby>る(혼내다)의 수동형은 <ruby>叱<rt>しか</rt></ruby>られる! 과거형은 <ruby>叱<rt>しか</rt></ruby>られた"
            },
            {
                stem: "みんなに___いる。(사랑받고)",
                options: ["<ruby>愛<rt>あい</rt></ruby>されて", "<ruby>愛<rt>あい</rt></ruby>して", "<ruby>愛<rt>あい</rt></ruby>される"],
                answer: "<ruby>愛<rt>あい</rt></ruby>されて",
                explanation: "<ruby>愛<rt>あい</rt></ruby>する의 수동형 <ruby>愛<rt>あい</rt></ruby>される + て형 = <ruby>愛<rt>あい</rt></ruby>されて"
            },
            {
                stem: "<ruby>名前<rt>なまえ</rt></ruby>を___。(불렸다)",
                options: ["<ruby>呼<rt>よ</rt></ruby>んだ", "<ruby>呼<rt>よ</rt></ruby>ばれた", "<ruby>呼<rt>よ</rt></ruby>ぶれた"],
                answer: "<ruby>呼<rt>よ</rt></ruby>ばれた",
                explanation: "<ruby>呼<rt>よ</rt></ruby>ぶ의 수동형은 <ruby>呼<rt>よ</rt></ruby>ばれる! '이름이 불렸다'"
            }
        ]
    },
    {
        id: "n3-causative",
        level: "N3",
        title: "사역형 (させる/せる) - 시키는 표현",
        description: "아이를 재우고, 친구를 웃기고! 누군가에게 무언가를 시키는 표현을 배워봐요.",
        detailedExplanation: [
            [ // 페이지 1
                {
                    type: 'heading',
                    content: '👨‍👩‍👧 사역형 - 시키거나 허락하는 표현!'
                },
                {
                    type: 'paragraph',
                    content: "'~시키다, ~하게 하다'를 나타내는 문법이에요. 부모가 아이에게, 상사가 부하에게 무언가를 시킬 때 써요. '허락'의 의미로도 사용된답니다!"
                },
                {
                    type: 'list',
                    items: [
                        "📌 사역형 만드는 법",
                        "1그룹: 어미 u단 → a단 + せる",
                        "   <ruby>読<rt>よ</rt></ruby>む→<ruby>読<rt>よ</rt></ruby>ませる (읽게 하다)",
                        "   <ruby>行<rt>い</rt></ruby>く→<ruby>行<rt>い</rt></ruby>かせる (가게 하다)",
                        "2그룹: る → させる",
                        "   <ruby>食<rt>た</rt></ruby>べる→<ruby>食<rt>た</rt></ruby>べさせる (먹게 하다)",
                        "   <ruby>見<rt>み</rt></ruby>る→<ruby>見<rt>み</rt></ruby>させる (보게 하다)",
                        "3그룹: する→させる, <ruby>来<rt>く</rt></ruby>る→<ruby>来<rt>こ</rt></ruby>させる"
                    ]
                }
            ],
            [ // 페이지 2
                {
                    type: 'heading',
                    content: '🎯 사역형의 2가지 의미'
                },
                {
                    type: 'list',
                    items: [
                        "😤 강제/지시: ~에게 ~을 시키다",
                        "   <ruby>母<rt>はは</rt></ruby>は<ruby>弟<rt>おとうと</rt></ruby>に<ruby>部屋<rt>へや</rt></ruby>を<ruby>掃除<rt>そうじ</rt></ruby>させた (엄마는 남동생에게 방을 청소시켰다)",
                        "😊 허락/방임: ~가 ~하게 해주다",
                        "   <ruby>子供<rt>こども</rt></ruby>にゲームをさせてあげる (아이에게 게임을 하게 해주다)",
                        "🙏 부탁: ~させてください (~하게 해주세요)",
                        "   <ruby>休<rt>やす</rt></ruby>ませてください (쉬게 해주세요)"
                    ]
                }
            ],
            [ // 페이지 3
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>母<rt>はは</rt></ruby>は<ruby>私<rt>わたし</rt></ruby>に<ruby>宿題<rt>しゅくだい</rt></ruby>をさせた。", ko: "엄마는 나에게 숙제를 시켰다." },
                        { de: "<ruby>子供<rt>こども</rt></ruby>を<ruby>早<rt>はや</rt></ruby>く<ruby>寝<rt>ね</rt></ruby>かせる。", ko: "아이를 일찍 재운다." },
                        { de: "<ruby>笑<rt>わら</rt></ruby>わせてくれてありがとう。", ko: "웃게 해줘서 고마워." },
                        { de: "<ruby>少<rt>すこ</rt></ruby>し<ruby>考<rt>かんが</rt></ruby>えさせてください。", ko: "조금 생각할 시간을 주세요." },
                        { de: "<ruby>私<rt>わたし</rt></ruby>に<ruby>払<rt>はら</rt></ruby>わせてください。", ko: "제가 내게 해주세요. (제가 낼게요)"}
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "<ruby>子供<rt>こども</rt></ruby>に<ruby>本<rt>ほん</rt></ruby>を___。(읽게 했다)",
                options: ["<ruby>読<rt>よ</rt></ruby>んだ", "<ruby>読<rt>よ</rt></ruby>ませた", "<ruby>読<rt>よ</rt></ruby>まれた"],
                answer: "<ruby>読<rt>よ</rt></ruby>ませた",
                explanation: "<ruby>読<rt>よ</rt></ruby>む의 사역형은 <ruby>読<rt>よ</rt></ruby>ませる! 과거형은 <ruby>読<rt>よ</rt></ruby>ませた. '아이에게 책을 읽게 했다'"
            },
            {
                stem: "<ruby>少<rt>すこ</rt></ruby>し___ください。(쉬게 하다)",
                options: ["<ruby>休<rt>やす</rt></ruby>ませて", "<ruby>休<rt>やす</rt></ruby>まれて", "<ruby>休<rt>やす</rt></ruby>んで"],
                answer: "<ruby>休<rt>やす</rt></ruby>ませて",
                explanation: "<ruby>休<rt>やす</rt></ruby>む→<ruby>休<rt>やす</rt></ruby>ませる, 부탁할 땐 て형! <ruby>休<rt>やす</rt></ruby>ませてください. '쉬게 해주세요'"
            },
            {
                stem: "<ruby>弟<rt>おとうと</rt></ruby>を<ruby>買<rt>か</rt></ruby>い<ruby>物<rt>もの</rt></ruby>に___。(가게 했다)",
                options: ["<ruby>行<rt>い</rt></ruby>かせた", "<ruby>行<rt>い</rt></ruby>かれた", "<ruby>行<rt>い</rt></ruby>った"],
                answer: "<ruby>行<rt>い</rt></ruby>かせた",
                explanation: "<ruby>行<rt>い</rt></ruby>く의 사역형은 <ruby>行<rt>い</rt></ruby>かせる! 과거형은 <ruby>行<rt>い</rt></ruby>かせた. '남동생을 쇼핑하러 가게 했다'"
            }
        ]
    },

    // ================ N2 레벨 주제들 ================
    {
        id: "n2-keigo-basics",
        level: "N2",
        title: "경어 기초 - 존경어와 겸양어",
        description: "비즈니스 일본어의 시작! 상대를 높이고 나를 낮추는 진짜 어른의 일본어를 배워봅시다.",
        detailedExplanation: [
            [ // 페이지 1
                {
                    type: 'heading',
                    content: '👔 경어 - 진정한 어른의 일본어!'
                },
                {
                    type: 'paragraph',
                    content: "일본 사회 생활의 필수 스킬! 상대를 높이는 '존경어', 자신을 낮추는 '겸양어', 그리고 말을 예쁘게 하는 '정중어'. 이 3가지를 마스터하면 당신도 일본 비즈니스 전문가!"
                },
                {
                    type: 'list',
                    items: [
                        "👑 존경어 (상대의 행동을 높임)",
                        "   いらっしゃる (계시다) ← いる/<ruby>行<rt>い</rt></ruby>く/<ruby>来<rt>く</rt></ruby>る",
                        "   おっしゃる (말씀하시다) ← <ruby>言<rt>い</rt></ruby>う",
                        "   <ruby>召<rt>め</rt></ruby>し<ruby>上<rt>あ</rt></ruby>がる (드시다) ← <ruby>食<rt>た</rt></ruby>べる/<ruby>飲<rt>の</rt></ruby>む",
                        "   ご覧になる (보시다) ← 見る",
                        "🙇 겸양어 (자신의 행동을 낮춤)",
                        "   <ruby>参<rt>まい</rt></ruby>る (가다/오다) ← <ruby>行<rt>い</rt></ruby>く/<ruby>来<rt>く</rt></ruby>る",
                        "   <ruby>申<rt>もう</rt></ruby>す (말씀드리다) ← <ruby>言<rt>い</rt></ruby>う",
                        "   いただく (받다/먹다) ← もらう/<ruby>食<rt>た</rt></ruby>べる",
                        "   <ruby>拝見<rt>はいけん</rt></ruby>する (보다) ← 見る"
                    ]
                }
            ],
            [ // 페이지 2
                {
                    type: 'heading',
                    content: '🎭 상황별 경어 사용법'
                },
                {
                    type: 'list',
                    items: [
                        "☎️ 전화/이메일",
                        "   お<ruby>忙<rt>いそが</rt></ruby>しいところ<ruby>恐<rt>おそ</rt></ruby>れ<ruby>入<rt>い</rt></ruby>りますが (바쁘신 와중에 죄송합니다만)",
                        "   いつもお<ruby>世話<rt>せわ</rt></ruby>になっております (항상 신세 지고 있습니다)",
                        "🏢 회사에서",
                        "   <ruby>承知<rt>しょうち</rt></ruby>いたしました (알겠습니다 - 겸양)",
                        "   かしこまりました (알겠습니다 - 겸양, 주로 서비스업)",
                        "   <ruby>恐<rt>おそ</rt></ruby>れ<ruby>入<rt>い</rt></ruby>りますが (죄송하지만 - 부탁할 때)",
                        "🏬 가게/식당에서",
                        "   いらっしゃいませ (어서 오세요)",
                        "   <ruby>少々<rt>しょうしょう</rt></ruby>お<ruby>待<rt>ま</rt></ruby>ちください (잠시만 기다려 주세요)"
                    ]
                }
            ],
            [ // 페이지 3
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>社長<rt>しゃちょう</rt></ruby>はもうお<ruby>帰<rt>かえ</rt></ruby>りになりました。", ko: "사장님은 이미 돌아가셨습니다. (존경어)" },
                        { de: "<ruby>明日<rt>あした</rt></ruby>、<ruby>午後<rt>ごご</rt></ruby>3<ruby>時<rt>じ</rt></ruby>に<ruby>伺<rt>うかが</rt></ruby>います。", ko: "내일 오후 3시에 찾아뵙겠습니다. (겸양어)" },
                        { de: "お<ruby>名前<rt>なまえ</rt></ruby>を<ruby>伺<rt>うかが</rt></ruby>ってもよろしいですか。", ko: "성함을 여쭤봐도 괜찮을까요? (겸양어)" },
                        { de: "<ruby>資料<rt>しりょう</rt></ruby>を<ruby>拝見<rt>はいけん</rt></ruby>しました。", ko: "자료를 보았습니다. (겸양어)" }
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "<ruby>社長<rt>しゃちょう</rt></ruby>は<ruby>会議室<rt>かいぎしつ</rt></ruby>に___。(계십니다)",
                options: ["います", "いらっしゃいます", "おります"],
                answer: "いらっしゃいます",
                explanation: "상사의 행동에는 존경어 'いらっしゃる'를 사용해요! 'おります'는 자신을 낮추는 겸양어예요."
            },
            {
                stem: "<ruby>私<rt>わたし</rt></ruby>は<ruby>田中<rt>たなか</rt></ruby>と___。(다나카라고 합니다)",
                options: ["<ruby>言<rt>い</rt></ruby>います", "おっしゃいます", "<ruby>申<rt>もう</rt></ruby>します"],
                answer: "<ruby>申<rt>もう</rt></ruby>します",
                explanation: "자신의 행동은 겸양어 '<ruby>申<rt>もう</rt></ruby>す'로 낮춰서 표현해요!"
            },
            {
                stem: "お<ruby>客様<rt>きゃくさま</rt></ruby>、<ruby>何<rt>なに</rt></ruby>を___か。(드시겠습니까?)",
                options: ["<ruby>食<rt>た</rt></ruby>べます", "<ruby>召<rt>め</rt></ruby>し<ruby>上<rt>あ</rt></ruby>がります", "いただきます"],
                answer: "<ruby>召<rt>め</rt></ruby>し<ruby>上<rt>あ</rt></ruby>がります",
                explanation: "손님의 행동에는 존경어 '召し上がる'를 사용해요! 'いただきます'는 자신이 먹을 때 쓰는 겸양 표현이에요."
            }
        ]
    },

    // ================ N1 레벨 주제들 ================
    {
        id: "n1-advanced-grammar",
        level: "N1",
        title: "고급 문형 - ～にかけては / ～ともなると",
        description: "네이티브처럼! 신문과 소설에 나오는 고급 표현을 마스터해요.",
        detailedExplanation: [
            [ // 페이지 1
                {
                    type: 'heading',
                    content: '🎓 N1 고급 문법 - 진정한 상급자로!'
                },
                {
                    type: 'paragraph',
                    content: "이제 일본어의 정수를 맛볼 시간! 신문 사설, 학술 논문, 문학 작품에서 볼 수 있는 고급 표현들이에요. 이것까지 마스터하면 당신도 일본어의 달인!"
                },
                {
                    type: 'list',
                    items: [
                        "📚 ～にかけては (~에 관해서는 최고)",
                        "   <ruby>料理<rt>りょうり</rt></ruby>にかけては<ruby>彼女<rt>かのじょ</rt></ruby>の<ruby>右<rt>みぎ</rt></ruby>に<ruby>出<rt>で</rt></ruby>る<ruby>者<rt>もの</rt></ruby>はいない",
                        "   (요리에 관해서는 그녀를 따라올 자가 없다)",
                        "🎭 ～ともなると/～ともなれば (~쯤 되면)",
                        "   <ruby>社長<rt>しゃちょう</rt></ruby>ともなると<ruby>責任<rt>せきにん</rt></ruby>が<ruby>重<rt>おも</rt></ruby>い",
                        "   (사장이 되면 책임이 무겁다)",
                        "⚖️ ～をもって (~로써, ~를 기해)",
                        "   <ruby>本日<rt>ほんじつ</rt></ruby>をもって<ruby>閉店<rt>へいてん</rt></ruby>いたします",
                        "   (금일을 기해 폐점합니다. - 격식)"
                    ]
                }
            ],
            [ // 페이지 2
                {
                    type: 'heading',
                    content: '📰 신문/뉴스 필수 표현'
                },
                {
                    type: 'list',
                    items: [
                        "～かたわら (한편으로는)",
                        "～を<ruby>皮切<rt>かわき</rt></ruby>りに (~를 시작으로)",
                        "～を<ruby>踏<rt>ふ</rt></ruby>まえて (~를 근거로 하여, 입각하여)",
                        "～ならまだしも (~라면 또 몰라도)",
                        "～を<ruby>余儀<rt>よぎ</rt></ruby>なくされる (~를 어쩔 수 없이 하게 되다)"
                    ]
                }
            ],
            [ // 페이지 3
                {
                    type: 'example',
                    items: [
                        { de: "<ruby>彼<rt>かれ</rt></ruby>は<ruby>仕事<rt>しごと</rt></ruby>にかけては<ruby>誰<rt>だれ</rt></ruby>にも<ruby>負<rt>ま</rt></ruby>けない。", ko: "그는 일에 관해서는 누구에게도 지지 않는다." },
                        { de: "<ruby>春<rt>はる</rt></ruby>ともなれば<ruby>桜<rt>さくら</rt></ruby>が<ruby>咲<rt>さ</rt></ruby>き<ruby>始<rt>はじ</rt></ruby>める。", ko: "봄이 되면 으레 벚꽃이 피기 시작한다." },
                        { de: "これをもって<ruby>会議<rt>かいぎ</rt></ruby>を<ruby>終<rt>お</rt></ruby>わります。", ko: "이것으로 회의를 마치겠습니다." }
                    ]
                }
            ]
        ],
        questions: [
            {
                stem: "スポーツ___は<ruby>自信<rt>じしん</rt></ruby>がある。",
                options: ["にかけて", "にとって", "について"],
                answer: "にかけて",
                explanation: "'~에 관해서는 (누구에게도 지지 않는다)'는 의미로, 특정 분야의 실력을 강조할 때 사용해요!"
            },
            {
                stem: "<ruby>大臣<rt>だいじん</rt></ruby>___、その<ruby>発言<rt>はつげん</rt></ruby>は<ruby>問題<rt>もんだい</rt></ruby>だ。",
                options: ["ともなると", "とともに", "といえば"],
                answer: "ともなると",
                explanation: "'~쯤 되는 높은 지위의 사람이 되면' 이라는 의미로, 지위나 상황의 변화를 나타낼 때 사용해요!"
            }
        ]
    }
];
