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
    this.filePath = path.join(process.cwd(), 'claude-usage.json')
  }
  
  async getUsage(): Promise<UsageData> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8')
      const usage = JSON.parse(data)
      
      // Reset monthly totals if new month, but preserve all-time totals
      const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
      if (usage.currentMonth !== currentMonth) {
        return this.resetMonth(currentMonth, usage)
      }
      
      return usage
    } catch (error) {
      // Initialize if file doesn't exist
      return this.resetMonth(new Date().toISOString().substring(0, 7))
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
    await fs.writeFile(this.filePath, JSON.stringify(usage, null, 2), 'utf-8')
  }
  
  async trackUsage(inputTokens: number, outputTokens: number): Promise<UsageData> {
    const usage = await this.getUsage()
    
    // Claude 3.5 Sonnet pricing: $3/1M input, $15/1M output
    const inputCost = (inputTokens / 1000000) * 3
    const outputCost = (outputTokens / 1000000) * 15
    const totalCost = inputCost + outputCost
    
    usage.totalInputTokens += inputTokens
    usage.totalOutputTokens += outputTokens
    usage.totalCostDollars += totalCost
    usage.allTimeInputTokens += inputTokens
    usage.allTimeOutputTokens += outputTokens
    usage.allTimeCostDollars += totalCost
    
    await this.saveUsage(usage)
    return usage
  }
  
  formatUsageString(usage: UsageData): string {
    return `💰 Claude Usage: This month: $${usage.totalCostDollars.toFixed(4)} | All-time: $${usage.allTimeCostDollars.toFixed(4)}`
  }
}