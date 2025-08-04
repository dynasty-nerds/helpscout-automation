export interface SentimentResult {
  angerScore: number; // 0-100, based on profanity, negative words, caps
  urgencyScore: number; // 0-100, based on urgency keywords, subscription issues
  isAngry: boolean;
  isHighUrgency: boolean;
  isSpam: boolean;
  indicators: {
    hasProfanity: boolean;
    profanityCount: number;
    profanityFound: string[];
    hasNegativeWords: boolean;
    negativeWordCount: number;
    negativeWordsFound: string[];
    negativeContextCount: number;
    negativeContextFound: string[];
    capsRatio: number;
    urgencyKeywords: string[];
    subscriptionMentions: number; // refunds, cancellations, billing issues
    isPoliteRequest: boolean; // uses please, thank you, etc.
    spamIndicatorCount: number;
  };
  categories: string[]; // ['angry', 'subscription-related', 'urgent', 'polite', 'spam']
  issueCategory: 'refund-cancellation' | 'bug-broken' | 'spam' | 'other';
}

export class SentimentAnalyzer {
  private profanityWords = [
    'fuck', 'shit', 'ass', 'bitch', 'cunt', 'piss', 'damn', 'hell',
    'bastard', 'dick', 'pussy', 'cock', 'bullshit', 'asshole',
    'fucking', 'shitty', 'fucked', 'dammit', 'goddamn'
  ];
  
  private negativeWords = [
    'terrible', 'awful', 'horrible', 'disgusting', 'pathetic', 
    'useless', 'worthless', 'garbage', 'trash', 'ridiculous',
    'bad', 'poor', 'worst', 'sucks', 'crap', 'stupid', 'dumb',
    'idiotic', 'incompetent', 'unprofessional', 'unacceptable',
    'disappointed', 'frustrating', 'annoying', 'irritating',
    'sick of', 'tired of', 'fed up', 'enough', 'done with'
  ];
  
  private negativeContextPhrases = [
    'bad service', 'terrible service', 'awful service', 'poor service',
    'bad customer service', 'terrible customer service', 'poor customer service',
    'bad app', 'terrible app', 'awful app', 'broken app',
    'bad company', 'terrible company', 'worst company',
    'bad support', 'terrible support', 'no support',
    'bad experience', 'terrible experience', 'awful experience'
  ];

  private urgencyKeywords = [
    'immediately', 'now', 'asap', 'urgent', 'emergency', 'right away',
    'today', 'unacceptable', 'outrageous', 'ridiculous', 'frustrated',
    'angry', 'furious', 'livid', 'pissed', 'disappointed', 'disgusted',
    'right now', 'hurry', 'quickly', 'fast', 'need help', 'help me',
    'still waiting', 'been waiting', 'no response', 'ignored'
  ];

  private insultKeywords = [
    "don't know how to do", "dont know how to do", "incompetent", 
    "you're stupid", "youre stupid", "this is ridiculous", "this is absurd",
    "waste of time", "waste of money", "scam", "fraud", "joke",
    "worst service", "terrible service", "horrible service", "pathetic service",
    "you people", "you guys are", "no idea what"
  ];

  private subscriptionKeywords = [
    'refund', 'money back', 'charge back', 'chargeback', 'reimburse',
    'reimbursement', 'cancel subscription', 'cancel', 'cancellation', 
    'unsubscribe', 'stop subscription', 'end subscription', 'terminate', 
    'want to cancel', 'cancel my account', 'stop billing', 'stop charging', 
    'close account', 'delete account', 'billing issue', 'payment problem',
    'charged', 'subscription', 'membership'
  ];
  
  private politeWords = [
    'please', 'thank you', 'thanks', 'appreciate', 'kindly', 'would you',
    'could you', 'if possible', 'when you get a chance', 'sorry'
  ];
  
  private spamIndicators = [
    'guest post', 'sponsored post', 'article contribution', 'posting an article',
    'post my article', 'dofollow', 'backlink', 'link building', 'seo',
    'editorial team', 'advertising cost', 'article proposal', 'tell me the price',
    'what is the cost', 'interested in posting', 'accept guest post',
    'quality content', 'engaging articles', 'trusted source'
  ];

