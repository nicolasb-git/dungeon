const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'style.css'); // Assumes running from root c:\workspace\dungeon

try {
    let css = fs.readFileSync(cssPath, 'utf8');

    // Find the last known good block
    const marker = '.hidden {';
    const markerIndex = css.lastIndexOf(marker);

    if (markerIndex === -1) {
        console.error('Could not find .hidden marker!');
        process.exit(1);
    }

    // Find the closing brace of that block
    const closingBraceIndex = css.indexOf('}', markerIndex);

    if (closingBraceIndex === -1) {
        console.error('Could not find closing brace!');
        process.exit(1);
    }

    // Truncate valid content (keep the })
    const validCss = css.substring(0, closingBraceIndex + 1);

    // New CSS to append
    const newCss = `

/* Pox Effect - Purple Glow (Matches Paralyzed style) */
.entity-player.poxed {
    animation: pulse-purple 1s infinite;
    box-shadow: 0 0 10px 2px #9b59b6;
    /* Purple Glow */
    background-color: rgba(155, 89, 182, 0.3);
}

@keyframes pulse-purple {
    0% {
        box-shadow: 0 0 10px 2px #9b59b6;
    }

    50% {
        box-shadow: 0 0 20px 5px #9b59b6;
    }

    100% {
        box-shadow: 0 0 10px 2px #9b59b6;
    }
}

/* Status Icon for Pox */
.status-icon.poxed {
    color: #9b59b6;
    border-color: #9b59b6;
    background: rgba(155, 89, 182, 0.2);
}
`;

    const finalCss = validCss + newCss;

    fs.writeFileSync(cssPath, finalCss, 'utf8');
    console.log('Successfully repaired style.css');

} catch (err) {
    console.error('Error repairing file:', err);
    process.exit(1);
}
