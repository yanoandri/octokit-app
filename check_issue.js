import { Octokit } from "@octokit/core";
import 'dotenv/config';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function checkIssueFields(owner, repo, issueNumber) {
    const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
                id
                title
                projectItems(first: 10) {
                    nodes {
                        id
                        fieldValues(first: 20) {
                            nodes {
                                ... on ProjectV2ItemFieldTextValue {
                                    text
                                    field {
                                        ... on ProjectV2Field {
                                            name
                                        }
                                    }
                                }
                                ... on ProjectV2ItemFieldDateValue {
                                    date
                                    field {
                                        ... on ProjectV2Field {
                                            name
                                        }
                                    }
                                }
                                ... on ProjectV2ItemFieldSingleSelectValue {
                                    name
                                    field {
                                        ... on ProjectV2SingleSelectField {
                                            name
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }`;

    const response = await octokit.graphql(query, { owner, repo, issueNumber });
    const issue = response.repository.issue;
    
    console.log(`Issue #${issueNumber}: ${issue.title}`);
    
    if (issue.projectItems.nodes.length > 0) {
        const fieldValues = issue.projectItems.nodes[0].fieldValues.nodes;
        fieldValues.forEach(field => {
            if (field.field) {
                const value = field.text || field.date || field.name || 'N/A';
                console.log(`  ${field.field.name}: ${value}`);
            }
        });
    }
}

// Check the first issue
await checkIssueFields('xendit', 'shopify-integration', 548);
