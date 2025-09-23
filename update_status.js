import fs from 'fs';
import XLSX from 'xlsx';
import { Octokit } from "@octokit/core";
import 'dotenv/config';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function updateProjectV2ItemField(projectId, itemId, fieldId, value) {
    const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value}) {
            projectV2Item {
                id
            }
        }
    }`;

    await octokit.graphql(mutation, {
        projectId,
        itemId,
        fieldId,
        value: { singleSelectOptionId: value }
    });
}

async function getIssueProjectItem(owner, repo, issueNumber) {
    const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
                id
                projectItems(first: 10) {
                    nodes {
                        id
                        project {
                            id
                        }
                    }
                }
            }
        }
    }`;

    const response = await octokit.graphql(query, { owner, repo, issueNumber });
    return response.repository.issue.projectItems.nodes[0];
}

// Read the updated Excel file that should contain PR Links
const workbook = XLSX.readFile('./issues/issues-2025-09-23.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet);

for (const row of data) {
    const prLink = row['PR Link'];
    if (prLink) {
        const issueNumber = parseInt(prLink.split('/').pop());
        const repo = row['Repo'];
        
        try {
            const projectItem = await getIssueProjectItem('xendit', repo, issueNumber);
            if (projectItem) {
                await updateProjectV2ItemField(
                    projectItem.project.id,
                    projectItem.id,
                    'PVTSSF_lADOAJQP7c4AbG6AzgRbQrI',
                    '98236657'
                );
                console.log(`Updated status to Done for issue #${issueNumber} in ${repo}`);
            }
        } catch (error) {
            console.error(`Error updating issue #${issueNumber} in ${repo}:`, error.message);
        }
    }
}
