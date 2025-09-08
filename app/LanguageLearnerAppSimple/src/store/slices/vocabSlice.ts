import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VocabState, Vocab } from '@/types';

const initialState: VocabState = {
  vocabularies: [],
  currentVocab: null,
  isLoading: false,
  error: null,
};

const vocabSlice = createSlice({
  name: 'vocab',
  initialState,
  reducers: {
    fetchVocabStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchVocabSuccess: (state, action: PayloadAction<Vocab[]>) => {
      state.vocabularies = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    fetchVocabFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    setCurrentVocab: (state, action: PayloadAction<Vocab>) => {
      state.currentVocab = action.payload;
    },
    clearCurrentVocab: (state) => {
      state.currentVocab = null;
    },
    addVocab: (state, action: PayloadAction<Vocab>) => {
      state.vocabularies.push(action.payload);
    },
    updateVocab: (state, action: PayloadAction<Vocab>) => {
      const index = state.vocabularies.findIndex(
        vocab => vocab.id === action.payload.id,
      );
      if (index !== -1) {
        state.vocabularies[index] = action.payload;
      }
    },
    removeVocab: (state, action: PayloadAction<number>) => {
      state.vocabularies = state.vocabularies.filter(
        vocab => vocab.id !== action.payload,
      );
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchVocabStart,
  fetchVocabSuccess,
  fetchVocabFailure,
  setCurrentVocab,
  clearCurrentVocab,
  addVocab,
  updateVocab,
  removeVocab,
  clearError,
} = vocabSlice.actions;

export default vocabSlice.reducer;