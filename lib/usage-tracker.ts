import fs from 'fs/promises'
import path from 'path'

interface UsageData {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostDollars: number
  monthlyBudget: number
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
      
      // Reset if new month
      const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
      if (usage.currentMonth !== currentMonth) {
        return this.resetMonth(currentMonth)
      }
      
      return usage
    } catch (error) {
      // Initialize if file doesn't exist
      return this.resetMonth(new Date().toISOString().substring(0, 7))
    }
  }
  
  private async resetMonth(month: string): Promise<UsageData> {
    const usage: UsageData = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostDollars: 0,
      monthlyBudget: 100, // $100/month budget
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
    
    await this.saveUsage(usage)
    return usage
  }
  
  formatUsageString(usage: UsageData): string {
    const percentUsed = (usage.totalCostDollars / usage.monthlyBudget) * 100
    const remaining = usage.monthlyBudget - usage.totalCostDollars
    
    return `💰 Claude Usage: $${usage.totalCostDollars.toFixed(4)} of $${usage.monthlyBudget} (${percentUsed.toFixed(1)}% used) | $${remaining.toFixed(2)} remaining`
  }
}