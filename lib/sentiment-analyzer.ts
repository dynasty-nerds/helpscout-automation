interface SentimentResult {
  score: number; // 0-100, higher = angrier
  indicators: {
    hasProfanity: boolean;
    capsRatio: number;
    urgencyKeywords: string[];
    refundMentions: number;
    cancelMentions: number;
  };
  confidence: 'high' | 'medium' | 'low';
}

export class SentimentAnalyzer {
  private profanityWords = [
    'damn', 'hell', 'crap', 'piss', 'fuck', 'shit', 'ass', 'bitch',
    'bastard', 'stupid', 'idiot', 'suck'
  ];
  
  private negativeWords = [
    'terrible', 'awful', 'horrible', 'disgusting', 'pathetic', 
    'useless', 'worthless', 'garbage', 'trash', 'ridiculous'
  ];

  private urgencyKeywords = [
    'immediately', 'now', 'asap', 'urgent', 'emergency', 'right away',
    'today', 'unacceptable', 'outrageous', 'ridiculous', 'frustrated',
    'angry', 'furious', 'livid', 'pissed', 'disappointed', 'disgusted'
  ];

  private insultKeywords = [
    "don't know how to do", "dont know how to do", "incompetent", 
    "you're stupid", "youre stupid", "this is ridiculous", "this is absurd",
    "waste of time", "waste of money", "scam", "fraud", "joke",
    "worst service", "terrible service", "horrible service", "pathetic service",
    "you people", "you guys are", "no idea what"
  ];

  private refundKeywords = [
    'refund', 'money back', 'charge back', 'chargeback', 'reimburse',
    'reimbursement', 'cancel subscription', 'want my money', 'demand refund',
    'cancel', 'cancellation', 'unsubscribe', 'stop subscription', 
    'end subscription', 'terminate', 'want to cancel', 'cancel my account',
    'stop billing', 'stop charging', 'close account', 'delete account'
  ];

  analyze(text: string): SentimentResult {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    // Check for profanity
    const hasProfanity = this.profanityWords.some(word => 
      lowerText.includes(word)
    );
    
    // Calculate capitalization ratio
    const capsRatio = this.calculateCapsRatio(text);
    
    // Find urgency keywords
    const foundUrgencyKeywords = this.urgencyKeywords.filter(keyword =>
      lowerText.includes(keyword)
    );
    
    // Count refund/cancel mentions
    const refundMentions = this.refundKeywords.filter(keyword =>
      lowerText.includes(keyword)
    ).length;
    
    // Count profanity occurrences
    const profanityCount = this.profanityWords.filter(word =>
      lowerText.includes(word)
    ).length;
    
    // Count negative words (less severe than profanity)
    const negativeWordCount = this.negativeWords.filter(word =>
      lowerText.includes(word)
    ).length;
    
    // Calculate anger score
    let score = 0;
    
    // Profanity adds significant points (more profanity = higher score)
    if (hasProfanity) {
      score += 20 + (profanityCount * 10); // Base 20 + 10 per profanity
    }
    
    // Negative words add moderate points
    score += negativeWordCount * 5;
    
    // High caps ratio indicates shouting
    if (capsRatio > 0.5) score += 25;
    else if (capsRatio > 0.3) score += 15;
    
    // Check for insults about service/competence
    const foundInsults = this.insultKeywords.filter(keyword =>
      lowerText.includes(keyword)
    ).length;
    
    // Urgency keywords
    score += foundUrgencyKeywords.length * 10;
    
    // Insults about service quality
    score += foundInsults * 15;
    
    // Refund/cancel mentions are critical
    score += refundMentions * 20;
    
    // Multiple exclamation marks
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 3) score += 10;
    
    // Cap at 100
    score = Math.min(100, score);
    
    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (score > 70 || (refundMentions > 0 && hasProfanity)) {
      confidence = 'high';
    } else if (score > 40) {
      confidence = 'medium';
    }
    
    return {
      score,
      indicators: {
        hasProfanity,
        capsRatio,
        urgencyKeywords: foundUrgencyKeywords,
        refundMentions,
        cancelMentions: 0
      },
      confidence
    };
  }
  
  private calculateCapsRatio(text: string): number {
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return 0;
    
    const upperCount = letters.replace(/[^A-Z]/g, '').length;
    return upperCount / letters.length;
  }
}