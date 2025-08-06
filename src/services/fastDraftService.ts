import axios from 'axios';

interface FastDraftCode {
  email: string;
  code: string;
  found: boolean;
  error?: string;
}

export class FastDraftService {
  private sheetId: string;
  private sheetUrl: string;

  constructor() {
    // Extract sheet ID from the Google Sheets URL
    // URL format: https://docs.google.com/spreadsheets/d/[SHEET_ID]/...
    this.sheetId = '116aJBf2ljTwyOQmHjr0BJiOHLATL7ynhXRjNYiTuu_A';
    
    // Use Google Sheets CSV export URL for public sheets
    // Specify gid=0 for the first tab (Signups)
    // This allows us to fetch the data without authentication
    this.sheetUrl = `https://docs.google.com/spreadsheets/d/${this.sheetId}/export?format=csv&gid=0`;
  }

  /**
   * Parse CSV data into an array of rows
   */
  private parseCSV(csvText: string): string[][] {
    const lines = csvText.split('\n');
    const result: string[][] = [];
    
    for (const line of lines) {
      if (line.trim()) {
        // Simple CSV parsing - handles basic cases
        // For more complex CSV with quotes and commas in values, we'd need a proper CSV parser
        const values = line.split(',').map(value => value.trim());
        result.push(values);
      }
    }
    
    return result;
  }

  /**
   * Fetch FastDraft code for a given email address
   * Looks up email in column B (index 1) and returns code from column E (index 4)
   */
  async getCodeByEmail(email: string): Promise<FastDraftCode> {
    try {
      console.log(`Fetching FastDraft code for email: ${email}`);
      
      // Fetch the CSV data from the public Google Sheet
      const response = await axios.get(this.sheetUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept': 'text/csv'
        }
      });

      if (!response.data) {
        return {
          email,
          code: '',
          found: false,
          error: 'No data received from Google Sheets'
        };
      }

      // Parse the CSV data
      const rows = this.parseCSV(response.data);
      
      if (rows.length === 0) {
        return {
          email,
          code: '',
          found: false,
          error: 'Google Sheet appears to be empty'
        };
      }

      // Find the row with matching email (case-insensitive)
      // Column B is index 1 (0-based), Column E is index 4
      const emailLower = email.toLowerCase().trim();
      
      for (let i = 1; i < rows.length; i++) { // Start from 1 to skip header row
        const row = rows[i];
        if (row.length > 4) { // Ensure row has at least 5 columns
          const rowEmail = row[1]?.toLowerCase().trim(); // Column B
          if (rowEmail === emailLower) {
            const code = row[4]?.trim() || ''; // Column E
            
            console.log(`Found FastDraft code for ${email}: ${code}`);
            return {
              email,
              code,
              found: true
            };
          }
        }
      }

      console.log(`No FastDraft code found for email: ${email}`);
      return {
        email,
        code: '',
        found: false,
        error: `No code found for email: ${email}`
      };

    } catch (error: any) {
      console.error('Error fetching FastDraft code:', error);
      
      // Handle specific error cases
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return {
          email,
          code: '',
          found: false,
          error: 'Unable to connect to Google Sheets. Please try again later.'
        };
      }
      
      if (error.response?.status === 404) {
        return {
          email,
          code: '',
          found: false,
          error: 'Google Sheet not found or not publicly accessible'
        };
      }
      
      return {
        email,
        code: '',
        found: false,
        error: `Error fetching code: ${error.message}`
      };
    }
  }
}

// Export singleton instance
export const fastDraftService = new FastDraftService();