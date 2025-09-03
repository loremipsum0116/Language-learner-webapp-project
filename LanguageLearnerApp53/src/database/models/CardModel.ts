// src/database/models/CardModel.ts
// 학습 카드 데이터 모델

import { BaseModel, BaseRecord } from './BaseModel';
import { database } from '../sqlite/Database';

export interface CardRecord extends BaseRecord {
  vocab_id: number;
  user_id?: number;
  stage: number;
  is_mastered: number;
  master_cycles: number;
  correct_total: number;
  wrong_total: number;
  last_review_at?: string;
  next_review_at?: string;
  waiting_until?: string;
  frozen_until?: string;
  is_overdue: number;
  overdue_deadline?: string;
  is_from_wrong_answer: number;
  mastered_at?: string;
}

export interface CardWithVocab extends CardRecord {
  vocab_lemma: string;
  vocab_pos?: string;
  vocab_definition?: string;
  vocab_example?: string;
  vocab_pronunciation?: string;
  vocab_pronunciation_ko?: string;
}

export interface StudySession {
  due_cards: CardWithVocab[];
  overdue_cards: CardWithVocab[];
  new_cards: CardWithVocab[];
  review_cards: CardWithVocab[];
}

export class CardModel extends BaseModel<CardRecord> {
  constructor() {
    super('cards');
  }

  // Get card with vocabulary information
  async getCardWithVocab(cardId: number): Promise<CardWithVocab | null> {
    try {
      const [result] = await database.executeSql(`
        SELECT 
          c.*,
          v.lemma as vocab_lemma,
          v.pos as vocab_pos,
          v.definition as vocab_definition,
          v.example as vocab_example,
          v.pronunciation as vocab_pronunciation,
          v.pronunciation_ko as vocab_pronunciation_ko
        FROM ${this.tableName} c
        JOIN vocabularies v ON c.vocab_id = v.id
        WHERE c.id = ? AND c.is_deleted = 0
      `, [cardId]);

      if (result.rows.length > 0) {
        return result.rows.item(0) as CardWithVocab;
      }
      return null;
    } catch (error) {
      console.error('Error getting card with vocab:', error);
      throw error;
    }
  }

  // Get cards by vocabulary ID
  async getByVocabId(vocabId: number): Promise<CardRecord[]> {
    return this.findAll({
      where: 'vocab_id = ?',
      params: [vocabId],
    });
  }

  // Get due cards for review
  async getDueCards(limit: number = 20): Promise<CardWithVocab[]> {
    try {
      const now = new Date().toISOString();
      const [result] = await database.executeSql(`
        SELECT 
          c.*,
          v.lemma as vocab_lemma,
          v.pos as vocab_pos,
          v.definition as vocab_definition,
          v.example as vocab_example,
          v.pronunciation as vocab_pronunciation,
          v.pronunciation_ko as vocab_pronunciation_ko
        FROM ${this.tableName} c
        JOIN vocabularies v ON c.vocab_id = v.id
        WHERE c.is_deleted = 0 
          AND c.is_mastered = 0
          AND c.next_review_at IS NOT NULL 
          AND c.next_review_at <= ?
          AND (c.frozen_until IS NULL OR c.frozen_until <= ?)
        ORDER BY c.next_review_at ASC
        LIMIT ?
      `, [now, now, limit]);

      const cards: CardWithVocab[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        cards.push(result.rows.item(i) as CardWithVocab);
      }

      return cards;
    } catch (error) {
      console.error('Error getting due cards:', error);
      throw error;
    }
  }

  // Get overdue cards
  async getOverdueCards(limit: number = 50): Promise<CardWithVocab[]> {
    try {
      const now = new Date().toISOString();
      const [result] = await database.executeSql(`
        SELECT 
          c.*,
          v.lemma as vocab_lemma,
          v.pos as vocab_pos,
          v.definition as vocab_definition,
          v.example as vocab_example,
          v.pronunciation as vocab_pronunciation,
          v.pronunciation_ko as vocab_pronunciation_ko
        FROM ${this.tableName} c
        JOIN vocabularies v ON c.vocab_id = v.id
        WHERE c.is_deleted = 0 
          AND c.is_overdue = 1
          AND (c.overdue_deadline IS NULL OR c.overdue_deadline > ?)
          AND (c.frozen_until IS NULL OR c.frozen_until <= ?)
        ORDER BY c.last_review_at ASC
        LIMIT ?
      `, [now, now, limit]);

      const cards: CardWithVocab[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        cards.push(result.rows.item(i) as CardWithVocab);
      }

      return cards;
    } catch (error) {
      console.error('Error getting overdue cards:', error);
      throw error;
    }
  }

