const fs = require('fs');
let content = fs.readFileSync('app/projects/page.tsx', 'utf8');

// 1. Add import
content = content.replace(
    /import { useProjects } from "\.\.\/providers\/projects-store";/,
    'import { useProjects } from "../providers/projects-store";\nimport ProjectDetailModal from "../components/ProjectDetailModal";'
);

// 2. Remove Procure Options, ProcureItemsBlock, Helpers
content = content.replace(
    /\/\/ --- Procurement Options ---[\s\S]*?export default function ProjectsPage\(\) {/,
    'export default function ProjectsPage() {'
);

// 3. Remove Modal states inside ProjectsPage
// from draggedStepIndex to detailActiveTab
content = content.replace(
    /\/\/ Drag and Drop state[\s\S]*?\/\/ --- Create Wizard State ---/,
    '// --- Create Wizard State ---'
);

// 4. Update Read URL params to open the modal correctly (keeping it in ProjectsPage)
// Actually wait! The URL params read logic needs `focusStepId` and `defaultTab` which we should pass to the Modal.
// Instead of hardcoding, I'll delete the original URL logic and write a cleaner one later if needed, but for now let's just use string replace.

// 5. Remove helper functions inside ProjectsPage
content = content.replace(
    /const recalculateProjectDates = \([\s\S]*?\/\/ Filter out available nodes to add \(not currently in steps\)/,
    '// Filter out available nodes to add (not currently in steps)'
);

// Remove the remaining modal handlers
content = content.replace(
    /    const handleUpdateStep = \([\s\S]*?    const handleToggleImportant = \(/,
    '    const handleToggleImportant = ('
);

// 6. Replace the modals JSX
content = content.replace(
    /{\/\* 第二層彈窗 \(20 步詳細資訊與編輯\) \*\/}[\s\S]*?{\/\* Create Project Wizard \*\/}/,
    `{/* Project Detail Modal */}
            <ProjectDetailModal 
                isOpen={showDetailModal} 
                onClose={() => setShowDetailModal(false)}
                selectedProjectId={selectedProjectId}
                focusStepId={null}
                defaultTab={detailActiveTab}
            />\n\n            {/* Create Project Wizard */}`
);

fs.writeFileSync('app/projects/page.tsx', content);
