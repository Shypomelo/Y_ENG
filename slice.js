const fs = require('fs');
let content = fs.readFileSync('app/components/ProjectDetailModal.tsx', 'utf8');

// Replace the JSX from return ( up to the start of the second layer modal
content = content.replace(
    /return \([\s\S]*?{\/\* 第二層彈窗 \(20 步詳細資訊與編輯\) \*\/}\n\s*{showDetailModal && selectedProject && \(/,
    `if (!isOpen || !selectedProject) return null;
    const availableNodesToAdd = flowTemplate.filter(node => !selectedProject.steps.some(s => s.id === node.id) && !node.is_archived);

    return (
        <>
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 py-8 sm:p-6 overflow-y-auto">`
);

// Clean up the end of the file (remove Close details and Wizard Modals)
content = content.replace(
    /{\/\* C\) 結案彈窗 \*\/}[\s\S]*/,
    `        </>
    );
}`
);

// Delete unused handlers
content = content.replace(
    /const handleCloseProject = \(\) => {[\s\S]*?const handleWizardRemoveStep = \(stepId: string\) => {[\s\S]*?};/g,
    ''
);

content = content.replace(/setShowDetailModal\(false\)/g, 'onClose()');

fs.writeFileSync('app/components/ProjectDetailModal.tsx', content);
