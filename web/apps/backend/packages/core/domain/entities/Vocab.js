// packages/core/domain/entities/Vocab.js
class Vocab {
  constructor({
    id,
    lemma,
    pos,
    plural = null,
    levelCEFR,
    levelJLPT = null,
    frequency = null,
    source = null,
    koGloss = null,
    dictEntry = null
  }) {
    this.id = id;
    this.lemma = lemma;
    this.pos = pos; // part of speech
    this.plural = plural;
    this.levelCEFR = levelCEFR;
    this.levelJLPT = levelJLPT; // JLPT level (N1-N5)
    this.frequency = frequency;
    this.source = source;
    this.koGloss = koGloss; // Korean translation
    this.dictEntry = dictEntry;
  }

  // Domain business rules
  isIdiom() {
    return this.source === 'idiom' || this.source === 'idiom_migration';
  }

  isPhrasalVerb() {
    return this.pos === 'phrasal_verb';
  }

  isJapanese() {
    return this.levelJLPT || this.source === 'jlpt';
  }

  hasAudio() {
    return this.dictEntry?.audioLocal || this.dictEntry?.audioUrl;
  }

  getDefinition(language = 'ko') {
    if (!this.dictEntry?.examples) return null;
    
    const examples = Array.isArray(this.dictEntry.examples) 
      ? this.dictEntry.examples 
      : JSON.parse(this.dictEntry.examples);
    
    const glossExample = examples.find(ex => ex.kind === 'gloss');
    return glossExample?.[language] || null;
  }

  getExampleSentence(language = 'en') {
    if (!this.dictEntry?.examples) return null;
    
    const examples = Array.isArray(this.dictEntry.examples) 
      ? this.dictEntry.examples 
      : JSON.parse(this.dictEntry.examples);
    
    const sentenceExample = examples.find(ex => ex.kind === 'example');
    return sentenceExample?.[language] || null;
  }

  // Value object for difficulty assessment
  getDifficultyLevel() {
    const levelOrder = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
    return levelOrder[this.levelCEFR] || 1;
  }

  // Business rule: Can this vocab be used in SRS?
  isSrsEligible() {
    return this.lemma && this.lemma.trim().length > 0 && this.pos;
  }

  toString() {
    return `${this.lemma} (${this.pos}) [${this.levelCEFR}]`;
  }
}

module.exports = Vocab;