import { Octokit } from "@octokit/core";
import 'dotenv/config';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getProjectFields(projectId) {
    const query = `
    query($projectId: ID!) {
        node(id: $projectId) {
            ... on ProjectV2 {
                fields(first: 50) {
                    nodes {
                        ... on ProjectV2Field {
                            id
                            name
                            dataType
                        }
                        ... on ProjectV2SingleSelectField {
                            id
                            name
                            dataType
                        }
                    }
                }
            }
        }
    }`;

    const response = await octokit.graphql(query, { projectId: process.env.PROJECT_ID });
    return response.node.fields.nodes;
}

const fields = await getProjectFields(process.env.PROJECT_ID);
console.log('Project Fields:');
fields.forEach(field => {
    console.log(`  ${field.name}: ${field.id} (${field.dataType})`);
});
