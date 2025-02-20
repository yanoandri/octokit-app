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
            title: row['Title'],
            body: row['Body'],
            assignees: row['Assignees'],
            status: row['Status'],
            domain: row['Domain'],
            impactType: row['Impact Type'],
            priority: row['Priority'],
            urgency: row['Urgency'],
            effort: row['Effort'],
            startDate: row['Start Date'],
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

        const { domain, impactType, priority, urgency, effort } = description;

        const payload = {
            'Domain': domain,
            'Status': STATUS.TO_DO,
            'Impact Type': impactType,
            'Priority': priority,
            'Urgency': urgency,
            'Effort': effort,
            'Start Date': description.startDate ? description.startDate : new Date().toISOString()
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
    const assignedIssues = [];
    for (const issue of issues) {
        const newIssue = issue;
        const status = issue.status;

        if (status === STATUS.DONE) {
            continue;
        }

        if (status === STATUS.TO_DO) {
           const { owner, repo, title, body, domain, impactType, priority, urgency, effort } = issue;

           const request = {
                owner,
                repo,
                title,
                body,
                description: {
                    domain,
                    status,
                    impactType,
                    priority,
                    urgency,
                    effort,
                }
            }

            if (issue.assignees) {
                request.assignes = issue.assignees.includes(',') ? issue.assignees.split(',') : [issue.assignees];
            }

            if (issue.startDate && issue.startDate !== '') {
                request.description.startDate = issue.startDate;
            }

            const data = await createIssues(request);

            newIssue.prLink = data.html_url;
            assignedIssues.push(newIssue);
        }
    }

    return assignedIssues;
}

function writeToExcel(data, filePath) {
    const newMappedData = data.map((issue) => {
        return {
            'Repo': issue.repo,
            'Title': issue.title,
            'Body': issue.body,
            'Assignees': issue.assignees,
            'Status': issue.status,
            'Domain': issue.domain,
            'Impact Type': issue.impactType,
            'Priority': issue.priority,
            'Urgency': issue.urgency,
            'Effort': issue.effort,
            'Start Date': issue.startDate,
            'PR Link': issue.prLink,
        }
    });
    const ws = XLSX.utils.json_to_sheet(newMappedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Generated');
    XLSX.writeFile(wb, filePath);
}

(async () => {
    const issues = readAndMergeDescription(process.argv[2]);

    await convertToIssues(issues);

    writeToExcel(issues, process.argv[3]);
})().catch(console.error);