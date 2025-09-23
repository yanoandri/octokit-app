import { Octokit } from "@octokit/core";
import 'dotenv/config';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const issues = [
    { repo: 'shopify-integration', number: 548 },
    { repo: 'woocommerce-wp-plugin-va', number: 450 },
    { repo: 'dashboard-ui-api-experience', number: 148 },
    { repo: 'third-party-integration-service', number: 946 },
    { repo: 'shopify-connector', number: 155 },
    { repo: 'shopify-integration', number: 549 },
    { repo: 'third-party-integration-service', number: 947 },
    { repo: 'xendit-regional-dashboard', number: 1051 },
    { repo: 'xendit-dashboard-ui', number: 6621 },
    { repo: 'dashboard-ui-api-experience', number: 149 },
    { repo: 'shopify-integration', number: 550 },
    { repo: 'third-party-integration-service', number: 948 },
    { repo: 'meta-integration', number: 1967 },
    { repo: 'shopify-integration', number: 551 },
    { repo: 'checkout-ui', number: 1777 }
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

for (const issue of issues) {
    try {
        const projectItem = await getIssueProjectItem('xendit', issue.repo, issue.number);
        if (projectItem) {
            await updateProjectV2ItemField(
                projectItem.project.id,
                projectItem.id,
                'PVTSSF_lADOAJQP7c4AbG6AzgRbQrI',
                '98236657'
            );
            console.log(`Updated status to Done for issue #${issue.number} in ${issue.repo}`);
        }
    } catch (error) {
        console.error(`Error updating issue #${issue.number} in ${issue.repo}:`, error.message);
    }
}
