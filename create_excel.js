import fs from 'fs';
import XLSX from 'xlsx';

const prData = JSON.parse(fs.readFileSync('/tmp/yano_prs.json', 'utf8'));
const filteredPRs = prData.filter(pr => pr.repository.name !== 'xendit-argo-catalog');

const excelData = filteredPRs.map(pr => ({
    'Repo': pr.repository.name,
    'Title': pr.title,
    'Body': pr.body || 'No description provided',
    'Assignees': 'yanoandri',
    'Status': 'Ready Todo',
    'Domain': 'TPI',
    'Impact Type': 'Functional',
    'Priority': 'P2',
    'Urgency': 'High',
    'Effort': 'Medium',
    'Start Date': pr.createdAt.split('T')[0],
    'End Date': pr.closedAt.split('T')[0],
    'PR URL': pr.url
}));

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(excelData);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Issues List');
XLSX.writeFile(workbook, './issues/issues-2025-09-23-updated.xlsx');

console.log(`Created Excel with ${excelData.length} PRs including PR URLs`);
