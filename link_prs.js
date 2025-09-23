import { Octokit } from "@octokit/core";
import 'dotenv/config';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const issuePRMappings = [
    { repo: 'woocommerce-wp-plugin-va', issueNumber: 450, prNumber: 449 },
    { repo: 'dashboard-ui-api-experience', issueNumber: 148, prNumber: 147 },
    { repo: 'third-party-integration-service', issueNumber: 946, prNumber: 942 },
    { repo: 'shopify-connector', issueNumber: 155, prNumber: 154 },
    { repo: 'shopify-integration', issueNumber: 549, prNumber: 537 },
    { repo: 'third-party-integration-service', issueNumber: 947, prNumber: 939 },
    { repo: 'xendit-regional-dashboard', issueNumber: 1051, prNumber: 1024 },
    { repo: 'xendit-dashboard-ui', issueNumber: 6621, prNumber: 6593 },
    { repo: 'dashboard-ui-api-experience', issueNumber: 149, prNumber: 146 },
    { repo: 'shopify-integration', issueNumber: 550, prNumber: 535 },
    { repo: 'third-party-integration-service', issueNumber: 948, prNumber: 938 },
    { repo: 'meta-integration', issueNumber: 1967, prNumber: 1966 },
    { repo: 'shopify-integration', issueNumber: 551, prNumber: 531 },
    { repo: 'checkout-ui', issueNumber: 1777, prNumber: 1720 }
];

// All issues including 548 for label removal
const allIssues = [
    { repo: 'shopify-integration', issueNumber: 548 },
    ...issuePRMappings
];

async function linkPRToIssue(owner, repo, issueNumber, prNumber) {
    try {
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner,
            repo,
            issue_number: issueNumber,
            body: `Development: Closes https://github.com/${owner}/${repo}/pull/${prNumber}`
        });
        console.log(`✅ Linked PR #${prNumber} to issue #${issueNumber} in ${repo}`);
    } catch (error) {
        console.error(`❌ Failed to link PR #${prNumber} to issue #${issueNumber} in ${repo}:`, error.message);
    }
}

async function removeLabel(owner, repo, issueNumber, labelId) {
    try {
        await octokit.request('DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}', {
            owner,
            repo,
            issue_number: issueNumber,
            name: labelId
        });
        console.log(`✅ Removed label from issue #${issueNumber} in ${repo}`);
    } catch (error) {
        console.log(`ℹ️  Label not found on issue #${issueNumber} in ${repo} (may not have been added)`);
    }
}

// Link PRs to issues
for (const mapping of issuePRMappings) {
    await linkPRToIssue('xendit', mapping.repo, mapping.issueNumber, mapping.prNumber);
}

// Remove incorrect labels from all issues
for (const issue of allIssues) {
    await removeLabel('xendit', issue.repo, issue.issueNumber, 'PVTSSF_lADOAJQP7c4AbG6AzgRbQrI');
}