  // Get new cards (never reviewed)
  async getNewCards(limit: number = 10): Promise<CardWithVocab[]> {
    try {
      const [result] = await database.executeSql(`
        SELECT 
          c.*,
          v.lemma as vocab_lemma,
          v.pos as vocab_pos,
          v.definition as vocab_definition,
          v.example as vocab_example,
          v.pronunciation as vocab_pronunciation,
          v.pronunciation_ko as vocab_pronunciation_ko
        FROM ${this.tableName} c
        JOIN vocabularies v ON c.vocab_id = v.id
        WHERE c.is_deleted = 0 
          AND c.stage = 0
          AND c.last_review_at IS NULL
        ORDER BY c.created_at ASC
        LIMIT ?
      `, [limit]);

      const cards: CardWithVocab[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        cards.push(result.rows.item(i) as CardWithVocab);
      }

      return cards;
    } catch (error) {
      console.error('Error getting new cards:', error);
      throw error;
    }
  }

  // Get study session data
  async getStudySession(): Promise<StudySession> {
    try {
      const [dueCards, overdueCards, newCards] = await Promise.all([
        this.getDueCards(),
        this.getOverdueCards(),
        this.getNewCards(),
      ]);

      // Review cards are cards that have been studied before
      const reviewCards = await this.getReviewCards();

      return {
        due_cards: dueCards,
        overdue_cards: overdueCards,
        new_cards: newCards,
        review_cards: reviewCards,
      };
    } catch (error) {
      console.error('Error getting study session:', error);
      throw error;
    }
  }

  // Get review cards (cards with review history)
  async getReviewCards(limit: number = 20): Promise<CardWithVocab[]> {
    try {
      const [result] = await database.executeSql(`
        SELECT 
          c.*,
          v.lemma as vocab_lemma,
          v.pos as vocab_pos,
          v.definition as vocab_definition,
          v.example as vocab_example,
          v.pronunciation as vocab_pronunciation,
          v.pronunciation_ko as vocab_pronunciation_ko
        FROM ${this.tableName} c
        JOIN vocabularies v ON c.vocab_id = v.id
        WHERE c.is_deleted = 0 
          AND c.stage > 0
          AND c.is_mastered = 0
          AND c.last_review_at IS NOT NULL
        ORDER BY c.last_review_at DESC
        LIMIT ?
      `, [limit]);

      const cards: CardWithVocab[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        cards.push(result.rows.item(i) as CardWithVocab);
      }

      return cards;
    } catch (error) {
      console.error('Error getting review cards:', error);
      throw error;
    }
  }

  // Update card after quiz answer
  async updateAfterAnswer(
    cardId: number,
    isCorrect: boolean,
    nextReviewAt?: string
  ): Promise<CardRecord> {
    try {
      const card = await this.findById(cardId);
      if (!card) {
        throw new Error(`Card with ID ${cardId} not found`);
      }

      const now = new Date().toISOString();
      let newStage = card.stage;
      let isMastered = card.is_mastered;
      let masterCycles = card.master_cycles;
      let masteredAt = card.mastered_at;

      // Update stage based on answer
      if (isCorrect) {
        newStage = Math.min(card.stage + 1, 6); // Max stage is 6
        
        // Check if card should be mastered (stage 6 with correct answer)
        if (newStage === 6 && !isMastered) {
          isMastered = 1;
          masterCycles = masterCycles + 1;
          masteredAt = now;
        }
      } else {
        // Reset stage on wrong answer, but keep some progress
        newStage = Math.max(0, Math.floor(card.stage / 2));
      }

      const updateData: Partial<CardRecord> = {
        stage: newStage,
        is_mastered: isMastered,
        master_cycles: masterCycles,
        mastered_at: masteredAt,
        correct_total: isCorrect ? card.correct_total + 1 : card.correct_total,
        wrong_total: isCorrect ? card.wrong_total : card.wrong_total + 1,
        last_review_at: now,
        next_review_at: nextReviewAt || this.calculateNextReviewDate(newStage),
        is_from_wrong_answer: isCorrect ? 0 : 1,
      };

      return this.update(cardId, updateData);
    } catch (error) {
      console.error('Error updating card after answer:', error);
      throw error;
    }
  }

