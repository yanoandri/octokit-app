import fs from 'fs';
import XLSX from 'xlsx';
import { Octokit } from "@octokit/core";
import 'dotenv/config';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const workbook = XLSX.readFile('./issues/issues-2025-09-23-result.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet);

for (const row of data) {
    const prLink = row['PR Link'];
    if (prLink) {
        const issueNumber = prLink.split('/').pop();
        const repo = row['Repo'];
        
        try {
            // Close issue
            await octokit.request('PATCH /repos/xendit/{repo}/issues/{issue_number}', {
                repo,
                issue_number: issueNumber,
                state: 'closed'
            });
            
            console.log(`Updated and closed issue #${issueNumber} in ${repo}`);
        } catch (error) {
            console.error(`Error updating issue #${issueNumber} in ${repo}:`, error.message);
        }
    }
}