  analyze(text: string): SentimentResult {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    // Check for profanity and capture matches with context
    const profanityFound: string[] = []
    this.profanityWords.forEach(word => {
      if (lowerText.includes(word)) {
        // Find the word in context (up to 30 chars before and after)
        const index = text.toLowerCase().indexOf(word)
        const start = Math.max(0, index - 30)
        const end = Math.min(text.length, index + word.length + 30)
        const context = text.substring(start, end).trim()
        if (!profanityFound.some(p => p.includes(context))) { // Avoid duplicates
          profanityFound.push(`"...${context}..."`)
        }
      }
    });
    const hasProfanity = profanityFound.length > 0;
    
    // Calculate capitalization ratio
    const capsRatio = this.calculateCapsRatio(text);
    
    // Find urgency keywords
    const foundUrgencyKeywords = this.urgencyKeywords.filter(keyword =>
      lowerText.includes(keyword)
    );
    
    // Count subscription/billing mentions
    const subscriptionMentions = this.subscriptionKeywords.filter(keyword =>
      lowerText.includes(keyword)
    ).length;
    
    // Check for politeness
    const isPoliteRequest = this.politeWords.some(word =>
      lowerText.includes(word)
    );
    
    // Check for spam
    const spamCount = this.spamIndicators.filter(indicator =>
      lowerText.includes(indicator)
    ).length;
    const isSpam = spamCount >= 2 || lowerText.includes('guest post') || lowerText.includes('sponsored post');
    
    // Count profanity occurrences
    const profanityCount = this.profanityWords.filter(word =>
      lowerText.includes(word)
    ).length;
    
    // Count negative words and capture them
    const negativeWordsFound: string[] = []
    this.negativeWords.forEach(word => {
      if (lowerText.includes(word)) {
        const index = text.toLowerCase().indexOf(word)
        const start = Math.max(0, index - 20)
        const end = Math.min(text.length, index + word.length + 20)
        const context = text.substring(start, end).trim()
        if (!negativeWordsFound.some(p => p.includes(context))) {
          negativeWordsFound.push(`"...${context}..."`)
        }
      }
    });
    const negativeWordCount = negativeWordsFound.length;
    
    // Check for negative context phrases (bad service, etc.)
    const negativeContextFound: string[] = []
    this.negativeContextPhrases.forEach(phrase => {
      if (lowerText.includes(phrase)) {
        const index = text.toLowerCase().indexOf(phrase)
        const start = Math.max(0, index - 10)
        const end = Math.min(text.length, index + phrase.length + 10)
        const context = text.substring(start, end).trim()
        if (!negativeContextFound.some(p => p.includes(context))) {
          negativeContextFound.push(`"...${context}..."`)
        }
      }
    });
    const negativeContextCount = negativeContextFound.length;
    
    // Calculate ANGER score (profanity, negative words, shouting, insults)
    let angerScore = 0;
    
    // Profanity is strong indicator of anger
    if (hasProfanity) {
      angerScore += 30 + (profanityCount * 15);
    }
    
    // Negative words and context
    angerScore += negativeWordCount * 5;
    angerScore += negativeContextCount * 15;
    
    // High caps ratio indicates shouting
    if (capsRatio > 0.5) angerScore += 30;
    else if (capsRatio > 0.3) angerScore += 20;
    
    // Check for insults
    const foundInsults = this.insultKeywords.filter(keyword =>
      lowerText.includes(keyword)
    ).length;
    angerScore += foundInsults * 20;
    
    // Multiple exclamation marks
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 3) angerScore += 15;
    
    // If polite, reduce anger score
    if (isPoliteRequest && angerScore > 0) {
      angerScore = Math.max(0, angerScore - 20);
    }
    
    angerScore = Math.min(100, angerScore);
    
    // Calculate URGENCY score (subscription issues, urgency keywords, multiple attempts)
    let urgencyScore = 0;
    
    // Subscription/billing issues are always urgent
    if (subscriptionMentions > 0) {
      urgencyScore += 40 + (subscriptionMentions * 10);
    }
    
    // Urgency keywords
    urgencyScore += foundUrgencyKeywords.length * 15;
    
    // If they mention being charged, paying for service, or waiting long
    if (lowerText.includes('still being charged') || lowerText.includes('months ago') || 
        lowerText.includes('weeks ago') || lowerText.includes('multiple times') ||
        lowerText.includes('paying for') || lowerText.includes('i\'m paying') ||
        lowerText.includes('not heard back') || lowerText.includes('no response') ||
        lowerText.includes('still have not heard')) {
      urgencyScore += 30;
    }
    
    // Check for words in ALL CAPS (excluding common abbreviations)
    const allCapsWords = text.match(/\b[A-Z]{2,}\b/g) || [];
    const nonAbbrevCaps = allCapsWords.filter(word => 
      !['GM', 'API', 'FAQ', 'URL', 'ID', 'UI', 'SEO', 'CEO', 'USA', 'UK', 'MFL', 'NFL'].includes(word) &&
      word.length > 2
    );
    if (nonAbbrevCaps.length > 0) {
      angerScore += 10 * nonAbbrevCaps.length;
      urgencyScore += 10 * nonAbbrevCaps.length;
    }
    
    // If angry, it's also urgent
    if (angerScore > 50) {
      urgencyScore = Math.max(urgencyScore, 60);
    }
    
    urgencyScore = Math.min(100, urgencyScore);
    
    // Determine categories
    const categories: string[] = [];
    if (isSpam) categories.push('spam');
    if (angerScore >= 40) categories.push('angry');
    if (subscriptionMentions > 0) categories.push('subscription-related');
    if (urgencyScore >= 50) categories.push('urgent');
    if (isPoliteRequest) categories.push('polite');
    
    // Determine issue category
    let issueCategory: 'refund-cancellation' | 'bug-broken' | 'spam' | 'other' = 'other';
    if (isSpam) {
      issueCategory = 'spam';
    } else if (subscriptionMentions > 0 || lowerText.includes('refund') || lowerText.includes('cancel') || 
               lowerText.includes('billing') || lowerText.includes('charged')) {
      issueCategory = 'refund-cancellation';
    } else if (lowerText.includes('not working') || lowerText.includes('broken') || lowerText.includes('bug') ||
               lowerText.includes('error') || lowerText.includes('issue') || lowerText.includes('problem') ||
               lowerText.includes('doesn\'t work') || lowerText.includes('cant ') || lowerText.includes('can\'t ')) {
      issueCategory = 'bug-broken';
    }
    
    return {
      angerScore,
      urgencyScore,
      isAngry: angerScore >= 40,
      isHighUrgency: urgencyScore >= 50,
      isSpam,
      indicators: {
        hasProfanity,
        profanityCount,
        profanityFound,
        hasNegativeWords: negativeWordCount > 0 || negativeContextCount > 0,
        negativeWordCount,
        negativeWordsFound,
        negativeContextCount,
        negativeContextFound,
        capsRatio,
        urgencyKeywords: foundUrgencyKeywords,
        subscriptionMentions,
        isPoliteRequest,
        spamIndicatorCount: spamCount
      },
      categories,
      issueCategory
    };
  }
  
  private calculateCapsRatio(text: string): number {
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return 0;
    
    const upperCount = letters.replace(/[^A-Z]/g, '').length;
    return upperCount / letters.length;
  }
}