  // Calculate next review date based on SRS algorithm
  private calculateNextReviewDate(stage: number): string {
    const now = new Date();
    let hoursToAdd = 0;

    // SRS intervals (in hours)
    const intervals = [
      1,    // Stage 0: 1 hour
      4,    // Stage 1: 4 hours
      24,   // Stage 2: 1 day
      72,   // Stage 3: 3 days
      168,  // Stage 4: 1 week
      720,  // Stage 5: 1 month
      2160, // Stage 6: 3 months
    ];

    hoursToAdd = intervals[Math.min(stage, intervals.length - 1)];
    
    now.setHours(now.getHours() + hoursToAdd);
    return now.toISOString();
  }

  // Freeze card (pause review schedule)
  async freezeCard(cardId: number, hours: number = 24): Promise<CardRecord> {
    const frozenUntil = new Date();
    frozenUntil.setHours(frozenUntil.getHours() + hours);

    return this.update(cardId, {
      frozen_until: frozenUntil.toISOString(),
    });
  }

  // Unfreeze card
  async unfreezeCard(cardId: number): Promise<CardRecord> {
    return this.update(cardId, {
      frozen_until: null,
    });
  }

  // Mark card as overdue
  async markAsOverdue(cardId: number, deadlineHours: number = 72): Promise<CardRecord> {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + deadlineHours);

    return this.update(cardId, {
      is_overdue: 1,
      overdue_deadline: deadline.toISOString(),
    });
  }

  // Get card statistics
  async getStatistics(): Promise<{
    total: number;
    mastered: number;
    inProgress: number;
    new: number;
    due: number;
    overdue: number;
    byStage: { [key: number]: number };
    accuracy: number;
  }> {
    try {
      const total = await this.count();
      const mastered = await this.count('is_mastered = 1');
      const inProgress = await this.count('stage > 0 AND is_mastered = 0');
      const newCards = await this.count('stage = 0 AND last_review_at IS NULL');
      
      const now = new Date().toISOString();
      const due = await this.count(
        'next_review_at IS NOT NULL AND next_review_at <= ? AND is_mastered = 0 AND (frozen_until IS NULL OR frozen_until <= ?)',
        [now, now]
      );
      const overdue = await this.count('is_overdue = 1');

      // By stage
      const [stageResult] = await database.executeSql(`
        SELECT stage, COUNT(*) as count 
        FROM ${this.tableName} 
        WHERE is_deleted = 0 
        GROUP BY stage
      `);

      const byStage: { [key: number]: number } = {};
      for (let i = 0; i < stageResult.rows.length; i++) {
        const row = stageResult.rows.item(i);
        byStage[row.stage] = row.count;
      }

      // Accuracy calculation
      const [accuracyResult] = await database.executeSql(`
        SELECT 
          SUM(correct_total) as total_correct,
          SUM(correct_total + wrong_total) as total_attempts
        FROM ${this.tableName}
        WHERE is_deleted = 0 AND (correct_total + wrong_total) > 0
      `);

      const accuracyData = accuracyResult.rows.item(0);
      const accuracy = accuracyData.total_attempts > 0 
        ? (accuracyData.total_correct / accuracyData.total_attempts) * 100 
        : 0;

      return {
        total,
        mastered,
        inProgress,
        new: newCards,
        due,
        overdue,
        byStage,
        accuracy: Math.round(accuracy * 100) / 100,
      };
    } catch (error) {
      console.error('Error getting card statistics:', error);
      throw error;
    }
  }

  // Reset card progress
  async resetCard(cardId: number): Promise<CardRecord> {
    return this.update(cardId, {
      stage: 0,
      is_mastered: 0,
      master_cycles: 0,
      correct_total: 0,
      wrong_total: 0,
      last_review_at: null,
      next_review_at: null,
      waiting_until: null,
      frozen_until: null,
      is_overdue: 0,
      overdue_deadline: null,
      is_from_wrong_answer: 0,
      mastered_at: null,
    });
  }

  // Bulk create cards for vocabularies
  async createCardsForVocabularies(vocabIds: number[], userId?: number): Promise<void> {
    const cardData = vocabIds.map(vocabId => ({
      vocab_id: vocabId,
      user_id: userId,
      stage: 0,
      is_mastered: 0,
      master_cycles: 0,
      correct_total: 0,
      wrong_total: 0,
      is_overdue: 0,
      is_from_wrong_answer: 0,
    }));

    await this.batchInsert(cardData);
  }
}

// Export singleton instance
export const cardModel = new CardModel();
export default CardModel;