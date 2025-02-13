import 'dotenv/config';
import { Octokit } from "@octokit/core";
import open from 'open';
import XLSX from 'xlsx';
import { mandatoryInfo } from './field.js';

const STATUS = {
    DONE: 'Done',
    IN_PROGRESS: 'In Progress',
    TO_DO: 'Ready Todo',
}

function readAndMergeDescription(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // assuming data is in the second sheet
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    return data.map((row) => {
        return {
            owner: 'xendit',
            repo: row['Repo'],
            title: row['Next Action'],
            body: row['Next Action'],
            decision: row['Decision'],
            status: row['Status']
        }
    });
}

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

async function openSSOUrl(error, callback) {
    const ssoUrl = error.response.headers['x-github-sso'].replace('required; url=', '');
    await open(ssoUrl);
    await callback;
}

async function getIssues(owner, repo, issueNumber) {
    const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
                id
                title
                body
                state
                labels(first: 10) {
                    nodes {
                        id
                        name
                    }
                }
                projectItems(first: 10) {
                    nodes {
                        id
                        project {
                            id
                            title
                        }
                        fieldValues(first: 100) {
                            nodes {
                                ... on ProjectV2ItemFieldTextValue {
                                    field {
                                        ... on ProjectV2FieldCommon {
                                            id
                                            name
                                        }
                                    }
                                    text
                                }
                                ... on ProjectV2ItemFieldNumberValue {
                                    field {
                                        ... on ProjectV2FieldCommon {
                                            id
                                            name
                                        }
                                    }
                                    number
                                }
                                ... on ProjectV2ItemFieldSingleSelectValue {
                                    field {
                                        ... on ProjectV2SingleSelectField {
                                            id
                                            name
                                            options {
                                                id
                                                name
                                            }
                                        }
                                    }
                                    name
                                    optionId
                                }
                                ... on ProjectV2ItemFieldDateValue {
                                    field {
                                        ... on ProjectV2FieldCommon {
                                            id
                                            name
                                        }
                                    }
                                    date
                                }
                                ... on ProjectV2ItemFieldIterationValue {
                                    field {
                                        ... on ProjectV2FieldCommon {
                                            id
                                            name
                                        }
                                    }
                                    title
                                }
                            }
                        }
                    }
                }
            }
        }
    }`;

    const variables = {
        owner,
        repo,
        issueNumber
    };

    try {
        const response = await octokit.graphql(query, variables);
        return response.repository.issue;
    } catch (error) {
        if (error.response?.status === 403) {
            await openSSOUrl(error, getIssues(owner, repo, issueNumber));
        } else {
            console.error('Error fetching issue:', error);
        }
    }
}

async function updateProjectV2ItemField(projectId, itemId, key, value) {
    let newValue;
    const fieldSelector = mandatoryInfo.fields.find(data => data.name === key)

    if (!fieldSelector) {
        throw new Error('Field doesn\'t exists');
    }

    if (fieldSelector && fieldSelector.options) {
        const option = fieldSelector.options.find(option => option.name === value);
        if (!option) {
            throw new Error(`Option '${value}' not found for field '${key}'`);
        }
        newValue = { singleSelectOptionId: option.id }
    
    } else if (key === 'Start Date') {
         // Handle date fields - ensure date is in ISO 8601 format
         const date = new Date(value);
         newValue = { date: date.toISOString() };
    } else {
        newValue = { text: value }
    }

    const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(
            input: {
                projectId: $projectId,
                itemId: $itemId,
                fieldId: $fieldId,
                value: $value
            }
        ) {
            projectV2Item {
                id
            }
        }
    }`;

    const variables = {
        projectId,
        itemId,
        fieldId: fieldSelector.id,
        value: newValue
    };

    let response;
    try {
        response = await octokit.graphql(mutation, variables);
    } catch (error) {
        console.error('Error updating project field:', error);
        if (error.response?.status === 403) {
            await openSSOUrl(error, () => updateProjectV2ItemField(projectId, itemId, fieldId, value));
        } else {
            console.log(error);
        }
    }
    return response;
}

async function assignProjectToIssue(projectId, contentId) {
    const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
            item {
                id
            }
        }
    }
    `;

    const variables = {
        projectId,
        contentId
    };

    let response;
    try {
        response = await octokit.graphql(mutation, variables);
    } catch (error) {
        console.error('Error assigning issue to project:', error);
        if (error.response.status && error.response.status === 403) {
            await openSSOUrl(error, assignProjectToIssue(projectId, contentId));
        } else {
            console.log(error);
        }
    }

    return response;
}

async function createIssues({ owner, repo, title, body, assignes, description }) {
    try {
        const newAssignes = [];
        const parent = {
            owner,
            repo,
            title,
            body,
        }

        const { data } = await octokit.request(`POST /repos/{owner}/{repo}/issues`, parent);

        if (assignes && Array.isArray(assignes) && assignes.length > 0) {
            newAssignes.push(...assignes);

            await octokit.request(`POST /repos/{owner}/{repo}/issues/{issue_number}/assignees`, {
                owner,
                repo,
                issue_number: data.number,
                assignees: newAssignes
            });
        }

        const response = await getIssues(owner, repo, data.number);

        const { addProjectV2ItemById: { item: { id } } } = await assignProjectToIssue(mandatoryInfo.project.id, response.id);

        const payload = {
            'Domain': description['Domain'],
            'Status': STATUS.TO_DO,
            'Impact Type': description['Impact Type'],
            'Priority': description['Priority'],
            'Urgency': description['Urgency'],
            'Effort': description['Effort'],
            'Start Date': description['Start Date'] ? description['Start Date'] : new Date().toISOString()
        }

        for (const [key, value] of Object.entries(payload)) {
            await updateProjectV2ItemField(mandatoryInfo.project.id, id, key, value)
        }
        console.log('Issue created successfully: ', data.html_url);

        return data;
    } catch (error) {
        console.error('Error creating issue:', error);
        if (error.response.status && error.response.status === 403) {
            await openSSOUrl(error, createIssues({ owner, repo, title, body }));
        } else {
            console.log(error);
        }
    }

}

async function convertToIssues(issues) {
    for (const issue of issues) {
        const status = issue.status;

        if (status === STATUS.DONE) {
            continue;
        }

        if (status === STATUS.TO_DO) {
           const request = {
                owner: issue.owner,
                repo: issue.repo,
                title: issue.title,
                body: issue.body,
                description: {
                    'Domain': issue['Domain'],
                    'Status': status,
                    'Impact Type': issue['Impact Type'],
                    'Priority': issue['Priority'],
                    'Urgency': issue['Urgency'],
                    'Effort': issue['Effort'],
                }
            }

            if (issue.assignees) {
                request.assignes = issue.assignees.includes(',') ? issue.assignees.split(',') : [issue.assignees];
            }

            if (issue['Start Date'] && issue['Start Date'] !== '') {
                request.description['Start Date'] = issue['Start Date'];
            }

            await createIssues(request);
        }
    }

    return;
}

(async () => {
    const issues = readAndMergeDescription('{replace with your current file}');

    await convertToIssues(issues);
})().catch(console.error);