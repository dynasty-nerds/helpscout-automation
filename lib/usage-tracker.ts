import fs from 'fs/promises'
import path from 'path'

interface UsageData {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostDollars: number
  allTimeInputTokens: number
  allTimeOutputTokens: number
  allTimeCostDollars: number
  currentMonth: string
}

export class UsageTracker {
  private filePath: string
  
  constructor() {
    // In production (Vercel), we can't write files, so just track in memory
    // In a real app, you'd use a database or external service
    this.filePath = path.join(process.cwd(), 'claude-usage.json')
  }
  
  async getUsage(): Promise<UsageData> {
    try {
      // Try to read file, but if we can't (like on Vercel), just return defaults
      const data = await fs.readFile(this.filePath, 'utf-8')
      const usage = JSON.parse(data)
      
      // Reset monthly totals if new month, but preserve all-time totals
      const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
      if (usage.currentMonth !== currentMonth) {
        return this.resetMonth(currentMonth, usage)
      }
      
      return usage
    } catch (error) {
      // Initialize with defaults - in production this is always used
      return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostDollars: 0,
        allTimeInputTokens: 0,
        allTimeOutputTokens: 0,
        allTimeCostDollars: 0,
        currentMonth: new Date().toISOString().substring(0, 7)
      }
    }
  }
  
  private async resetMonth(month: string, previousUsage?: any): Promise<UsageData> {
    const usage: UsageData = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostDollars: 0,
      allTimeInputTokens: previousUsage?.allTimeInputTokens || 0,
      allTimeOutputTokens: previousUsage?.allTimeOutputTokens || 0,
      allTimeCostDollars: previousUsage?.allTimeCostDollars || 0,
      currentMonth: month
    }
    await this.saveUsage(usage)
    return usage
  }
  
  private async saveUsage(usage: UsageData): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(usage, null, 2), 'utf-8')
    } catch (error) {
      // Silently fail on Vercel - in production you'd use a database
      console.log('Usage tracking skipped - read-only filesystem')
    }
  }
  
  async trackUsage(inputTokens: number, outputTokens: number): Promise<UsageData> {
    // Claude 3.5 Sonnet pricing: $3/1M input, $15/1M output
    const inputCost = (inputTokens / 1000000) * 3
    const outputCost = (outputTokens / 1000000) * 15
    const totalCost = inputCost + outputCost
    
    // In production, just calculate and return the cost without persistence
    // You would track this in a database in a real application
    return {
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
      totalCostDollars: totalCost,
      allTimeInputTokens: inputTokens,
      allTimeOutputTokens: outputTokens,
      allTimeCostDollars: totalCost,
      currentMonth: new Date().toISOString().substring(0, 7)
    }
  }
  
  formatUsageString(usage: UsageData): string {
    return `💰 Claude Usage: $${usage.totalCostDollars.toFixed(4)} for this request`
  }
}