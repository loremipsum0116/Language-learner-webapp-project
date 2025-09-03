export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Vocabulary: undefined;
  Quiz: undefined;
  Profile: undefined;
};

export type VocabularyStackParamList = {
  VocabularyList: undefined;
  VocabularyDetail: { vocabId: number };
  VocabularySearch: undefined;
};

export type QuizStackParamList = {
  QuizList: undefined;
  QuizSession: { quizId: string };
  QuizResult: { sessionId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
  Statistics: undefined;
  About: undefined;
};