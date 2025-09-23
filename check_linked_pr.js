import { Octokit } from "@octokit/core";
import 'dotenv/config';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function checkIssueWithPRs(owner, repo, issueNumber) {
    const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
                id
                title
                timelineItems(first: 50, itemTypes: [CONNECTED_EVENT, DISCONNECTED_EVENT]) {
                    nodes {
                        ... on ConnectedEvent {
                            subject {
                                ... on PullRequest {
                                    number
                                    title
                                    url
                                }
                            }
                        }
                    }
                }
                projectItems(first: 10) {
                    nodes {
                        id
                        fieldValues(first: 20) {
                            nodes {
                                ... on ProjectV2ItemFieldPullRequestValue {
                                    pullRequests(first: 10) {
                                        nodes {
                                            number
                                            title
                                            url
                                        }
                                    }
                                    field {
                                        ... on ProjectV2Field {
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
    
    // Check timeline for connected PRs
    console.log('\nConnected PRs from timeline:');
    issue.timelineItems.nodes.forEach(item => {
        if (item.subject) {
            console.log(`  PR #${item.subject.number}: ${item.subject.title}`);
            console.log(`  URL: ${item.subject.url}`);
        }
    });
    
    // Check project field for linked PRs
    console.log('\nLinked PRs from project fields:');
    if (issue.projectItems.nodes.length > 0) {
        const fieldValues = issue.projectItems.nodes[0].fieldValues.nodes;
        fieldValues.forEach(field => {
            if (field.pullRequests) {
                console.log(`  Field: ${field.field.name}`);
                field.pullRequests.nodes.forEach(pr => {
                    console.log(`    PR #${pr.number}: ${pr.title}`);
                    console.log(`    URL: ${pr.url}`);
                });
            }
        });
    }
}

await checkIssueWithPRs('xendit', 'shopify-integration', 548);
