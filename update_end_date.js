import { Octokit } from "@octokit/core";
import 'dotenv/config';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const issuesWithEndDates = [
    { repo: 'shopify-integration', number: 548, endDate: '2025-09-19' },
    { repo: 'woocommerce-wp-plugin-va', number: 450, endDate: '2025-09-18' },
    { repo: 'dashboard-ui-api-experience', number: 148, endDate: '2025-09-17' },
    { repo: 'third-party-integration-service', number: 946, endDate: '2025-09-16' },
    { repo: 'shopify-connector', number: 155, endDate: '2025-09-15' },
    { repo: 'shopify-integration', number: 549, endDate: '2025-09-16' },
    { repo: 'third-party-integration-service', number: 947, endDate: '2025-09-15' },
    { repo: 'xendit-regional-dashboard', number: 1051, endDate: '2025-09-15' },
    { repo: 'xendit-dashboard-ui', number: 6621, endDate: '2025-09-15' },
    { repo: 'dashboard-ui-api-experience', number: 149, endDate: '2025-09-15' },
    { repo: 'shopify-integration', number: 550, endDate: '2025-09-11' },
    { repo: 'third-party-integration-service', number: 948, endDate: '2025-09-12' },
    { repo: 'meta-integration', number: 1967, endDate: '2025-09-09' },
    { repo: 'shopify-integration', number: 551, endDate: '2025-09-10' },
    { repo: 'checkout-ui', number: 1777, endDate: '2025-09-03' }
];

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
        value: { date: value }
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

for (const issue of issuesWithEndDates) {
    try {
        const projectItem = await getIssueProjectItem('xendit', issue.repo, issue.number);
        if (projectItem) {
            await updateProjectV2ItemField(
                projectItem.project.id,
                projectItem.id,
                'PVTF_lADOAJQP7c4AbG6AzgSNrUo',
                issue.endDate
            );
            console.log(`Updated End Date to ${issue.endDate} for issue #${issue.number} in ${issue.repo}`);
        }
    } catch (error) {
        console.error(`Error updating issue #${issue.number} in ${issue.repo}:`, error.message);
    }
}
