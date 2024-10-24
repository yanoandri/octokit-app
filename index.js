require('dotenv').config();
import { Octokit } from "@octokit/core";
import open from 'open';
import XLSX from 'xlsx';

const DECISION = {
    DELETED: 'Deleted',
    INTEGRATION_HANDLED: 'Integration Handled',
}

const STATUS = {
    DONE: 'Done',
    IN_PROGRESS: 'In Progress',
    TO_DO: 'To Do',
}

function readAndMergeDescription(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // assuming data is in the second sheet
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    return data.map((row) => {
        // const raw = JSON.parse(row['_raw']);
        // const removeMessage = raw.msg.replace('Error when processing invoice, ', '');
        // const payload = JSON.parse(removeMessage);
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

async function createIssues({ owner, repo, title, body, assignes }) {
    try {
        const newAssignes = [];
        const payload = {
            owner,
            repo,
            title,
            body,
        }

        if (assignes && Array.isArray(assignes) && assignes.length > 0) {
            newAssignes.push(...assignes);
        }

        const { data } = await octokit.request(`POST /repos/{owner}/{repo}/issues`, payload);

        console.log(data);
        console.log('Issue created successfully');

        return data;
    } catch (error) {
        if (error.response.status && error.response.status === 403) {
            await openSSOUrl(error, createIssues({ owner, repo, title, body }));
        } else {
            console.log(error);
        }
    }

}

async function getRepo(owner, repo) {
    try {
        const { data } = await octokit.request(`GET /repos/{owner}/{repo}`, {
            owner,
            repo,
        });

        return data;
    } catch (error) {
        if (error.response.status && error.response.status === 403) {
            await openSSOUrl(error, getRepo(owner, repo));
        } else {
            console.log(error);
        }
    }
}

async function convertToIssues(issues) {
    for (const issue of issues) {
        const status = issue.status;
        const decision = issue.decision;

        if (status === STATUS.DONE) {
            continue;
        }

        if (status === STATUS.TO_DO && decision === DECISION.INTEGRATION_HANDLED) {
            await createIssues({
                owner: issue.owner,
                repo: issue.repo,
                title: issue.title,
                body: issue.body,
                assignes: [] // TBD for assignes
            });
        }
    }

    return;
}

(async () => {
    // await getRepo('xendit', 'third-party-integration-service');
    const issues = readAndMergeDescription('./tpi-ld-flag-removal.xlsx');
    console.log(issues);

    await convertToIssues(issues);
})().catch(console.error);